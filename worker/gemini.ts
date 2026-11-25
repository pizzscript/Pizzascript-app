import { GoogleGenAI } from "@google/genai";
import { DECISION_MODEL, MODEL_CHAINS, MODEL_LIMITS, quotaDayStart, type ModelTier } from "../src/lib/studio/models";
import { aiKeyOwner, geminiKey } from "./connections";
import { db } from "./db";
import { env } from "./env";
import { addUsage, assertAiBudget } from "./usage";

// v1beta: preview models in the backup chain (e.g. 3 Flash) return 404 on the SDK's default version.
// One client per key (a client may bring its own); rebuilt when a key is replaced in the admin panel.
const aiClients = new Map<string, GoogleGenAI>();
const ai = () => {
  const key = geminiKey();
  let client = aiClients.get(key);
  if (!client) {
    if (aiClients.size > 20) aiClients.clear();
    client = new GoogleGenAI({ apiKey: key, apiVersion: "v1beta" });
    aiClients.set(key, client);
  }
  return client;
};

// Per-request timeout: an overloaded model can otherwise leave a request hanging for minutes and block the queue.
// Small jobs (scoring, briefs) should fail over to the next backup quickly; a full article genuinely needs longer.
const TIMEOUT_MS: Record<ModelTier, number> = { writer: 180_000, light: 35_000 };
const GEMMA_TIMEOUT_MS = 120_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAY_MS = 86_400_000;
// Gemma's free tier allows 16K tokens a minute, so long prompts skip it.
const GEMMA_MAX_PROMPT_CHARS = 48_000;

// A depleted billing balance blocks every model on the account at once (HTTP 402, but the body still says
// "RESOURCE_EXHAUSTED" like an ordinary per-model quota error) — it is not worth retrying or trying another model.
// One bad outage once burned 78 requests in 40 minutes this way, cycling the whole chain every call.
// Pauses, billing blocks and pacing belong to a key, so one client's own key never pauses another's.
const billingBlocked = new Map<string, number>();
const BILLING_RECHECK_MS = 5 * 60_000;
const billingBlockedUntil = () => billingBlocked.get(aiKeyOwner()) ?? 0;
const blockBilling = (until: number) => billingBlocked.set(aiKeyOwner(), Math.max(billingBlockedUntil(), until));

function checkBilling() {
  if (Date.now() < billingBlockedUntil()) throw new Error(`Gemini billing is blocked until ${new Date(billingBlockedUntil()).toISOString()}`);
}

/** The API's HTTP status. Other numbers in a message, like a JSON parse position, must never be read as one. */
export function apiStatus(message: string) {
  const match = message.match(/"code":\s*(\d{3})\b/) ?? message.match(/^(?:HTTP|Antigravity)\s+(\d{3})\b/);
  return match ? Number(match[1]) : null;
}

const hasApiStatus = (message: string, status: string) => new RegExp(`"status":\\s*"${status}"`).test(message);

export function isBillingError(message: string) {
  return apiStatus(message) === 402 || /prepayment credits|payment required|billing is blocked/i.test(message);
}

const isQuotaError = (message: string) => apiStatus(message) === 429 || hasApiStatus(message, "RESOURCE_EXHAUSTED");

/** Failures worth another attempt later: quota, overload, timeouts, network errors and billing blocks. */
export function isTransientError(message: string) {
  const status = apiStatus(message);
  return (
    isBillingError(message) ||
    isQuotaError(message) ||
    (status !== null && [408, 500, 502, 503, 504].includes(status)) ||
    ["UNAVAILABLE", "DEADLINE_EXCEEDED", "INTERNAL"].some((s) => hasApiStatus(message, s)) ||
    /ECONNRESET|ETIMEDOUT|fetch failed|operation was aborted|timed out/i.test(message)
  );
}

type Kind = "text" | "json";

export interface CallOptions {
  tier?: ModelTier;
  temperature?: number;
  /** Keeps one article on one model: holds the model in use, and moves only if that model is unavailable. */
  sticky?: { model?: string };
}

/** Logs one Gemini request for the usage panel. tokens = input/prompt tokens only (what Google calls TPM);
 * total = input+output+thinking, for our own cost picture. Never fails the job. */
export function record(model: string, kind: Kind, error?: string, tokens?: number, total?: number) {
  const limit = error?.match(/limit: (\d+)/)?.[1];
  // Google counts failed requests too, so both count against the client's daily budget.
  void addUsage({ ai: 1 });
  db.from("ai_calls")
    .insert({ model, kind, ok: !error, error: error?.slice(0, 500) ?? null, quota_limit: limit === undefined ? null : Number(limit), key_owner: aiKeyOwner(), input_tokens: tokens ?? null, total_tokens: total ?? null })
    .then(({ error: e }) => e && console.warn("[usage] " + e.message));
  if (!error && tokens) void checkTpm(model, tokens);
}

/** One 1-minute-TPM alert per model per day, so a real squeeze is surfaced without repeating every call. */
async function checkTpm(model: string, latestTokens: number) {
  const tpm = MODEL_LIMITS[model]?.tpm;
  if (!tpm) return;
  try {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data } = await db.from("ai_calls").select("input_tokens").eq("model", model).gte("created_at", since);
    // The insert above is fire-and-forget, so this query can race it; count this call's own tokens explicitly.
    const total = latestTokens + (data ?? []).reduce((sum: number, r: { input_tokens: number | null }) => sum + (r.input_tokens ?? 0), 0);
    if (total < tpm * 0.8) return;
    const { raiseSignal, todayIst } = await import("./db");
    await raiseSignal({
      kind: "quality_gate",
      title: `${MODEL_LIMITS[model].label}: token use this minute is near its limit (${Math.round((total / tpm) * 100)}% of ${tpm.toLocaleString("en-US")} TPM). Articles may fail over to a backup model.`,
      detail: { model, tokensThisMinute: total, tpm },
      priority: "P3",
      post_id: null,
      topic_id: null,
      dedupe_key: `tpm:${model}:${todayIst()}`,
    });
  } catch (e) {
    console.warn(`[usage] tpm check: ${e instanceof Error ? e.message : e}`);
  }
}

const nextSlot = new Map<string, number>();
async function pace(model: string) {
  const interval = Math.ceil(60_000 / (MODEL_LIMITS[model]?.rpm ?? 5)) + 1000;
  const now = Date.now();
  const key = `${aiKeyOwner()}:${model}`;
  const slot = Math.max(now, nextSlot.get(key) ?? 0);
  nextSlot.set(key, slot + interval);
  if (slot > now) await sleep(slot - now);
}

/** Models known to be out for this quota day, so a job doesn't spend time asking them again. */
const blockedUntil = new Map<string, number>();
const OVERLOAD_PAUSE_MS = 10 * 60_000;

/** Clears model pauses. Only the offline test harness uses this between scenarios. */
export function clearModelPauses() {
  blockedUntil.clear();
  billingBlocked.clear();
  nextSlot.clear();
}
const pausedUntil = (model: string) => blockedUntil.get(`${aiKeyOwner()}:${model}`) ?? 0;
const pauseModel = (model: string, until: number) => blockedUntil.set(`${aiKeyOwner()}:${model}`, until);

function isDailyLimit(message: string, model: string) {
  const limit = Number(message.match(/limit: (\d+)/)?.[1] ?? -1);
  return /PerDay/i.test(message) || limit === 0 || limit === MODEL_LIMITS[model]?.rpd;
}

function chainFor(tier: ModelTier, promptChars: number, preferred?: string) {
  const base = tier === "writer" ? [env.textModel, ...MODEL_CHAINS.writer] : MODEL_CHAINS.light;
  const ordered = [...new Set(preferred ? [preferred, ...base] : base)];
  return ordered.filter((m) => pausedUntil(m) <= Date.now() && !(m.startsWith("gemma") && promptChars > GEMMA_MAX_PROMPT_CHARS));
}

/** Tries each model in the tier: waits out per-minute limits, and moves on at once when one is used up, overloaded or returns junk. */
async function route<T>(label: string, kind: Kind, promptChars: number, opts: CallOptions, call: (model: string) => Promise<{ value: T; tokens?: number; total?: number }>): Promise<T> {
  checkBilling();
  await assertAiBudget();
  const tier = opts.tier ?? "light";
  const chain = chainFor(tier, promptChars, opts.sticky?.model);
  let lastError: unknown = new Error("every model in this tier is used up for today");

  for (const model of chain) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await pace(model);
        const result = await call(model);
        record(model, kind, undefined, result.tokens, result.total);
        if (opts.sticky) opts.sticky.model = model;
        return result.value;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        record(model, kind, message);
        if (apiStatus(message) === 401 || hasApiStatus(message, "PERMISSION_DENIED") || /API key not valid/i.test(message)) throw new Error(`${label} failed: ${message}`);
        if (isBillingError(message)) {
          blockBilling(Date.now() + BILLING_RECHECK_MS);
          throw new Error(`${label} failed (billing blocked, account-wide): ${message}`);
        }
        // Overloaded or timing out: skip this model for a while instead of trying it again on every request.
        if ([503, 504].includes(apiStatus(message) ?? 0) || hasApiStatus(message, "UNAVAILABLE") || hasApiStatus(message, "DEADLINE_EXCEEDED")) {
          pauseModel(model, Date.now() + OVERLOAD_PAUSE_MS);
          break;
        }
        if (isQuotaError(message) && isDailyLimit(message, model)) {
          pauseModel(model, quotaDayStart() + DAY_MS);
          break;
        }
        if (apiStatus(message) === 404 || hasApiStatus(message, "NOT_FOUND")) {
          pauseModel(model, quotaDayStart() + DAY_MS);
          break;
        }
        // Google counts failed requests against the daily quota, so only a per-minute limit is worth waiting out.
        if (!isQuotaError(message) || attempt === 2) break;
        const stated = Number(message.match(/retry in ([\d.]+)s/i)?.[1] ?? 0);
        await sleep(stated ? Math.min(stated + 1, 65) * 1000 : 2000 * 2 ** attempt + Math.random() * 1000);
      }
    }
  }
  throw new Error(`${label} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/** Gemma has no system-instruction or JSON mode, so both go in the prompt and the reply is parsed leniently. */
function request(model: string, prompt: string, system: string, temperature: number, asJson: boolean, tier: ModelTier) {
  const gemma = model.startsWith("gemma");
  return ai().models.generateContent({
    model,
    contents: gemma ? `${system}\n\n${prompt}` : prompt,
    config: {
      ...(gemma ? {} : { systemInstruction: system }),
      temperature,
      ...(asJson && !gemma ? { responseMimeType: "application/json" } : {}),
      // Gemma is the last-resort backup and answers far more slowly than Flash Lite.
      httpOptions: { timeout: gemma ? GEMMA_TIMEOUT_MS : TIMEOUT_MS[tier] },
    },
  });
}

export async function text(prompt: string, system: string, opts: CallOptions = {}) {
  return route("Gemini text", "text", prompt.length + system.length, opts, async (model) => {
    const res = await request(model, prompt, system, opts.temperature ?? 0.7, false, opts.tier ?? "light");
    const out = res.text?.trim();
    if (!out) throw new Error("empty response");
    return { value: out, tokens: res.usageMetadata?.promptTokenCount, total: res.usageMetadata?.totalTokenCount };
  });
}

/**
 * JSON.parse, but tolerant of raw control characters inside string values and trailing commas — the two harmless
 * mistakes models make in long replies, which strict JSON rejects even though the content is fine.
 */
export function parseLenient(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    let out = "";
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        else if (ch < " ") {
          out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : ch === "\t" ? "\\t" : `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
          continue;
        }
      } else if (ch === '"') inString = true;
      else if (ch === "," && /^\s*[}\]]/.test(text.slice(i + 1))) continue;
      out += ch;
    }
    return JSON.parse(out);
  }
}

/** Asks for JSON and parses it; tolerant of code fences and prose around the value. */
export async function json<T>(prompt: string, system: string, opts: CallOptions = {}): Promise<T> {
  const fullSystem = `${system}\n\nRespond with a single valid JSON value and nothing else.`;
  return route("Gemini JSON", "json", prompt.length + fullSystem.length, opts, async (model) => {
    const res = await request(model, prompt, fullSystem, opts.temperature ?? 0.4, true, opts.tier ?? "light");
    const raw = res.text ?? "";
    const start = raw.search(/[[{]/);
    const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
    if (start === -1 || end === -1) throw new Error(`no JSON in response: ${raw.slice(0, 200)}`);
    return { value: parseLenient(raw.slice(start, end + 1)) as T, tokens: res.usageMetadata?.promptTokenCount, total: res.usageMetadata?.totalTokenCount };
  });
}

/** Yes/no judgements from Gemini Decision 1, as probabilities of yes. Null when unavailable, so callers fall back. */
export async function decide(input: string, questions: Record<string, string>): Promise<Record<string, number> | null> {
  const keys = Object.keys(questions);
  if (!keys.length) return {};
  try {
    checkBilling();
    await assertAiBudget();
    await pace(DECISION_MODEL);
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/decisions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": geminiKey() },
      body: JSON.stringify({
        model: DECISION_MODEL,
        input,
        questions: Object.fromEntries(keys.map((k) => [k, { type: "noul", instructions: questions[k] }])),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const { answers } = (await res.json()) as { answers: Record<string, { noul: number }> };
    record(DECISION_MODEL, "json");
    return Object.fromEntries(keys.map((k) => [k, answers[k].noul]));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record(DECISION_MODEL, "json", message);
    if (isBillingError(message)) blockBilling(Date.now() + BILLING_RECHECK_MS);
    console.warn(`[decide] ${message.slice(0, 200)}`);
    return null;
  }
}

/** True while the account's billing balance is known to be blocked, so callers can skip Gemini entirely rather than fail into it. */
export function geminiBillingBlocked() {
  return Date.now() < billingBlockedUntil();
}

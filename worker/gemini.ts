import { GoogleGenAI } from "@google/genai";
import { DECISION_MODEL, MODEL_CHAINS, MODEL_LIMITS, quotaDayStart, type ModelTier } from "../src/lib/studio/models";
import { db } from "./db";
import { env } from "./env";

// Hard per-request timeout: an overloaded model can otherwise leave a request hanging for minutes and block the queue.
const ai = new GoogleGenAI({ apiKey: env.geminiApiKey, httpOptions: { timeout: 180_000 } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAY_MS = 86_400_000;
// Gemma's free tier allows 16K tokens a minute, so long prompts skip it.
const GEMMA_MAX_PROMPT_CHARS = 48_000;

type Kind = "text" | "json";

export interface CallOptions {
  tier?: ModelTier;
  temperature?: number;
  /** Keeps one article on one model: holds the model in use, and moves only if that model is unavailable. */
  sticky?: { model?: string };
}

/** Logs one Gemini request for the usage panel. Never fails the job. */
function record(model: string, kind: Kind, error?: string) {
  const limit = error?.match(/limit: (\d+)/)?.[1];
  db.from("ai_calls")
    .insert({ model, kind, ok: !error, error: error?.slice(0, 500) ?? null, quota_limit: limit === undefined ? null : Number(limit) })
    .then(({ error: e }) => e && console.warn("[usage] " + e.message));
}

const nextSlot = new Map<string, number>();
async function pace(model: string) {
  const interval = Math.ceil(60_000 / (MODEL_LIMITS[model]?.rpm ?? 5)) + 1000;
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(model) ?? 0);
  nextSlot.set(model, slot + interval);
  if (slot > now) await sleep(slot - now);
}

/** Models known to be out for this quota day, so a job doesn't spend time asking them again. */
const blockedUntil = new Map<string, number>();

function isDailyLimit(message: string, model: string) {
  const limit = Number(message.match(/limit: (\d+)/)?.[1] ?? -1);
  return /PerDay/i.test(message) || limit === 0 || limit === MODEL_LIMITS[model]?.rpd;
}

function chainFor(tier: ModelTier, promptChars: number, preferred?: string) {
  const base = tier === "writer" ? [env.textModel, ...MODEL_CHAINS.writer] : MODEL_CHAINS.light;
  const ordered = [...new Set(preferred ? [preferred, ...base] : base)];
  return ordered.filter((m) => (blockedUntil.get(m) ?? 0) <= Date.now() && !(m.startsWith("gemma") && promptChars > GEMMA_MAX_PROMPT_CHARS));
}

/** Tries each model in the tier: waits out per-minute limits, and moves on when one is used up, overloaded or returns junk. */
async function route<T>(label: string, kind: Kind, promptChars: number, opts: CallOptions, call: (model: string) => Promise<T>): Promise<T> {
  const chain = chainFor(opts.tier ?? "light", promptChars, opts.sticky?.model);
  let lastError: unknown = new Error("every model in this tier is used up for today");

  for (const model of chain) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await pace(model);
        const result = await call(model);
        record(model, kind);
        if (opts.sticky) opts.sticky.model = model;
        return result;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        record(model, kind, message);
        if (/API key|PERMISSION_DENIED|\b401\b/i.test(message)) throw new Error(`${label} failed: ${message}`);
        if (/429|RESOURCE_EXHAUSTED/.test(message) && isDailyLimit(message, model)) {
          blockedUntil.set(model, quotaDayStart() + DAY_MS);
          break;
        }
        if (/\b404\b|NOT_FOUND/.test(message)) {
          blockedUntil.set(model, quotaDayStart() + DAY_MS);
          break;
        }
        if (!/429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|500|INTERNAL|deadline|timeout|fetch failed/i.test(message)) break;
        if (attempt === 2) break;
        const stated = Number(message.match(/retry in ([\d.]+)s/i)?.[1] ?? 0);
        await sleep(stated ? Math.min(stated + 1, 65) * 1000 : 2000 * 2 ** attempt + Math.random() * 1000);
      }
    }
  }
  throw new Error(`${label} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/** Gemma has no system-instruction or JSON mode, so both go in the prompt and the reply is parsed leniently. */
function request(model: string, prompt: string, system: string, temperature: number, asJson: boolean) {
  const gemma = model.startsWith("gemma");
  return ai.models.generateContent({
    model,
    contents: gemma ? `${system}\n\n${prompt}` : prompt,
    config: {
      ...(gemma ? {} : { systemInstruction: system }),
      temperature,
      ...(asJson && !gemma ? { responseMimeType: "application/json" } : {}),
    },
  });
}

export async function text(prompt: string, system: string, opts: CallOptions = {}) {
  return route("Gemini text", "text", prompt.length + system.length, opts, async (model) => {
    const res = await request(model, prompt, system, opts.temperature ?? 0.7, false);
    const out = res.text?.trim();
    if (!out) throw new Error("empty response");
    return out;
  });
}

/**
 * JSON.parse, but tolerant of raw control characters (line breaks, tabs) inside string values — the model sometimes
 * returns long HTML bodies that way, which strict JSON rejects even though the content is fine.
 */
export function parseLenient(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError) || !/control character/i.test(error.message)) throw error;
    let out = "";
    let inString = false;
    let escaped = false;
    for (const ch of text) {
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        else if (ch < " ") {
          out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : ch === "\t" ? "\\t" : `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
          continue;
        }
      } else if (ch === '"') inString = true;
      out += ch;
    }
    return JSON.parse(out);
  }
}

/** Asks for JSON and parses it; tolerant of code fences and prose around the value. */
export async function json<T>(prompt: string, system: string, opts: CallOptions = {}): Promise<T> {
  const fullSystem = `${system}\n\nRespond with a single valid JSON value and nothing else.`;
  return route("Gemini JSON", "json", prompt.length + fullSystem.length, opts, async (model) => {
    const res = await request(model, prompt, fullSystem, opts.temperature ?? 0.4, true);
    const raw = res.text ?? "";
    const start = raw.search(/[[{]/);
    const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
    if (start === -1 || end === -1) throw new Error(`no JSON in response: ${raw.slice(0, 200)}`);
    return parseLenient(raw.slice(start, end + 1)) as T;
  });
}

/** Yes/no judgements from Gemini Decision 1, as probabilities of yes. Null when unavailable, so callers fall back. */
export async function decide(input: string, questions: Record<string, string>): Promise<Record<string, number> | null> {
  const keys = Object.keys(questions);
  if (!keys.length) return {};
  try {
    await pace(DECISION_MODEL);
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/decisions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.geminiApiKey },
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
    console.warn(`[decide] ${message.slice(0, 200)}`);
    return null;
  }
}

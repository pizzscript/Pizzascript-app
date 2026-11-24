import { GoogleGenAI } from "@google/genai";
import { assertAiBudget } from "./usage";
import { geminiKey } from "./connections";
import { AGENT_MODEL, nextCooldownMs, quotaDayStart, type AgentState, type AgentTask } from "../src/lib/studio/models";
import { db, setting } from "./db";
import { apiStatus, geminiBillingBlocked, isBillingError, record } from "./gemini";

const BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";
const START_LIMIT_MS = 2 * 60_000;
const DAY_MS = 86_400_000;
const LIFECYCLE = new Set(["interaction.created", "interaction.status_update"]);

interface AgentEvent {
  event_type?: string;
  type?: string;
  id?: string;
  interaction_id?: string;
  interaction?: { id?: string };
  error?: unknown;
}

interface Interaction {
  status?: string;
  error?: unknown;
  usage?: { total_tokens?: number };
  steps?: { type?: string; content?: { text?: string }[] }[];
}

type StreamingClient = {
  interactions: {
    create(params: Record<string, unknown>, options: { timeout: number }): Promise<AsyncIterable<AgentEvent> & { controller?: AbortController }>;
    get(id: string): Promise<Interaction>;
  };
};

let agentClient: StreamingClient | null = null;
let agentKey = "";
const client = () => {
  if (!agentClient || agentKey !== geminiKey()) {
    agentKey = geminiKey();
    agentClient = new GoogleGenAI({ apiKey: agentKey, httpOptions: { apiVersion: "v1beta" } }) as unknown as StreamingClient;
  }
  return agentClient;
};

const readState = () => setting<AgentState>("agent_state", {});

async function updateState(change: (state: AgentState) => AgentState) {
  const next = change(await readState());
  const { error } = await db.from("settings").upsert({ key: "agent_state", value: next });
  if (error) console.warn(`[agent] state: ${error.message}`);
}

const logTask = (task: AgentTask) =>
  updateState((s) => ({ ...s, tasks: [task, ...(s.tasks ?? []).filter((t) => t.id !== task.id)].slice(0, 20) }));

const cancel = (id: string) => fetch(`${BASE}/${id}:cancel`, { method: "POST", headers: { "x-goog-api-key": geminiKey() } }).catch(() => {});

/** One Antigravity task. Fails fast if no step starts, then pauses the agent so later articles go straight to the backups. */
export async function runAgent(input: string, opts: { label: string; maxTokens: number; timeoutMs: number }) {
  if (geminiBillingBlocked()) throw new Error("Antigravity skipped: Gemini billing is currently blocked (account-wide)");
  await assertAiBudget();
  const state = await readState();
  if (state.cooldownUntil && Date.parse(state.cooldownUntil) > Date.now()) throw new Error(`Antigravity paused until ${state.cooldownUntil}`);

  const begin = Date.now();
  const startedAt = new Date(begin).toISOString();
  let id: string | undefined;
  let working = false;
  let finished = false;
  let stream: Awaited<ReturnType<StreamingClient["interactions"]["create"]>> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  try {
    stream = await client().interactions.create(
      {
        agent: AGENT_MODEL,
        input,
        environment: "remote",
        stream: true,
        agent_config: { type: "antigravity", model: "gemini-4-hydrogen", max_total_tokens: opts.maxTokens },
      },
      { timeout: opts.timeoutMs },
    );
    const active = stream;
    const consume = (async () => {
      for await (const event of active) {
        const type = event.event_type ?? event.type ?? "";
        if (!id) {
          id = event.interaction?.id ?? event.interaction_id ?? event.id;
          if (id) await logTask({ id, label: opts.label, status: "running", startedAt });
        }
        if (type === "error") throw new Error(`Antigravity error: ${JSON.stringify(event.error ?? event).slice(0, 300)}`);
        if (type && !LIFECYCLE.has(type)) working = true;
        if (type === "interaction.completed") finished = true;
      }
    })();
    const watchdog = new Promise<never>((_, reject) => {
      timer = setInterval(() => {
        const elapsed = Date.now() - begin;
        if (!working && elapsed > START_LIMIT_MS) reject(new Error("Antigravity hung: no step started"));
        if (elapsed > opts.timeoutMs) reject(new Error("Antigravity timed out"));
      }, 2000);
    });
    consume.catch(() => {});
    await Promise.race([consume, watchdog]);
    if (!id) throw new Error("Antigravity returned no task ID");

    let final = await client().interactions.get(id);
    while (final.status === "in_progress" && Date.now() - begin < opts.timeoutMs) {
      await new Promise((r) => setTimeout(r, 5000));
      final = await client().interactions.get(id);
    }
    if (final.status !== "completed") throw new Error(`Antigravity ended as ${final.status}: ${JSON.stringify(final.error ?? "").slice(0, 200)}`);
    finished = true;

    const text = (final.steps ?? [])
      .filter((s) => s.type === "model_output")
      .flatMap((s) => s.content ?? [])
      .map((c) => c.text ?? "")
      .join("")
      .trim();
    if (!text) throw new Error("Antigravity returned no text");

    record(AGENT_MODEL, "json");
    // A clean run resets the failure streak immediately: a success means the service is healthy right now.
    await updateState((s) => ({
      tasks: [{ id: id!, label: opts.label, status: "completed" as const, startedAt, tokens: final.usage?.total_tokens }, ...(s.tasks ?? []).filter((t) => t.id !== id)].slice(0, 20),
      consecutiveFailures: 0,
      consecutiveSuccesses: (s.consecutiveSuccesses ?? 0) + 1,
      cooldownUntil: undefined,
      reason: undefined,
    }));
    return { text, tokens: final.usage?.total_tokens ?? 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record(AGENT_MODEL, "json", message);
    stream?.controller?.abort();
    if (id && !finished) await cancel(id);
    // A billing block isn't Antigravity being unreliable — don't let it count toward the hang streak.
    if (!/no text/i.test(message) && !isBillingError(message)) {
      await updateState((s) => {
        const failures = (s.consecutiveFailures ?? 0) + 1;
        const until = apiStatus(message) === 429 ? quotaDayStart() + DAY_MS : Date.now() + nextCooldownMs(failures);
        return { ...s, cooldownUntil: new Date(until).toISOString(), reason: message.slice(0, 160), consecutiveFailures: failures, consecutiveSuccesses: 0 };
      });
    }
    if (id) await logTask({ id, label: opts.label, status: "failed", startedAt, error: message.slice(0, 160) });
    throw error;
  } finally {
    if (timer) clearInterval(timer);
  }
}

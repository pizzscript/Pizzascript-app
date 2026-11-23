export type ModelTier = "writer" | "light";

export interface ModelLimit {
  label: string;
  rpm: number;
  rpd: number;
  group: "agent" | "writer" | "light" | "backup" | "decision";
}

export const AGENT_MODEL = "antigravity-preview-09-2026";

export interface AgentTask {
  id: string;
  label: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  tokens?: number;
  error?: string;
}

export interface AgentState {
  cooldownUntil?: string;
  reason?: string;
  tasks?: AgentTask[];
  /** Hangs/failures and successes in a row, tracked separately so a run of failures earns a longer rest. */
  consecutiveFailures?: number;
  consecutiveSuccesses?: number;
}

/**
 * Antigravity has swung between a healthy streak and a broken streak lasting hours, rather than failing at a fixed
 * rate — so the first failure after a streak of successes gets the benefit of the doubt (short rest), while repeat
 * failures confirm a bad streak and earn a much longer one.
 */
export function nextCooldownMs(consecutiveFailures: number) {
  if (consecutiveFailures <= 1) return 15 * 60_000;
  if (consecutiveFailures === 2) return 4 * 3_600_000;
  return 8 * 3_600_000;
}

/** Free-tier limits from Google AI Studio's rate-limit page (2026-11-21). */
export const MODEL_LIMITS: Record<string, ModelLimit> = {
  [AGENT_MODEL]: { label: "Antigravity", rpm: 60, rpd: 100, group: "agent" },
  "gemini-3.8-flash": { label: "3.8 Flash", rpm: 5, rpd: 20, group: "writer" },
  "gemini-3.6-flash": { label: "3.6 Flash", rpm: 5, rpd: 20, group: "writer" },
  "gemini-3-flash-preview": { label: "3 Flash", rpm: 5, rpd: 20, group: "writer" },
  "gemini-3.5-flash-lite": { label: "3.5 Flash Lite", rpm: 15, rpd: 500, group: "light" },
  "gemini-3.1-flash-lite": { label: "3.1 Flash Lite", rpm: 15, rpd: 500, group: "light" },
  "gemma-4-31b-it": { label: "Gemma 4 31B", rpm: 30, rpd: 14400, group: "backup" },
  "gemma-4-26b-a4b-it": { label: "Gemma 4 26B", rpm: 30, rpd: 14400, group: "backup" },
  "gemini-decision-1": { label: "Decision 1", rpm: 200, rpd: 10000, group: "decision" },
};

export const MODEL_CHAINS: Record<ModelTier, string[]> = {
  writer: ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3-flash-preview"],
  light: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemma-4-31b-it", "gemma-4-26b-a4b-it"],
};

export const DECISION_MODEL = "gemini-decision-1";

/** Start of Google's current quota day (midnight Pacific), in epoch ms. */
export function quotaDayStart(now = Date.now()) {
  const pacific = new Date(new Date(now).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return now - (pacific.getHours() * 3_600_000 + pacific.getMinutes() * 60_000 + pacific.getSeconds() * 1000);
}

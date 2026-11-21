export type ModelTier = "writer" | "light";

export interface ModelLimit {
  label: string;
  rpm: number;
  rpd: number;
  group: "writer" | "light" | "backup" | "decision";
}

/** Free-tier limits from Google AI Studio's rate-limit page (2026-11-21). */
export const MODEL_LIMITS: Record<string, ModelLimit> = {
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

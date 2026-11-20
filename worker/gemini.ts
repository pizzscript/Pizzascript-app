import { GoogleGenAI, Modality } from "@google/genai";
import { db } from "./db";
import { env } from "./env";

// Hard per-request timeout: an overloaded model can otherwise leave a request hanging for minutes and block the queue.
// withRetry below decides what's worth retrying and how often.
const ai = new GoogleGenAI({ apiKey: env.geminiApiKey, httpOptions: { timeout: 120_000 } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Kind = "text" | "json" | "image";

/** Logs one Gemini request for the usage panel (every attempt counts against the quota). Never fails the job. */
function record(model: string, kind: Kind, error?: string) {
  const limit = error?.match(/limit: (\d+)/)?.[1];
  db.from("ai_calls")
    .insert({ model, kind, ok: !error, error: error?.slice(0, 500) ?? null, quota_limit: limit === undefined ? null : Number(limit) })
    .then(({ error: e }) => e && console.warn("[usage] " + e.message));
}

/** Retries rate limits and transient failures with backoff — the free tier returns 429s readily. */
async function withRetry<T>(fn: () => Promise<T>, label: string, model: string, kind: Kind): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await fn();
      record(model, kind);
      return result;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      record(model, kind, message);
      const transient = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|500|INTERNAL|deadline/i.test(message);
      // "limit: 0" = this model has no quota on this key at all (e.g. image models on the free tier); retrying is pointless.
      if (!transient || /limit: 0\b/.test(message) || attempt === 3) break;
      await sleep(2000 * 2 ** attempt + Math.random() * 1000);
    }
  }
  throw new Error(`${label} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export async function text(prompt: string, system: string, opts: { search?: boolean; temperature?: number } = {}) {
  return withRetry(async () => {
    const res = await ai.models.generateContent({
      model: env.textModel,
      contents: prompt,
      config: {
        systemInstruction: system,
        temperature: opts.temperature ?? 0.7,
        tools: opts.search ? [{ googleSearch: {} }] : undefined,
      },
    });
    const out = res.text?.trim();
    if (!out) throw new Error("empty response");
    return out;
  }, "Gemini text", env.textModel, "text");
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

/** Asks for JSON and parses it; tolerant of code fences and of grounded responses that wrap JSON in prose. */
export async function json<T>(prompt: string, system: string, opts: { search?: boolean; temperature?: number } = {}): Promise<T> {
  return withRetry(async () => {
    const res = await ai.models.generateContent({
      model: env.textModel,
      contents: prompt,
      config: {
        systemInstruction: `${system}\n\nRespond with a single valid JSON value and nothing else.`,
        temperature: opts.temperature ?? 0.4,
        // Grounding with Google Search can't be combined with JSON mode, so parse leniently in that case.
        ...(opts.search ? { tools: [{ googleSearch: {} }] } : { responseMimeType: "application/json" }),
      },
    });
    const raw = res.text ?? "";
    const start = raw.search(/[[{]/);
    const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
    if (start === -1 || end === -1) throw new Error(`no JSON in response: ${raw.slice(0, 200)}`);
    return parseLenient(raw.slice(start, end + 1)) as T;
  }, "Gemini JSON", env.textModel, "json");
}

export async function image(prompt: string, aspectRatio = "21:9") {
  return withRetry(async () => {
    const res = await ai.models.generateContent({
      model: env.imageModel,
      contents: prompt,
      config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio } },
    });
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      throw new Error(`no image returned${res.text ? `: ${res.text.slice(0, 200)}` : ""}`);
    }
    return Buffer.from(part.inlineData.data, "base64");
  }, "Gemini image", env.imageModel, "image");
}

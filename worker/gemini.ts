import { GoogleGenAI, Modality } from "@google/genai";
import { env } from "./env";

const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries rate limits and transient failures with backoff — the free tier returns 429s readily. */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const transient = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|500|INTERNAL|deadline/i.test(message);
      if (!transient || attempt === 3) break;
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
  }, "Gemini text");
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
    return JSON.parse(raw.slice(start, end + 1)) as T;
  }, "Gemini JSON");
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
  }, "Gemini image");
}

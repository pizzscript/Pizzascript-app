import type { SerpData } from "../../src/lib/studio/types";
import { env } from "../env";

interface RawSerp {
  organic?: { title?: string; link?: string; description?: string }[];
  people_also_ask?: { question?: string }[];
  related?: { text?: string }[];
  featured_snippets?: { title?: string; description?: string; value?: unknown; link?: string }[];
  knowledge?: unknown;
  top_ads?: unknown[];
  videos?: unknown[];
  images?: unknown[];
}

export function parseSerp(raw: unknown): SerpData | null {
  const wrapped = raw as { body?: unknown };
  const body = typeof wrapped?.body === "string" ? JSON.parse(wrapped.body) : (wrapped?.body ?? raw);
  const data = (typeof body === "string" ? JSON.parse(body) : body) as RawSerp;
  if (!Array.isArray(data?.organic)) return null;
  const featured = data.featured_snippets?.[0];
  return {
    fetchedAt: new Date().toISOString(),
    organic: data.organic
      .filter((r) => r.link?.startsWith("https://"))
      .slice(0, 8)
      .map((r) => ({ title: r.title ?? "", url: r.link!, snippet: (r.description ?? "").slice(0, 220) })),
    questions: (data.people_also_ask ?? []).map((q) => q.question ?? "").filter(Boolean).slice(0, 8),
    related: (data.related ?? []).map((r) => r.text ?? "").filter(Boolean).slice(0, 8),
    featured: featured ? `${featured.title ?? ""} ${featured.description ?? ""}`.trim().slice(0, 300) || null : null,
    resultTypes: (["featured_snippets", "people_also_ask", "knowledge", "videos", "images", "top_ads"] as const).filter((k) => {
      const value = data[k];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }),
  };
}

/** One Bright Data credit per call. Returns null when unconfigured or failing, so research degrades instead of blocking. */
export async function fetchSerp(query: string): Promise<SerpData | null> {
  if (!env.brightDataKey || !env.brightDataZone) return null;
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=in&hl=en&num=10&brd_json=1`;
    const res = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.brightDataKey}` },
      body: JSON.stringify({ zone: env.brightDataZone, url, format: "raw" }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseSerp(JSON.parse(await res.text()));
  } catch (error) {
    console.warn(`[serp] ${query}: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

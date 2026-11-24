import { db, raiseSignal, setting, todayIst } from "../db";
import { env } from "../env";

export interface ServiceProfile {
  path: string;
  title: string;
  description: string;
  headings: string[];
}

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const get = async (url: string) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000), headers: { "user-agent": "content-agent-service-scan" } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
};

export const savedServices = async () => (await setting<{ pages?: ServiceProfile[] }>("service_profiles", {})).pages ?? [];

/** Finds every /services/ page in the live sitemap and records what it offers, so new services get their own ideas. */
export async function scanServices() {
  const base = env.revalidateUrls[0] ?? env.siteUrl;
  const before = await savedServices();
  const xml = await get(`${base}/sitemap.xml`);
  const paths = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/$/, "")).filter((p) => /^\/services\/[^/]+$/.test(p)))];
  const pages: ServiceProfile[] = [];
  for (const path of paths) {
    try {
      const html = await get(`${base}${path}`);
      pages.push({
        path,
        title: strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
        description: html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? "",
        headings: [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => strip(m[1])).filter(Boolean).slice(0, 12),
      });
    } catch (error) {
      const old = before.find((p) => p.path === path);
      if (old) pages.push(old);
      console.warn(`[services] ${error instanceof Error ? error.message : error}`);
    }
  }
  if (!pages.length) throw new Error("No service pages found in the sitemap");
  await db.from("settings").upsert({ key: "service_profiles", value: { scannedAt: new Date().toISOString(), pages } });
  const added = pages.filter((p) => !before.some((b) => b.path === p.path)).map((p) => p.path);
  if (before.length && added.length) {
    await raiseSignal({ kind: "quality_gate", title: `New service page found: ${added.join(", ")}. Research will add ideas for it.`, detail: { added }, priority: "P2", post_id: null, topic_id: null, dedupe_key: `services:${todayIst()}` });
  }
  return { services: pages.length, added };
}

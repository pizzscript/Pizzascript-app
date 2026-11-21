import { XMLParser } from "fast-xml-parser";
import { db, setting } from "../db";

export const FEEDS = [
  { name: "Next.js releases", url: "https://github.com/vercel/next.js/releases.atom", stableOnly: true },
  { name: "React releases", url: "https://github.com/facebook/react/releases.atom", stableOnly: true },
  { name: "Vercel blog", url: "https://vercel.com/atom" },
  { name: "Cloudflare blog", url: "https://blog.cloudflare.com/rss/" },
  { name: "Google Search Central", url: "https://developers.google.com/search/blog/feed.xml" },
];

export interface FeedItem {
  feed: string;
  title: string;
  link: string;
  date: string;
  summary: string;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
const list = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : ((v as { "#text"?: string })?.["#text"] ?? ""));
const clean = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim().slice(0, 280);

export function parseFeed(xml: string, feed: string): FeedItem[] {
  const doc = parser.parse(xml);
  const atom = list<Record<string, unknown>>(doc.feed?.entry).map((e) => ({
    feed,
    title: clean(str(e.title)),
    link: str(list<{ href?: string; rel?: string }>(e.link as never).find((l) => !l.rel || l.rel === "alternate")?.href),
    date: str(e.updated ?? e.published),
    summary: clean(str(e.summary ?? e.content)),
  }));
  const rss = list<Record<string, unknown>>(doc.rss?.channel?.item).map((e) => ({
    feed,
    title: clean(str(e.title)),
    link: str(e.link),
    date: str(e.pubDate),
    summary: clean(str(e.description)),
  }));
  return [...atom, ...rss].filter((i) => i.title && !Number.isNaN(Date.parse(i.date)));
}

const PRERELEASE = /canary|alpha|beta|\brc\b|-rc|experimental|nightly/i;

/** New items since the last confirmed scan. Costs no AI; call markFeedsSeen only after they have been judged. */
export async function newFeedItems() {
  const seen = await setting<Record<string, string>>("feeds_seen", {});
  const fallback = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const latest: Record<string, string> = { ...seen };
  const items: FeedItem[] = [];
  await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "content-agent-feed-reader" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const since = Date.parse(seen[f.name] ?? fallback);
        const parsed = parseFeed(await res.text(), f.name);
        const newest = Math.max(since, ...parsed.map((i) => Date.parse(i.date)));
        latest[f.name] = new Date(newest).toISOString();
        items.push(...parsed.filter((i) => Date.parse(i.date) > since && !(f.stableOnly && PRERELEASE.test(i.title))).slice(0, 5));
      } catch (error) {
        console.warn(`[feeds] ${f.name}: ${error instanceof Error ? error.message : error}`);
      }
    }),
  );
  return { items, latest };
}

export async function markFeedsSeen(latest: Record<string, string>) {
  await db.from("settings").upsert({ key: "feeds_seen", value: latest });
}

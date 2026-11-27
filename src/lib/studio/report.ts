// The monthly client report: everything is read for one client and one month (IST). Server-only.
import { planOf } from "./plans";
import type { Studio } from "./server";
import { DEFAULT_WORKSPACE } from "./workspace-scope";

export interface MonthlyReport {
  client: { name: string; site: string; plan: string };
  month: string;
  label: string;
  articles: { title: string; url: string | null; date: string }[];
  search: { clicks: number; impressions: number; position: number | null; prevClicks: number; prevImpressions: number };
  topQueries: { query: string; clicks: number; impressions: number; position: number }[];
  topPages: { page: string; clicks: number; impressions: number }[];
  health: { score: number | null; prevScore: number | null; open: number; fixed: number; pages: number | null };
  speed: { url: string; performance: number | null; lcp: number | null }[];
  indexing: { checked: number; indexed: number };
  usage: { articles: number; articlesLimit: number; ai: number };
}

/** YYYY-MM → [first day, first day of next month]. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  return { start, next, prev };
}

export const lastMonth = (now = Date.now()) => {
  const d = new Date(now + 5.5 * 3_600_000);
  const y = d.getUTCMonth() === 0 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
  const m = d.getUTCMonth() === 0 ? 12 : d.getUTCMonth();
  return `${y}-${String(m).padStart(2, "0")}`;
};

type Gsc = { query: string; page: string; clicks: number; impressions: number; position: number };

function sum(rows: Gsc[]) {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const weighted = rows.reduce((s, r) => s + r.position * r.impressions, 0);
  return { clicks, impressions, position: impressions ? Math.round((weighted / impressions) * 10) / 10 : null };
}

function top<K extends "query" | "page">(rows: Gsc[], key: K, n: number) {
  const map = new Map<string, { clicks: number; impressions: number; weighted: number }>();
  for (const r of rows) {
    const v = map.get(r[key]) ?? { clicks: 0, impressions: 0, weighted: 0 };
    v.clicks += r.clicks;
    v.impressions += r.impressions;
    v.weighted += r.position * r.impressions;
    map.set(r[key], v);
  }
  return [...map]
    .map(([k, v]) => ({ [key]: k, clicks: v.clicks, impressions: v.impressions, position: Math.round((v.weighted / Math.max(v.impressions, 1)) * 10) / 10 }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, n) as ({ [P in K]: string } & { clicks: number; impressions: number; position: number })[];
}

export interface SearchTotals {
  now: { clicks: number; impressions: number; position: number | null };
  before: { clicks: number; impressions: number; position: number | null };
}

/** Google results for the dashboard: the last 28 settled days against the 28 before. Null when there's no data. */
export async function searchTotals(studio: Studio): Promise<SearchTotals | null> {
  if (studio.mode !== "live") return null;
  const day = (n: number) => new Date(Date.now() + 5.5 * 3_600_000 - n * 86_400_000).toISOString().slice(0, 10);
  const [now, before] = await Promise.all([
    studio.db.from("gsc_daily").select("query,page,clicks,impressions,position").gte("date", day(30)).lte("date", day(3)).limit(100_000),
    studio.db.from("gsc_daily").select("query,page,clicks,impressions,position").gte("date", day(58)).lte("date", day(31)).limit(100_000),
  ]);
  const a = sum((now.data ?? []) as Gsc[]);
  const b = sum((before.data ?? []) as Gsc[]);
  return a.impressions || b.impressions ? { now: a, before: b } : null;
}

export async function buildReport(studio: Pick<Extract<Studio, { mode: "live" }>, "db" | "workspace">, month: string): Promise<MonthlyReport> {
  const { db, workspace } = studio;
  const { start, next, prev } = monthRange(month);
  const prevRange = monthRange(prev);
  const [posts, gsc, gscPrev, runs, openIssues, fixedIssues, metrics, inspections, usage] = await Promise.all([
    db.from("posts").select("title,published_url,slug,published_at").eq("stage", "live").gte("published_at", start).lt("published_at", next).order("published_at"),
    db.from("gsc_daily").select("query,page,clicks,impressions,position").gte("date", start).lt("date", next).limit(100_000),
    db.from("gsc_daily").select("clicks,impressions,position,query,page").gte("date", prevRange.start).lt("date", prevRange.next).limit(100_000),
    db.from("crawl_runs").select("score,pages,finished_at").eq("status", "done").lt("finished_at", next).order("finished_at", { ascending: false }).limit(2),
    db.from("crawl_issues").select("url", { count: "exact", head: true }).is("fixed_at", null),
    db.from("crawl_issues").select("url", { count: "exact", head: true }).gte("fixed_at", start).lt("fixed_at", next),
    db.from("metrics_daily").select("date,url,metric,value").gte("date", start).lt("date", next).in("metric", ["performance", "lcp"]).limit(5000),
    db.from("url_inspections").select("url,indexed,checked_at").lt("checked_at", next).order("checked_at", { ascending: false }).limit(2000),
    db.from("usage_ledger").select("ai_requests,articles").gte("day", start).lt("day", next),
  ]);
  const rows = (gsc.data ?? []) as Gsc[];
  const now = sum(rows);
  const before = sum((gscPrev.data ?? []) as Gsc[]);
  const speed = new Map<string, { performance: number | null; lcp: number | null; date: string }>();
  for (const m of ((metrics.data ?? []) as { date: string; url: string; metric: string; value: number }[]).sort((a, b) => a.date.localeCompare(b.date))) {
    const v = speed.get(m.url) ?? { performance: null, lcp: null, date: m.date };
    speed.set(m.url, { ...v, date: m.date, [m.metric]: m.value });
  }
  const latestInspection = new Map<string, boolean>();
  for (const i of (inspections.data ?? []) as { url: string; indexed: boolean }[]) if (!latestInspection.has(i.url)) latestInspection.set(i.url, i.indexed);
  const runRows = (runs.data ?? []) as { score: number | null; pages: number }[];
  const ledger = (usage.data ?? []) as { ai_requests: number; articles: number }[];
  const plan = planOf(workspace.plan, workspace.id === DEFAULT_WORKSPACE);
  return {
    client: { name: workspace.name, site: workspace.site_url, plan: plan.name },
    month,
    label: new Date(`${start}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }),
    articles: ((posts.data ?? []) as { title: string; published_url: string | null; slug: string; published_at: string }[]).map((p) => ({ title: p.title, url: p.published_url, date: p.published_at })),
    search: { ...now, prevClicks: before.clicks, prevImpressions: before.impressions },
    topQueries: top(rows, "query", 10),
    topPages: top(rows, "page", 10),
    health: { score: runRows[0]?.score ?? null, prevScore: runRows[1]?.score ?? null, open: openIssues.count ?? 0, fixed: fixedIssues.count ?? 0, pages: runRows[0]?.pages ?? null },
    speed: [...speed].map(([url, v]) => ({ url, performance: v.performance, lcp: v.lcp })).slice(0, 6),
    indexing: { checked: latestInspection.size, indexed: [...latestInspection.values()].filter(Boolean).length },
    usage: { articles: ledger.reduce((s, r) => s + r.articles, 0), articlesLimit: plan.articlesPerMonth, ai: ledger.reduce((s, r) => s + r.ai_requests, 0) },
  };
}

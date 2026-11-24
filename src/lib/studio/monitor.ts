// Speed, indexing and ranking judgements. Pure functions, shared by the worker and the admin.

/** Google's Core Web Vitals bands (75th percentile). */
const BANDS = {
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
  inp: [200, 500],
} as const;

export type Band = "good" | "needs improvement" | "poor";

export function band(metric: keyof typeof BANDS, value: number): Band {
  const [good, poor] = BANDS[metric];
  return value <= good ? "good" : value <= poor ? "needs improvement" : "poor";
}

const RANK: Record<Band, number> = { good: 0, "needs improvement": 1, poor: 2 };

/** Metrics that moved to a worse band since last time, e.g. LCP from good to needs improvement. */
export function speedDrops(before: Record<string, number>, after: Record<string, number>) {
  const drops: { metric: keyof typeof BANDS; from: Band; to: Band; value: number }[] = [];
  for (const metric of Object.keys(BANDS) as (keyof typeof BANDS)[]) {
    if (before[metric] == null || after[metric] == null) continue;
    const from = band(metric, before[metric]);
    const to = band(metric, after[metric]);
    if (RANK[to] > RANK[from]) drops.push({ metric, from, to, value: after[metric] });
  }
  if (before.performance != null && after.performance != null && before.performance - after.performance >= 15) {
    drops.push({ metric: "lcp", from: "good", to: "needs improvement", value: after.lcp ?? 0 });
  }
  return drops;
}

/** The numbers we keep from a PageSpeed Insights reply (mobile). Field data (real users) is preferred when Google has it. */
export function readPageSpeed(reply: {
  lighthouseResult?: { categories?: { performance?: { score?: number } }; audits?: Record<string, { numericValue?: number }> };
  loadingExperience?: { metrics?: Record<string, { percentile?: number }> };
}) {
  const audits = reply.lighthouseResult?.audits ?? {};
  const field = reply.loadingExperience?.metrics ?? {};
  const out: Record<string, number> = {};
  const score = reply.lighthouseResult?.categories?.performance?.score;
  if (score != null) out.performance = Math.round(score * 100);
  const lcp = field.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? audits["largest-contentful-paint"]?.numericValue;
  if (lcp != null) out.lcp = Math.round(lcp);
  const cls = field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : audits["cumulative-layout-shift"]?.numericValue;
  if (cls != null) out.cls = Math.round(cls * 1000) / 1000;
  const inp = field.INTERACTION_TO_NEXT_PAINT?.percentile;
  if (inp != null) out.inp = inp;
  const tbt = audits["total-blocking-time"]?.numericValue;
  if (tbt != null) out.tbt = Math.round(tbt);
  return out;
}

export interface QueryStats {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number;
}

/** Sums Search Console rows by query (position weighted by impressions). */
export function byQuery(rows: { query: string; page: string; clicks: number; impressions: number; position: number }[]) {
  const map = new Map<string, QueryStats & { weighted: number }>();
  for (const r of rows) {
    const q = map.get(r.query) ?? { query: r.query, page: r.page, clicks: 0, impressions: 0, position: 0, weighted: 0 };
    q.clicks += r.clicks;
    q.impressions += r.impressions;
    q.weighted += r.position * r.impressions;
    map.set(r.query, q);
  }
  return new Map([...map].map(([k, q]) => [k, { query: q.query, page: q.page, clicks: q.clicks, impressions: q.impressions, position: q.weighted / Math.max(q.impressions, 1) }]));
}

/** Searches whose average position moved 3+ places between two weeks (with enough impressions to mean something). */
export function rankChanges(prior: Map<string, QueryStats>, recent: Map<string, QueryStats>, minImpressions = 20) {
  const changes: { query: string; page: string; from: number; to: number; impressions: number }[] = [];
  for (const [query, now] of recent) {
    const before = prior.get(query);
    if (!before || now.impressions < minImpressions || before.impressions < minImpressions) continue;
    if (Math.abs(before.position - now.position) >= 3) changes.push({ query, page: now.page, from: Math.round(before.position * 10) / 10, to: Math.round(now.position * 10) / 10, impressions: now.impressions });
  }
  return {
    gained: changes.filter((c) => c.to < c.from).sort((a, b) => b.from - b.to - (a.from - a.to)),
    lost: changes.filter((c) => c.to > c.from).sort((a, b) => b.to - b.from - (a.to - a.from)),
  };
}

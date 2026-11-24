// Phases 5–6: weekly speed checks, indexing checks for new articles, and ranking changes. No AI requests.
import { byQuery, rankChanges, readPageSpeed, speedDrops } from "../../src/lib/studio/monitor";
import { hasModule } from "../../src/lib/studio/plans";
import { allPosts, db, enqueue, raiseSignal, setting, todayIst } from "../db";
import { conn } from "../connections";
import { gscConfigured, inspectUrl } from "../gsc";
import { currentPlan, currentProfile } from "../profile";

interface MonitorState {
  speed?: string;
  inspect?: string;
  ranks?: string;
}
const state = () => setting<MonitorState>("monitor_state", {});
const saveState = async (next: MonitorState) => db.from("settings").upsert({ key: "monitor_state", value: next });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const daysAgo = (n: number) => new Date(Date.now() + 5.5 * 3_600_000 - n * 86_400_000).toISOString().slice(0, 10);

/** The pages worth watching: the home page, the most-clicked pages, and the newest articles (at most 6). */
async function keyPages() {
  const site = currentProfile().siteUrl.replace(/\/$/, "");
  const { data } = await db.from("gsc_daily").select("page,clicks").gte("date", daysAgo(30)).limit(20_000);
  const clicks = new Map<string, number>();
  for (const r of (data ?? []) as { page: string; clicks: number }[]) clicks.set(r.page, (clicks.get(r.page) ?? 0) + r.clicks);
  const top = [...clicks].sort((a, b) => b[1] - a[1]).map(([page]) => (page.startsWith("http") ? page : `${site}${page}`));
  const newest = (await allPosts())
    .filter((p) => p.stage === "live" && p.published_url)
    .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))
    .map((p) => p.published_url!);
  return [...new Set([`${site}/`, ...top.slice(0, 3), ...newest.slice(0, 2)])].slice(0, 6);
}

/** Weekly PageSpeed (mobile) for the key pages; an alert when a page drops a Core Web Vitals band. */
export async function speedCheck() {
  if (!hasModule(currentPlan(), "speed")) return { skipped: "speed is off for this client" };
  const key = conn("pagespeedKey");
  const pages = await keyPages();
  const { data: previousRows } = await db.from("metrics_daily").select("date,url,metric,value").lt("date", todayIst()).gte("date", daysAgo(21)).limit(5000);
  const previous = new Map<string, Record<string, number>>();
  for (const r of ((previousRows ?? []) as { date: string; url: string; metric: string; value: number }[]).sort((a, b) => a.date.localeCompare(b.date))) {
    previous.set(r.url, { ...(previous.get(r.url) ?? {}), [r.metric]: r.value });
  }
  let checked = 0;
  const drops: string[] = [];
  for (const url of pages) {
    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance${key ? `&key=${encodeURIComponent(key)}` : ""}`;
    try {
      const res = await fetch(api, { signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`PageSpeed answered ${res.status}`);
      const metrics = readPageSpeed(await res.json());
      const rows = Object.entries(metrics).map(([metric, value]) => ({ date: todayIst(), url, metric, value }));
      if (rows.length) await db.from("metrics_daily").upsert(rows, { onConflict: "workspace_id,date,url,metric" });
      for (const d of speedDrops(previous.get(url) ?? {}, metrics)) drops.push(`${url.replace(/^https?:\/\/[^/]+/, "") || "/"}: ${d.metric.toUpperCase()} is now ${d.to}`);
      checked++;
    } catch (error) {
      console.warn(`[speed] ${url}: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(2000);
  }
  if (drops.length) {
    await raiseSignal({ kind: "quality_gate", title: `Speed got worse: ${drops.slice(0, 3).join("; ")}`, detail: { drops }, priority: "P2", post_id: null, topic_id: null, dedupe_key: `speed:${todayIst()}` });
  }
  return { checked, drops: drops.length };
}

/** New articles: is Google indexing them? Checked every 2 days until indexed; an alert after a week if not. */
export async function inspectUrls() {
  if (!hasModule(currentPlan(), "indexing") || !gscConfigured()) return { skipped: "indexing is off or Search Console isn't connected" };
  const posts = (await allPosts()).filter((p) => p.stage === "live" && p.published_at && Date.now() - Date.parse(p.published_at) < 60 * 86_400_000);
  const { data } = await db.from("url_inspections").select("url,indexed,checked_at").order("checked_at", { ascending: false }).limit(2000);
  const latest = new Map<string, { indexed: boolean; checked_at: string }>();
  for (const r of (data ?? []) as { url: string; indexed: boolean; checked_at: string }[]) if (!latest.has(r.url)) latest.set(r.url, r);
  const due = posts.filter((p) => {
    const url = p.published_url ?? `${currentProfile().origin}/blog/${p.slug}`;
    const last = latest.get(url);
    return !last || (!last.indexed && Date.now() - Date.parse(last.checked_at) > 2 * 86_400_000);
  });
  let checked = 0;
  for (const post of due.slice(0, 20)) {
    const url = post.published_url ?? `${currentProfile().origin}/blog/${post.slug}`;
    try {
      const r = await inspectUrl(url);
      await db.from("url_inspections").insert({ url, indexed: r.indexed, verdict: r.verdict, coverage: r.coverage, last_crawl: r.lastCrawl, canonical: r.canonical });
      checked++;
      const age = (Date.now() - Date.parse(post.published_at!)) / 86_400_000;
      if (!r.indexed && age >= 7) {
        await raiseSignal({
          kind: "quality_gate",
          title: `"${post.title}" isn't in Google after ${Math.floor(age)} days: ${r.coverage}`,
          detail: { url, ...r },
          priority: "P2",
          post_id: post.id,
          topic_id: null,
          dedupe_key: `not-indexed:${post.id}:${Math.floor(age / 7)}`,
        });
      }
    } catch (error) {
      console.warn(`[indexing] ${url}: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(1500);
  }
  return { checked };
}

/** Week-on-week ranking moves of 3+ places, from Search Console data already synced. */
export async function rankingAlerts() {
  if (!hasModule(currentPlan(), "rankings")) return { skipped: "rankings are off for this client" };
  const [recentRows, priorRows] = await Promise.all([
    db.from("gsc_daily").select("query,page,clicks,impressions,position").gte("date", daysAgo(9)).lte("date", daysAgo(3)).limit(50_000),
    db.from("gsc_daily").select("query,page,clicks,impressions,position").gte("date", daysAgo(16)).lte("date", daysAgo(10)).limit(50_000),
  ]);
  type Row = { query: string; page: string; clicks: number; impressions: number; position: number };
  const { gained, lost } = rankChanges(byQuery((priorRows.data ?? []) as Row[]), byQuery((recentRows.data ?? []) as Row[]));
  if (lost.length) {
    await raiseSignal({
      kind: "quality_gate",
      title: `Rankings dropped for ${lost.length} search${lost.length > 1 ? "es" : ""}, e.g. "${lost[0].query}" #${lost[0].from} → #${lost[0].to}`,
      detail: { lost: lost.slice(0, 20), gained: gained.slice(0, 20) },
      priority: "P2",
      post_id: null,
      topic_id: null,
      dedupe_key: `ranks:${todayIst()}`,
    });
  }
  return { gained: gained.length, lost: lost.length };
}

/** Speed weekly, indexing every day, rankings weekly (Monday). Called from the schedule for each client. */
export async function scheduleMonitoring() {
  const plan = currentPlan();
  const s = await state();
  const today = todayIst();
  const weekday = new Date(Date.now() + 5.5 * 3_600_000).getUTCDay();
  const next = { ...s };
  const pending = async (type: string) => ((await db.from("jobs").select("id", { count: "exact", head: true }).eq("type", type).in("status", ["queued", "running"])).count ?? 0) > 0;
  let queued = false;
  if (hasModule(plan, "speed") && (!s.speed || Date.now() - Date.parse(s.speed) >= 7 * 86_400_000) && !(await pending("speed_check"))) {
    await enqueue("speed_check");
    next.speed = today;
    queued = true;
  }
  if (hasModule(plan, "indexing") && gscConfigured() && s.inspect !== today && !(await pending("inspect_urls"))) {
    await enqueue("inspect_urls");
    next.inspect = today;
    queued = true;
  }
  if (hasModule(plan, "rankings") && weekday === 1 && s.ranks !== today && !(await pending("sync_rankings"))) {
    await enqueue("sync_rankings");
    next.ranks = today;
    queued = true;
  }
  if (queued) await saveState(next);
  return queued;
}

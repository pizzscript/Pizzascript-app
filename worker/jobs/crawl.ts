// Phase 4: the weekly site health crawl. Polite by design: same site only, robots.txt obeyed, one request a second,
// a page cap from the client's plan. A big site is read over several short runs, so the queue never stalls.
import { findIssues, healthScore, isSitemapIndex, locsIn, readPage, robotsAllows, sitemapsIn, type CrawledPage } from "../../src/lib/studio/crawl";
import { hasModule } from "../../src/lib/studio/plans";
import { check, db, enqueue, raiseSignal, todayIst } from "../db";
import { currentPlan, currentProfile } from "../profile";
import { addUsage } from "../usage";

const AGENT = "PizzaScriptSiteHealth/1.0 (+https://www.pizzascript.com)";
const GAP_MS = 1000;
const TIMEOUT_MS = 15_000;
const PAGES_PER_RUN = 120;
const MAX_OUTBOUND = 80;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Frontier {
  queue: string[];
  seen: string[];
  sitemap: string[];
  robots: string;
  sitemapMissing: boolean;
}

async function get(url: string, method: "GET" | "HEAD" = "GET") {
  return fetch(url, { method, redirect: "manual", headers: { "user-agent": AGENT, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

const normal = (u: string) => {
  const url = new URL(u);
  url.hash = "";
  return url.href;
};

/** Follows up to 5 redirects by hand, so chains and loops can be reported. */
async function visit(url: string): Promise<{ status: number; redirects: number; loop: boolean; ms: number; html: string | null; final: string }> {
  const started = Date.now();
  const seen = new Set<string>();
  let current = url;
  for (let hop = 0; hop <= 5; hop++) {
    if (seen.has(current)) return { status: 310, redirects: hop, loop: true, ms: Date.now() - started, html: null, final: current };
    seen.add(current);
    let res: Response;
    try {
      res = await get(current);
    } catch {
      return { status: 0, redirects: hop, loop: false, ms: Date.now() - started, html: null, final: current };
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = normal(new URL(location, current).href);
      continue;
    }
    const html = res.ok && /html/i.test(res.headers.get("content-type") ?? "") ? (await res.text()).slice(0, 1_500_000) : null;
    return { status: res.status, redirects: hop, loop: false, ms: Date.now() - started, html, final: current };
  }
  return { status: 310, redirects: 5, loop: false, ms: Date.now() - started, html: null, final: current };
}

async function readSitemaps(site: string, robots: string) {
  const urls = new Set<string>();
  const queue = sitemapsIn(robots).length ? sitemapsIn(robots) : [`${site}/sitemap.xml`];
  let read = 0;
  while (queue.length && read < 10) {
    const map = queue.shift()!;
    read++;
    try {
      const res = await fetch(map, { headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) continue;
      const xml = await res.text();
      if (isSitemapIndex(xml)) queue.push(...locsIn(xml));
      else for (const loc of locsIn(xml)) urls.add(normal(loc));
    } catch {
      // an unreadable sitemap is reported as missing below if none worked
    }
    await sleep(GAP_MS);
  }
  return [...urls];
}

/** Starts a crawl, or continues the one in progress. Returns what it did. */
export async function crawlSite() {
  const plan = currentPlan();
  if (!hasModule(plan, "site_health")) return { skipped: "site health is off for this client" };
  const site = new URL(currentProfile().siteUrl).origin;
  const host = new URL(site).host;
  const limit = Math.max(10, plan.crawlPages);

  let { data: run } = await db.from("crawl_runs").select("*").eq("status", "running").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!run) {
    const robots = await fetch(`${site}/robots.txt`, { headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "");
    const sitemap = await readSitemaps(site, robots);
    const start = [...new Set([normal(`${site}/`), ...sitemap.filter((u) => new URL(u).host === host)])];
    const frontier: Frontier = { queue: start, seen: start, sitemap, robots, sitemapMissing: sitemap.length === 0 };
    run = check(await db.from("crawl_runs").insert({ frontier }).select("*").single(), "crawl start");
  }
  const frontier = run!.frontier as Frontier;
  const allowed = robotsAllows(frontier.robots);
  const inSitemap = new Set(frontier.sitemap);
  const { count: done } = await db.from("crawl_pages").select("url", { count: "exact", head: true }).eq("run_id", run!.id);
  let pagesDone = done ?? 0;
  let thisRun = 0;

  while (frontier.queue.length && pagesDone < limit && thisRun < PAGES_PER_RUN) {
    const url = frontier.queue.shift()!;
    if (!allowed(new URL(url).pathname + new URL(url).search)) continue;
    const page = await visit(url);
    const facts = page.html ? readPage(page.html, page.final) : null;
    await db.from("crawl_pages").upsert({ run_id: run!.id, url, status: page.status, redirects: page.redirects, loop: page.loop, ms: page.ms, in_sitemap: inSitemap.has(url), facts }, { onConflict: "run_id,url" });
    for (const link of facts?.links ?? []) {
      if (new URL(link).host !== host || frontier.seen.includes(link) || frontier.seen.length >= limit * 3) continue;
      frontier.seen.push(link);
      frontier.queue.push(link);
    }
    pagesDone++;
    thisRun++;
    await sleep(GAP_MS);
  }
  void addUsage({ pages: thisRun });

  if (frontier.queue.length && pagesDone < limit) {
    await db.from("crawl_runs").update({ frontier, pages: pagesDone }).eq("id", run!.id);
    await enqueue("crawl_site");
    return { continued: true, pages: pagesDone };
  }
  return finish(run!.id, frontier, pagesDone, host);
}

/** Checks outbound links once (HEAD, then GET), scores the site and records what's new and what got fixed. */
async function finish(runId: string, frontier: Frontier, pages: number, host: string) {
  const { data } = await db.from("crawl_pages").select("url,status,redirects,loop,ms,in_sitemap,facts").eq("run_id", runId).limit(20_000);
  const crawled: CrawledPage[] = ((data ?? []) as { url: string; status: number; redirects: number; loop: boolean; ms: number; in_sitemap: boolean; facts: CrawledPage["facts"] }[]).map((p) => ({
    url: p.url,
    status: p.status,
    redirects: p.redirects,
    loop: p.loop,
    ms: p.ms,
    inSitemap: p.in_sitemap,
    facts: p.facts,
  }));
  const outbound = new Map<string, number>();
  const external = [...new Set(crawled.flatMap((p) => p.facts?.links ?? []).filter((l) => new URL(l).host !== host))].slice(0, MAX_OUTBOUND);
  for (const link of external) {
    try {
      let res = await fetch(link, { method: "HEAD", headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      // Many sites refuse HEAD; only a GET failure counts.
      if (res.status >= 400) res = await fetch(link, { headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      outbound.set(link, res.status);
    } catch {
      outbound.set(link, 0);
    }
    await sleep(300);
  }

  const issues = findIssues(crawled, outbound);
  if (frontier.sitemapMissing) issues.push({ url: `https://${host}/sitemap.xml`, type: "sitemap_missing", detail: "" });
  const score = healthScore(crawled.length, issues);
  const now = new Date().toISOString();

  const { data: openRows } = await db.from("crawl_issues").select("url,type").is("fixed_at", null);
  const found = new Set(issues.map((i) => `${i.url}|${i.type}`));
  const open = new Set(((openRows ?? []) as { url: string; type: string }[]).map((r) => `${r.url}|${r.type}`));
  const fresh = issues.filter((i) => !open.has(`${i.url}|${i.type}`));
  for (const i of issues) {
    await db.from("crawl_issues").upsert({ url: i.url, type: i.type, detail: i.detail, last_seen: now, fixed_at: null, ...(open.has(`${i.url}|${i.type}`) ? {} : { first_seen: now }) }, { onConflict: "workspace_id,url,type" });
  }
  const fixed = [...open].filter((k) => !found.has(k));
  for (const key of fixed) {
    const [url, type] = key.split("|");
    await db.from("crawl_issues").update({ fixed_at: now }).eq("url", url).eq("type", type);
  }
  const counts = issues.reduce<Record<string, number>>((c, i) => ((c[i.type] = (c[i.type] ?? 0) + 1), c), {});
  await db.from("crawl_runs").update({ status: "done", finished_at: now, pages, score, frontier: [], summary: { counts, new: fresh.length, fixed: fixed.length, outboundChecked: external.length } }).eq("id", runId);
  // Only the latest run's pages are kept.
  await db.from("crawl_pages").delete().neq("run_id", runId);

  const newErrors = fresh.filter((i) => ["http_error", "broken_internal_link", "redirect_loop", "missing_title", "noindex_in_sitemap"].includes(i.type));
  if (newErrors.length) {
    await raiseSignal({
      kind: "quality_gate",
      title: `Site health: ${newErrors.length} new problem${newErrors.length > 1 ? "s" : ""} (score ${score}). First: ${newErrors[0].url}`,
      detail: { score, newErrors: newErrors.slice(0, 20) },
      priority: "P1",
      post_id: null,
      topic_id: null,
      dedupe_key: `crawl:${todayIst()}`,
    });
  }
  return { pages, score, issues: issues.length, new: fresh.length, fixed: fixed.length };
}

/** Weekly, on Sundays (IST), or on the first day the module is on. */
export async function scheduleCrawl() {
  if (!hasModule(currentPlan(), "site_health")) return false;
  const { data: last } = await db.from("crawl_runs").select("started_at,status").order("started_at", { ascending: false }).limit(1).maybeSingle();
  const { count: pending } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("type", "crawl_site").in("status", ["queued", "running"]);
  if (pending) return false;
  const age = last ? Date.now() - Date.parse(last.started_at) : Infinity;
  if (last?.status === "running" && age < 86_400_000) return false;
  if (age < 7 * 86_400_000) return false;
  await enqueue("crawl_site");
  return true;
}

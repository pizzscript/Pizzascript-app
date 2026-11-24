// Phase 7: weekly content growth. Finds articles losing clicks (refresh), articles Google shows but nobody clicks
// (better title, within the AI budget) and articles no other article links to (orphans). Suggestions, never silent edits.
import { internalLinks } from "../../src/lib/studio/content";
import { hasModule } from "../../src/lib/studio/plans";
import type { StudioPost } from "../../src/lib/studio/types";
import { allPosts, db, enqueue, raiseSignal, setting, todayIst } from "../db";
import { currentPlan } from "../profile";
import { RELATED_SIMILARITY, storedMatches } from "../research/embeddings";
import { aiBudgetLeft } from "../usage";

const daysAgo = (n: number) => new Date(Date.now() + 5.5 * 3_600_000 - n * 86_400_000).toISOString().slice(0, 10);

/** The page path Search Console reports for an article: its address on the client's site, or PizzaScript's /blog/. */
export function pagePath(post: Pick<StudioPost, "slug" | "published_url">) {
  if (!post.published_url) return `/blog/${post.slug}`;
  try {
    const u = new URL(post.published_url);
    return u.pathname + u.search;
  } catch {
    return `/blog/${post.slug}`;
  }
}

type Row = { page: string; clicks: number; impressions: number; position: number };
function totals(rows: Row[]) {
  const map = new Map<string, { clicks: number; impressions: number; weighted: number }>();
  for (const r of rows) {
    const v = map.get(r.page) ?? { clicks: 0, impressions: 0, weighted: 0 };
    v.clicks += r.clicks;
    v.impressions += r.impressions;
    v.weighted += r.position * r.impressions;
    map.set(r.page, v);
  }
  return map;
}

/** Losing articles: 30%+ fewer clicks than the four weeks before, from at least 20. */
export function losingPages(recent: Map<string, { clicks: number }>, prior: Map<string, { clicks: number }>) {
  return [...prior]
    .filter(([page, before]) => before.clicks >= 20 && (recent.get(page)?.clicks ?? 0) <= before.clicks * 0.7)
    .map(([page, before]) => ({ page, before: before.clicks, now: recent.get(page)?.clicks ?? 0 }))
    .sort((a, b) => b.before - b.now - (a.before - a.now));
}

/** Live articles that no other live article links to. */
export function orphans<T extends Pick<StudioPost, "id" | "slug" | "stage" | "body_html">>(posts: T[]): T[] {
  const live = posts.filter((p) => p.stage === "live");
  const linked = new Set(live.flatMap((p) => internalLinks(p.body_html).map((l) => l.href)));
  return live.filter((p) => !linked.has(`/blog/${p.slug}`));
}

export async function contentGrowth() {
  if (!hasModule(currentPlan(), "content_growth")) return { skipped: "content growth is off for this client" };
  const posts = await allPosts();
  const live = posts.filter((p) => p.stage === "live");
  const byPath = new Map(live.map((p) => [pagePath(p), p]));
  const [recentRows, priorRows] = await Promise.all([
    db.from("gsc_daily").select("page,clicks,impressions,position").gte("date", daysAgo(30)).lte("date", daysAgo(3)).limit(100_000),
    db.from("gsc_daily").select("page,clicks,impressions,position").gte("date", daysAgo(58)).lte("date", daysAgo(31)).limit(100_000),
  ]);
  const recent = totals((recentRows.data ?? []) as Row[]);
  const prior = totals((priorRows.data ?? []) as Row[]);

  // 1. Refresh: articles losing clicks.
  let refresh = 0;
  for (const loss of losingPages(recent, prior).slice(0, 5)) {
    const post = byPath.get(loss.page);
    if (!post) continue;
    refresh++;
    await raiseSignal({
      kind: "refresh",
      title: `"${post.title}" fell from ${loss.before} to ${loss.now} clicks in four weeks. Refresh it: update facts, add what's missing, check the title.`,
      detail: loss,
      priority: "P2",
      post_id: post.id,
      topic_id: post.topic_id,
      dedupe_key: `growth-refresh:${post.id}:${todayIst().slice(0, 7)}`,
    });
  }

  // 2. Better titles: shown 100+ times on page one, under 1.5% clicked. One AI retitle per article a month, within budget.
  const titled = await setting<Record<string, string>>("growth_titles", {});
  let retitled = 0;
  for (const [page, s] of recent) {
    const post = byPath.get(page);
    const position = s.weighted / Math.max(s.impressions, 1);
    if (!post || s.impressions < 100 || position > 10 || s.clicks / s.impressions >= 0.015) continue;
    if (titled[post.id] && Date.now() - Date.parse(titled[post.id]) < 30 * 86_400_000) continue;
    if ((await aiBudgetLeft()) < 10 || retitled >= 2) break;
    await enqueue("fix_title", { postId: post.id });
    titled[post.id] = new Date().toISOString();
    retitled++;
  }
  if (retitled) await db.from("settings").upsert({ key: "growth_titles", value: titled });

  // 3. Orphans: suggest a link from the closest related article (the admin clicks "Add link").
  let linked = 0;
  for (const orphan of orphans(posts).slice(0, 5)) {
    const related = (await storedMatches("post", orphan.id, 5).catch(() => [])).filter((m) => m.owner_type === "post" && m.similarity >= RELATED_SIMILARITY);
    const source = related.map((m) => live.find((p) => p.id === m.owner_id)).find(Boolean);
    if (!source) continue;
    linked++;
    await raiseSignal({
      kind: "backlink_needed",
      title: `No article links to "${orphan.title}". Link to it from "${source.title}".`,
      detail: { fromSlug: source.slug, toPath: `/blog/${orphan.slug}` },
      priority: "P2",
      post_id: source.id,
      topic_id: null,
      dedupe_key: `backlink:${source.slug}:/blog/${orphan.slug}`,
    });
  }
  return { refresh, retitled, orphanLinks: linked };
}

/** Weekly on Tuesdays (IST). */
export async function scheduleGrowth() {
  if (!hasModule(currentPlan(), "content_growth")) return false;
  const weekday = new Date(Date.now() + 5.5 * 3_600_000).getUTCDay();
  const last = await setting<string>("last_content_growth", "");
  if (weekday !== 2 || last === todayIst()) return false;
  await db.from("settings").upsert({ key: "last_content_growth", value: todayIst() });
  await enqueue("content_growth");
  return true;
}

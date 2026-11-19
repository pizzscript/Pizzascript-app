import { composeBriefing } from "../../src/lib/studio/briefing";
import { plainText } from "../../src/lib/studio/content";
import type { AgentMessage, StudioPost } from "../../src/lib/studio/types";
import { allBatches, allClusters, allPosts, allTopics, check, db, getPost, openSignals, raiseSignal, setting, todayIst } from "../db";
import { json, text } from "../gemini";
import { fetchGsc, gscConfigured, type GscRow } from "../gsc";
import { AGENT, STRATEGY, WRITING } from "../rules";

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

function weekKey() {
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}w${Math.ceil(((d.getTime() - start.getTime()) / 86_400_000 + start.getUTCDay() + 1) / 7)}`;
}

const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));

// ───────────────────────── GSC sync + signals ─────────────────────────

async function syncGsc() {
  // Search Console data lags ~2–3 days; re-pull the last 5 days so late rows fill in.
  const rows = await fetchGsc(day(-6), day(-1));
  for (let i = 0; i < rows.length; i += 500) {
    check(await db.from("gsc_daily").upsert(rows.slice(i, i + 500), { onConflict: "date,page,query" }), "gsc upsert");
  }
  return rows.length;
}

async function gscWindow(from: string, to: string) {
  const { data } = await db.from("gsc_daily").select("*").gte("date", from).lte("date", to);
  return (data ?? []) as GscRow[];
}

function byPage(rows: GscRow[]) {
  const pages = new Map<string, { impressions: number; clicks: number; weightedPos: number }>();
  for (const r of rows) {
    const p = pages.get(r.page) ?? { impressions: 0, clicks: 0, weightedPos: 0 };
    p.impressions += r.impressions;
    p.clicks += r.clicks;
    p.weightedPos += r.position * r.impressions;
    pages.set(r.page, p);
  }
  return new Map([...pages].map(([page, p]) => [page, { ...p, position: p.weightedPos / Math.max(p.impressions, 1), ctr: p.clicks / Math.max(p.impressions, 1) }]));
}

async function gscSignals(posts: StudioPost[]) {
  const postByPath = new Map(posts.map((p) => [`/blog/${p.slug}`, p]));
  const last28 = byPage(await gscWindow(day(-30), day(-2)));
  const recent = byPage(await gscWindow(day(-9), day(-2)));
  const prior = byPage(await gscWindow(day(-16), day(-10)));

  for (const [page, s] of last28) {
    if (s.impressions >= 30 && s.position <= 10 && s.ctr < 0.02) {
      const post = postByPath.get(page);
      await raiseSignal({
        kind: "low_ctr",
        title: `${page} ranks #${s.position.toFixed(0)} but gets ${(s.ctr * 100).toFixed(1)}% CTR on ${s.impressions} impressions`,
        detail: { page, ...s },
        priority: "P1",
        post_id: post?.id ?? null,
        topic_id: null,
        dedupe_key: `low_ctr:${page}:${weekKey()}`,
      });
    }
  }
  for (const [page, now] of recent) {
    const before = prior.get(page);
    if (!before || now.impressions < 10 || before.impressions < 10) continue;
    const delta = before.position - now.position;
    if (Math.abs(delta) < 5) continue;
    await raiseSignal({
      kind: delta > 0 ? "rank_up" : "rank_down",
      title: `${page} position ${before.position.toFixed(0)} → ${now.position.toFixed(0)}`,
      detail: { page, before: before.position, after: now.position, impressions: now.impressions },
      priority: delta > 0 ? "P3" : "P1",
      post_id: postByPath.get(page)?.id ?? null,
      topic_id: null,
      dedupe_key: `rank:${page}:${weekKey()}`,
    });
  }

  // Queries with real demand that no article or topic covers.
  const topics = await allTopics();
  const covered = [...topics.map((t) => t.query), ...posts.map((p) => String(p.seo_plan?.targetQuery ?? ""))].map(tokens);
  const queries = new Map<string, number>();
  for (const r of await gscWindow(day(-30), day(-2))) queries.set(r.query, (queries.get(r.query) ?? 0) + r.impressions);
  for (const [query, impressions] of queries) {
    if (impressions < 15 || /pizza ?script/i.test(query)) continue;
    const q = tokens(query);
    const best = Math.max(0, ...covered.map((c) => [...q].filter((t) => c.has(t)).length / Math.max(q.size, 1)));
    if (best >= 0.6) continue;
    await raiseSignal({
      kind: "query_gap",
      title: `"${query}" — ${impressions} impressions, no article covers it`,
      detail: { query, impressions },
      priority: "P2",
      post_id: null,
      topic_id: null,
      dedupe_key: `gap:${query}`,
    });
  }
}

// ───────────────────────── trend scan ─────────────────────────

async function trendScan() {
  const neverCover = await setting<string[]>("never_cover", []);
  const trends = await json<{ name: string; type: 1 | 2 | 3; passes: boolean; indiaAngle: boolean; query: string; why: string }[]>(
    `Scan the last 48 hours for news that matters to a studio building React/Next.js sites with GSAP/Lenis animation, deployed on Vercel/Cloudflare, focused on performance and technical SEO.
Consider: Next.js/React/Vite/GSAP/Lenis/Tailwind releases, Vercel/Cloudflare platform changes, Google algorithm or Core Web Vitals updates, web standards.
A trend PASSES only if it is (1) a stack technology update with practical impact, (2) a Google/search/Core Web Vitals change affecting client sites, or (3) a web-standards shift — AND the studio can write something useful from real experience within 48h. Skip hype, funding news and generic AI news. Never cover: ${neverCover.join("; ")}.
Return a JSON array (max 3, empty if nothing passes): [{"name":"","type":1,"passes":true,"indiaAngle":false,"query":"the search query people will use","why":"one line"}]`,
    `${AGENT}\n\n${STRATEGY}`,
    { search: true },
  );
  for (const trend of trends.filter((t) => t.passes)) {
    const slug = trend.query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const { data: topic } = await db
      .from("topics")
      .upsert({ slug, query: trend.query, track: 1, role: "trend", source: "trend", priority: "P0", status: "candidate", reason: trend.why }, { onConflict: "slug", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    await raiseSignal({
      kind: "trend",
      title: `${trend.name} — ${trend.why}${trend.indiaAngle ? " · India angle" : ""}`,
      detail: trend,
      priority: "P0",
      post_id: null,
      topic_id: topic?.id ?? null,
      dedupe_key: `trend:${slug}`,
    });
  }
  return trends.length;
}

// ───────────────────────── daily_briefing ─────────────────────────

export async function dailyBriefing() {
  const notes: string[] = [];
  const posts = await allPosts();
  if (gscConfigured()) {
    try {
      notes.push(`GSC: ${await syncGsc()} rows synced`);
      await gscSignals(posts);
    } catch (error) {
      notes.push(`GSC sync failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  try {
    await trendScan();
  } catch (error) {
    notes.push(`Trend scan failed: ${error instanceof Error ? error.message : error}`);
  }

  const [signals, clusters, topics, batches] = await Promise.all([openSignals(), allClusters(), allTopics(), allBatches()]);
  const date = todayIst();
  const base = composeBriefing(date, { posts, signals, clusters, topics, batches });

  const summary = `TODAY ${date}
Base recommendation: ${base.content.recommendation.text}
Open signals: ${signals.map((s) => `[${s.priority}] ${s.title}`).join("; ") || "none"}
Next slots: ${posts
    .filter((p) => p.stage !== "live" && p.scheduled_for)
    .sort((a, b) => a.scheduled_for!.localeCompare(b.scheduled_for!))
    .slice(0, 5)
    .map((p) => `${p.scheduled_for!.slice(0, 10)} "${p.title}" (${p.stage}${p.audit && !p.audit.ok ? ", audit failing" : ""})`)
    .join("; ")}
Batches: ${batches.map((b) => `${b.name} ${b.approved_at ? "approved" : "awaiting approval"}`).join("; ")}`;

  const text_ = await text(
    `${summary}\n\nWrite today's recommendation for the studio owner in at most two sentences: the single most important thing to do and why. Be specific and opinionated. If you disagree with the base recommendation, say so and why. No greeting, no headings.`,
    AGENT,
    { temperature: 0.5 },
  ).catch(() => base.content.recommendation.text);

  const content = { ...base.content, recommendation: { ...base.content.recommendation, text: text_ }, notes: [...base.content.notes, ...notes] };
  check(await db.from("briefings").upsert({ date, content }), "briefing");
  return { signals: signals.length };
}

// ───────────────────────── discuss ─────────────────────────

export async function discuss({ thread }: { thread: string }) {
  const messages = check(await db.from("agent_messages").select("*").eq("thread", thread).order("created_at"), "thread") as AgentMessage[];
  let context = "";
  if (thread.startsWith("briefing:")) {
    const { data } = await db.from("briefings").select("content").eq("date", thread.slice(9)).maybeSingle();
    const [signals, posts] = await Promise.all([openSignals(), allPosts()]);
    context = `TODAY'S BRIEFING: ${JSON.stringify(data?.content ?? {})}
OPEN SIGNALS: ${signals.map((s) => s.title).join("; ")}
UPCOMING: ${posts.filter((p) => p.stage !== "live" && p.scheduled_for).map((p) => `${p.scheduled_for!.slice(0, 10)} ${p.title} [${p.stage}]`).join("; ")}`;
  } else if (thread.startsWith("post:")) {
    const post = await getPost(thread.slice(5));
    context = `ARTICLE: "${post.title}" · query ${post.seo_plan?.targetQuery} · T${post.track} ${post.role} · stage ${post.stage}
BRIEF: ${JSON.stringify(post.brief)}
AUDIT: ${post.audit ? post.audit.checks.filter((c) => !c.pass).map((c) => c.label).join("; ") || "passing" : "not run"}
OPENING: ${plainText(post.body_html).slice(0, 1200)}`;
  }
  const transcript = messages.map((m) => `${m.role === "admin" ? "OWNER" : "AGENT"}: ${m.content}`).join("\n");
  const reply = await text(
    `${context}\n\nCONVERSATION:\n${transcript}\n\nReply to the owner's last message. Be direct and specific; push back if they're wrong, concede if they're right. Under 120 words. If an action is needed, name it (e.g. "Rewrite section 2", "Push to Friday", "Reject the topic").`,
    `${AGENT}\n\n${STRATEGY}\n\n${WRITING}`,
    { temperature: 0.6 },
  );
  check(await db.from("agent_messages").insert({ thread, role: "agent", content: reply }), "reply");
  return { ok: true };
}

// ───────────────────────── quality_gate (every 5 drafts) ─────────────────────────

export async function qualityGate() {
  const { data: drafts } = await db
    .from("post_versions")
    .select("post_id,created_at")
    .eq("note", "Agent draft")
    .order("created_at", { ascending: false })
    .limit(5);
  const ids = [...new Set((drafts ?? []).map((d) => d.post_id))];
  if (ids.length < 2) return { skipped: true };
  const posts = check(await db.from("posts").select("*").in("id", ids), "gate posts") as StudioPost[];
  const findings = await json<{ slug: string; issue: string }[]>(
    `Quality gate over the latest drafts. Check: no two share the same angle; each opening line is a real insight (not setup); the depth criterion is genuinely present; voice matches the audience; no banned phrases; internal links reference real articles.

${posts.map((p) => `### ${p.slug} (T${p.track}, audience ${p.brief?.audience}, depth ${p.brief?.depth})\nANGLE: ${p.brief?.angle}\nOPENING: ${plainText(p.body_html).slice(0, 700)}`).join("\n\n")}

Return a JSON array of problems only (empty if all pass): [{"slug":"","issue":"specific, actionable"}]`,
    `${AGENT}\n\n${WRITING}`,
  );
  for (const f of findings) {
    const post = posts.find((p) => p.slug === f.slug);
    await raiseSignal({
      kind: "quality_gate",
      title: `${f.slug}: ${f.issue}`,
      detail: f,
      priority: "P1",
      post_id: post?.id ?? null,
      topic_id: null,
      dedupe_key: `gate:${f.slug}:${f.issue.slice(0, 40)}`,
    });
  }
  await db.from("settings").upsert({ key: "last_quality_gate", value: new Date().toISOString() });
  return { findings: findings.length };
}

// ───────────────────────── performance_check (weekly) ─────────────────────────

export async function performanceCheck() {
  const posts = (await allPosts()).filter((p) => p.stage === "live" && p.published_at);
  for (const post of posts) {
    const ageDays = (Date.now() - new Date(post.published_at!).getTime()) / 86_400_000;
    const checkpoint = ageDays >= 84 ? "w12" : ageDays >= 28 ? "w4" : null;
    if (!checkpoint) continue;
    const { data } = await db.from("gsc_daily").select("*").eq("page", `/blog/${post.slug}`).gte("date", day(-30));
    const s = byPage((data ?? []) as GscRow[]).get(`/blog/${post.slug}`);
    const performance = { ...(post.seo_plan?.performance as object), [checkpoint]: s ? { clicks: s.clicks, impressions: s.impressions, position: Math.round(s.position * 10) / 10 } : null };
    await db.from("posts").update({ seo_plan: { ...post.seo_plan, performance } }).eq("id", post.id);
    if (checkpoint === "w12" && (!s || (s.position > 20 && s.impressions > 50))) {
      await raiseSignal({
        kind: "refresh",
        title: `${post.title} is ${s ? `stuck at #${s.position.toFixed(0)}` : "not ranking"} after 12 weeks — refresh or merge`,
        detail: { page: `/blog/${post.slug}`, ...(s ?? {}) },
        priority: "P2",
        post_id: post.id,
        topic_id: post.topic_id,
        dedupe_key: `refresh:${post.slug}:w12`,
      });
    }
  }
  await db.from("settings").upsert({ key: "last_performance_check", value: todayIst() });
  return { checked: posts.length };
}

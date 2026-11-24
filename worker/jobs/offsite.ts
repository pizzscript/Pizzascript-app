// Phases 8–10: backlinks, link opportunities, competitors and local SEO. Weekly or monthly; AI only for link ideas.
import { keywordCoverage } from "../../src/lib/studio/content";
import { hasModule } from "../../src/lib/studio/plans";
import { slugFor } from "../../src/lib/studio/research";
import { allPosts, allTopics, db, enqueue, raiseSignal, setting, todayIst } from "../db";
import { conn } from "../connections";
import { json } from "../gemini";
import { currentPlan, currentProfile } from "../profile";
import { savedServices } from "../research/services";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TIMEOUT = 30_000;
const AGENT = "PizzaScriptSEO/1.0 (+https://www.pizzascript.com)";

// ───────────────────────── Backlinks (Bing Webmaster) ─────────────────────────

interface BingLinkCount {
  Url: string;
  Count: number;
}

async function bing<T>(method: string, params: Record<string, string>) {
  const key = conn("bingKey");
  if (!key) throw new Error("Bing Webmaster isn't connected for this client");
  const qs = new URLSearchParams({ ...params, apikey: key });
  const res = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/${method}?${qs}`, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`Bing answered ${res.status}`);
  return ((await res.json()) as { d: T }).d;
}

/** Who links to the client (from Bing), what's new and what was lost since last week. */
export async function backlinkScan() {
  if (!hasModule(currentPlan(), "backlinks")) return { skipped: "backlinks are off for this client" };
  if (!conn("bingKey")) return { skipped: "Bing Webmaster isn't connected" };
  const site = `${currentProfile().siteUrl.replace(/\/$/, "")}/`;
  const counts = (await bing<{ Links?: BingLinkCount[] }>("GetLinkCounts", { siteUrl: site, page: "0" })).Links ?? [];
  const now = new Date().toISOString();
  const seen = new Set<string>();
  let fresh = 0;
  const { data: known } = await db.from("backlinks").select("source_url,target_url,lost_at");
  const knownKeys = new Set(((known ?? []) as { source_url: string; target_url: string }[]).map((k) => `${k.source_url}|${k.target_url}`));
  for (const target of counts.sort((a, b) => b.Count - a.Count).slice(0, 25)) {
    const links = (await bing<{ Details?: { Url: string; AnchorText: string }[] }>("GetUrlLinks", { siteUrl: site, link: target.Url, page: "0" })).Details ?? [];
    for (const l of links.slice(0, 200)) {
      const key = `${l.Url}|${target.Url}`;
      seen.add(key);
      if (!knownKeys.has(key)) fresh++;
      await db.from("backlinks").upsert({ source_url: l.Url, target_url: target.Url, anchor: l.AnchorText?.slice(0, 200) ?? null, last_seen: now, lost_at: null }, { onConflict: "workspace_id,source_url,target_url" });
    }
    await sleep(1000);
  }
  const lost = ((known ?? []) as { source_url: string; target_url: string; lost_at: string | null }[]).filter((k) => !k.lost_at && !seen.has(`${k.source_url}|${k.target_url}`));
  for (const l of lost) await db.from("backlinks").update({ lost_at: now }).eq("source_url", l.source_url).eq("target_url", l.target_url);
  if (fresh || lost.length) {
    await raiseSignal({ kind: "quality_gate", title: `Backlinks: ${fresh} new, ${lost.length} lost this week`, detail: { lost: lost.slice(0, 20) }, priority: "P3", post_id: null, topic_id: null, dedupe_key: `backlinks:${todayIst()}` });
  }
  return { targets: counts.length, new: fresh, lost: lost.length };
}

/** Ten ideas a month for earning links, each with an outreach draft a person reviews and sends. One light AI request. */
export async function findOpportunities() {
  if (!hasModule(currentPlan(), "backlinks")) return { skipped: "backlinks are off for this client" };
  const p = currentProfile();
  const [services, posts] = await Promise.all([savedServices(), allPosts()]);
  const live = posts.filter((x) => x.stage === "live").slice(0, 15);
  const reply = await json<{ ideas: { kind: string; target: string; search: string; why: string; subject: string; draft: string }[] }>(
    `Suggest 10 realistic ways for ${p.name} (${p.researchDescription}; ${p.siteUrl}) to earn links. Readers: ${p.market}.
Kinds: "directory" (local or industry listings), "resource" (pages that list useful resources), "partner" (suppliers, clients, associations), "mention" (sites likely to mention the business), "guest" (sites accepting expert articles).
For each give: "target" (a type of site or a specific well-known site), "search" (the exact Google search a person can run to find the pages), "why" (one sentence), and a short, polite, personal outreach email ("subject", "draft", under 120 words, signed "[Your name]") that offers something useful, ideally one of these articles:
${live.map((x) => `- ${x.title}: ${x.published_url ?? `${p.origin}/blog/${x.slug}`}`).join("\n") || "(no articles yet)"}
Services: ${services.map((s) => s.title).join("; ") || "(not scanned yet)"}
Never invent statistics or claim a relationship that doesn't exist. Return {"ideas":[{"kind":"","target":"","search":"","why":"","subject":"","draft":""}]}`,
    "You are an ethical SEO link-building strategist. Return only JSON.",
    { tier: "light", temperature: 0.6 },
  );
  const ideas = (reply.ideas ?? []).filter((i) => i && i.target && i.draft).slice(0, 10);
  if (ideas.length) {
    await db.from("link_opportunities").insert(ideas.map((i) => ({ kind: String(i.kind).slice(0, 20), target: i.target.slice(0, 300), search: i.search?.slice(0, 300), why: i.why?.slice(0, 400), subject: i.subject?.slice(0, 200), draft: i.draft.slice(0, 2000) })));
    await raiseSignal({ kind: "quality_gate", title: `${ideas.length} new link ideas with outreach drafts are ready to review (Links page).`, detail: {}, priority: "P3", post_id: null, topic_id: null, dedupe_key: `opportunities:${todayIst().slice(0, 7)}` });
  }
  return { ideas: ideas.length };
}

// ───────────────────────── Competitors ─────────────────────────

/** New pages on the client's competitors (from their sitemaps); topics the client hasn't covered become ideas. */
export async function competitorScan() {
  const plan = currentPlan();
  if (!hasModule(plan, "competitors")) return { skipped: "competitors are off for this client" };
  const competitors = (await setting<string[]>("competitors", [])).slice(0, plan.competitors || 3);
  if (!competitors.length) return { skipped: "no competitors saved" };
  const [posts, topics] = await Promise.all([allPosts(), allTopics()]);
  const covered = [...posts.map((p) => p.seo_plan?.targetQuery ?? p.title), ...topics.map((t) => t.query)].filter(Boolean) as string[];
  const { data: knownRows } = await db.from("competitor_pages").select("url");
  const known = new Set(((knownRows ?? []) as { url: string }[]).map((r) => r.url));
  const firstScan = known.size === 0;
  const gaps: { competitor: string; title: string; url: string }[] = [];
  for (const competitor of competitors) {
    const origin = new URL(competitor).origin;
    const urls: string[] = [];
    try {
      const xml = await fetch(`${origin}/sitemap.xml`, { headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(TIMEOUT) }).then((r) => (r.ok ? r.text() : ""));
      const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
      for (const loc of locs.filter((l) => /sitemap.*\.xml/i.test(l)).slice(0, 3)) {
        const sub = await fetch(loc, { headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(TIMEOUT) }).then((r) => (r.ok ? r.text() : ""));
        urls.push(...[...sub.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]));
        await sleep(1000);
      }
      urls.push(...locs.filter((l) => !/\.xml$/i.test(l)));
    } catch {
      continue;
    }
    const fresh = urls.filter((u) => !known.has(u) && /\/(blog|articles?|news|insights|guides?)\//i.test(u)).slice(0, 30);
    for (const url of fresh) {
      // The title is read from the address to stay light; a slug is usually the article's topic.
      const title = decodeURIComponent(url.replace(/\/$/, "").split("/").pop() ?? "").replace(/[-_]+/g, " ").replace(/\.\w+$/, "").trim();
      await db.from("competitor_pages").upsert({ competitor: origin, url, title }, { onConflict: "workspace_id,url", ignoreDuplicates: true });
      if (!firstScan && title.split(" ").length >= 3 && !covered.some((c) => keywordCoverage(title, c) >= 0.6)) gaps.push({ competitor: origin, title, url });
    }
    await sleep(1000);
  }
  // Gaps become unscored ideas; the normal research scoring decides whether they're worth writing.
  for (const gap of gaps.slice(0, 5)) {
    await db.from("topics").upsert(
      { slug: slugFor(gap.title), query: gap.title, track: 1, role: "spoke", audience: "client", status: "candidate", source: "agent", scores: {}, filters: {}, reason: `Competitor ${new URL(gap.competitor).host} published ${gap.url}`, research: { evidence: "competitor", url: gap.url } },
      { onConflict: "slug", ignoreDuplicates: true },
    );
  }
  if (gaps.length) {
    await raiseSignal({ kind: "quality_gate", title: `Competitors published ${gaps.length} article${gaps.length > 1 ? "s" : ""} on topics you haven't covered (added to Ideas).`, detail: { gaps }, priority: "P3", post_id: null, topic_id: null, dedupe_key: `competitors:${todayIst()}` });
  }
  return { competitors: competitors.length, gaps: gaps.length, firstScan };
}

// ───────────────────────── Local SEO (Google Business Profile) ─────────────────────────

async function gbpToken() {
  const raw = conn("gbpOauth");
  if (!raw || !conn("gbpLocation")) return null;
  const creds = JSON.parse(raw) as { client_id: string; client_secret: string; refresh_token: string };
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ ...creds, grant_type: "refresh_token" }), signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`Google refused the Business Profile access (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Turns articles published in the last 3 days into Business Profile posts (once each), and alerts on new reviews. */
export async function localPost() {
  if (!hasModule(currentPlan(), "local")) return { skipped: "local SEO is off for this client" };
  const token = await gbpToken();
  if (!token) return { skipped: "Business Profile isn't connected" };
  const location = conn("gbpLocation")!;
  const { data: done } = await db.from("local_posts").select("post_id");
  const posted = new Set(((done ?? []) as { post_id: string }[]).map((d) => d.post_id));
  const recent = (await allPosts()).filter((p) => p.stage === "live" && p.published_at && Date.now() - Date.parse(p.published_at) < 3 * 86_400_000 && !posted.has(p.id));
  let count = 0;
  for (const post of recent.slice(0, 2)) {
    const url = post.published_url ?? `${currentProfile().origin}/blog/${post.slug}`;
    const res = await fetch(`https://mybusiness.googleapis.com/v4/${location}/localPosts`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ languageCode: currentProfile().language, summary: `${post.title}\n\n${post.excerpt}`.slice(0, 1450), topicType: "STANDARD", callToAction: { actionType: "LEARN_MORE", url }, ...(post.cover_image_url ? { media: [{ mediaFormat: "PHOTO", sourceUrl: post.cover_image_url }] } : {}) }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = (await res.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };
    await db.from("local_posts").insert({ post_id: post.id, remote_name: body.name ?? null, status: res.ok ? "posted" : "failed", detail: res.ok ? null : (body.error?.message ?? `HTTP ${res.status}`).slice(0, 300) });
    if (res.ok) count++;
  }
  // New reviews since the last check.
  const lastCheck = await setting<string>("gbp_reviews_checked", new Date(Date.now() - 7 * 86_400_000).toISOString());
  const reviews = await fetch(`https://mybusiness.googleapis.com/v4/${location}/reviews?pageSize=20&orderBy=updateTime desc`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT) })
    .then((r) => (r.ok ? r.json() : { reviews: [] }))
    .then((r: { reviews?: { starRating: string; comment?: string; updateTime: string; reviewer?: { displayName?: string } }[] }) => r.reviews ?? []);
  const fresh = reviews.filter((r) => r.updateTime > lastCheck);
  for (const r of fresh.slice(0, 5)) {
    const low = ["ONE", "TWO", "THREE"].includes(r.starRating);
    await raiseSignal({
      kind: "quality_gate",
      title: `New ${r.starRating.toLowerCase()}-star review from ${r.reviewer?.displayName ?? "a customer"}${low ? " — reply soon" : ""}: "${(r.comment ?? "").slice(0, 100)}"`,
      detail: { review: r },
      priority: low ? "P1" : "P3",
      post_id: null,
      topic_id: null,
      dedupe_key: `review:${r.updateTime}`,
    });
  }
  await db.from("settings").upsert({ key: "gbp_reviews_checked", value: new Date().toISOString() });
  return { posted: count, reviews: fresh.length };
}

/** Name, address and phone: the client's own pages must show the same details as their saved listing. */
export async function localCheck() {
  if (!hasModule(currentPlan(), "local")) return { skipped: "local SEO is off for this client" };
  const nap = await setting<{ name?: string; address?: string; phone?: string }>("local_profile", {});
  if (!nap.phone && !nap.address) return { skipped: "no business details saved" };
  const site = currentProfile().siteUrl.replace(/\/$/, "");
  const digits = (s: string) => s.replace(/\D/g, "").slice(-10);
  const problems: string[] = [];
  for (const path of ["/", "/contact", "/about"]) {
    const html = await fetch(`${site}${path}`, { headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(TIMEOUT) })
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "");
    if (!html) continue;
    const text = html.replace(/<[^>]+>/g, " ");
    if (nap.phone && !text.replace(/\D/g, "").includes(digits(nap.phone))) problems.push(`${path}: phone ${nap.phone} not found`);
    const street = nap.address?.split(",")[0]?.trim().toLowerCase();
    if (street && !text.toLowerCase().includes(street)) problems.push(`${path}: address "${nap.address!.split(",")[0]}" not found`);
    await sleep(1000);
  }
  if (problems.length) {
    await raiseSignal({ kind: "quality_gate", title: `Business details don't match on your site: ${problems[0]}`, detail: { problems }, priority: "P2", post_id: null, topic_id: null, dedupe_key: `nap:${todayIst().slice(0, 7)}` });
  }
  return { problems: problems.length };
}

/** Backlinks and competitors weekly (Thursday), link ideas on the 1st, local posts and reviews daily, details monthly. */
export async function scheduleOffsite() {
  const plan = currentPlan();
  const ist = new Date(Date.now() + 5.5 * 3_600_000);
  const today = todayIst();
  const state = await setting<Record<string, string>>("offsite_state", {});
  const next = { ...state };
  const due = (key: string, ok: boolean) => ok && state[key] !== today;
  const plans: [string, boolean, "backlink_scan" | "find_opportunities" | "competitor_scan" | "local_post" | "local_check"][] = [
    ["backlinks", hasModule(plan, "backlinks") && ist.getUTCDay() === 4, "backlink_scan"],
    ["opportunities", hasModule(plan, "backlinks") && ist.getUTCDate() === 1, "find_opportunities"],
    ["competitors", hasModule(plan, "competitors") && ist.getUTCDay() === 4, "competitor_scan"],
    ["local", hasModule(plan, "local"), "local_post"],
    ["nap", hasModule(plan, "local") && ist.getUTCDate() === 2, "local_check"],
  ];
  let queued = false;
  for (const [key, ok, job] of plans) {
    if (!due(key, ok)) continue;
    await enqueue(job);
    next[key] = today;
    queued = true;
  }
  if (queued) await db.from("settings").upsert({ key: "offsite_state", value: next });
  return queued;
}

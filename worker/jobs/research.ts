import { RESEARCH_DEFAULTS, checkIdeas, ideasToArchive, neededGroup, priorityForIdea, slugFor, type IdeaCandidate, type ResearchSettings } from "../../src/lib/studio/research";
import type { JobType } from "../../src/lib/studio/types";
import { allClusters, allPosts, allTopics, db, enqueue, raiseSignal, setting, todayIst } from "../db";
import { json } from "../gemini";
import { autocomplete } from "../research/autocomplete";
import { savedServices, scanServices, type ServiceProfile } from "../research/services";

export const RESEARCH_JOBS: JobType[] = ["discover_ideas", "prune_ideas", "scan_services"];
const STUDIO = "PizzaScript, a web development studio in Pune, India, that also builds business automation and custom software for small and medium businesses";

interface ResearchState {
  discovered?: string;
  weekly?: string;
}

const config = async () => ({ ...RESEARCH_DEFAULTS, ...(await setting<Partial<ResearchSettings>>("research", {})) });

interface ServiceSuggestion {
  query: string;
  service: string;
  reason: string;
  firstSeen: string;
}

/** Provider searches ("... company pune") go to a list of service page suggestions instead of the blog idea pool. */
async function suggestServicePages(items: { query: string; service?: string; angle?: string }[]) {
  if (!items.length) return 0;
  const saved = await setting<{ items?: ServiceSuggestion[] }>("service_page_suggestions", {});
  const list = saved.items ?? [];
  const fresh = items.filter((i) => !list.some((s) => s.query === i.query));
  if (!fresh.length) return 0;
  const next = [...fresh.map((i) => ({ query: i.query, service: i.service ?? "", reason: i.angle ?? "", firstSeen: new Date().toISOString() })), ...list].slice(0, 30);
  await db.from("settings").upsert({ key: "service_page_suggestions", value: { items: next } });
  await raiseSignal({
    kind: "quality_gate",
    title: `Service page idea: people search "${fresh[0].query}"${fresh.length > 1 ? ` and ${fresh.length - 1} more` : ""}. These rank with service pages, not blog posts.`,
    detail: { queries: fresh.map((i) => i.query) },
    priority: "P2",
    post_id: null,
    topic_id: null,
    dedupe_key: `service-page-ideas:${todayIst()}`,
  });
  return fresh.length;
}
const serviceList = (services: ServiceProfile[]) => services.map((s) => `${s.path} — ${s.title} — ${s.description}`).join("\n");

/** Up to 2 light AI requests: suggest seeds, then choose ideas from the real phrases they return. */
export async function discoverIdeas() {
  const settings = await config();
  const [posts, topics, clusters] = await Promise.all([allPosts(), allTopics(), allClusters()]);
  const pool = topics.filter((t) => t.status === "candidate" && (t.score ?? 0) >= settings.minScore);
  if (pool.length >= settings.poolTarget) return { skipped: `pool has ${pool.length} good ideas` };

  let services = await savedServices();
  if (!services.length) {
    await scanServices();
    services = await savedServices();
  }
  const existing = [...posts.map((p) => p.seo_plan?.targetQuery ?? p.title), ...topics.filter((t) => t.status !== "rejected").map((t) => t.query)].filter(Boolean) as string[];
  const group = neededGroup(pool, settings.broadShare);
  const broadSeeds = group === "broad" ? 8 : 4;

  const seeds = await json<{ seeds: { phrase: string }[] }>(
    `Propose 12 short Google search phrases (2 to 5 words) to look up in autocomplete, for ${STUDIO}.
Readers: business owners in Pune first, then the rest of India.
About ${broadSeeds} broad phrases (business automation, tools, software, operations problems a development studio can solve) and the rest core (websites, web development, speed, SEO).
SERVICES:\n${serviceList(services)}
ALREADY COVERED (avoid): ${existing.slice(0, 60).join("; ")}
Return {"seeds":[{"phrase":""}]}`,
    "You are an SEO researcher. Return only JSON.",
    { tier: "light", temperature: 0.8 },
  );
  const phrases = await autocomplete((seeds.seeds ?? []).map((s) => s.phrase));
  if (phrases.size < 10) return { skipped: "autocomplete returned too few phrases" };

  const picked = await json<{ ideas: IdeaCandidate[] }>(
    `Choose up to 12 article ideas for ${STUDIO} from these REAL phrases people typed into Google in India. Use a phrase exactly as written for "query".
Rules: the reader must plausibly need this studio next. Skip jobs, logins, downloads, puzzles, other countries and navigational searches. Prefer specific long-tail and local phrases a new website can rank for. Prefer ${group} ideas.
"group": "core" for websites, web development, speed and SEO; "broad" for automation, tools, software and business operations.
SERVICES (use the path that fits, or "" if none does):\n${serviceList(services)}
CATEGORIES (use one id): ${clusters.map((c) => `${c.id} (${c.name})`).join(", ")}
EXISTING ARTICLES AND IDEAS (skip overlaps): ${existing.slice(0, 80).join("; ")}
PHRASES: ${[...phrases].slice(0, 180).join(" | ")}
Score 0 to 10: fit (how likely the reader needs this studio), newSite (how realistic ranking is for a new site), value (how close the reader is to buying).
Return {"ideas":[{"query":"","group":"core","category":"","service":"","audience":"","angle":"one sentence: the specific angle","fit":0,"newSite":0,"value":0}]}`,
    "You are an SEO strategist. Return only JSON.",
    { tier: "light", temperature: 0.4 },
  );

  const { kept, dropped, servicePages } = checkIdeas(picked.ideas ?? [], {
    phrases,
    existing,
    services: services.map((s) => s.path),
    clusters: clusters.map((c) => c.id),
    minScore: settings.minScore,
  });
  const chosen = [...kept.filter((k) => k.group === group), ...kept.filter((k) => k.group !== group)].slice(0, settings.maxNewPerRun);
  for (const idea of chosen) {
    await db.from("topics").upsert(
      {
        slug: slugFor(idea.query),
        query: idea.query,
        cluster_id: idea.category,
        track: idea.service && idea.value >= 8 ? 2 : 1,
        role: "spoke",
        audience: "client",
        status: "candidate",
        source: "agent",
        score: idea.score,
        priority: priorityForIdea(idea.score),
        scores: {},
        filters: {},
        reason: idea.angle,
        research: { angle: idea.angle, group: idea.group, service: idea.service, audience: idea.audience, evidence: "Google autocomplete", needsService: idea.needsService },
      },
      { onConflict: "slug", ignoreDuplicates: true },
    );
  }
  const missing = chosen.filter((i) => i.needsService);
  if (missing.length) {
    await raiseSignal({
      kind: "quality_gate",
      title: `${missing.length} new idea${missing.length > 1 ? "s" : ""} need a service page you don't have yet (for example "${missing[0].query}").`,
      detail: { ideas: missing.map((i) => i.query) },
      priority: "P3",
      post_id: null,
      topic_id: null,
      dedupe_key: `research-service:${todayIst()}`,
    });
  }
  const servicePageIdeas = await suggestServicePages(servicePages);
  return { added: chosen.length, dropped: dropped.length, servicePageIdeas, phrases: phrases.size, group };
}

/** Archives weak, expired, duplicate or overflow ideas. Can be restored from the Ideas page. */
export async function pruneIdeas() {
  const settings = await config();
  const [posts, topics] = await Promise.all([allPosts(), allTopics()]);
  const archive = ideasToArchive(topics, posts.map((p) => p.seo_plan?.targetQuery ?? p.title), settings);
  for (const { id, reason } of archive) await db.from("topics").update({ status: "archived", reason: `Auto-archived: ${reason}` }).eq("id", id).eq("status", "candidate");
  const moved = archive.filter((a) => a.reason === "Better as a service page").map((a) => topics.find((t) => t.id === a.id)!);
  const servicePageIdeas = await suggestServicePages(moved.map((t) => ({ query: t.query, service: (t.research as { service?: string } | undefined)?.service, angle: t.reason ?? "" })));
  return { archived: archive.length, servicePageIdeas };
}

/** Runs when the queue is otherwise idle: research once a day after the briefing, upkeep once a week (Sunday). */
export async function scheduleResearch(): Promise<boolean> {
  const settings = await config();
  if (!settings.enabled) return false;
  const today = todayIst();
  const [{ data: briefing }, state, { count: pending }] = await Promise.all([
    db.from("briefings").select("date").eq("date", today).maybeSingle(),
    setting<ResearchState>("research_state", {}),
    db.from("jobs").select("id", { count: "exact", head: true }).in("type", RESEARCH_JOBS).in("status", ["queued", "running"]),
  ]);
  if (!briefing || pending) return false;
  const save = (next: ResearchState) => db.from("settings").upsert({ key: "research_state", value: next });

  const sunday = new Date(Date.now() + 5.5 * 3_600_000).getUTCDay() === 0;
  if ((sunday || !state.weekly) && state.weekly !== today) {
    await save({ ...state, weekly: today });
    await enqueue("scan_services");
    await enqueue("prune_ideas");
    return true;
  }
  if (state.discovered !== today) {
    await save({ ...state, discovered: today });
    await enqueue("discover_ideas");
    return true;
  }
  return false;
}

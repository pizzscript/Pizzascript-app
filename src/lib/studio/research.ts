import { keywordCoverage } from "./content";
import { isAvoided, placeAllowed, type ResearchLocation, type TopicGroup } from "./research-profile";
import type { Topic } from "./types";

/** Every research limit, in one place. */
export const RESEARCH_DEFAULTS = {
  enabled: true,
  /** Good ideas to keep waiting. Discovery runs only below this. */
  poolTarget: 40,
  /** Share of broad business, automation and tools ideas; the rest is web development. Used only without a profile. */
  broadShare: 60,
  maxNewPerRun: 6,
  minScore: 60,
  /** Unused trend ideas expire after this many days. */
  trendDays: 14,
  /** Kept for saved settings; unscored ideas now wait until floorDays. */
  staleDays: 45,
  /** Weak or unscored ideas stay in the pool this long before they're archived. */
  floorDays: 180,
  /** Google lookups per research run for "People also ask" and Reddit/Quora questions (one Bright Data credit each). */
  serpLookups: 3,
  /** Auto-pick writes only ideas the owner marked as OK. On unless a client's research settings switch it off. */
  requireApproval: undefined as boolean | undefined,
  /** Search Console searches below this many impressions in 30 days are ignored. */
  gscMinImpressions: 15,
  /** Opportunities shown to the AI per run. */
  maxOpportunities: 60,
};
export type ResearchSettings = typeof RESEARCH_DEFAULTS;

export interface IdeaCandidate {
  query: string;
  group: "core" | "broad";
  category: string;
  service: string;
  audience: string;
  angle: string;
  fit: number;
  newSite: number;
  value: number;
}

export interface CheckedIdea extends IdeaCandidate {
  score: number;
  needsService: boolean;
}

const WRONG_INTENT = /\b(jobs?|salary|login|sign in|download|crossword|clue|for sale|course|internship|apk)\b/i;
const WRONG_PLACE = /\b(usa|uk|australia|canada|uae|philippines|kenya|south africa|america|dubai|singapore|nigeria|pakistan)\b/i;

const SERVICE_WORDS = /\b(company|companies|agency|agencies|studios?|services?|near me|consultants?|experts?|firms?|providers?|hire|freelancers?)\b/i;
const VENDOR_IN_CITY = /\b(software|solutions?|tools?|developers?|development)\s+(in\s+)?(pune|mumbai|bangalore|bengaluru|delhi|hyderabad|chennai|kolkata|ahmedabad)\b/i;

/** Searches for a provider ("... company pune", "... services") rank with service pages, not blog articles. */
export const isServiceIntent = (query: string) => SERVICE_WORDS.test(query) || VENDOR_IN_CITY.test(query);

export const sameIntent = (a: string, b: string) => Math.min(keywordCoverage(a, b), keywordCoverage(b, a)) >= 0.7;
const clamp = (n: unknown) => Math.max(0, Math.min(10, Number(n) || 0));
export const ideaScore = (c: Pick<IdeaCandidate, "fit" | "newSite" | "value">) => Math.round((clamp(c.fit) * 0.4 + clamp(c.newSite) * 0.35 + clamp(c.value) * 0.25) * 10);
export const priorityForIdea = (score: number) => (score >= 75 ? "P1" : score >= 60 ? "P2" : "P3");
export const slugFor = (query: string) => query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);

/**
 * Keeps an AI idea only if people really type it (it's in the autocomplete phrases), it fits the business, isn't a job
 * or login search, targets India, and doesn't repeat existing content or another idea in the batch.
 */
export function checkIdeas(
  candidates: IdeaCandidate[],
  context: { phrases: Set<string>; existing: string[]; services: string[]; clusters: string[]; minScore: number },
) {
  const kept: CheckedIdea[] = [];
  const dropped: { query: string; reason: string }[] = [];
  const servicePages: CheckedIdea[] = [];
  const scored = candidates
    .filter((c) => c && typeof c.query === "string" && c.query.trim())
    .map((c) => ({ ...c, query: c.query.trim().toLowerCase(), score: ideaScore(c) }))
    .sort((a, b) => b.score - a.score);
  for (const c of scored) {
    const reason = !context.phrases.has(c.query)
      ? "not a real search phrase"
      : WRONG_INTENT.test(c.query)
        ? "wrong intent"
        : WRONG_PLACE.test(c.query)
          ? "outside India"
          : clamp(c.fit) < 6
            ? "weak business fit"
            : c.score < context.minScore
              ? `score ${c.score}`
              : context.existing.some((q) => sameIntent(c.query, q))
                ? "already covered"
                : kept.some((k) => sameIntent(c.query, k.query))
                  ? "same search as a stronger idea"
                  : null;
    if (reason) {
      dropped.push({ query: c.query, reason });
      continue;
    }
    const service = context.services.includes(c.service) ? c.service : "";
    const checked: CheckedIdea = {
      ...c,
      group: c.group === "core" ? "core" : "broad",
      category: context.clusters.includes(c.category) ? c.category : context.clusters[0],
      service,
      needsService: !service,
    };
    if (isServiceIntent(c.query)) servicePages.push(checked);
    else kept.push(checked);
  }
  return { kept, dropped, servicePages };
}

/** Which group is furthest below its target share, so new ideas rebalance the pool. */
export function neededGroup(pool: Pick<Topic, "research">[], broadShare: number): "core" | "broad" {
  if (!pool.length) return "broad";
  const broad = pool.filter((t) => (t.research as { group?: string } | undefined)?.group === "broad").length;
  return (broad / pool.length) * 100 < broadShare ? "broad" : "core";
}

// ───────────────────────── client research: opportunities → ranked ideas ─────────────────────────

export type OpportunitySource = "gsc" | "autocomplete" | "question" | "site_gap" | "feed" | "competitor" | "paa" | "discussion";
export type IdeaAction = "new_article" | "update_page" | "service_page";

/** One piece of raw evidence: a search, question or gap, with where it came from. */
export interface Opportunity {
  query: string;
  source: OpportunitySource;
  evidence: { impressions?: number; clicks?: number; position?: number; page?: string; covered?: boolean; seed?: string; service?: string; note?: string };
}

/** What the AI says about a group of opportunities. Code does the scoring. */
export interface JudgedIdea {
  query: string;
  group: string;
  service: string;
  customer: string;
  fit: number;
  intent: number;
  why: string;
  angle: string;
}

export interface IdeaResearch {
  group: string;
  service: string;
  customer: string;
  action: IdeaAction;
  updatePath?: string;
  why: string;
  angle: string;
  evidence: { source: OpportunitySource; detail: string }[];
  demand: "measured" | "weak" | "unknown";
  ranking: "measured" | "unknown";
  unknowns: string[];
  ratings: { fit: number; intent: number; demand: number | null; ranking: number | null };
  review: { state: "pending" | "approved" | "rejected"; at?: string; reason?: string };
  needsService: boolean;
  evidenceSource: string;
}

export interface RankedIdea extends JudgedIdea {
  score: number;
  research: IdeaResearch;
}

export const SOURCE_LABEL: Record<OpportunitySource, string> = {
  gsc: "Search Console",
  autocomplete: "Google suggestion",
  question: "Customer question",
  site_gap: "Website gap",
  feed: "News feed",
  competitor: "Competitor",
  paa: "People also ask",
  discussion: "Reddit/Quora question",
};

const cityOf = (name: string) => name.split(",")[0].trim().toLowerCase();

/**
 * The phrases research looks up, built only from the approved profile and real Search Console searches: no AI guess.
 * The group that needs ideas most goes first, then services the owner wants to grow.
 */
export function buildSeeds(
  profile: { services: { name: string; priority: string }[]; locations: { name: string; primary: boolean }[]; customerQuestions: string[]; topicGroups: TopicGroup[] },
  gscQueries: string[],
  fillGroup: string,
  max = 15,
) {
  const city = cityOf((profile.locations.find((l) => l.primary) ?? profile.locations[0])?.name ?? "");
  const groupService = profile.topicGroups.find((g) => g.id === fillGroup)?.service?.toLowerCase();
  const services = profile.services
    .filter((s) => s.priority !== "ignore")
    .map((s) => ({ name: s.name.trim().toLowerCase(), rank: s.name.toLowerCase() === groupService ? 0 : s.priority === "grow" ? 1 : 2 }))
    .filter((s) => s.name)
    .sort((a, b) => a.rank - b.rank)
    .map((s) => s.name);
  const seeds = [
    ...services.flatMap((s) => (city && !s.includes(city) ? [s, `${s} ${city}`] : [s])),
    ...gscQueries.map((q) => q.trim().toLowerCase()),
    ...profile.customerQuestions.map((q) => q.trim().toLowerCase().replace(/\?$/, "")).filter((q) => q.split(/\s+/).length <= 8),
  ];
  return [...new Set(seeds.filter(Boolean))].slice(0, max);
}

/**
 * What earlier research produced, judged by real clicks: clicks per article for each topic group and each kind of
 * evidence. Only groups or sources with at least `min` published articles are reported, so one lucky post doesn't steer.
 */
export function researchResults(articles: { group?: string; sources: string[]; clicks: number }[], groups: TopicGroup[], min = 2) {
  const rate = (list: typeof articles) => Math.round((list.reduce((s, a) => s + a.clicks, 0) / list.length) * 10) / 10;
  const byGroup = groups
    .map((g) => ({ label: g.label, list: articles.filter((a) => a.group === g.id) }))
    .filter((g) => g.list.length >= min)
    .map((g) => ({ name: g.label, articles: g.list.length, clicksPerArticle: rate(g.list) }))
    .sort((a, b) => b.clicksPerArticle - a.clicksPerArticle);
  const bySource = (Object.keys(SOURCE_LABEL) as OpportunitySource[])
    .map((s) => ({ name: SOURCE_LABEL[s], list: articles.filter((a) => a.sources.includes(s)) }))
    .filter((s) => s.list.length >= min)
    .map((s) => ({ name: s.name, articles: s.list.length, clicksPerArticle: rate(s.list) }))
    .sort((a, b) => b.clicksPerArticle - a.clicksPerArticle);
  return { byGroup, bySource };
}

/** A Reddit or Quora result title as a plain question: without the site and community suffixes. */
export const discussionTitle = (title: string) =>
  title
    .replace(/\s*[:|-]\s*r\/\w+.*$/i, "")
    .replace(/\s*[-|]\s*(reddit|quora).*$/i, "")
    .trim()
    .toLowerCase();

/** Search demand from Search Console impressions (log scale, 0–10). Suggestions prove wording, not volume. */
export function demandOf(evidence: Opportunity[]): { level: IdeaResearch["demand"]; value: number | null } {
  const impressions = Math.max(0, ...evidence.map((o) => o.evidence.impressions ?? 0));
  if (impressions > 0) return { level: "measured", value: Math.round(Math.min(10, Math.log10(impressions) * 3.3) * 10) / 10 };
  if (evidence.some((o) => ["autocomplete", "question", "paa", "discussion"].includes(o.source))) return { level: "weak", value: null };
  return { level: "unknown", value: null };
}

/** How realistic it is to rank higher, from the site's current Google position for the search. */
export function rankingOf(evidence: Opportunity[]): { level: IdeaResearch["ranking"]; value: number | null } {
  const positions = evidence.map((o) => o.evidence.position).filter((p): p is number => typeof p === "number" && p > 0);
  if (!positions.length) return { level: "unknown", value: null };
  const p = Math.min(...positions);
  return { level: "measured", value: p <= 3 ? 5 : p <= 15 ? 8 : p <= 30 ? 6 : p <= 60 ? 4 : 2 };
}

const clamp10 = (n: unknown) => Math.max(0, Math.min(10, Number(n) || 0));

/** Score 0–100: fit 40%, intent 30%, demand 20%, ranking 10%. Unknown parts are left out and the rest rescaled. */
export function opportunityScore(r: { fit: number; intent: number; demand: number | null; ranking: number | null }) {
  const parts: [number, number][] = [
    [clamp10(r.fit), 0.4],
    [clamp10(r.intent), 0.3],
    ...(r.demand === null ? [] : [[clamp10(r.demand), 0.2] as [number, number]]),
    ...(r.ranking === null ? [] : [[clamp10(r.ranking), 0.1] as [number, number]]),
  ];
  const weight = parts.reduce((s, [, w]) => s + w, 0);
  return Math.round((parts.reduce((s, [v, w]) => s + v * w, 0) / weight) * 10);
}

/** New article, update of an existing page that already ranks 8–30, or a service page for "hire a provider" searches. */
export function actionFor(query: string, evidence: Opportunity[]): { action: IdeaAction; updatePath?: string } {
  const ranked = evidence.find((o) => o.source === "gsc" && o.evidence.covered && o.evidence.page && (o.evidence.position ?? 0) >= 8 && (o.evidence.position ?? 99) <= 30);
  if (ranked) return { action: "update_page", updatePath: ranked.evidence.page };
  if (isServiceIntent(query) || evidence.some((o) => o.source === "site_gap" && o.evidence.note === "no service page")) return { action: "service_page" };
  return { action: "new_article" };
}

/** Which topic group is furthest below its share of the waiting pool. */
export function groupToFill(pool: Pick<Topic, "research">[], groups: TopicGroup[]) {
  if (!groups.length) return "general";
  const count = (id: string) => pool.filter((t) => (t.research as { group?: string } | undefined)?.group === id).length;
  const total = pool.length || 1;
  return [...groups].sort((a, b) => count(a.id) / total - a.share / 100 - (count(b.id) / total - b.share / 100))[0].id;
}

/**
 * Turns the AI's judgements into ranked ideas. Code makes every keep/drop decision: the idea must come from a real
 * opportunity, fit the client's area and avoid list, not repeat existing content, and clear the minimum score.
 */
export function rankIdeas(
  judged: JudgedIdea[],
  opportunities: Opportunity[],
  context: { existing: string[]; avoid: string[]; locations: ResearchLocation[]; groups: TopicGroup[]; services: string[]; minScore: number },
) {
  const byQuery = new Map<string, Opportunity[]>();
  for (const o of opportunities) byQuery.set(o.query.toLowerCase(), [...(byQuery.get(o.query.toLowerCase()) ?? []), o]);
  const groupIds = new Set(context.groups.map((g) => g.id));
  const kept: RankedIdea[] = [];
  const dropped: { query: string; reason: string }[] = [];
  for (const raw of judged) {
    if (!raw || typeof raw.query !== "string" || !raw.query.trim()) continue;
    const query = raw.query.trim().toLowerCase();
    const evidence = byQuery.get(query) ?? [];
    const reason = !evidence.length
      ? "not one of the collected searches"
      : WRONG_INTENT.test(query)
        ? "wrong intent"
        : !placeAllowed(query, context.locations)
          ? "outside the client's area"
          : isAvoided(query, context.avoid)
            ? "on the avoid list"
            : clamp10(raw.fit) < 6
              ? "weak business fit"
              : evidence.every((o) => !o.evidence.covered) && context.existing.some((q) => sameIntent(query, q))
                ? "already covered"
                : kept.some((k) => sameIntent(query, k.query))
                  ? "same search as a stronger idea"
                  : null;
    if (reason) {
      dropped.push({ query, reason });
      continue;
    }
    const demand = demandOf(evidence);
    const ranking = rankingOf(evidence);
    const ratings = { fit: clamp10(raw.fit), intent: clamp10(raw.intent), demand: demand.value, ranking: ranking.value };
    const score = opportunityScore(ratings);
    if (score < context.minScore) {
      dropped.push({ query, reason: `score ${score}` });
      continue;
    }
    const { action, updatePath } = actionFor(query, evidence);
    const service = context.services.includes(raw.service) ? raw.service : "";
    const unknowns = [
      ...(demand.level === "unknown" ? ["search demand"] : demand.level === "weak" ? ["how many people search for it"] : []),
      ...(ranking.level === "unknown" ? ["how hard it is to rank"] : []),
      ...(!service && action !== "update_page" ? ["no matching service page"] : []),
    ];
    kept.push({
      ...raw,
      query,
      group: groupIds.has(raw.group) ? raw.group : (context.groups[0]?.id ?? "general"),
      service,
      score,
      research: {
        group: groupIds.has(raw.group) ? raw.group : (context.groups[0]?.id ?? "general"),
        service,
        customer: String(raw.customer ?? "").slice(0, 160),
        action,
        ...(updatePath ? { updatePath } : {}),
        why: String(raw.why ?? "").slice(0, 300),
        angle: String(raw.angle ?? "").slice(0, 300),
        evidence: evidence.map((o) => ({
          source: o.source,
          detail:
            o.source === "gsc"
              ? `${SOURCE_LABEL.gsc}: ${o.evidence.impressions ?? 0} impressions, position ${(o.evidence.position ?? 0).toFixed(1)}${o.evidence.page ? ` (${o.evidence.page})` : ""}`
              : o.source === "autocomplete"
                ? `${SOURCE_LABEL.autocomplete}${o.evidence.seed ? ` for "${o.evidence.seed}"` : ""}`
                : `${SOURCE_LABEL[o.source]}${o.evidence.note ? `: ${o.evidence.note}` : ""}`,
        })),
        demand: demand.level,
        ranking: ranking.level,
        unknowns,
        ratings,
        review: { state: "pending" },
        needsService: !service,
        evidenceSource: [...new Set(evidence.map((o) => SOURCE_LABEL[o.source]))].join(", "),
      },
    });
  }
  kept.sort((a, b) => b.score - a.score);
  return { kept, dropped };
}

/** True when an idea may be written by Auto-pick: a new article, and approved when approval is required. */
export function autoPickAllowed(topic: Pick<Topic, "research">, requireApproval: boolean) {
  const r = topic.research as Partial<IdeaResearch> | undefined;
  if (r?.action && r.action !== "new_article") return false;
  return !requireApproval || r?.review?.state === "approved";
}

/**
 * Waiting ideas to archive, each with a reason. Only ideas that can never be written are archived at once (a service
 * page search, an expired trend, an overlap with an existing article, a repeat of a stronger idea). Weak or unscored
 * ideas stay in the pool, ranked low, so newer evidence can lift them; they're archived only after floorDays.
 * Ideas already approved, written or published are never touched.
 */
export function ideasToArchive(topics: Topic[], existingQueries: string[], settings: Pick<ResearchSettings, "minScore" | "trendDays"> & { floorDays?: number }, now = Date.now()) {
  const day = 86_400_000;
  const floor = settings.floorDays ?? RESEARCH_DEFAULTS.floorDays;
  const waiting = topics.filter((t) => t.status === "candidate");
  const out = new Map<string, string>();
  for (const t of waiting) {
    const age = (now - Date.parse(t.created_at)) / day;
    const scored = t.score !== null && t.score !== undefined;
    if (isServiceIntent(t.query)) out.set(t.id, "Better as a service page");
    else if (t.source === "trend" && age > settings.trendDays) out.set(t.id, `Trend older than ${settings.trendDays} days`);
    else if (existingQueries.some((q) => sameIntent(t.query, q))) out.set(t.id, "Overlaps an existing article");
    else if (scored && t.score! < settings.minScore && age > floor) out.set(t.id, `Score ${t.score} below ${settings.minScore} for ${floor} days`);
    else if (!scored && age > floor) out.set(t.id, `Not scored in ${floor} days`);
  }
  const left = waiting.filter((t) => !out.has(t.id)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  for (let i = 0; i < left.length; i++) {
    for (let j = i + 1; j < left.length; j++) {
      if (!out.has(left[j].id) && sameIntent(left[i].query, left[j].query)) out.set(left[j].id, `Same search as "${left[i].query}"`);
    }
  }
  return [...out.entries()].map(([id, reason]) => ({ id, reason }));
}

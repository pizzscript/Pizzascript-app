import { keywordCoverage } from "./content";
import type { Topic } from "./types";

/** Every research limit, in one place. */
export const RESEARCH_DEFAULTS = {
  enabled: true,
  /** Good ideas to keep waiting. Discovery runs only below this. */
  poolTarget: 40,
  /** Share of broad business, automation and tools ideas; the rest is web development. */
  broadShare: 60,
  maxNewPerRun: 6,
  minScore: 60,
  /** Unused trend ideas expire after this many days. */
  trendDays: 14,
  /** Unscored ideas older than this are archived. */
  staleDays: 45,
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

const SERVICE_WORDS = /\b(company|companies|agency|agencies|services?|near me|consultants?|firms?|providers?|hire|freelancers?)\b/i;
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

/** Waiting ideas to archive, each with a reason. Ideas already approved, written or published are never touched. */
export function ideasToArchive(topics: Topic[], existingQueries: string[], settings: Pick<ResearchSettings, "poolTarget" | "minScore" | "trendDays" | "staleDays">, now = Date.now()) {
  const day = 86_400_000;
  const waiting = topics.filter((t) => t.status === "candidate");
  const out = new Map<string, string>();
  for (const t of waiting) {
    const age = (now - Date.parse(t.created_at)) / day;
    if (isServiceIntent(t.query)) out.set(t.id, "Better as a service page");
    else if (t.source === "trend" && age > settings.trendDays) out.set(t.id, `Trend older than ${settings.trendDays} days`);
    else if (t.score !== null && t.score !== undefined && t.score < settings.minScore) out.set(t.id, `Score ${t.score} below ${settings.minScore}`);
    else if ((t.score === null || t.score === undefined) && age > settings.staleDays) out.set(t.id, `Not scored in ${settings.staleDays} days`);
    else if (existingQueries.some((q) => sameIntent(t.query, q))) out.set(t.id, "Overlaps an existing article");
  }
  const left = waiting.filter((t) => !out.has(t.id)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  for (let i = 0; i < left.length; i++) {
    for (let j = i + 1; j < left.length; j++) {
      if (!out.has(left[j].id) && sameIntent(left[i].query, left[j].query)) out.set(left[j].id, `Same search as "${left[i].query}"`);
    }
  }
  const remaining = left.filter((t) => !out.has(t.id));
  const limit = Math.ceil(settings.poolTarget * 1.25);
  for (const t of remaining.slice(limit)) out.set(t.id, "Pool is full: lowest score");
  return [...out.entries()].map(([id, reason]) => ({ id, reason }));
}

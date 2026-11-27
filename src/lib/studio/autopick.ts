import { keywordCoverage } from "./content";
import { QUALITY } from "./quality";
import { autoPickAllowed } from "./research";
import type { TopicGroup } from "./research-profile";
import type { StudioPost, Topic } from "./types";

/** Every Auto-pick limit, in one place. It ships switched off. */
export const AUTO_PICK_DEFAULTS = {
  enabled: false,
  minScore: 60,
  /** New articles are scheduled at least this far ahead, so there's time to remove one before it publishes. */
  leadDays: 3,
  horizonDays: 14,
  maxScoringPerDay: 2,
  /** Pause after this many picked articles fail in a row. */
  maxFailures: 2,
  /** Writer requests that must remain before starting an article. */
  writerRequestsWithAgent: 3,
  writerRequestsWithoutAgent: 8,
};
export type AutoPickSettings = typeof AUTO_PICK_DEFAULTS;

export interface AutoPickState {
  /** The IST day Auto-pick finished its work. */
  doneDate?: string;
  scoringDate?: string;
  scored?: string[];
  pausedReason?: string;
}

export const istDate = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3_600_000).toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
export const istSlot = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).toISOString();

/** The first date far enough ahead that still has room in the publishing schedule. */
export function nextOpenDate(posts: Pick<StudioPost, "scheduled_for">[], today: string, perDay: number, leadDays: number, horizonDays: number) {
  const taken = new Map<string, number>();
  for (const post of posts) {
    if (!post.scheduled_for) continue;
    const date = istDate(post.scheduled_for);
    taken.set(date, (taken.get(date) ?? 0) + 1);
  }
  for (let offset = leadDays; offset <= horizonDays; offset++) {
    const date = addDays(today, offset);
    if ((taken.get(date) ?? 0) < perDay) return date;
  }
  return null;
}

const sameIntent = (a: string, b: string) => Math.min(keywordCoverage(a, b), keywordCoverage(b, a)) >= QUALITY.duplicate.sameQuery;
const failedFilter = (topic: Pick<Topic, "filters">) => Object.values(topic.filters ?? {}).some((filter) => filter && !filter.pass);
const namesClient = (topic: Topic, clients: string[]) => {
  const text = `${topic.query} ${topic.research?.title ?? ""} ${topic.research?.angle ?? ""}`.toLowerCase();
  return clients.some((name) => name && text.includes(name.toLowerCase()));
};

/**
 * The best idea that is scored, passes every filter, doesn't compete with anything already written or planned, is a
 * new article (not a page update or service page) and, when approval is required, was marked OK by the owner.
 */
export function chooseTopic(topics: Topic[], posts: StudioPost[], minScore: number, clients: string[], requireApproval = false, groups: TopicGroup[] = []) {
  const used = new Set(posts.map((post) => post.topic_id).filter(Boolean));
  const existing = [
    ...posts.map((post) => post.seo_plan?.targetQuery ?? post.title),
    ...topics.filter((topic) => ["approved", "in_production", "published"].includes(topic.status)).map((topic) => topic.query),
  ].filter(Boolean);
  const eligible = topics
    .filter((topic) => topic.status === "candidate" && !used.has(topic.id))
    .filter((topic) => topic.score !== null && topic.score !== undefined && topic.score >= minScore && topic.priority !== "P4")
    .filter((topic) => !failedFilter(topic) && !namesClient(topic, clients) && autoPickAllowed(topic, requireApproval))
    .filter((topic) => !existing.some((query) => sameIntent(topic.query, query)))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.created_at.localeCompare(b.created_at));
  if (!groups.length || eligible.length < 2) return eligible[0] ?? null;

  // Only qualified ideas get here, so balance never trades quality away: it picks which good idea goes first.
  const groupOf = (topic: Pick<Topic, "research"> | undefined) => (topic?.research as { group?: string } | undefined)?.group ?? "";
  const byId = new Map(topics.map((t) => [t.id, t]));
  const written = posts.map((p) => groupOf(p.topic_id ? byId.get(p.topic_id) : undefined)).filter(Boolean);
  const total = written.length || 1;
  const deficit = (g: TopicGroup) => g.share / 100 - written.filter((id) => id === g.id).length / total;
  const best = (list: TopicGroup[]) => {
    const ranked = list
      .map((g) => ({ g, need: deficit(g) + (g.mode === "boost" ? 0.15 : 0), idea: eligible.find((t) => groupOf(t) === g.id) }))
      .filter((x) => x.idea)
      .sort((a, b) => b.need - a.need);
    return ranked[0];
  };
  const mandatory = best(groups.filter((g) => g.mode === "mandatory" && deficit(g) > 0));
  if (mandatory) return mandatory.idea!;
  const pick = best(groups);
  return pick && pick.need > 0 ? pick.idea! : eligible[0];
}

/** The oldest idea that hasn't been scored or tried today. */
export function nextToScore(topics: Topic[], tried: string[]) {
  return (
    topics
      .filter((topic) => topic.status === "candidate" && (topic.score === null || topic.score === undefined) && !tried.includes(topic.id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
  );
}

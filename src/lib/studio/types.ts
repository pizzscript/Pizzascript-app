export type Stage = "brief" | "draft" | "image" | "audit" | "slotted" | "live";
export const STAGES: Stage[] = ["brief", "draft", "image", "audit", "slotted", "live"];

export type Priority = "P0" | "P1" | "P2" | "P3" | "P4";
export type Track = 1 | 2;
export type Role = "pillar" | "spoke" | "edge" | "case-study" | "trend";
export type Audience = "client" | "developer" | "both";
export type TopicStatus = "candidate" | "approved" | "in_production" | "published" | "rejected" | "archived";

export interface Cluster {
  id: string;
  name: string;
  audience: Audience;
  target_t1: number;
  position: number;
}

export interface Batch {
  id: string;
  name: string;
  approved_at: string | null;
  created_at: string;
}

export const SCORE_FACTORS = ["authority", "intent", "volume", "backlink", "difficulty", "internalLink"] as const;
export type ScoreFactor = (typeof SCORE_FACTORS)[number];
export type TopicScores = Partial<Record<ScoreFactor, { value: number; reason: string }>> & { caseStudy?: boolean };

export const FILTERS = ["uniqueness", "depth", "audience", "cannibalism", "demand"] as const;
export type FilterName = (typeof FILTERS)[number];
export type TopicFilters = Partial<Record<FilterName, { pass: boolean; reason: string }>>;

export interface Topic {
  id: string;
  slug: string;
  query: string;
  cluster_id: string | null;
  track: Track;
  role: Role;
  intent: "informational" | "commercial" | "transactional" | null;
  audience: Audience | null;
  scores: TopicScores;
  score: number | null;
  priority: Priority | null;
  filters: TopicFilters;
  status: TopicStatus;
  reason: string | null;
  source: "manual" | "gsc" | "trend" | "agent" | "seed";
  research?: TopicResearch;
  created_at: string;
}

export interface TopicResearch {
  summary?: string;
  angle?: string;
  title?: string;
  outline?: string[];
  competitors?: string[];
  serp?: SerpData;
}

export interface SerpData {
  fetchedAt: string;
  organic: { title: string; url: string; snippet: string }[];
  questions: string[];
  related: string[];
  featured: string | null;
  resultTypes: string[];
}

export type Verdict = "good" | "maybe" | "skip" | "unresearched";

/** Plain-language verdict for the Ideas list, derived from the score, priority and filters. */
export function verdictFor(topic: Pick<Topic, "score" | "priority" | "filters" | "status">): Verdict {
  if (topic.status === "rejected" || topic.status === "archived") return "skip";
  if (topic.score === null || topic.score === undefined) return "unresearched";
  if (Object.values(topic.filters).some((f) => f && !f.pass) || topic.priority === "P4") return "skip";
  return topic.priority === "P0" || topic.priority === "P1" ? "good" : "maybe";
}

export interface Brief {
  angle?: string;
  audience?: Audience;
  depth?: "A" | "B" | "C" | "D" | "E";
  servicePage?: string;
  linksTo?: string[];
  outline?: string[];
  /** Related searcher questions the article must answer. */
  questions?: string[];
  wordRange?: [number, number];
}

/** blocker: can't publish. autofix: the agent repairs it. warning: shown, doesn't block. waiting: a step hasn't finished. */
export type CheckLevel = "blocker" | "autofix" | "warning" | "waiting";

export interface AuditCheck {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
  level?: CheckLevel;
}

export interface Audit {
  ok: boolean;
  ranAt: string;
  checks: AuditCheck[];
}

export interface StudioPost {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  stage: Stage;
  title: string;
  excerpt: string;
  body_html: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  category: string | null;
  tags: string[];
  topic_id: string | null;
  cluster_id: string | null;
  track: Track | null;
  role: Role | null;
  batch_id: string | null;
  scheduled_for: string | null;
  approved_at: string | null;
  published_at: string | null;
  brief: Brief;
  audit: Audit | null;
  image_prompt: string | null;
  version: number;
  seo_plan: { targetQuery?: string; [key: string]: unknown };
  /** From an approved idea: the pipeline carries it through draft, banner and SEO check without clicks. */
  auto_pipeline?: boolean;
  updated_at: string;
}

export interface PostVersion {
  id: string;
  post_id: string;
  version: number;
  title: string;
  body_html: string;
  cover_image_url: string | null;
  note: string | null;
  author: "agent" | "admin";
  created_at: string;
}

export interface LinkPlan {
  id: string;
  from_slug: string;
  to_path: string;
  anchor: string | null;
  status: "planned" | "inserted" | "dismissed";
}

export interface Fact {
  id: string;
  subject: string;
  statement: string;
  source: string | null;
  verified?: boolean;
}

/** Simplified status shown in the CMS (stages collapse into editorial states). */
export const STATUS_LABEL: Record<Stage, string> = {
  brief: "Brief",
  draft: "Draft",
  image: "Draft",
  audit: "Ready",
  slotted: "Scheduled",
  live: "Live",
};

export type SignalKind =
  | "rank_up"
  | "rank_down"
  | "low_ctr"
  | "query_gap"
  | "trend"
  | "index"
  | "backlink_needed"
  | "audit_failed"
  | "quality_gate"
  | "refresh";

export interface Signal {
  id: string;
  kind: SignalKind;
  title: string;
  detail: Record<string, unknown>;
  priority: Priority;
  post_id: string | null;
  topic_id: string | null;
  status: "open" | "acted" | "dismissed";
  created_at: string;
}

export interface BriefingAction {
  type: JobType | "navigate";
  label: string;
  payload?: Record<string, unknown>;
  href?: string;
}

export interface Briefing {
  date: string;
  content: {
    headline: string;
    recommendation: { text: string; actions: BriefingAction[] };
    notes: string[];
  };
}

export interface AgentMessage {
  id: string;
  thread: string;
  role: "admin" | "agent";
  content: string;
  created_at: string;
}

export const JOB_TYPES = [
  "daily_briefing",
  "score_topic",
  "write_brief",
  "write_draft",
  "rewrite",
  "generate_image",
  "run_audit",
  "publish_due",
  "insert_link",
  "fix_title",
  "discuss",
  "quality_gate",
  "performance_check",
  "discover_ideas",
  "prune_ideas",
  "scan_services",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export interface Job {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "done" | "failed";
  result: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  created_at: string;
  finished_at: string | null;
}

export interface RewritePayload {
  postId: string;
  scope: "selection" | "section" | "article";
  /** Index of the h2 section (0 = intro before the first h2) for scope=section. */
  section?: number;
  /** Exact text the admin selected, for scope=selection. */
  selection?: string;
  instruction: string;
}

export interface ScoringSettings {
  base: Record<ScoreFactor, number>;
  track1: Partial<Record<ScoreFactor, number>>;
  track2: Partial<Record<ScoreFactor, number>>;
  priority: { P1: number; P2: number; P3: number };
}

export interface ScheduleSettings {
  timezone: string;
  publishAt: string;
  briefingAt: string;
  perDay: number;
}

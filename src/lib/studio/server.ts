import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SCORING } from "./scoring";
import type {
  AgentMessage,
  Batch,
  Briefing,
  Cluster,
  Fact,
  Job,
  LinkPlan,
  PostVersion,
  ScheduleSettings,
  ScoringSettings,
  Signal,
  StudioPost,
  Topic,
} from "./types";

/** Preview mode: no Supabase configured and not a production deploy. Reads supabase/seed/studio.json, read-only. */
export function isPreview() {
  return !process.env.SUPABASE_URL && (process.env.NODE_ENV !== "production" || process.env.STUDIO_PREVIEW === "1");
}

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

export type Studio = { mode: "live"; db: SupabaseClient; email: string } | { mode: "preview" };

/** Resolves the admin session or redirects to login. Call inside a Suspense boundary. */
export async function requireAdmin(): Promise<Studio> {
  if (isPreview()) {
    await connection();
    return { mode: "preview" };
  }
  if (!process.env.SUPABASE_URL) redirect("/admin/login?error=not-configured");
  const db = await supabaseServer();
  const { data } = await db.auth.getUser();
  if (!data.user?.email) redirect("/admin/login");
  const { data: isAdmin } = await db.rpc("is_admin");
  if (!isAdmin) redirect("/admin/login?error=forbidden");
  return { mode: "live", db, email: data.user.email };
}

export interface StudioData {
  clusters: Cluster[];
  batches: Batch[];
  topics: Topic[];
  posts: StudioPost[];
  linkPlan: LinkPlan[];
  facts: Fact[];
  signals: Signal[];
  briefing: Briefing | null;
  jobs: Job[];
  messages: AgentMessage[];
  scoring: ScoringSettings;
  schedule: ScheduleSettings;
  bannedPhrases: string[];
  wordRanges: Record<string, [number, number]>;
}

const DEFAULT_SCHEDULE: ScheduleSettings = { timezone: "Asia/Kolkata", publishAt: "09:00", briefingAt: "06:30", perDay: 1 };
const DEFAULT_WORD_RANGES: Record<string, [number, number]> = {
  track1: [1000, 1800],
  spoke: [1500, 2500],
  pillar: [2500, 4000],
  edge: [1200, 2000],
  "case-study": [1500, 2500],
  trend: [800, 1500],
};
const DEFAULT_BANNED = [
  "in today's digital age",
  "ever-changing landscape",
  "unlock the power of",
  "more important than ever",
  "comprehensive guide",
  "everything you need to know",
  "in conclusion",
  "as a freelancer",
];

export function todayIst() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

function normalizePost(row: Record<string, unknown>): StudioPost {
  return {
    status: "draft",
    excerpt: "",
    body_html: "",
    cover_image_url: null,
    cover_image_alt: null,
    seo_title: null,
    seo_description: null,
    category: null,
    tags: [],
    topic_id: null,
    cluster_id: null,
    track: null,
    role: null,
    batch_id: null,
    scheduled_for: null,
    approved_at: null,
    published_at: null,
    brief: {},
    audit: null,
    image_prompt: null,
    version: 1,
    seo_plan: {},
    updated_at: new Date(0).toISOString(),
    ...row,
  } as unknown as StudioPost;
}

async function loadPreview(): Promise<StudioData> {
  const seed = (await import("../../../supabase/seed/studio.json")).default as unknown as {
    clusters: Cluster[];
    batches: Batch[];
    topics: Topic[];
    posts: Record<string, unknown>[];
    link_plan: LinkPlan[];
    facts: Fact[];
    signals: Signal[];
  };
  return {
    clusters: seed.clusters,
    batches: seed.batches,
    topics: seed.topics,
    posts: seed.posts.map(normalizePost),
    linkPlan: seed.link_plan,
    facts: seed.facts,
    signals: seed.signals.map((s) => ({ ...s, created_at: new Date().toISOString() })),
    briefing: null,
    jobs: [],
    messages: [],
    scoring: DEFAULT_SCORING,
    schedule: DEFAULT_SCHEDULE,
    bannedPhrases: DEFAULT_BANNED,
    wordRanges: DEFAULT_WORD_RANGES,
  };
}

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}

export async function loadStudio(studio: Studio): Promise<StudioData> {
  if (studio.mode === "preview") return loadPreview();
  const { db } = studio;
  const [clusters, batches, topics, posts, linkPlan, facts, signals, briefings, jobs, messages, settings] = await Promise.all([
    rows<Cluster[]>(db.from("clusters").select("*").order("position")),
    rows<Batch[]>(db.from("batches").select("*").order("created_at", { ascending: false })),
    rows<Topic[]>(db.from("topics").select("*").order("score", { ascending: false, nullsFirst: false })),
    rows<Record<string, unknown>[]>(db.from("posts").select("*").order("scheduled_for", { ascending: true, nullsFirst: false })),
    rows<LinkPlan[]>(db.from("link_plan").select("*")),
    rows<Fact[]>(db.from("facts").select("*").order("created_at")),
    rows<Signal[]>(db.from("signals").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(50)),
    rows<Briefing[]>(db.from("briefings").select("*").eq("date", todayIst())),
    rows<Job[]>(db.from("jobs").select("*").order("created_at", { ascending: false }).limit(30)),
    rows<AgentMessage[]>(db.from("agent_messages").select("*").order("created_at").limit(200)),
    rows<{ key: string; value: unknown }[]>(db.from("settings").select("*")),
  ]);
  const setting = <T,>(key: string, fallback: T) => (settings.find((s) => s.key === key)?.value as T) ?? fallback;
  return {
    clusters,
    batches,
    topics,
    posts: posts.map(normalizePost),
    linkPlan,
    facts,
    signals,
    briefing: briefings[0] ?? null,
    jobs,
    messages,
    scoring: setting("scoring", DEFAULT_SCORING),
    schedule: setting("schedule", DEFAULT_SCHEDULE),
    bannedPhrases: setting("banned_phrases", DEFAULT_BANNED),
    wordRanges: setting("word_ranges", DEFAULT_WORD_RANGES),
  };
}

export async function loadVersions(studio: Studio, postId: string): Promise<PostVersion[]> {
  if (studio.mode === "preview") return [];
  return rows<PostVersion[]>(
    studio.db.from("post_versions").select("*").eq("post_id", postId).order("version", { ascending: false }),
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SCORING } from "./scoring";
import { BRIEF_KEY, PROFILE_KEYS, type OwnerBrief, type ResearchProfile } from "./research-profile";
import { DEFAULT_WORKSPACE, scopeClient } from "./workspace-scope";
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

export interface WorkspaceInfo {
  id: string;
  slug: string;
  name: string;
  site_url: string;
  status: "active" | "paused" | "archived";
  approval_mode: "owner" | "client" | "automatic";
  cms: string;
  location: string | null;
  language: string;
  plan: Record<string, unknown>;
  created_at: string;
}

const PREVIEW_WORKSPACE: WorkspaceInfo = {
  id: DEFAULT_WORKSPACE,
  slug: "pizzascript",
  name: "PizzaScript",
  site_url: "https://www.pizzascript.com",
  status: "active",
  approval_mode: "automatic",
  cms: "hosted",
  location: "Pune, India",
  language: "en",
  plan: {},
  created_at: new Date(0).toISOString(),
};

/** The cookie that remembers which client the admin is working on. */
export const CLIENT_COOKIE = "ps_client";

export type Studio =
  | { mode: "live"; db: SupabaseClient; email: string; workspace: WorkspaceInfo; workspaces: WorkspaceInfo[] }
  | { mode: "preview"; workspace: WorkspaceInfo; workspaces: WorkspaceInfo[] };

/** Resolves the admin session and the client being worked on, or redirects to login. Call inside a Suspense boundary. */
export async function requireAdmin(): Promise<Studio> {
  // Establishes dynamic rendering before any Date.now()/Math.random() use further down (e.g. todayIst()),
  // which cacheComponents otherwise flags during prerendering.
  await connection();
  if (isPreview()) {
    return { mode: "preview", workspace: PREVIEW_WORKSPACE, workspaces: [PREVIEW_WORKSPACE] };
  }
  if (!process.env.SUPABASE_URL) redirect("/login?error=not-configured");
  const db = await supabaseServer();
  const { data } = await db.auth.getUser();
  if (!data.user?.email) redirect("/login");
  const { data: isAdmin } = await db.rpc("is_admin");
  if (!isAdmin) redirect("/login?error=forbidden");
  const { data: list } = await db.from("workspaces").select("id,slug,name,site_url,status,approval_mode,cms,location,language,plan,created_at").order("created_at");
  const workspaces = ((list ?? []) as WorkspaceInfo[]).filter((w) => w.status !== "archived" || w.id === DEFAULT_WORKSPACE);
  const archived = ((list ?? []) as WorkspaceInfo[]).filter((w) => w.status === "archived");
  const chosen = (await cookies()).get(CLIENT_COOKIE)?.value;
  // An unknown or deleted client falls back to PizzaScript; an archived one can still be opened to export or delete it.
  const workspace = [...workspaces, ...archived].find((w) => w.id === chosen) ?? workspaces.find((w) => w.id === DEFAULT_WORKSPACE) ?? PREVIEW_WORKSPACE;
  return { mode: "live", db: scopeClient(db, () => workspace.id), email: data.user.email, workspace, workspaces: [...workspaces, ...archived] };
}

export const isDefaultClient = (studio: Studio) => studio.workspace.id === DEFAULT_WORKSPACE;

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
  /** Global autopilot: every scheduled post is prepared and published automatically if it passes the SEO check. */
  autopilot: boolean;
  /** Lets the agent choose and schedule its own ideas. Needs autopilot. */
  autoPick: { enabled: boolean; pausedReason: string | null };
  /** Daily idea research settings (on unless switched off). */
  research: Record<string, unknown> & { enabled: boolean };
  /** Gemini requests in the last 7 days, for the usage panel. */
  aiUsage: AiCall[];
}

export interface AiCall {
  created_at: string;
  model: string;
  kind: "text" | "json";
  ok: boolean;
  quota_limit: number | null;
  error?: string | null;
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
    autopilot: false,
    autoPick: { enabled: false, pausedReason: null },
    research: { enabled: false },
    aiUsage: [],
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
  const [clusters, batches, topics, posts, linkPlan, facts, signals, briefings, jobs, messages, settings, aiUsage] = await Promise.all([
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
    rows<AiCall[]>(
      db
        .from("ai_calls")
        .select("created_at,model,kind,ok,quota_limit,error")
        .neq("kind", "image")
        .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(5000),
    ),
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
    autopilot: setting<{ enabled?: boolean }>("autopilot", {}).enabled === true,
    autoPick: {
      enabled: setting<{ enabled?: boolean }>("autopick", {}).enabled === true,
      pausedReason: setting<{ pausedReason?: string }>("autopick_state", {}).pausedReason ?? null,
    },
    research: (() => {
      const saved = setting<Record<string, unknown>>("research", {});
      return { ...saved, enabled: saved.enabled !== false };
    })(),
    aiUsage,
  };
}

export async function loadVersions(studio: Studio, postId: string): Promise<PostVersion[]> {
  if (studio.mode === "preview") return [];
  return rows<PostVersion[]>(
    studio.db.from("post_versions").select("*").eq("post_id", postId).order("version", { ascending: false }),
  );
}

export interface ClientOverview {
  workspace: WorkspaceInfo;
  /** This month (IST): articles drafted and AI requests; today's AI requests. */
  usage: { articles: number; aiMonth: number; aiToday: number };
  profile: Record<string, unknown>;
  /** The client's research profile: the draft being edited and the approved copy research uses. */
  research: { draft: ResearchProfile | null; approved: ResearchProfile | null; analysing: boolean; brief: OwnerBrief | null };
  members: { email: string; role: string }[];
  /** Setup checklist for a new client. */
  setup: { profile: boolean; searchConsole: boolean; competitors: boolean; local: boolean; autopilot: boolean; crawled: boolean; live: number };
}

/** Every client with this month's usage and saved profile, for the Clients page. */
export async function loadClientsOverview(studio: Studio): Promise<ClientOverview[]> {
  if (studio.mode === "preview") {
    const setup = { profile: true, searchConsole: false, competitors: false, local: false, autopilot: false, crawled: false, live: 0 };
    return studio.workspaces.map((workspace) => ({ workspace, usage: { articles: 0, aiMonth: 0, aiToday: 0 }, profile: {}, research: { draft: null, approved: null, analysing: false, brief: null }, members: [], setup }));
  }
  const raw = await supabaseServer();
  const month = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 8) + "01";
  const [{ data: usage }, { data: profiles }, { data: members }, { data: flags }, { data: crawls }, { data: livePosts }, gsc, { data: research }, { data: analysing }] = await Promise.all([
    raw.from("usage_ledger").select("workspace_id,day,ai_requests,articles").gte("day", month).limit(10_000),
    raw.from("settings").select("workspace_id,value").eq("key", "profile"),
    raw.from("workspace_members").select("workspace_id,email,role"),
    raw.from("settings").select("workspace_id,key,value").in("key", ["competitors", "local_profile", "autopilot"]),
    raw.from("crawl_runs").select("workspace_id").limit(1000),
    raw.from("posts").select("workspace_id").eq("stage", "live").limit(10_000),
    Promise.all(studio.workspaces.map(async (w) => [w.id, ((await raw.rpc("connection_status", { ws: w.id })).data ?? []) as { name: string; in_vault: boolean }[]] as const)),
    raw.from("settings").select("workspace_id,key,value").in("key", [PROFILE_KEYS.draft, PROFILE_KEYS.approved, BRIEF_KEY]),
    raw.from("jobs").select("workspace_id").eq("type", "analyze_site").in("status", ["queued", "running"]),
  ]);
  const researchFor = (ws: string, key: string) => (((research ?? []) as { workspace_id: string; key: string; value: ResearchProfile }[]).find((r) => r.workspace_id === ws && r.key === key)?.value ?? null);
  const flag = (ws: string, key: string) => ((flags ?? []) as { workspace_id: string; key: string; value: unknown }[]).find((f) => f.workspace_id === ws && f.key === key)?.value;
  const today = todayIst();
  return studio.workspaces.map((workspace) => {
    const rows = ((usage ?? []) as { workspace_id: string; day: string; ai_requests: number; articles: number }[]).filter((r) => r.workspace_id === workspace.id);
    return {
      workspace,
      usage: {
        articles: rows.reduce((s, r) => s + r.articles, 0),
        aiMonth: rows.reduce((s, r) => s + r.ai_requests, 0),
        aiToday: rows.filter((r) => r.day === today).reduce((s, r) => s + r.ai_requests, 0),
      },
      profile: ((profiles ?? []) as { workspace_id: string; value: Record<string, unknown> }[]).find((p) => p.workspace_id === workspace.id)?.value ?? {},
      research: {
        draft: researchFor(workspace.id, PROFILE_KEYS.draft),
        approved: researchFor(workspace.id, PROFILE_KEYS.approved),
        brief: researchFor(workspace.id, BRIEF_KEY) as unknown as OwnerBrief | null,
        analysing: ((analysing ?? []) as { workspace_id: string }[]).some((j) => j.workspace_id === workspace.id),
      },
      members: ((members ?? []) as { workspace_id: string; email: string; role: string }[]).filter((m) => m.workspace_id === workspace.id).map(({ email, role }) => ({ email, role })),
      setup: {
        profile: Boolean(((profiles ?? []) as { workspace_id: string; value: Record<string, unknown> }[]).find((p) => p.workspace_id === workspace.id)?.value?.description),
        searchConsole: Boolean(new Map(gsc).get(workspace.id)?.find((c) => c.name === "gsc_site_url")?.in_vault) || (workspace.id === DEFAULT_WORKSPACE && Boolean(process.env.GSC_SITE_URL)),
        competitors: ((flag(workspace.id, "competitors") as string[] | undefined) ?? []).length > 0,
        local: Boolean((flag(workspace.id, "local_profile") as { phone?: string } | undefined)?.phone),
        autopilot: (flag(workspace.id, "autopilot") as { enabled?: boolean } | undefined)?.enabled === true,
        crawled: ((crawls ?? []) as { workspace_id: string }[]).some((c) => c.workspace_id === workspace.id),
        live: ((livePosts ?? []) as { workspace_id: string }[]).filter((p) => p.workspace_id === workspace.id).length,
      },
    };
  });
}

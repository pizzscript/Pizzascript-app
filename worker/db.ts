import { createClient } from "@supabase/supabase-js";
import { jobPriority } from "../src/lib/studio/jobs";
import { DEFAULT_SCORING } from "../src/lib/studio/scoring";
import type { Batch, Cluster, Fact, JobType, LinkPlan, ScheduleSettings, ScoringSettings, Signal, StudioPost, Topic } from "../src/lib/studio/types";
import { env } from "./env";

export const db = createClient(env.supabaseUrl, env.supabaseSecretKey, { auth: { persistSession: false } });

export function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

export async function setting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db.from("settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}

export const settings = {
  scoring: () => setting<ScoringSettings>("scoring", DEFAULT_SCORING),
  schedule: () => setting<ScheduleSettings>("schedule", { timezone: "Asia/Kolkata", publishAt: "09:00", briefingAt: "06:30", perDay: 1 }),
  banned: () => setting<string[]>("banned_phrases", []),
  neverCover: () => setting<string[]>("never_cover", []),
  wordRanges: () => setting<Record<string, [number, number]>>("word_ranges", {}),
  /** Global autopilot: when on, every scheduled post is prepared and published automatically if it passes the SEO check. */
  autopilot: async () => (await setting<{ enabled?: boolean }>("autopilot", {})).enabled === true,
};

export async function getPost(id: string) {
  return check(await db.from("posts").select("*").eq("id", id).single(), "post") as StudioPost;
}

export async function allPosts() {
  return check(await db.from("posts").select("*"), "posts") as StudioPost[];
}

export async function allTopics() {
  return check(await db.from("topics").select("*"), "topics") as Topic[];
}

export async function allClusters() {
  return check(await db.from("clusters").select("*").order("position"), "clusters") as Cluster[];
}

export async function allBatches() {
  return check(await db.from("batches").select("*"), "batches") as Batch[];
}

/** Only facts the owner marked verified may ever be cited by the agent. */
export async function allFacts() {
  return check(await db.from("facts").select("*").eq("verified", true), "facts") as Fact[];
}

/** Everything the scheduler needs to decide what's next, without loading every full article into memory. */
export async function pipelinePosts() {
  return check(
    await db.from("posts").select("id,slug,title,stage,status,scheduled_for,approved_at,batch_id,auto_pipeline,brief,audit,cover_image_url,seo_plan"),
    "pipeline posts",
  ) as unknown as StudioPost[];
}

export async function linkPlan() {
  return check(await db.from("link_plan").select("*"), "link_plan") as LinkPlan[];
}

export async function openSignals() {
  return check(await db.from("signals").select("*").eq("status", "open"), "signals") as Signal[];
}

export async function enqueue(type: string, payload: Record<string, unknown> = {}, delaySeconds = 0) {
  check(
    await db
      .from("jobs")
      .insert({ type, payload, priority: jobPriority(type as JobType, "agent"), run_after: new Date(Date.now() + delaySeconds * 1000).toISOString() }),
    `enqueue ${type}`,
  );
}

/** Signals are de-duplicated by key so recurring checks don't spam the Pass. */
export async function raiseSignal(signal: Omit<Signal, "id" | "status" | "created_at"> & { dedupe_key: string }) {
  const { error } = await db.from("signals").upsert({ ...signal, status: "open" }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error(`signal: ${error.message}`);
}

export async function saveVersion(post: StudioPost, bodyHtml: string, note: string, extra: Partial<StudioPost> = {}) {
  const version = (post.version ?? 0) + 1;
  // Imported articles have no history row yet: keep the text being replaced so it can always be restored.
  if (post.body_html && post.version) {
    await db.from("post_versions").upsert(
      { post_id: post.id, version: post.version, title: post.title, body_html: post.body_html, cover_image_url: post.cover_image_url, note: "Previous version", author: "agent" },
      { onConflict: "post_id,version", ignoreDuplicates: true },
    );
  }
  check(
    await db.from("post_versions").insert({
      post_id: post.id,
      version,
      title: extra.title ?? post.title,
      body_html: bodyHtml,
      cover_image_url: extra.cover_image_url ?? post.cover_image_url,
      note,
      author: "agent",
    }),
    "version",
  );
  check(await db.from("posts").update({ ...extra, body_html: bodyHtml, version, audit: null }).eq("id", post.id), "post update");
  return version;
}

export function todayIst() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

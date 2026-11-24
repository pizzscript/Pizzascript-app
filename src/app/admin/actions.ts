"use server";

import { AUTO_PICK_DEFAULTS } from "@/lib/studio/autopick";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { POSTS_TAG, clientPostsTag } from "@/lib/blog";
import { jobLabel, jobPriority } from "@/lib/studio/jobs";
import { computeScore, priorityFor } from "@/lib/studio/scoring";
import { requireAdmin, supabaseServer } from "@/lib/studio/server";
import type { JobType, ScoringSettings, Topic, TopicStatus } from "@/lib/studio/types";
import { DEFAULT_WORKSPACE } from "@/lib/studio/workspace-scope";

const PREVIEW = "Preview mode — connect Supabase to make changes.";

async function liveStudio() {
  const studio = await requireAdmin();
  if (studio.mode === "preview") throw new Error(PREVIEW);
  return studio;
}

async function live() {
  return (await liveStudio()).db;
}

/** A client's live article that was edited here: refresh that client's cached feed so their site shows the change. */
async function syncClientPost(post: { stage?: string; slug?: string } | null) {
  const studio = await liveStudio();
  if (post?.stage !== "live" || studio.workspace.id === DEFAULT_WORKSPACE) return;
  revalidateTag(clientPostsTag(studio.workspace.id), "max");
  if (post.slug) revalidateTag(`${clientPostsTag(studio.workspace.id)}:${post.slug}`, "max");
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function refreshPublicPost(post: { slug: string; stage: string } | null) {
  if (post?.stage !== "live") return;
  revalidateTag(POSTS_TAG, "max");
  revalidateTag(`post:${post.slug}`, "max");
}

/**
 * Runs queued jobs inside this server process, after the response is sent. Only on a long-lived Node host
 * (Render) with RUN_JOBS_IN_PROCESS=1 — serverless hosts would cut a Gemini job short, so there jobs just
 * wait in the queue for the scheduled GitHub Actions run.
 */
function startJobs() {
  if (process.env.RUN_JOBS_IN_PROCESS !== "1") return false;
  after(async () => {
    try {
      const { requestRun } = await import("../../../worker/runner");
      // A long-lived server has no request timeout; give a manual run room to carry a few posts through.
      await requestRun(30 * 60_000);
    } catch (error) {
      console.error("[jobs]", error instanceof Error ? error.message : error);
    }
  });
  return true;
}

export async function enqueue(type: JobType, payload: Record<string, unknown> = {}) {
  const db = await live();
  const { data, error } = await db.from("jobs").insert({ type, payload, priority: jobPriority(type, "admin") }).select("id").single();
  fail(error);
  startJobs();
  revalidatePath("/admin", "layout");
  return data!.id as string;
}

/** Manual "Run agent now". */
export async function runAgent() {
  await live();
  if (!startJobs()) throw new Error("Jobs run on the admin server (RUN_JOBS_IN_PROCESS=1). Here they wait for the scheduled run.");
  revalidatePath("/admin", "layout");
}

/** Queued and running jobs with what they're for — the admin's agent activity panel polls this. */
export async function activeJobs() {
  const db = await live();
  const { data: jobs, error } = await db
    .from("jobs")
    .select("id,type,status,payload,started_at,heartbeat_at,run_after,created_at")
    .in("status", ["queued", "running"])
    .order("created_at")
    .limit(30);
  fail(error);
  const list = (jobs ?? []) as {
    id: string;
    type: JobType;
    status: "queued" | "running";
    payload: { postId?: string; topicId?: string };
    started_at: string | null;
    heartbeat_at: string | null;
    run_after: string;
    created_at: string;
  }[];
  const now = Date.now();

  // Nudge: jobs are due but nothing is genuinely running (none, or only one whose worker stopped) → start the agent.
  const alive = list.some((j) => j.status === "running" && now - new Date(j.heartbeat_at ?? j.started_at ?? 0).getTime() < 2 * 60_000);
  const due = list.some((j) => j.status === "running" || (j.status === "queued" && new Date(j.run_after).getTime() <= now));
  if (due && !alive) startJobs();

  // Health: failures in the last 24h, and how long the oldest due job has been waiting.
  const { count: failed24h } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("finished_at", new Date(now - 86_400_000).toISOString());
  const waiting = list.filter((j) => j.status === "queued" && new Date(j.run_after).getTime() <= now);
  const oldestWaitMin = waiting.length ? Math.round((now - Math.min(...waiting.map((j) => new Date(j.created_at).getTime()))) / 60_000) : 0;
  const postIds = [...new Set(list.map((j) => j.payload?.postId).filter((x): x is string => !!x))];
  const topicIds = [...new Set(list.map((j) => j.payload?.topicId).filter((x): x is string => !!x))];
  const [posts, topics] = await Promise.all([
    postIds.length ? db.from("posts").select("id,title").in("id", postIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    topicIds.length ? db.from("topics").select("id,query").in("id", topicIds) : Promise.resolve({ data: [] as { id: string; query: string }[] }),
  ]);
  return {
    jobs: list.map((j) => ({
      id: j.id,
      type: j.type,
      status: j.status,
      postId: j.payload?.postId,
      label: jobLabel(j.type),
      subject: posts.data?.find((p) => p.id === j.payload?.postId)?.title ?? topics.data?.find((t) => t.id === j.payload?.topicId)?.query,
    })),
    health: { failed24h: failed24h ?? 0, oldestWaitMin },
  };
}

export async function jobStatuses(ids: string[]) {
  if (ids.length === 0) return [];
  const db = await live();
  const { data, error } = await db.from("jobs").select("id,type,status,error").in("id", ids);
  fail(error);
  return data as { id: string; type: JobType; status: string; error: string | null }[];
}

function istSlot(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:30`).toISOString();
}

export async function slotPost(postId: string, date: string | null) {
  const db = await live();
  if (!date) {
    fail((await db.from("posts").update({ scheduled_for: null }).eq("id", postId)).error);
  } else {
    const { data: settings } = await db.from("settings").select("value").eq("key", "schedule").maybeSingle();
    const { publishAt = "09:00", perDay = 1 } = (settings?.value ?? {}) as { publishAt?: string; perDay?: number };
    const start = istSlot(date, "00:00");
    const end = new Date(new Date(start).getTime() + 86_400_000).toISOString();
    const { data: taken } = await db
      .from("posts")
      .select("id,title")
      .neq("id", postId)
      .neq("stage", "live")
      .gte("scheduled_for", start)
      .lt("scheduled_for", end);
    if ((taken?.length ?? 0) >= perDay) throw new Error(`${date} is taken by "${taken![0].title}"`);
    fail((await db.from("posts").update({ scheduled_for: istSlot(date, publishAt) }).eq("id", postId)).error);
  }
  revalidatePath("/admin", "layout");
}

export async function approveBatch(batchId: string, approved: boolean) {
  const db = await live();
  fail((await db.from("batches").update({ approved_at: approved ? new Date().toISOString() : null }).eq("id", batchId)).error);
  // Approving a batch works through all its posts, one at a time.
  if (approved) startJobs();
  revalidatePath("/admin", "layout");
}

/** Global autopilot. On: every scheduled post is written, bannered, SEO-checked and published on its date if it passes. */
export async function setAutopilot(enabled: boolean) {
  const db = await live();
  fail((await db.from("settings").upsert({ key: "autopilot", value: { enabled } })).error);
  if (enabled) startJobs();
  revalidatePath("/admin", "layout");
}

/** Auto-pick lets the agent choose its own ideas. Turning it on also clears a safety pause. */
export async function setAutoPick(enabled: boolean) {
  const db = await live();
  const [{ data: saved }, { data: state }] = await Promise.all([
    db.from("settings").select("value").eq("key", "autopick").maybeSingle(),
    db.from("settings").select("value").eq("key", "autopick_state").maybeSingle(),
  ]);
  fail((await db.from("settings").upsert({ key: "autopick", value: { ...AUTO_PICK_DEFAULTS, ...(saved?.value as object | undefined), enabled } })).error);
  if (enabled && state?.value) {
    const { pausedReason: _cleared, ...rest } = state.value as { pausedReason?: string };
    void _cleared;
    fail((await db.from("settings").upsert({ key: "autopick_state", value: rest })).error);
  }
  revalidatePath("/admin", "layout");
}

export async function approvePost(postId: string, approved: boolean) {
  const studio = await liveStudio();
  const db = studio.db;
  const { data: post, error } = await db.from("posts").select("stage,audit,scheduled_for").eq("id", postId).single();
  fail(error);
  const ready = approved && post!.audit?.ok && post!.scheduled_for && ["audit", "slotted"].includes(post!.stage);
  fail(
    (
      await db
        .from("posts")
        .update({ approved_at: approved ? new Date().toISOString() : null, approved_by: approved ? studio.email : null, stage: ready ? "slotted" : post!.stage === "slotted" ? "audit" : post!.stage })
        .eq("id", postId)
    ).error,
  );
  revalidatePath("/admin", "layout");
}

const EDITABLE = ["title", "seo_title", "seo_description", "excerpt", "image_prompt", "cover_image_alt"] as const;

export async function updatePost(postId: string, fields: Partial<Record<(typeof EDITABLE)[number], string>>) {
  const db = await live();
  const clean = Object.fromEntries(Object.entries(fields).filter(([k]) => (EDITABLE as readonly string[]).includes(k)));
  const { data: post, error } = await db.from("posts").update({ ...clean, audit: null }).eq("id", postId).select("slug,stage,body_html").single();
  fail(error);
  refreshPublicPost(post);
  await syncClientPost(post);
  // Title/SEO changes can fix (or break) the SEO check — re-run it, so a stuck post continues on its own.
  if (post?.body_html && post.stage !== "live") {
    await db.from("jobs").insert({ type: "run_audit", payload: { postId }, priority: jobPriority("run_audit", "admin") });
    startJobs();
  }
  revalidatePath(`/admin/posts/${postId}`);
}

export async function saveBody(postId: string, bodyHtml: string, note: string) {
  const db = await live();
  const { data: post, error } = await db.from("posts").select("slug,stage,title,version,cover_image_url,body_html").eq("id", postId).single();
  fail(error);
  const version = (post!.version ?? 0) + 1;
  // Imported articles have no history row yet: keep the text being replaced so it can always be restored.
  if (post!.body_html && post!.version) {
    await db.from("post_versions").upsert(
      { post_id: postId, version: post!.version, title: post!.title, body_html: post!.body_html, cover_image_url: post!.cover_image_url, note: "Previous version", author: "admin" },
      { onConflict: "post_id,version", ignoreDuplicates: true },
    );
  }
  fail(
    (
      await db
        .from("post_versions")
        .insert({ post_id: postId, version, title: post!.title, body_html: bodyHtml, cover_image_url: post!.cover_image_url, note, author: "admin" })
    ).error,
  );
  fail((await db.from("posts").update({ body_html: bodyHtml, version, audit: null }).eq("id", postId)).error);
  refreshPublicPost(post);
  await syncClientPost(post);
  await db.from("jobs").insert({ type: "run_audit", payload: { postId }, priority: jobPriority("run_audit", "admin") });
  startJobs();
  revalidatePath(`/admin/posts/${postId}`);
}

/** Takes a live article off the site. It returns to Ready without a date; nothing is deleted. */
export async function unpublishPost(postId: string) {
  const db = await live();
  fail((await db.from("jobs").insert({ type: "unpublish_post", payload: { postId }, priority: jobPriority("unpublish_post", "admin") })).error);
  startJobs();
  revalidatePath(`/admin/posts/${postId}`);
}

export async function restoreVersion(postId: string, versionId: string) {
  const db = await live();
  const { data: v, error } = await db.from("post_versions").select("*").eq("id", versionId).single();
  fail(error);
  await saveBody(postId, v!.body_html, `Restored v${v!.version}`);
}

export async function setSignal(signalId: string, status: "acted" | "dismissed") {
  const db = await live();
  fail((await db.from("signals").update({ status }).eq("id", signalId)).error);
  revalidatePath("/admin");
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export async function createTopic(input: { query: string; clusterId: string | null; track: 1 | 2; source?: Topic["source"] }) {
  const db = await live();
  const query = input.query.trim();
  if (query.length < 4) throw new Error("Query is too short");
  const { data, error } = await db
    .from("topics")
    .insert({ slug: slugify(query), query, cluster_id: input.clusterId, track: input.track, source: input.source ?? "manual" })
    .select("id")
    .single();
  fail(error);
  await db.from("jobs").insert({ type: "score_topic", payload: { topicId: data!.id } });
  revalidatePath("/admin/ideas");
  return data!.id as string;
}

export async function setTopicStatus(topicId: string, status: TopicStatus, reason?: string) {
  const db = await live();
  fail((await db.from("topics").update({ status, reason: reason ?? null }).eq("id", topicId)).error);
  // Approving an idea starts its post down the whole pipeline (brief → draft → banner → SEO check) with no more clicks.
  if (status === "approved") {
    await db.from("jobs").insert({ type: "write_brief", payload: { topicId, auto: true }, priority: jobPriority("write_brief", "admin") });
    startJobs();
  }
  revalidatePath("/admin", "layout");
}

export async function saveScoring(settings: ScoringSettings) {
  const db = await live();
  fail((await db.from("settings").upsert({ key: "scoring", value: settings })).error);
  const { data: topics } = await db.from("topics").select("id,scores,track");
  for (const t of (topics ?? []) as Pick<Topic, "id" | "scores" | "track">[]) {
    if (Object.keys(t.scores).length < 4) continue;
    const { score } = computeScore(t.scores, t.track, settings);
    await db.from("topics").update({ score, priority: priorityFor(score, settings) }).eq("id", t.id);
  }
  revalidatePath("/admin/ideas");
}

export async function sendMessage(thread: string, content: string) {
  const db = await live();
  const text = content.trim();
  if (!text) return;
  fail((await db.from("agent_messages").insert({ thread, role: "admin", content: text })).error);
  await enqueue("discuss", { thread });
}

const SETTING_KEYS = ["schedule", "banned_phrases", "word_ranges", "never_cover", "research", "competitors", "local_profile"] as const;

export async function saveSetting(key: (typeof SETTING_KEYS)[number], value: unknown) {
  if (!(SETTING_KEYS as readonly string[]).includes(key)) throw new Error("Unknown setting");
  const db = await live();
  fail((await db.from("settings").upsert({ key, value })).error);
  revalidatePath("/admin", "layout");
}

export async function addFact(subject: string, statement: string, source: string) {
  const db = await live();
  if (subject.trim().length < 2 || statement.trim().length < 8) throw new Error("Add a subject and a full statement");
  fail((await db.from("facts").insert({ subject: subject.trim(), statement: statement.trim(), source: source.trim() || null })).error);
  revalidatePath("/admin/settings");
}

export async function setFactVerified(factId: string, verified: boolean) {
  const db = await live();
  fail((await db.from("facts").update({ verified }).eq("id", factId)).error);
  revalidatePath("/admin/settings");
}

export async function deleteFact(factId: string) {
  const db = await live();
  fail((await db.from("facts").delete().eq("id", factId)).error);
  revalidatePath("/admin/settings");
}

export async function saveCategory(input: { id?: string; name: string; audience: "client" | "developer" | "both"; targetT1: number }) {
  const db = await live();
  const name = input.name.trim();
  if (name.length < 3) throw new Error("Category name is too short");
  const id = input.id ?? slugify(name);
  fail((await db.from("clusters").upsert({ id, name, audience: input.audience, target_t1: Math.max(0, Math.min(100, input.targetT1)) })).error);
  revalidatePath("/admin", "layout");
}

export async function updateTaxonomy(postId: string, fields: { clusterId: string | null; tags: string[] }) {
  const db = await live();
  const tags = [...new Set(fields.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 12);
  const { data: cluster } = fields.clusterId ? await db.from("clusters").select("name").eq("id", fields.clusterId).maybeSingle() : { data: null };
  const { data: post, error } = await db.from("posts").update({ cluster_id: fields.clusterId, category: cluster?.name ?? null, tags }).eq("id", postId).select("slug,stage").single();
  fail(error);
  refreshPublicPost(post);
  revalidatePath(`/admin/posts/${postId}`);
}

export async function signOut() {
  const db = await supabaseServer();
  await db.auth.signOut();
  redirect("/admin/login");
}

/** A link idea was sent, won or isn't worth it. */
export async function setOpportunityStatus(id: string, status: "new" | "sent" | "won" | "dismissed") {
  const db = await live();
  fail((await db.from("link_opportunities").update({ status }).eq("id", id)).error);
  revalidatePath("/admin/links");
}

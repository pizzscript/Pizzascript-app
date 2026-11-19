"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeScore, priorityFor } from "@/lib/studio/scoring";
import { requireAdmin, supabaseServer } from "@/lib/studio/server";
import type { JobType, ScoringSettings, Topic, TopicStatus } from "@/lib/studio/types";

const PREVIEW = "Preview mode — connect Supabase to make changes.";

async function live() {
  const studio = await requireAdmin();
  if (studio.mode === "preview") throw new Error(PREVIEW);
  return studio.db;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function enqueue(type: JobType, payload: Record<string, unknown> = {}) {
  const db = await live();
  const { data, error } = await db.from("jobs").insert({ type, payload, priority: type === "discuss" ? 5 : 0 }).select("id").single();
  fail(error);
  revalidatePath("/admin", "layout");
  return data!.id as string;
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
  revalidatePath("/admin", "layout");
}

export async function approvePost(postId: string, approved: boolean) {
  const db = await live();
  const { data: post, error } = await db.from("posts").select("stage,audit,scheduled_for").eq("id", postId).single();
  fail(error);
  const ready = approved && post!.audit?.ok && post!.scheduled_for && ["audit", "slotted"].includes(post!.stage);
  fail(
    (
      await db
        .from("posts")
        .update({ approved_at: approved ? new Date().toISOString() : null, stage: ready ? "slotted" : post!.stage === "slotted" ? "audit" : post!.stage })
        .eq("id", postId)
    ).error,
  );
  revalidatePath("/admin", "layout");
}

const EDITABLE = ["title", "seo_title", "seo_description", "excerpt", "image_prompt", "cover_image_alt"] as const;

export async function updatePost(postId: string, fields: Partial<Record<(typeof EDITABLE)[number], string>>) {
  const db = await live();
  const clean = Object.fromEntries(Object.entries(fields).filter(([k]) => (EDITABLE as readonly string[]).includes(k)));
  fail((await db.from("posts").update(clean).eq("id", postId)).error);
  revalidatePath(`/admin/posts/${postId}`);
}

export async function saveBody(postId: string, bodyHtml: string, note: string) {
  const db = await live();
  const { data: post, error } = await db.from("posts").select("title,version,cover_image_url").eq("id", postId).single();
  fail(error);
  const version = (post!.version ?? 0) + 1;
  fail(
    (
      await db
        .from("post_versions")
        .insert({ post_id: postId, version, title: post!.title, body_html: bodyHtml, cover_image_url: post!.cover_image_url, note, author: "admin" })
    ).error,
  );
  fail((await db.from("posts").update({ body_html: bodyHtml, version, audit: null }).eq("id", postId)).error);
  await db.from("jobs").insert({ type: "run_audit", payload: { postId } });
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
  revalidatePath("/admin/lab");
  return data!.id as string;
}

export async function setTopicStatus(topicId: string, status: TopicStatus, reason?: string) {
  const db = await live();
  fail((await db.from("topics").update({ status, reason: reason ?? null }).eq("id", topicId)).error);
  if (status === "approved") await db.from("jobs").insert({ type: "write_brief", payload: { topicId } });
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
  revalidatePath("/admin/lab");
}

export async function sendMessage(thread: string, content: string) {
  const db = await live();
  const text = content.trim();
  if (!text) return;
  fail((await db.from("agent_messages").insert({ thread, role: "admin", content: text })).error);
  await enqueue("discuss", { thread });
}

const SETTING_KEYS = ["schedule", "banned_phrases", "word_ranges", "never_cover"] as const;

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
  fail((await db.from("posts").update({ cluster_id: fields.clusterId, category: cluster?.name ?? null, tags }).eq("id", postId)).error);
  revalidatePath(`/admin/posts/${postId}`);
}

export async function signOut() {
  const db = await supabaseServer();
  await db.auth.signOut();
  redirect("/admin/login");
}

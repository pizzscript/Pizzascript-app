"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/studio/server";
import { enqueue } from "./actions";

const PREVIEW = "Preview mode — connect Supabase to make changes.";
const CTA_TYPES = ["NONE", "LEARN_MORE", "BOOK", "ORDER", "SHOP", "SIGN_UP", "CALL"] as const;
export type CtaType = (typeof CTA_TYPES)[number];

async function live() {
  const studio = await requireAdmin();
  if (studio.mode === "preview") throw new Error(PREVIEW);
  return studio.db;
}

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export interface PostInput {
  summary: string;
  ctaType: CtaType;
  ctaUrl: string;
  photoUrl: string;
}

/** Checks a post the way Google will, so problems show here instead of as a failed post later. */
function clean(input: PostInput) {
  const summary = input.summary.trim();
  if (summary.length < 10) throw new Error("Write at least a sentence.");
  if (summary.length > 1450) throw new Error("Business Profile posts can be at most 1,450 characters.");
  if (!CTA_TYPES.includes(input.ctaType)) throw new Error("Choose a button.");
  const ctaUrl = input.ctaUrl.trim();
  if (input.ctaType !== "NONE" && input.ctaType !== "CALL" && !/^https:\/\/\S+$/.test(ctaUrl)) throw new Error("The button needs a link starting with https://");
  const photoUrl = input.photoUrl.trim();
  if (photoUrl && !/^https:\/\/\S+$/.test(photoUrl)) throw new Error("The photo link must start with https://");
  return { summary, cta_type: input.ctaType, cta_url: ctaUrl || null, photo_url: photoUrl || null };
}

const done = () => revalidatePath("/business-profile");

/** Edits a post that hasn't gone out yet (or failed). */
export async function saveLocalPost(id: string, input: PostInput) {
  const db = await live();
  fail((await db.from("local_posts").update({ ...clean(input), updated_at: new Date().toISOString() }).eq("id", id).in("status", ["draft", "queued", "failed"])).error);
  done();
}

/** Your own post (an update, an offer, news). It goes out on the next sync, which starts now. */
export async function createLocalPost(input: PostInput) {
  const db = await live();
  fail((await db.from("local_posts").insert({ ...clean(input), source: "custom", status: "queued" })).error);
  await enqueue("local_post");
  done();
}

/**
 * post: send a draft now · retry: try a failed post again · skip: never post it · restore: back to draft ·
 * delete: remove a live post from Google.
 */
export async function setLocalPost(id: string, action: "post" | "retry" | "skip" | "restore" | "delete") {
  const db = await live();
  const next = { post: "queued", retry: "queued", skip: "skipped", restore: "draft", delete: "deleting" }[action];
  const from = { post: ["draft"], retry: ["failed"], skip: ["draft", "queued", "failed"], restore: ["skipped"], delete: ["posted"] }[action];
  fail((await db.from("local_posts").update({ status: next, ...(action === "retry" ? { attempts: 0, detail: null } : {}), updated_at: new Date().toISOString() }).eq("id", id).in("status", from)).error);
  if (action === "post" || action === "retry" || action === "delete") await enqueue("local_post");
  done();
}

/** Reads new reviews and sends anything due, now instead of at the daily run. */
export async function syncBusinessProfile() {
  await live();
  await enqueue("local_post");
  done();
}

/** Asks the AI for a reply in the client's voice. It's only a draft: nothing is sent until you press Send. */
export async function draftReply(name: string) {
  const db = await live();
  fail((await db.from("gbp_reviews").update({ reply_status: "drafting", reply_error: null }).eq("name", name)).error);
  await enqueue("gbp_draft_reply", { name });
  done();
}

export async function saveReply(name: string, reply: string, send: boolean) {
  const db = await live();
  const text = reply.trim();
  if (text.length < 2) throw new Error("Write a reply first.");
  if (text.length > 4000) throw new Error("Replies can be at most 4,000 characters.");
  fail((await db.from("gbp_reviews").update({ draft_reply: text, reply_status: send ? "sending" : "drafted", reply_error: null, updated_at: new Date().toISOString() }).eq("name", name)).error);
  if (send) await enqueue("local_post");
  done();
}

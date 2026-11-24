"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { memberWorkspace } from "@/lib/portal";
import { supabaseServer } from "@/lib/studio/server";

/** Emails a sign-in link. Only people invited to a client can sign in (no new accounts are created here). */
export async function sendSignInLink(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter a valid email." };
  if (!process.env.SUPABASE_URL) return { ok: false, message: "Not configured yet." };
  const origin = (await headers()).get("origin") ?? process.env.PUBLIC_APP_URL ?? "";
  const { error } = await (await supabaseServer()).auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${origin}/portal/auth` } });
  // The same answer either way, so the form doesn't reveal who has access.
  if (error && !/not found|signups not allowed/i.test(error.message)) return { ok: false, message: "Couldn't send the link. Try again in a minute." };
  return { ok: true, message: "If this email has access, a sign-in link is on its way." };
}

/** A client approves (or withdraws approval of) one of their own articles. */
export async function approveAsClient(slug: string, postId: string, approved: boolean) {
  const { member, workspace, db } = await memberWorkspace(slug);
  if (workspace.approval_mode === "automatic") throw new Error("Articles for this site publish automatically.");
  const role = member.workspaces.find((w) => w.id === workspace.id)?.role;
  if (workspace.approval_mode === "owner" && role === "client_viewer") throw new Error("Your agency approves articles for this site.");
  const { data: post, error } = await db.from("posts").select("stage,audit,scheduled_for").eq("id", postId).single();
  if (error || !post) throw new Error("Article not found.");
  if (approved && !(post.audit as { ok?: boolean } | null)?.ok) throw new Error("This article is still being checked.");
  const ready = approved && post.scheduled_for && ["audit", "slotted"].includes(post.stage);
  const { error: saveError } = await db
    .from("posts")
    .update({ approved_at: approved ? new Date().toISOString() : null, approved_by: approved ? member.email : null, stage: ready ? "slotted" : post.stage === "slotted" ? "audit" : post.stage })
    .eq("id", postId);
  if (saveError) throw new Error(saveError.message);
  revalidatePath(`/portal/${slug}`);
}

export async function signOutPortal() {
  await (await supabaseServer()).auth.signOut();
  redirect("/portal/login");
}

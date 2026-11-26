"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { MODULES, PLAN_PRESETS, type ModuleId } from "@/lib/studio/plans";
import { CLIENT_COOKIE, requireAdmin, supabaseServer } from "@/lib/studio/server";
import { DEFAULT_WORKSPACE } from "@/lib/studio/workspace-scope";

const PREVIEW = "Preview mode — connect Supabase to make changes.";

async function admin() {
  const studio = await requireAdmin();
  if (studio.mode === "preview") throw new Error(PREVIEW);
  return studio;
}

/** Signs in separately with the password, so a stolen browser session alone can't delete a client. */
async function confirmPassword(email: string, password: string) {
  if (!password) throw new Error("Enter your admin password to confirm.");
  const auth = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await auth.auth.signInWithPassword({ email, password });
  if (error) throw new Error("That password isn't right.");
  await auth.auth.signOut({ scope: "local" });
}

const refresh = () => revalidatePath("/", "layout");

/** Switches the admin to another client. Every page then shows and changes only that client's data. */
export async function switchClient(id: string) {
  const studio = await admin();
  if (!studio.workspaces.some((w) => w.id === id)) throw new Error("Unknown client");
  (await cookies()).set(CLIENT_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  refresh();
}

export interface NewClient {
  name: string;
  slug: string;
  siteUrl: string;
  location: string;
  language: string;
  approvalMode: "owner" | "client" | "automatic";
  preset: keyof typeof PLAN_PRESETS;
}

export async function createClientWorkspace(input: NewClient) {
  const studio = await admin();
  if (input.preset === "internal") throw new Error("Choose Starter, Growth or Pro.");
  const preset = PLAN_PRESETS[input.preset] ?? PLAN_PRESETS.starter;
  const { data, error } = await (await supabaseServer()).rpc("create_workspace", {
    ws_slug: input.slug.trim().toLowerCase(),
    ws_name: input.name.trim(),
    ws_site: input.siteUrl.trim(),
    ws_location: input.location.trim(),
    ws_language: input.language || "en",
    ws_cms: "hosted",
    ws_approval: input.approvalMode,
    ws_plan: preset,
  });
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "That short name is already used." : error.message);
  (await cookies()).set(CLIENT_COOKIE, data as string, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  void studio;
  refresh();
  return data as string;
}

export interface ClientChanges {
  name?: string;
  siteUrl?: string;
  location?: string;
  language?: string;
  approvalMode?: "owner" | "client" | "automatic";
  plan?: { name?: string; articlesPerMonth?: number; aiRequestsPerDay?: number; researchLevel?: "off" | "light" | "full"; crawlPages?: number; competitors?: number; modules?: ModuleId[] };
}

const whole = (n: unknown, min: number, max: number, what: string) => {
  const v = Number(n);
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${what} must be a whole number from ${min} to ${max}.`);
  return v;
};

export async function updateClient(id: string, changes: ClientChanges) {
  await admin();
  const raw = await supabaseServer();
  const { data: current, error: readError } = await raw.from("workspaces").select("plan").eq("id", id).single();
  if (readError) throw new Error(readError.message);
  const patch: Record<string, unknown> = {};
  if (changes.name !== undefined) {
    if (!changes.name.trim()) throw new Error("The name can't be empty.");
    patch.name = changes.name.trim();
  }
  if (changes.siteUrl !== undefined) {
    if (!/^https:\/\/[^/\s]+\.[^/\s]+/.test(changes.siteUrl.trim())) throw new Error("The site address must start with https://");
    patch.site_url = changes.siteUrl.trim().replace(/\/+$/, "");
  }
  if (changes.location !== undefined) patch.location = changes.location.trim() || null;
  if (changes.language !== undefined) patch.language = changes.language.trim() || "en";
  if (changes.approvalMode !== undefined) patch.approval_mode = changes.approvalMode;
  if (changes.plan) {
    const p = changes.plan;
    const next = { ...((current?.plan as Record<string, unknown>) ?? {}) };
    if (p.name !== undefined) next.name = p.name;
    if (p.articlesPerMonth !== undefined) next.articlesPerMonth = whole(p.articlesPerMonth, 0, 300, "Articles a month");
    if (p.aiRequestsPerDay !== undefined) next.aiRequestsPerDay = whole(p.aiRequestsPerDay, id === DEFAULT_WORKSPACE ? 0 : 10, 10_000, "AI requests a day");
    if (p.researchLevel !== undefined) next.researchLevel = p.researchLevel;
    if (p.crawlPages !== undefined) next.crawlPages = whole(p.crawlPages, 0, 20_000, "Pages per crawl");
    if (p.competitors !== undefined) next.competitors = whole(p.competitors, 0, 10, "Competitors");
    if (p.modules !== undefined) next.modules = p.modules.filter((m) => MODULES.some((x) => x.id === m));
    patch.plan = next;
  }
  const { error } = await raw.from("workspaces").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

/** Pause stops all of a client's work (its jobs wait); archive also hides it from the switcher. */
export async function setClientStatus(id: string, status: "active" | "paused" | "archived") {
  await admin();
  if (id === DEFAULT_WORKSPACE && status !== "active") throw new Error("PizzaScript itself stays active. Switch off Autopilot instead.");
  const raw = await supabaseServer();
  const { error } = await raw.from("workspaces").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  if (status === "archived") (await cookies()).set(CLIENT_COOKIE, DEFAULT_WORKSPACE, { httpOnly: true, sameSite: "lax", path: "/" });
  refresh();
}

export interface ProfileChanges {
  description?: string;
  shortDescription?: string;
  researchDescription?: string;
  market?: string;
  voiceRule?: string;
  positioning?: string;
  trendFocus?: string;
  /** The client's page that shows articles; {slug} is replaced by the article's slug. */
  articleUrl?: string;
  feeds?: { name: string; url: string }[];
}

/** What the agent says about this client. Blank fields fall back to neutral wording. */
export async function saveClientProfile(id: string, changes: ProfileChanges) {
  await admin();
  if (id === DEFAULT_WORKSPACE) throw new Error("PizzaScript's profile is built in.");
  const clean = Object.fromEntries(
    Object.entries(changes)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, typeof v === "string" ? v.trim().slice(0, 400) : v]),
  ) as ProfileChanges;
  if (clean.feeds) {
    clean.feeds = clean.feeds.filter((f) => f.name.trim() && /^https:\/\//.test(f.url.trim())).slice(0, 10).map((f) => ({ name: f.name.trim(), url: f.url.trim() }));
  }
  if (clean.articleUrl && !/^https:\/\/[^\s]+\{slug\}/.test(clean.articleUrl)) throw new Error("The article address must start with https:// and contain {slug}.");
  // Empty strings mean "use the default", so they aren't saved.
  const value = Object.fromEntries(Object.entries(clean).filter(([, v]) => v !== ""));
  const raw = await supabaseServer();
  const { error } = await raw.from("settings").upsert({ workspace_id: id, key: "profile", value }, { onConflict: "workspace_id,key" });
  if (error) throw new Error(error.message);
  refresh();
}

/** Deletes everything a client owns. Needs the client archived, its short name typed and your password. */
export async function deleteClient(id: string, confirmSlug: string, password: string) {
  const studio = await admin();
  await confirmPassword(studio.email, password);
  const raw = await supabaseServer();
  const { data: files } = await raw.storage.from("blog-images").list(id, { limit: 1000 });
  const { data, error } = await raw.rpc("delete_workspace", { ws: id, confirm_slug: confirmSlug.trim() });
  if (error) throw new Error(error.message);
  // Banners live in the client's own folder; remove them too.
  if (files?.length) await raw.storage.from("blog-images").remove(files.map((f) => `${id}/${f.name}`));
  (await cookies()).set(CLIENT_COOKIE, DEFAULT_WORKSPACE, { httpOnly: true, sameSite: "lax", path: "/" });
  refresh();
  return data as Record<string, number>;
}

const service = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

/** Gives someone a client login: they get an email invite and can then sign in at /portal with an emailed link. */
export async function inviteClientUser(id: string, email: string, role: "client_viewer" | "editor" = "client_viewer") {
  await admin();
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("Enter a valid email.");
  const raw = await supabaseServer();
  const { error } = await raw.from("workspace_members").upsert({ workspace_id: id, email: clean, role }, { onConflict: "workspace_id,email" });
  if (error) throw new Error(error.message);
  const origin = process.env.PUBLIC_APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? "";
  const { error: inviteError } = await service().auth.admin.inviteUserByEmail(clean, { redirectTo: `${origin}/portal/auth` });
  // Someone who already has an account just signs in at /portal.
  if (inviteError && !/already|registered|exists/i.test(inviteError.message)) throw new Error(`Access added, but the invite email failed: ${inviteError.message}`);
  refresh();
}

export async function removeClientUser(id: string, email: string) {
  const studio = await admin();
  if (email.toLowerCase() === studio.email.toLowerCase()) throw new Error("You can't remove yourself.");
  const { error } = await (await supabaseServer()).from("workspace_members").delete().eq("workspace_id", id).eq("email", email.toLowerCase());
  if (error) throw new Error(error.message);
  refresh();
}

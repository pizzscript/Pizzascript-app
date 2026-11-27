"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { jobPriority } from "@/lib/studio/jobs";
import { BRIEF_KEY, PROFILE_KEYS, approve, normaliseShares, type OwnerBrief, type ResearchProfile } from "@/lib/studio/research-profile";
import { requireAdmin, supabaseServer } from "@/lib/studio/server";

const PREVIEW = "Preview mode — connect Supabase to make changes.";

async function admin(id: string) {
  const studio = await requireAdmin();
  if (studio.mode === "preview") throw new Error(PREVIEW);
  if (!studio.workspaces.some((w) => w.id === id)) throw new Error("Unknown client");
  return studio;
}

function startJobs() {
  if (process.env.RUN_JOBS_IN_PROCESS !== "1") return;
  after(async () => {
    try {
      const { requestRun } = await import("../../worker/runner");
      await requestRun(30 * 60_000);
    } catch (error) {
      console.error("[jobs]", error instanceof Error ? error.message : error);
    }
  });
}

const clean = (lines: string[], max: number, len = 200) => lines.map((l) => l.replace(/\s+/g, " ").trim().slice(0, len)).filter(Boolean).slice(0, max);

/** Trims what the owner typed, so an edited profile has the same shape as an analysed one. */
function tidy(profile: ResearchProfile): ResearchProfile {
  const owner = { kind: "owner" as const, confirmed: true };
  const keepSource = <T,>(f: { value: T; source: ResearchProfile["business"]["source"] }, value: T) => (f.value === value ? f : { value, source: owner });
  return {
    ...profile,
    business: keepSource(profile.business, profile.business.value.trim().slice(0, 300)),
    industry: keepSource(profile.industry, profile.industry.value.trim().slice(0, 80)),
    tone: keepSource(profile.tone, profile.tone.value.trim().slice(0, 200)),
    services: profile.services.filter((s) => s.name.trim()).slice(0, 15).map((s) => ({ ...s, name: s.name.trim().slice(0, 80), path: s.path?.trim() ? s.path.trim().replace(/\/$/, "") : null })),
    customers: profile.customers.filter((c) => c.value.trim()).slice(0, 6),
    locations: profile.locations.filter((l) => l.name.trim()).slice(0, 8).map((l) => ({ ...l, countryCode: l.countryCode.trim().toLowerCase().slice(0, 2) || "in" })),
    avoid: clean(profile.avoid, 15),
    customerQuestions: clean(profile.customerQuestions, 20),
    competitors: clean(profile.competitors, 5, 120),
    topicGroups: normaliseShares(profile.topicGroups.filter((g) => g.label.trim()).slice(0, 5).map((g) => ({ ...g, id: g.id || g.label.toLowerCase().replace(/[^a-z0-9]+/g, "-") }))),
  };
}

/** Reads the client's website and drafts its research profile. The draft waits for approval. */
export async function analyzeClientSite(id: string, brief: OwnerBrief) {
  await admin(id);
  const raw = await supabaseServer();
  const trim = (v: string) => v.trim().slice(0, 500);
  const saved = await raw.from("settings").upsert({ workspace_id: id, key: BRIEF_KEY, value: { hire: trim(brief.hire), grow: trim(brief.grow), never: trim(brief.never) } }, { onConflict: "workspace_id,key" });
  if (saved.error) throw new Error(saved.error.message);
  const { error } = await raw.from("jobs").insert({ type: "analyze_site", payload: {}, workspace_id: id, priority: jobPriority("analyze_site", "admin") });
  if (error) throw new Error(error.message);
  startJobs();
  revalidatePath("/", "layout");
}

export async function saveResearchDraft(id: string, profile: ResearchProfile) {
  await admin(id);
  const raw = await supabaseServer();
  const { error } = await raw.from("settings").upsert({ workspace_id: id, key: PROFILE_KEYS.draft, value: { ...tidy(profile), status: "draft" } }, { onConflict: "workspace_id,key" });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/** Approves the profile: research uses it from now on, and the client's ideas need approval before Auto-pick writes them. */
export async function approveResearchProfile(id: string, profile: ResearchProfile) {
  const studio = await admin(id);
  if (!profile.business.value.trim()) throw new Error("Describe the business before approving.");
  if (!profile.locations.some((l) => l.name.trim())) throw new Error("Add at least one location before approving.");
  if (!profile.topicGroups.some((g) => g.label.trim())) throw new Error("Add at least one topic group before approving.");
  const approved = approve(tidy(profile), studio.mode === "live" ? studio.email : "admin");
  const raw = await supabaseServer();
  const { error } = await raw.from("settings").upsert(
    [
      { workspace_id: id, key: PROFILE_KEYS.approved, value: approved },
      { workspace_id: id, key: PROFILE_KEYS.draft, value: approved },
    ],
    { onConflict: "workspace_id,key" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

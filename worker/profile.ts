import { setSiteRules } from "../src/lib/studio/content";
import { planOf, type ClientPlan } from "../src/lib/studio/plans";
import { profileFor, type ClientProfile, type WorkspaceRow } from "../src/lib/studio/profile";
import { PROFILE_KEYS, researchFields, type ResearchProfile } from "../src/lib/studio/research-profile";
import { loadClientConnections } from "./connections";
import { rawDb } from "./db";
import { currentWorkspace, isDefaultWorkspace } from "./workspace";

const REFRESH_MS = 5 * 60_000;
export type ApprovalMode = "owner" | "client" | "automatic";
interface Loaded {
  at: number;
  profile: ClientProfile;
  plan: ClientPlan;
  approvalMode: ApprovalMode;
  cms: string;
  slug: string;
}
const cache = new Map<string, Loaded>();

/** The current client's profile. Load it first with loadProfile(); until then every client gets neutral wording. */
export function currentProfile(): ClientProfile {
  const hit = cache.get(currentWorkspace());
  if (hit) return hit.profile;
  return profileFor({ id: currentWorkspace(), name: "the business", site_url: "https://example.com", location: null });
}

/** The current client's plan. Before loading, a client gets the Starter limits (never PizzaScript's unlimited plan). */
export function currentPlan(): ClientPlan {
  return cache.get(currentWorkspace())?.plan ?? planOf(null, isDefaultWorkspace());
}

/** Who must approve an article before it publishes. A client without a saved choice defaults to the owner (you). */
export function currentApprovalMode(): ApprovalMode {
  return cache.get(currentWorkspace())?.approvalMode ?? "owner";
}

export function currentSlug(): string {
  return cache.get(currentWorkspace())?.slug ?? currentWorkspace();
}

/** Reads the current client's workspace, saved profile, scanned service pages and keys (cached for a few minutes). */
export async function loadProfile(force = false) {
  const id = currentWorkspace();
  const hit = cache.get(id);
  if (hit && !force && Date.now() - hit.at < REFRESH_MS) return hit.profile;
  const [workspace, settings] = await Promise.all([
    rawDb.from("workspaces").select("id,slug,name,site_url,location,language,plan,approval_mode,cms").eq("id", id).maybeSingle(),
    rawDb.from("settings").select("key,value").eq("workspace_id", id).in("key", ["profile", "service_profiles", PROFILE_KEYS.approved]),
    loadClientConnections(force),
  ]);
  const row = (workspace.data as (WorkspaceRow & { slug?: string; plan?: Record<string, unknown>; approval_mode?: ApprovalMode; cms?: string }) | null) ?? null;
  const value = (key: string) => (settings.data ?? []).find((s: { key: string }) => s.key === key)?.value;
  const saved = value("profile") as Partial<ClientProfile> | undefined;
  const scanned = (value("service_profiles") as { pages?: { path: string }[] } | undefined)?.pages?.map((p) => p.path) ?? [];
  const research = value(PROFILE_KEYS.approved) as ResearchProfile | undefined;
  const profile = profileFor(row, saved ?? {}, scanned);
  // An approved research profile says what the business is, who it serves and where.
  if (research?.status === "approved") {
    Object.assign(profile, researchFields(research));
    if (!saved?.description && research.business.value) {
      profile.description = research.business.value;
      profile.shortDescription = research.business.value;
    }
  }
  cache.set(id, {
    at: Date.now(),
    profile,
    // PizzaScript keeps its internal plan (no monthly limits); everything else about it is ordinary client data.
    plan: planOf(row?.plan, isDefaultWorkspace()),
    approvalMode: row?.approval_mode ?? "owner",
    cms: row?.cms ?? "hosted",
    slug: row?.slug ?? id,
  });
  return profile;
}

/** Wraps a duty so the client's profile, plan and keys are loaded before it runs. */
export const withProfile =
  <T>(work: () => Promise<T>) =>
  async () => {
    await loadProfile();
    return work();
  };

// Link and page checks follow the current client's site.
setSiteRules(() => {
  const p = currentProfile();
  return { origin: p.origin, servicePaths: p.servicePaths, staticPaths: p.staticPaths };
});

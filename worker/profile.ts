import { setSiteRules } from "../src/lib/studio/content";
import { planOf, type ClientPlan } from "../src/lib/studio/plans";
import { PIZZASCRIPT_PROFILE, profileFor, type ClientProfile, type WorkspaceRow } from "../src/lib/studio/profile";
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

/** The current client's profile. Load it first with loadProfile(); until then a client gets neutral wording, never PizzaScript's. */
export function currentProfile(): ClientProfile {
  const hit = cache.get(currentWorkspace());
  if (hit) return hit.profile;
  return isDefaultWorkspace() ? PIZZASCRIPT_PROFILE : profileFor({ id: currentWorkspace(), name: "the business", site_url: "https://example.com", location: null }, false);
}

/** The current client's plan. Before loading, a client gets the Starter limits (never PizzaScript's unlimited plan). */
export function currentPlan(): ClientPlan {
  return cache.get(currentWorkspace())?.plan ?? planOf(null, isDefaultWorkspace());
}

/** Who must approve an article before it publishes. New clients default to the owner (you). */
export function currentApprovalMode(): ApprovalMode {
  return cache.get(currentWorkspace())?.approvalMode ?? (isDefaultWorkspace() ? "automatic" : "owner");
}

export function currentSlug(): string {
  return cache.get(currentWorkspace())?.slug ?? (isDefaultWorkspace() ? "pizzascript" : currentWorkspace());
}

/** Reads the current client's workspace, saved profile, scanned service pages and keys (cached for a few minutes). */
export async function loadProfile(force = false) {
  const id = currentWorkspace();
  const hit = cache.get(id);
  if (hit && !force && Date.now() - hit.at < REFRESH_MS) return hit.profile;
  const [workspace, settings] = await Promise.all([
    rawDb.from("workspaces").select("id,slug,name,site_url,location,language,plan,approval_mode,cms").eq("id", id).maybeSingle(),
    rawDb.from("settings").select("key,value").eq("workspace_id", id).in("key", ["profile", "service_profiles"]),
    loadClientConnections(force),
  ]);
  const row = (workspace.data as (WorkspaceRow & { slug?: string; plan?: Record<string, unknown>; approval_mode?: ApprovalMode; cms?: string }) | null) ?? null;
  const saved = (settings.data ?? []).find((s: { key: string }) => s.key === "profile")?.value as Partial<ClientProfile> | undefined;
  const scanned = ((settings.data ?? []).find((s: { key: string }) => s.key === "service_profiles")?.value as { pages?: { path: string }[] } | undefined)?.pages?.map((p) => p.path) ?? [];
  const profile = profileFor(row, isDefaultWorkspace(), saved ?? {}, scanned);
  // PizzaScript's live site address comes from its workspace row (the Render app until the domain moves).
  if (isDefaultWorkspace() && row?.site_url) profile.siteUrl = row.site_url;
  cache.set(id, {
    at: Date.now(),
    profile,
    plan: planOf(row?.plan, isDefaultWorkspace()),
    approvalMode: row?.approval_mode ?? (isDefaultWorkspace() ? "automatic" : "owner"),
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

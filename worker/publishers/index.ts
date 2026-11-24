// Client articles stay in Supabase. Publishing marks them live; the client's site shows them through the article feed
// (embed script or server snippet). PizzaScript's own blog reads the same table directly.
import type { RemoteInfo, StudioPost } from "../../src/lib/studio/types";
import { env } from "../env";
import { currentProfile, currentSlug } from "../profile";
import { currentWorkspace, isDefaultWorkspace } from "../workspace";

/** The article's public address on the client's site. */
export const articleAddress = (slug: string) => currentProfile().articleUrl.replace("{slug}", encodeURIComponent(slug));

export interface Published {
  url: string;
  remote: RemoteInfo;
}

export async function publishToSite(post: Pick<StudioPost, "slug">): Promise<Published> {
  const url = articleAddress(post.slug);
  return { url, remote: isDefaultWorkspace() ? {} : { url, status: "publish", syncedAt: new Date().toISOString() } };
}

export async function unpublishFromSite(post: Pick<StudioPost, "remote">): Promise<RemoteInfo> {
  return { ...(post.remote ?? {}), status: "draft", syncedAt: new Date().toISOString() };
}

/** Clears the cached feed (or PizzaScript's blog pages) so a change shows within seconds, on every deployment. */
export async function refreshSite(slug?: string) {
  if (!env.revalidateSecret) return;
  const body = isDefaultWorkspace() ? { slug } : { slug, workspace: currentWorkspace(), client: currentSlug() };
  for (const base of env.revalidateUrls) {
    try {
      const res = await fetch(`${base}/api/revalidate`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-revalidate-secret": env.revalidateSecret },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) console.warn(`[revalidate] ${base} ${slug ?? "all"} → ${res.status}`);
    } catch (error) {
      console.warn(`[revalidate] ${base} unreachable: ${error instanceof Error ? error.message : error}`);
    }
  }
}

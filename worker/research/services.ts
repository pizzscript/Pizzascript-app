import { db, raiseSignal, setting, todayIst } from "../db";
import { currentProfile } from "../profile";
import { approvedResearchProfile } from "./profile-store";
import { fetchText, servicePagePaths, sitemapPages, summarisePage } from "./site";

export interface ServiceProfile {
  path: string;
  title: string;
  description: string;
  headings: string[];
}

export const savedServices = async () => (await setting<{ pages?: ServiceProfile[] }>("service_profiles", {})).pages ?? [];

/**
 * Finds the client's service pages on its public website and records what each offers, so new services get their
 * own ideas. Pages come from the sitemap (following sitemap indexes), the home page's links and the approved research
 * profile. If nothing can be read, the last saved list is kept.
 */
export async function scanServices() {
  const site = new URL(currentProfile().siteUrl).origin;
  const before = await savedServices();
  const { pages: sitemap, allowed } = await sitemapPages(site);
  const homeHtml = await fetchText(`${site}/`);
  const home = homeHtml ? summarisePage(homeHtml, `${site}/`) : null;
  const research = await approvedResearchProfile();
  const fromProfile = (research?.services ?? []).map((s) => s.path).filter((p): p is string => Boolean(p));
  const paths = [...new Set([...servicePagePaths(sitemap, home?.links ?? []), ...fromProfile])].filter((p) => allowed(p)).slice(0, 20);

  const pages: ServiceProfile[] = [];
  for (const path of paths) {
    const html = await fetchText(`${site}${path}`);
    if (html) {
      const page = summarisePage(html, `${site}${path}`);
      pages.push({ path, title: page.title, description: page.description, headings: page.headings.slice(0, 12) });
    } else {
      const old = before.find((p) => p.path === path);
      if (old) pages.push(old);
    }
  }
  if (!pages.length) {
    await raiseSignal({
      kind: "quality_gate",
      title: `Couldn't find any service pages on ${site}. Research keeps the last saved list${before.length ? ` (${before.length} pages)` : ""}. Check the website address in Clients.`,
      detail: { site, sitemapPages: sitemap.length },
      priority: "P2",
      post_id: null,
      topic_id: null,
      dedupe_key: `services-missing:${todayIst()}`,
    });
    return { services: 0, kept: before.length };
  }
  await db.from("settings").upsert({ key: "service_profiles", value: { scannedAt: new Date().toISOString(), pages } });
  const added = pages.filter((p) => !before.some((b) => b.path === p.path)).map((p) => p.path);
  if (before.length && added.length) {
    await raiseSignal({ kind: "quality_gate", title: `New service page found: ${added.join(", ")}. Research will add ideas for it.`, detail: { added }, priority: "P2", post_id: null, topic_id: null, dedupe_key: `services:${todayIst()}` });
  }
  return { services: pages.length, added };
}

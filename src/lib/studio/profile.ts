/**
 * Who a client is, for every prompt, check and banner: neutral defaults from its workspace, overridden by its saved
 * "profile" setting. PizzaScript is an ordinary client here; its wording is saved data (see supabase/seed).
 */
import { countryCodeFor } from "./research-profile";

export interface FeedSource {
  name: string;
  url: string;
  stableOnly?: boolean;
}

export interface ClientProfile {
  name: string;
  /** Name used in "You are the … Content Agent". */
  agentName: string;
  /** Short site name, e.g. "pizzascript.com". */
  domainLabel: string;
  /** Full description used in the agent's identity. */
  description: string;
  /** Short description used in the writer's first line. */
  shortDescription: string;
  /** Used instead of description/shortDescription for broad-audience business topics (not developer topics), so
   * the business doesn't read as narrower than it is. Falls back to description/shortDescription when unset. */
  broadDescription?: string;
  broadShortDescription?: string;
  /** How the writer should speak for the business. */
  voiceRule: string;
  /** Positioning rule in the writing rules. */
  positioning: string;
  /** The brand search the demand filter ignores. */
  brandQuery: string;
  /** How research describes the business. */
  researchDescription: string;
  /** Who research should target. */
  market: string;
  /** Country name for research and search data. */
  country: string;
  /** Google country and language codes for autocomplete. */
  countryCode: string;
  language: string;
  /** Where the client's site lives (used for service scans). */
  siteUrl: string;
  /** Canonical origin, so absolute links to the site count as internal. */
  origin: string;
  /** Footer text on banners. */
  blogLabel: string;
  /** Whether banners show the PizzaScript logo file. */
  showLogo: boolean;
  /** Where an article lives on the client's site; {slug} becomes the article's slug. */
  articleUrl: string;
  servicePaths: string[];
  staticPaths: string[];
  feeds: FeedSource[];
  /** What the business does, for judging which news matters. Empty: no trend scan. */
  trendFocus: string;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  site_url: string;
  location: string | null;
  language?: string | null;
}

/**
 * Builds a client's profile from its workspace (name, website, location, language) plus its saved profile and scanned
 * service pages. Every client, PizzaScript included, goes through here: nothing about a client is built into the code.
 */
export function profileFor(workspace: WorkspaceRow | null, saved: Partial<ClientProfile> = {}, scannedServices: string[] = []): ClientProfile {
  // A missing or mistyped address must not stop the client's jobs; links then simply count as external.
  const url = (() => {
    try {
      return new URL(workspace?.site_url ?? "");
    } catch {
      return new URL("https://example.invalid");
    }
  })();
  const name = workspace?.name?.trim() || url.hostname.replace(/^www\./, "");
  const location = workspace?.location?.trim() || "India";
  const country = location.split(",").at(-1)!.trim() || "India";
  const base: ClientProfile = {
    name,
    agentName: name,
    domainLabel: url.hostname.replace(/^www\./, ""),
    description: `a business in ${location}`,
    shortDescription: `a business in ${location}`,
    voiceRule: 'Write as the business itself ("we").',
    positioning: "Positioning: write as the business itself, confident and specific. Never imply limited capacity.",
    brandQuery: name.toLowerCase(),
    researchDescription: `a business in ${location}`,
    market: `customers in ${location}`,
    country,
    countryCode: countryCodeFor(country) || "us",
    language: workspace?.language || "en",
    siteUrl: url.origin,
    origin: url.origin,
    blogLabel: `${url.hostname.replace(/^www\./, "")}/blog`,
    showLogo: false,
    // The embed script reads ?article=; a site using the server snippet can save a path pattern instead.
    articleUrl: `${url.origin}/blog?article={slug}`,
    servicePaths: scannedServices,
    staticPaths: ["/", "/about", "/contact", "/blog", "/services"],
    feeds: [],
    trendFocus: "",
  };
  return { ...base, ...saved };
}

/**
 * Who a client is, for every prompt, check and banner. PizzaScript's profile reproduces the original wording exactly;
 * other clients get neutral defaults from their workspace, overridden by their saved "profile" setting.
 */
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

export const PIZZASCRIPT_SERVICES = [
  "/services/custom-website-development",
  "/services/business-websites",
  "/services/landing-page-development",
  "/services/website-redesign",
  "/services/seo-friendly-websites",
  "/services/website-maintenance",
  "/services/website-speed-optimization",
];

export const PIZZASCRIPT_PROFILE: ClientProfile = {
  name: "PizzaScript",
  agentName: "Pizzascript",
  domainLabel: "pizzascript.com",
  description: "a custom web engineering studio in Pune, India (React, Next.js, performance, technical SEO, scroll animation)",
  shortDescription: "a custom web engineering studio in Pune, India",
  voiceRule: 'Say "we", never "freelancer".',
  positioning: 'Studio positioning: never "freelancer"; always "studio" / "we" / "our process". Never imply limited capacity. The India angle is an asset (faster delivery, direct access).',
  brandQuery: "pizzascript",
  researchDescription: "a web development studio in Pune, India, that also builds business automation and custom software for small and medium businesses",
  market: "business owners in Pune first, then the rest of India",
  country: "India",
  countryCode: "in",
  language: "en",
  siteUrl: "https://www.pizzascript.com",
  origin: "https://www.pizzascript.com",
  blogLabel: "pizzascript.com/blog",
  showLogo: true,
  articleUrl: "https://www.pizzascript.com/blog/{slug}",
  servicePaths: PIZZASCRIPT_SERVICES,
  staticPaths: ["/", "/services", "/portfolio", "/about", "/blog", "/freelance-pune"],
  feeds: [
    { name: "Next.js releases", url: "https://github.com/vercel/next.js/releases.atom", stableOnly: true },
    { name: "React releases", url: "https://github.com/facebook/react/releases.atom", stableOnly: true },
    { name: "Vercel blog", url: "https://vercel.com/atom" },
    { name: "Cloudflare blog", url: "https://blog.cloudflare.com/rss/" },
    { name: "Google Search Central", url: "https://developers.google.com/search/blog/feed.xml" },
  ],
  trendFocus: "builds React/Next.js sites with GSAP/Lenis animation on Vercel/Cloudflare, focused on performance and technical SEO",
};

export interface WorkspaceRow {
  id: string;
  name: string;
  site_url: string;
  location: string | null;
  language?: string | null;
}

/** Builds a client's profile: PizzaScript's original one, or neutral defaults for any other client, plus saved overrides. */
export function profileFor(workspace: WorkspaceRow | null, isDefault: boolean, saved: Partial<ClientProfile> = {}, scannedServices: string[] = []): ClientProfile {
  if (isDefault || !workspace) return { ...PIZZASCRIPT_PROFILE, ...saved };
  // A missing or mistyped address must not stop the client's jobs; links then simply count as external.
  const url = (() => {
    try {
      return new URL(workspace.site_url);
    } catch {
      return new URL("https://example.invalid");
    }
  })();
  const name = workspace.name?.trim() || url.hostname.replace(/^www\./, "");
  const location = workspace.location?.trim() || "India";
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
    countryCode: country.toLowerCase() === "india" ? "in" : "us",
    language: workspace.language || "en",
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

// Reads a client's public website for research: its sitemaps (including sitemap indexes on other hosts, like a blog
// sitemap kept in storage) and a summary of each page. Polite: one page at a time, short timeouts, robots.txt obeyed.
import { isSitemapIndex, locsIn, robotsAllows, sitemapsIn } from "../../src/lib/studio/crawl";

const AGENT = "PizzaScriptResearch/1.0 (+https://www.pizzascript.com)";
const TIMEOUT_MS = 15_000;
const MAX_SITEMAPS = 6;

export interface PageSummary {
  url: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
  links: string[];
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
const strip = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export async function fetchText(url: string, accept = "text/html,application/xhtml+xml") {
  try {
    const res = await fetch(url, { headers: { "user-agent": AGENT, accept }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Page addresses on the site's own host, from robots.txt sitemaps or /sitemap.xml, following sitemap indexes. */
export async function sitemapPages(site: string) {
  const origin = new URL(site).origin;
  const host = new URL(origin).host.replace(/^www\./, "");
  const robots = (await fetchText(`${origin}/robots.txt`, "text/plain")) ?? "";
  const queue = sitemapsIn(robots).length ? sitemapsIn(robots) : [`${origin}/sitemap.xml`];
  const pages = new Set<string>();
  let read = 0;
  while (queue.length && read < MAX_SITEMAPS) {
    const map = queue.shift()!;
    read++;
    const xml = await fetchText(map, "application/xml,text/xml,*/*");
    if (!xml) continue;
    if (isSitemapIndex(xml)) queue.push(...locsIn(xml));
    else
      for (const loc of locsIn(xml)) {
        try {
          const u = new URL(loc);
          // A child sitemap may live elsewhere (for example in storage), but only the site's own pages count.
          if (u.host.replace(/^www\./, "") === host) pages.add(`${origin}${u.pathname.replace(/\/$/, "") || "/"}`);
        } catch {
          // not a usable address
        }
      }
  }
  return { pages: [...pages], robots, allowed: robotsAllows(robots) };
}

/** Title, description, headings, the first part of the visible text and same-site links. */
export function summarisePage(html: string, url: string, maxText = 1500): PageSummary {
  const head = html.slice(0, 200_000);
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>/gi, " ");
  const main = body.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? body;
  const origin = new URL(url).origin;
  const links = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(decode(m[1]), url);
      if (u.origin === origin) links.add(`${origin}${u.pathname.replace(/\/$/, "") || "/"}`);
    } catch {
      // not a usable address
    }
  }
  return {
    url,
    title: strip(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 160),
    description: decode(head.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? head.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ?? "").slice(0, 300),
    headings: [...main.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => strip(m[1])).filter(Boolean).slice(0, 15),
    text: strip(main).slice(0, maxText),
    links: [...links],
  };
}

const PRIORITY = [/^\/?$/, /\/(about|company|who-we-are|team)/i, /\/(services?|solutions|what-we-do|offerings)/i, /\/(products?|pricing|packages|plans)/i, /\/(portfolio|work|projects|gallery|case-stud)/i, /\/(contact|locations?|areas?)/i, /\/(faq|process|how-it-works)/i];

/** The pages worth reading to understand a business: home, about, services, pricing, work, contact, then the rest. */
export function choosePages(urls: string[], limit: number, preferred: string[] = []) {
  const unique = [...new Set(urls)];
  const rank = (u: string) => {
    const path = new URL(u).pathname;
    const hit = PRIORITY.findIndex((re) => re.test(path));
    const blog = /\/(blog|news|articles?|posts?)\//i.test(path);
    return (hit === -1 ? PRIORITY.length : hit) + (blog ? 20 : 0) + (preferred.includes(u) ? -0.5 : 0) + path.split("/").length * 0.01;
  };
  return unique.sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}

/** Service pages: under /services/ in the sitemap, or linked from the home page with a service-like address. */
export function servicePagePaths(sitemap: string[], homeLinks: string[]) {
  const all = [...sitemap, ...homeLinks].map((u) => new URL(u).pathname.replace(/\/$/, ""));
  return [...new Set(all.filter((p) => /^\/(services?|solutions|what-we-do)\/[^/]+$/i.test(p)))];
}

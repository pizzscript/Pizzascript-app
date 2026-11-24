// Site health: reading a page, the issues it has, and the health score. Pure functions, shared by the crawler and admin.

export type IssueSeverity = "error" | "warning" | "notice";

export const ISSUE_TYPES = {
  http_error: { label: "Page returns an error", severity: "error" },
  broken_internal_link: { label: "Link to a page that doesn't work", severity: "error" },
  broken_outbound_link: { label: "Link to another site that doesn't work", severity: "warning" },
  redirect_chain: { label: "Redirect chain (more than one hop)", severity: "warning" },
  redirect_loop: { label: "Redirect loop", severity: "error" },
  missing_title: { label: "Missing title", severity: "error" },
  duplicate_title: { label: "Same title as another page", severity: "warning" },
  long_title: { label: "Title longer than 60 characters", severity: "notice" },
  missing_description: { label: "Missing meta description", severity: "warning" },
  duplicate_description: { label: "Same description as another page", severity: "notice" },
  missing_h1: { label: "No main heading (H1)", severity: "warning" },
  multiple_h1: { label: "More than one H1", severity: "notice" },
  noindex_in_sitemap: { label: "In the sitemap but blocked from Google (noindex)", severity: "error" },
  canonical_elsewhere: { label: "Canonical points to another page", severity: "notice" },
  missing_alt: { label: "Images without alt text", severity: "warning" },
  invalid_structured_data: { label: "Broken structured data (JSON-LD)", severity: "warning" },
  mixed_content: { label: "Insecure (http) files on a secure page", severity: "warning" },
  slow_page: { label: "Page took over 3 seconds to load", severity: "warning" },
  thin_content: { label: "Very little text (under 200 words)", severity: "notice" },
  sitemap_missing: { label: "No sitemap found", severity: "warning" },
} as const satisfies Record<string, { label: string; severity: IssueSeverity }>;

export type IssueType = keyof typeof ISSUE_TYPES;

export interface PageFacts {
  title: string;
  description: string;
  h1: number;
  canonical: string | null;
  noindex: boolean;
  imagesWithoutAlt: number;
  invalidJsonLd: number;
  mixedContent: number;
  words: number;
  links: string[];
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((v) => v !== undefined) ?? null;

/** What the crawler needs from a page's HTML. Regex-based on purpose: fast, tiny and good enough for these checks. */
export function readPage(html: string, pageUrl: string): PageFacts {
  const head = html.slice(0, 200_000);
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const meta = (name: string) => metas.find((m) => attr(m, "name")?.toLowerCase() === name);
  const canonicalTag = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((l) => attr(l, "rel")?.toLowerCase() === "canonical");
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ");
  const links = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = attr(m[0], "href");
    if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    try {
      const u = new URL(decode(href), pageUrl);
      if (u.protocol === "http:" || u.protocol === "https:") {
        u.hash = "";
        links.add(u.href);
      }
    } catch {
      // not a usable address
    }
  }
  let invalidJsonLd = 0;
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(m[1]);
    } catch {
      invalidJsonLd++;
    }
  }
  const secure = pageUrl.startsWith("https:");
  const mixedContent = secure ? [...html.matchAll(/<(?:img|script|iframe|source|video|audio)\b[^>]*\bsrc\s*=\s*["']http:\/\//gi), ...html.matchAll(/<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']http:\/\//gi)].length : 0;
  const text = decode(body.replace(/<[^>]+>/g, " "));
  return {
    title: decode(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    description: decode(attr(meta("description") ?? "", "content") ?? ""),
    h1: (body.match(/<h1[\s>]/gi) ?? []).length,
    canonical: canonicalTag ? (() => {
      try {
        return new URL(attr(canonicalTag, "href") ?? "", pageUrl).href;
      } catch {
        return null;
      }
    })() : null,
    noindex: /noindex/i.test(attr(meta("robots") ?? "", "content") ?? "") || /noindex/i.test(attr(meta("googlebot") ?? "", "content") ?? ""),
    imagesWithoutAlt: [...html.matchAll(/<img\b[^>]*>/gi)].filter((m) => attr(m[0], "alt") === null).length,
    invalidJsonLd,
    mixedContent,
    words: text ? text.split(" ").length : 0,
    links: [...links],
  };
}

/** robots.txt rules for every crawler ("User-agent: *"). Returns a test for a path. */
export function robotsAllows(robots: string) {
  const rules: { allow: boolean; path: string }[] = [];
  let applies = false;
  let inGroup = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (!key) continue;
    const k = key.toLowerCase();
    if (k === "user-agent") {
      if (!inGroup) applies = false;
      inGroup = true;
      if (value === "*") applies = true;
    } else {
      inGroup = false;
      if (applies && (k === "allow" || k === "disallow") && value) rules.push({ allow: k === "allow", path: value });
    }
  }
  const matches = (rule: string, path: string) => {
    const re = new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`);
    return re.test(path);
  };
  return (path: string) => {
    // The longest matching rule wins; allow wins a tie.
    const hit = rules.filter((r) => matches(r.path, path)).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow))[0];
    return hit ? hit.allow : true;
  };
}

export const sitemapsIn = (robots: string) => [...robots.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]);
export const locsIn = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]));
export const isSitemapIndex = (xml: string) => /<sitemapindex[\s>]/i.test(xml);

export interface CrawledPage {
  url: string;
  status: number;
  redirects: number;
  loop: boolean;
  ms: number;
  inSitemap: boolean;
  facts: PageFacts | null;
}

export interface FoundIssue {
  url: string;
  type: IssueType;
  detail: string;
}

/** Every issue on a set of crawled pages, including the ones that need the whole site (duplicates, broken links). */
export function findIssues(pages: CrawledPage[], outbound: Map<string, number> = new Map()): FoundIssue[] {
  const issues: FoundIssue[] = [];
  const add = (url: string, type: IssueType, detail = "") => issues.push({ url, type, detail });
  const statusOf = new Map(pages.map((p) => [p.url, p.status]));
  const ok = pages.filter((p) => p.status >= 200 && p.status < 300 && p.facts);
  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();
  for (const p of ok) {
    if (p.facts!.noindex) continue;
    if (p.facts!.title) titles.set(p.facts!.title.toLowerCase(), [...(titles.get(p.facts!.title.toLowerCase()) ?? []), p.url]);
    if (p.facts!.description) descriptions.set(p.facts!.description.toLowerCase(), [...(descriptions.get(p.facts!.description.toLowerCase()) ?? []), p.url]);
  }
  for (const p of pages) {
    if (p.loop) add(p.url, "redirect_loop");
    else if (p.redirects > 1) add(p.url, "redirect_chain", `${p.redirects} hops`);
    if (p.status >= 400 || p.status === 0) add(p.url, "http_error", p.status ? `HTTP ${p.status}` : "No answer");
    if (!p.facts || p.status >= 300) continue;
    const f = p.facts;
    if (p.ms > 3000) add(p.url, "slow_page", `${(p.ms / 1000).toFixed(1)} s`);
    if (f.noindex) {
      if (p.inSitemap) add(p.url, "noindex_in_sitemap");
      continue;
    }
    if (!f.title) add(p.url, "missing_title");
    else {
      if (f.title.length > 60) add(p.url, "long_title", `${f.title.length} characters`);
      const same = titles.get(f.title.toLowerCase())!;
      if (same.length > 1) add(p.url, "duplicate_title", `Also on ${same.filter((u) => u !== p.url).slice(0, 3).join(", ")}`);
    }
    if (!f.description) add(p.url, "missing_description");
    else {
      const same = descriptions.get(f.description.toLowerCase())!;
      if (same.length > 1) add(p.url, "duplicate_description", `Also on ${same.filter((u) => u !== p.url).slice(0, 3).join(", ")}`);
    }
    if (f.h1 === 0) add(p.url, "missing_h1");
    if (f.h1 > 1) add(p.url, "multiple_h1", `${f.h1} H1s`);
    if (f.canonical && f.canonical.replace(/\/$/, "") !== p.url.replace(/\/$/, "")) add(p.url, "canonical_elsewhere", f.canonical);
    if (f.imagesWithoutAlt) add(p.url, "missing_alt", `${f.imagesWithoutAlt} image${f.imagesWithoutAlt > 1 ? "s" : ""}`);
    if (f.invalidJsonLd) add(p.url, "invalid_structured_data", `${f.invalidJsonLd} block${f.invalidJsonLd > 1 ? "s" : ""}`);
    if (f.mixedContent) add(p.url, "mixed_content", `${f.mixedContent} file${f.mixedContent > 1 ? "s" : ""}`);
    if (f.words < 200) add(p.url, "thin_content", `${f.words} words`);
    const brokenHere = f.links.filter((l) => (statusOf.get(l) ?? 200) >= 400 || statusOf.get(l) === 0);
    if (brokenHere.length) add(p.url, "broken_internal_link", brokenHere.slice(0, 5).join(", "));
    const brokenOut = f.links.filter((l) => (outbound.get(l) ?? 200) >= 400 || outbound.get(l) === 0);
    if (brokenOut.length) add(p.url, "broken_outbound_link", brokenOut.slice(0, 5).join(", "));
  }
  return issues;
}

const WEIGHT: Record<IssueSeverity, number> = { error: 10, warning: 3, notice: 0.5 };

/** 0–100: each page loses points for its issues (at most 40 per page); the site's score is the average page. */
export function healthScore(pages: number, issues: Pick<FoundIssue, "url" | "type">[]) {
  if (!pages) return 0;
  const perPage = new Map<string, number>();
  for (const i of issues) perPage.set(i.url, Math.min(40, (perPage.get(i.url) ?? 0) + WEIGHT[ISSUE_TYPES[i.type].severity]));
  const lost = [...perPage.values()].reduce((s, n) => s + n, 0);
  return Math.max(0, Math.round(100 - lost / pages));
}

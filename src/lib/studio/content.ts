import { QUALITY } from "./quality";
import type { Audit, AuditCheck, CheckLevel, StudioPost } from "./types";

export const SERVICE_PATHS = [
  "/services/custom-website-development",
  "/services/business-websites",
  "/services/landing-page-development",
  "/services/website-redesign",
  "/services/seo-friendly-websites",
  "/services/website-maintenance",
  "/services/website-speed-optimization",
] as const;

const STATIC_PATHS = new Set<string>(["/", "/services", "/portfolio", "/about", "/blog", "/freelance-pune", ...SERVICE_PATHS]);

export function internalLinks(html: string) {
  const links: { href: string; text: string }[] = [];
  for (const match of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let href = match[1];
    if (href.startsWith("https://www.pizzascript.com")) href = href.slice("https://www.pizzascript.com".length) || "/";
    if (!href.startsWith("/")) continue;
    links.push({ href: href.split("#")[0] || "/", text: match[2].replace(/<[^>]+>/g, "").trim() });
  }
  return links;
}

/** Unwraps internal links to pages that don't exist, keeping their text, so a model can't publish a dead link. */
export function removeUnknownLinks(html: string, blogSlugs: Iterable<string>) {
  const slugs = new Set(blogSlugs);
  return html.replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (whole, rawHref: string, inner: string) => {
    const href = rawHref.startsWith("https://www.pizzascript.com") ? rawHref.slice("https://www.pizzascript.com".length) || "/" : rawHref;
    if (!href.startsWith("/")) return whole;
    const path = href.split(/[?#]/)[0].replace(/(.)\/$/, "$1") || "/";
    const known = path.startsWith("/blog/") ? slugs.has(path.slice(6)) : STATIC_PATHS.has(path) || path.startsWith("/portfolio/");
    return known ? whole : inner;
  });
}

export function plainText(html: string) {
  return html
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(html: string) {
  const text = plainText(html);
  return text ? text.split(" ").length : 0;
}

/** Splits an article into sections: index 0 is the intro, then one section per <h2>. */
export function splitSections(html: string) {
  const parts = html.split(/(?=<h2[\s>])/i);
  return parts.map((part, index) => ({
    index,
    heading: index === 0 && !/^<h2/i.test(part) ? null : (part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1].replace(/<[^>]+>/g, "").trim() ?? null),
    html: part,
  }));
}

export function joinSections(sections: { html: string }[]) {
  return sections.map((s) => s.html.trim()).join("\n\n");
}

/** AGENT.md Part 6 funnel: T1 → a T2 article or pillar; T2 → a service page; pillars → a service page. */
export function funnelViolations(post: Pick<StudioPost, "slug" | "track" | "role" | "body_html">, posts: Pick<StudioPost, "slug" | "track" | "role">[]) {
  const links = internalLinks(post.body_html).map((l) => l.href);
  const blogTargets = links.filter((h) => h.startsWith("/blog/")).map((h) => h.slice(6));
  const bySlug = new Map(posts.map((p) => [p.slug, p]));
  const issues: string[] = [];
  if (post.track === 1) {
    const ok = blogTargets.some((slug) => {
      const target = bySlug.get(slug);
      return target && (target.track === 2 || target.role === "pillar");
    });
    if (!ok) issues.push("Add a link to an in-depth guide or the main article in this category");
  }
  if (post.track === 2 || post.role === "pillar") {
    if (!links.some((h) => (SERVICE_PATHS as readonly string[]).includes(h))) {
      issues.push("Add a link to a service page");
    }
  }
  return issues;
}

const STOPWORDS = new Set("a an and are as at be by do does for from how in is it of on or the to vs what when why with your you".split(" "));
const keywordTokens = (s: string) =>
  s
    .toLowerCase()
    // Same word, different spelling: "pre-render", "pre render", "prerendering"; "Next.js", "nextjs".
    .replace(/\bpre[\s-]?render(?:ing|ed|s)?\b/g, "prerender")
    .replace(/\bnext\.js\b/g, "nextjs")
    .split(/[^a-z0-9.]+/)
    .map((t) => t.replace(/\.$/, "").replace(/(?<=[a-z]{3})s$/, ""))
    .filter((t) => t && !STOPWORDS.has(t));

/** Share of the query's meaningful words found in the text, so natural rewording still counts. */
export function keywordCoverage(query: string, text: string) {
  const wanted = [...new Set(keywordTokens(query))];
  if (!wanted.length) return 1;
  const have = new Set(keywordTokens(text.replace(/-/g, " ")));
  return wanted.filter((t) => have.has(t)).length / wanted.length;
}

export function keywordMisses(post: Pick<StudioPost, "title" | "slug" | "body_html" | "seo_plan">) {
  const query = post.seo_plan?.targetQuery;
  if (!query) return [];
  const firstParagraph = plainText(post.body_html.match(/<p[^>]*>[\s\S]*?<\/p>/i)?.[0] ?? "");
  const misses: string[] = [];
  if (keywordCoverage(query, post.title) < 0.6) misses.push("title");
  if (keywordCoverage(query, firstParagraph) < 0.5) misses.push("first paragraph");
  if (keywordCoverage(query, post.slug) < 0.5) misses.push("slug");
  return misses;
}

/** Advisory only: natural headings often paraphrase the query, and 12 of the first 17 articles would otherwise fail. */
export function keywordInHeading(post: Pick<StudioPost, "body_html" | "seo_plan">) {
  const query = post.seo_plan?.targetQuery;
  if (!query) return true;
  return [...post.body_html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].some((m) => keywordCoverage(query, plainText(m[1])) >= 0.4);
}

/** Checks that need the compiler or embedding model; they run in the worker and are carried on the saved audit. */
export const DEEP_CHECK_IDS = ["code", "duplicate", "numbers", "clients", "verified"];
export const REVIEW_PENDING = "Review pending";
/** After a failed technical review, wait this long before spending another AI request on the same text. */
export const REVIEW_RETRY_MS = 3 * 3_600_000;
export const deepChecksOf = (audit: Audit | null | undefined) => (audit?.checks ?? []).filter((c) => DEEP_CHECK_IDS.includes(c.id));

/** Deterministic pre-publish audit (AGENT.md Part 9). Runs in the worker and is mirrored in the Station. */
export function auditPost(
  post: StudioPost,
  context: {
    posts: Pick<StudioPost, "id" | "slug" | "track" | "role" | "seo_description">[];
    bannedPhrases: string[];
    wordRange?: [number, number];
    deep?: AuditCheck[];
  },
): Audit {
  const checks: AuditCheck[] = [];
  const add = (id: string, label: string, pass: boolean, detail?: string, level: CheckLevel = "blocker") => checks.push({ id, label, pass, detail, level });
  /** Slightly outside the target is a warning; further out fails at the given level. */
  const addRange = (id: string, label: string, inTarget: boolean, inTolerance: boolean, detail: string, level: CheckLevel) =>
    add(id, label, inTarget || inTolerance, detail, inTarget ? "blocker" : inTolerance ? "warning" : level);
  const text = plainText(post.body_html).toLowerCase();
  const words = wordCount(post.body_html);

  const titleLength = post.title.length;
  addRange("title", "Title under 65 characters", titleLength > 0 && titleLength <= QUALITY.title.max, titleLength > 0 && titleLength <= QUALITY.title.softMax, `${titleLength} chars`, "autofix");
  const metaLength = post.seo_description?.length ?? 0;
  addRange("meta", "Meta description 120–160 characters", metaLength >= QUALITY.meta.min && metaLength <= QUALITY.meta.max, metaLength >= QUALITY.meta.softMin && metaLength <= QUALITY.meta.softMax, `${metaLength} chars`, "autofix");
  const duplicateMeta = context.posts.find((p) => p.id !== post.id && p.seo_description && p.seo_description === post.seo_description);
  add("meta-unique", "Meta description not used elsewhere", !duplicateMeta, duplicateMeta ? `Same as /blog/${duplicateMeta.slug}` : undefined, "autofix");
  add("excerpt", "Has an excerpt", post.excerpt.trim().length > 40, undefined, "autofix");

  if (context.wordRange) {
    const [min, max] = context.wordRange;
    const within = (tolerance: number) => words >= min * (1 - tolerance) && words <= max * (1 + tolerance);
    addRange("length", `Length ${min}–${max} words`, within(QUALITY.length.tolerance), within(QUALITY.length.softTolerance), `${words} words`, "blocker");
  }

  const firstParagraph = post.body_html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "";
  add("opening", "Opens with a strong first paragraph", firstParagraph.length > 60 && !/^<h2/i.test(post.body_html.trim()));

  const banned = context.bannedPhrases.filter((phrase) => text.includes(phrase.toLowerCase()));
  add("banned", "No banned clichés", banned.length === 0, banned.join(", ") || undefined, "autofix");

  add("h1", "No extra main heading in the body", !/<h1[\s>]/i.test(post.body_html));
  const h2Count = (post.body_html.match(/<h2[\s>]/gi) ?? []).length;
  add("structure", "At least 3 sections", h2Count >= 3, `${h2Count} sections`);

  const known = new Set(context.posts.map((p) => p.slug));
  const broken = internalLinks(post.body_html)
    .map((l) => l.href)
    .filter((href) => (href.startsWith("/blog/") ? !known.has(href.slice(6)) : !STATIC_PATHS.has(href) && !href.startsWith("/portfolio/")));
  add("links", "All internal links work", broken.length === 0, broken.join(", ") || undefined);

  const funnel = funnelViolations(post, context.posts);
  add("funnel", "Links to the right related pages", funnel.length === 0, funnel.join("; ") || undefined);

  add("banner", "Banner image with alt text", Boolean(post.cover_image_url) && (post.cover_image_alt?.length ?? 0) > 20);
  const imgsWithoutAlt = (post.body_html.match(/<img(?![^>]*alt="[^"]+")[^>]*>/gi) ?? []).length;
  add("img-alt", "Inline images have alt text", imgsWithoutAlt === 0, imgsWithoutAlt ? `${imgsWithoutAlt} missing` : undefined);

  const rawAnchors = internalLinks(post.body_html).filter((l) => l.text === l.href || /^\/[a-z0-9/-]*$/i.test(l.text));
  add("anchors", "Links use readable text", rawAnchors.length === 0, rawAnchors.map((l) => l.text).slice(0, 3).join(", ") || undefined, "autofix");

  const misses = keywordMisses(post);
  const headingTip = keywordInHeading(post) ? "" : "Tip: no heading mentions it yet";
  add("keyword", "Target keyword in title, opening and slug", misses.length === 0, [misses.length ? `Missing from ${misses.join(", ")}` : "", headingTip].filter(Boolean).join(". ") || undefined, "autofix");
  checks.push(...(context.deep ?? []));

  return { ok: checks.every((c) => c.pass), ranAt: new Date().toISOString(), checks };
}

/** Target word range for a post — by role first (pillar, case study, edge, trend), then by track. Used by the editor, the SEO check job and publishing, so all three agree. */
export function wordRangeFor(post: Pick<StudioPost, "role" | "track">, ranges: Record<string, [number, number]>): [number, number] {
  const key = post.role === "pillar" ? "pillar" : post.role === "case-study" ? "case-study" : post.role === "edge" ? "edge" : post.role === "trend" ? "trend" : post.track === 1 ? "track1" : "spoke";
  return ranges[key] ?? [1200, 2000];
}

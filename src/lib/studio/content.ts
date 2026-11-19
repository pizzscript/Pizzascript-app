import type { Audit, AuditCheck, StudioPost } from "./types";

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

/** Deterministic pre-publish audit (AGENT.md Part 9). Runs in the worker and is mirrored in the Station. */
export function auditPost(
  post: StudioPost,
  context: { posts: Pick<StudioPost, "id" | "slug" | "track" | "role" | "seo_description">[]; bannedPhrases: string[]; wordRange?: [number, number] },
): Audit {
  const checks: AuditCheck[] = [];
  const add = (id: string, label: string, pass: boolean, detail?: string) => checks.push({ id, label, pass, detail });
  const text = plainText(post.body_html).toLowerCase();
  const words = wordCount(post.body_html);

  add("title", "Title under 65 characters", post.title.length > 0 && post.title.length <= 65, `${post.title.length} chars`);
  const metaLength = post.seo_description?.length ?? 0;
  add("meta", "Meta description 120–160 characters", metaLength >= 120 && metaLength <= 160, `${metaLength} chars`);
  const duplicateMeta = context.posts.find((p) => p.id !== post.id && p.seo_description && p.seo_description === post.seo_description);
  add("meta-unique", "Meta description not used elsewhere", !duplicateMeta, duplicateMeta ? `Same as /blog/${duplicateMeta.slug}` : undefined);
  add("excerpt", "Has an excerpt", post.excerpt.trim().length > 40);

  if (context.wordRange) {
    const [min, max] = context.wordRange;
    add("length", `Length ${min}–${max} words`, words >= min * 0.85 && words <= max * 1.15, `${words} words`);
  }

  const firstParagraph = post.body_html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "";
  add("opening", "Opens with a strong first paragraph", firstParagraph.length > 60 && !/^<h2/i.test(post.body_html.trim()));

  const banned = context.bannedPhrases.filter((phrase) => text.includes(phrase.toLowerCase()));
  add("banned", "No banned clichés", banned.length === 0, banned.join(", ") || undefined);

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

  return { ok: checks.every((c) => c.pass), ranAt: new Date().toISOString(), checks };
}

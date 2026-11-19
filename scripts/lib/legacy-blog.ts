import fs from "node:fs/promises";
import path from "node:path";
import { parse, type HTMLElement } from "node-html-parser";

const SITE_ORIGIN = "https://www.pizzascript.com";

export interface LegacyPost {
  slug: string;
  frontMatter: Record<string, unknown>;
  bannerFile: string;
  row: {
    slug: string;
    status: "draft" | "published";
    title: string;
    excerpt: string;
    body_html: string;
    cover_image_alt: string | null;
    seo_title: string;
    seo_description: string;
    og_image_url: null;
    category: string | null;
    tags: string[];
    reading_minutes: number;
    word_count: number;
    seo_plan: Record<string, unknown>;
    published_at: string;
  };
}

function parseFrontMatter(html: string) {
  const match = html.match(/^\s*<!--([\s\S]*?)-->/);
  if (!match) throw new Error("Missing front-matter comment");
  const data: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    try {
      data[m[1]] = JSON.parse(m[2]);
    } catch {
      data[m[1]] = m[2];
    }
  }
  return data;
}

function cleanBody(section: HTMLElement, knownSlugs: Set<string>) {
  for (const el of section.querySelectorAll("*")) {
    const keep = el.classNames.includes("highlight-box") ? "highlight-box" : null;
    for (const attr of Object.keys(el.attributes)) {
      if (attr === "class" || attr.startsWith("data-") || attr === "style" || attr === "id") el.removeAttribute(attr);
    }
    if (keep) el.setAttribute("class", keep);
  }
  for (const a of section.querySelectorAll("a")) {
    let href = a.getAttribute("href") ?? "";
    if (href.startsWith(SITE_ORIGIN)) href = href.slice(SITE_ORIGIN.length) || "/";
    if (href === "/contact") href = "/#order";
    const blogLink = href.match(/^\/blog\/([a-z0-9-]+)\/?$/);
    if (blogLink && !knownSlugs.has(blogLink[1])) {
      a.replaceWith(a.innerHTML);
      continue;
    }
    a.setAttribute("href", href);
  }
  // Collapse the template's indentation, but never inside <pre> where whitespace is the content.
  return section.innerHTML
    .split(/(<pre[\s\S]*?<\/pre>)/i)
    .map((part) => (/^<pre/i.test(part) ? part : part.replace(/\n\s{2,}/g, "\n").replace(/[ \t]+\n/g, "\n")))
    .join("")
    .trim();
}

function plain(html: string) {
  return parse(html).textContent.replace(/\s+/g, " ").trim();
}

export async function readLegacyBlog(legacyRoot: string): Promise<LegacyPost[]> {
  const postsDir = path.join(legacyRoot, "blog");
  const slugs = (await fs.readdir(postsDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  const known = new Set(slugs);
  const posts: LegacyPost[] = [];

  for (const slug of slugs) {
    const html = await fs.readFile(path.join(postsDir, slug, "index.html"), "utf8");
    const fm = parseFrontMatter(html);
    const doc = parse(html);
    const section = doc.querySelector("section.prose");
    if (!section) throw new Error(`${slug}: article body not found`);
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}");
    const body = cleanBody(section, known);
    const words = plain(body).split(" ").length;

    posts.push({
      slug,
      frontMatter: fm,
      bannerFile: path.join(legacyRoot, String(fm.bannerImage ?? `images/blog/${slug}-banner.webp`)),
      row: {
        slug,
        status: fm.noindex === true ? "draft" : "published",
        title: String(fm.title),
        excerpt: String(fm.ogDescription ?? fm.metaDescription ?? ""),
        body_html: body,
        cover_image_alt: (fm.bannerAlt as string) ?? null,
        seo_title: String(fm.ogTitle ?? fm.title),
        seo_description: String(fm.metaDescription ?? fm.ogDescription ?? ""),
        og_image_url: null,
        category: (fm.cluster as string) ?? null,
        tags: Array.isArray(ld.keywords) ? ld.keywords : [],
        // Legacy front-matter reading times/word counts were inflated; derive them from the actual text.
        reading_minutes: Math.max(1, Math.round(words / 200)),
        word_count: words,
        seo_plan: {
          targetQuery: fm.targetQuery,
          secondaryQueries: fm.secondaryQueries,
          cluster: fm.cluster,
          track: fm.track,
          type: fm.type,
          audience: fm.audience,
          intent: fm.intent,
          depth: fm.depth,
          internalLinksTo: fm.internalLinksTo,
          internalLinksFrom: fm.internalLinksFrom,
          servicePageLink: fm.servicePageLink,
        },
        published_at: String(fm.publishTime),
      },
    });
  }
  return posts;
}

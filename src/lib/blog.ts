import { createClient } from "@supabase/supabase-js";
import { DEFAULT_WORKSPACE } from "./studio/workspace-scope";
import { cacheLife, cacheTag } from "next/cache";
import sanitizeHtml from "sanitize-html";

export const POSTS_TAG = "posts";

export interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  category: string | null;
  readingMinutes: number | null;
  publishedAt: string;
  updatedAt: string;
}

export interface Post extends PostSummary {
  bodyHtml: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string | null;
  tags: string[];
  wordCount: number | null;
}

const SUMMARY_COLUMNS =
  "slug,title,excerpt,cover_image_url,cover_image_alt,category,reading_minutes,published_at,updated_at";

type Row = Record<string, unknown>;

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn("[blog] SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not set; the blog will be empty.");
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function toSummary(row: Row): PostSummary {
  return {
    slug: row.slug as string,
    title: row.title as string,
    excerpt: row.excerpt as string,
    coverImageUrl: (row.cover_image_url as string | null) ?? null,
    coverImageAlt: (row.cover_image_alt as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    readingMinutes: (row.reading_minutes as number | null) ?? null,
    publishedAt: row.published_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "p", "a", "ul", "ol", "li", "strong", "em", "b", "i", "code", "pre",
    "blockquote", "figure", "figcaption", "img", "table", "thead", "tbody", "tr", "th", "td",
    "hr", "br", "div", "span", "sup", "sub",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "width", "height", "loading", "decoding"],
    div: ["class"],
    span: ["class"],
    code: ["class"],
    pre: ["class"],
    th: ["scope"],
  },
  allowedClasses: { div: ["highlight-box", "callout"], span: false, code: false, pre: false },
  allowedSchemes: ["https", "mailto", "tel"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const external = /^https?:\/\//.test(attribs.href ?? "") && !attribs.href.startsWith("https://www.pizzascript.com");
      return {
        tagName,
        attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer" } : attribs,
      };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy", decoding: "async" } }),
  },
};

export async function getPublishedPosts(): Promise<PostSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(POSTS_TAG);

  const client = supabase();
  if (!client) return [];
  const { data, error } = await client
    .from("posts")
    .select(SUMMARY_COLUMNS)
    .eq("workspace_id", DEFAULT_WORKSPACE)
    .order("published_at", { ascending: false });
  if (error) throw new Error(`[blog] Failed to load posts: ${error.message}`);
  return (data ?? []).map(toSummary);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(POSTS_TAG, `post:${slug}`);

  const client = supabase();
  if (!client) return null;
  const { data, error } = await client
    .from("posts")
    .select(`${SUMMARY_COLUMNS},body_html,seo_title,seo_description,og_image_url,tags,word_count`)
    .eq("workspace_id", DEFAULT_WORKSPACE)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`[blog] Failed to load post "${slug}": ${error.message}`);
  if (!data) return null;
  return toPost(data as Row);
}

function toPost(row: Row): Post {
  return {
    ...toSummary(row),
    bodyHtml: sanitizeHtml(row.body_html as string, SANITIZE_OPTIONS),
    seoTitle: (row.seo_title as string | null) ?? (row.title as string),
    seoDescription: (row.seo_description as string | null) ?? (row.excerpt as string),
    ogImageUrl: (row.og_image_url as string | null) ?? null,
    tags: (row.tags as string[]) ?? [],
    wordCount: (row.word_count as number | null) ?? null,
  };
}

// ───────────────────────── Hosted client blogs (/c/<client>/blog) ─────────────────────────

export interface ClientSite {
  id: string;
  slug: string;
  name: string;
  siteUrl: string;
  language: string;
  /** The client's article address; {slug} becomes the article's slug. */
  articleUrl: string;
}

export const clientPostsTag = (workspaceId: string) => `client-posts:${workspaceId}`;

/** A client whose articles the embed shows. Null for unknown or paused clients (and for PizzaScript). */
export async function getClientSite(slug: string): Promise<ClientSite | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`client-site:${slug}`);
  const client = supabase();
  if (!client || !/^[a-z0-9-]{2,39}$/.test(slug)) return null;
  const { data, error } = await client.rpc("public_workspace", { ws_slug: slug });
  if (error) throw new Error(`[blog] Failed to load client "${slug}": ${error.message}`);
  const row = (data as Row[] | null)?.[0];
  if (!row) return null;
  const siteUrl = row.site_url as string;
  return { id: row.id as string, slug: row.slug as string, name: row.name as string, siteUrl, language: (row.language as string) ?? "en", articleUrl: (row.article_url as string) || `${siteUrl}/blog?article={slug}` };
}

export async function getClientPosts(workspaceId: string): Promise<PostSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(clientPostsTag(workspaceId));
  const client = supabase();
  if (!client) return [];
  const { data, error } = await client.from("posts").select(SUMMARY_COLUMNS).eq("workspace_id", workspaceId).order("published_at", { ascending: false });
  if (error) throw new Error(`[blog] Failed to load client posts: ${error.message}`);
  return (data ?? []).map(toSummary);
}

export async function getClientPost(workspaceId: string, slug: string): Promise<Post | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(clientPostsTag(workspaceId), `${clientPostsTag(workspaceId)}:${slug}`);
  const client = supabase();
  if (!client) return null;
  const { data, error } = await client
    .from("posts")
    .select(`${SUMMARY_COLUMNS},body_html,seo_title,seo_description,og_image_url,tags,word_count`)
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`[blog] Failed to load client post "${slug}": ${error.message}`);
  return data ? toPost(data as Row) : null;
}

export { formatPostDate } from "./format";

import { db } from "../db";
import { currentProfile } from "../profile";
import { currentWorkspace, isDefaultWorkspace } from "../workspace";

const BUCKET = "sitemaps";

/**
 * Regenerates this workspace's blog sitemap and uploads it to Supabase Storage.
 * The public site's sitemap index links straight to this file (same pattern as other
 * PizzaScript-built sites: the index lives on the site's own domain, the leaf sitemap
 * lives in Supabase, and its <loc> entries point back at the site's own domain).
 */
export async function regenerateSitemap() {
  const site = currentProfile().siteUrl.replace(/\/$/, "");
  const { data, error } = await db
    .from("posts")
    .select("slug,updated_at")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (error) throw new Error(`[sitemap] load posts: ${error.message}`);

  const urls = (data ?? [])
    .map(
      (row) => `  <url>
    <loc>${site}/blog/${row.slug as string}</loc>
    <lastmod>${new Date(row.updated_at as string).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  const objectPath = `${isDefaultWorkspace() ? "" : `${currentWorkspace()}/`}posts-sitemap.xml`;
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(objectPath, Buffer.from(xml, "utf8"), { contentType: "application/xml", upsert: true });
  if (uploadError) throw new Error(`[sitemap] upload: ${uploadError.message}`);

  return { count: data?.length ?? 0, url: db.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl };
}

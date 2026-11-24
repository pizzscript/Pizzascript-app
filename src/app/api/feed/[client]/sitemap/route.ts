import { getClientPosts, getClientSite } from "@/lib/blog";

/**
 * A sitemap of the client's articles at their own addresses. The client adds one line to their robots.txt
 * ("Sitemap: <this address>") or submits it in their Search Console, which Google accepts for another host.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ client: string }> }) {
  const site = await getClientSite((await ctx.params).client);
  if (!site) return new Response("Not found", { status: 404 });
  const posts = await getClientPosts(site.id);
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const urls = posts.map((p) => `<url><loc>${escape(site.articleUrl.replace("{slug}", p.slug))}</loc><lastmod>${p.updatedAt}</lastmod></url>`);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}

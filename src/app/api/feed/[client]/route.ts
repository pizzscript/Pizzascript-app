import { getClientPost, getClientPosts, getClientSite } from "@/lib/blog";

/**
 * A client's live articles, for their website: the embed script calls it from the browser, or their server fetches it.
 *   GET /api/feed/<client>              → { site, posts: [summary…] }
 *   GET /api/feed/<client>?slug=<slug>  → { site, post: { …summary, bodyHtml, seoTitle, seoDescription, tags } }
 * Only published articles are returned (the database's public rule), so it's safe to call from anywhere.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "cache-control": "public, max-age=60, s-maxage=300" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request, ctx: { params: Promise<{ client: string }> }) {
  const site = await getClientSite((await ctx.params).client);
  if (!site) return Response.json({ error: "Unknown client" }, { status: 404, headers: CORS });
  const slug = new URL(request.url).searchParams.get("slug");
  const info = { name: site.name, siteUrl: site.siteUrl, language: site.language, articleUrl: site.articleUrl };
  const addressOf = (s: string) => site.articleUrl.replace("{slug}", s);
  if (slug) {
    const post = /^[a-z0-9-]{1,120}$/.test(slug) ? await getClientPost(site.id, slug) : null;
    if (!post) return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
    // Links inside the article point at the client's own site (and its article pages), never at this app.
    const bodyHtml = post.bodyHtml
      .replace(/href="\/blog\/([a-z0-9-]+)\/?"/g, (_m, s: string) => `href="${addressOf(s)}"`)
      .replace(/href="\/(?!\/)([^"]*)"/g, (_m, rest: string) => `href="${site.siteUrl}/${rest}"`);
    return Response.json({ site: info, post: { ...post, bodyHtml, url: addressOf(post.slug) } }, { headers: CORS });
  }
  const posts = (await getClientPosts(site.id)).map((p) => ({ ...p, url: addressOf(p.slug) }));
  return Response.json({ site: info, posts }, { headers: CORS });
}

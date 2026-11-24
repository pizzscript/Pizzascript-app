import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { POSTS_TAG, clientPostsTag } from "@/lib/blog";

function authorized(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const provided = request.headers.get("x-revalidate-secret");
  if (!secret || !provided) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Called by a Supabase database webhook (or the automation worker) after posts change.
 * Body: Supabase webhook payload, or { "slug": "post-slug" }.
 */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    slug?: string;
    /** A hosted client blog: its workspace id and short name. */
    workspace?: string;
    client?: string;
    record?: { slug?: string };
    old_record?: { slug?: string };
  };
  const slugs = [body.slug, body.record?.slug, body.old_record?.slug].filter(
    (slug): slug is string => typeof slug === "string" && slug.length > 0,
  );

  if (body.workspace && /^[0-9a-f-]{36}$/.test(body.workspace)) {
    revalidateTag(clientPostsTag(body.workspace), "max");
    if (body.slug) revalidateTag(`${clientPostsTag(body.workspace)}:${body.slug}`, "max");
    return Response.json({ revalidated: true, client: body.client ?? body.workspace });
  }

  revalidateTag(POSTS_TAG, "max");
  for (const slug of new Set(slugs)) revalidateTag(`post:${slug}`, "max");
  revalidatePath("/sitemap.xml");

  return Response.json({ revalidated: true, slugs: [...new Set(slugs)] });
}

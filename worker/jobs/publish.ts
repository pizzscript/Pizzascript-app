import { auditPost, internalLinks } from "../../src/lib/studio/content";
import type { StudioPost } from "../../src/lib/studio/types";
import { allBatches, allPosts, check, db, enqueue, linkPlan, raiseSignal, settings, todayIst } from "../db";
import { env } from "../env";

export async function revalidate(slug?: string) {
  if (!env.revalidateSecret) return;
  const res = await fetch(`${env.siteUrl}/api/revalidate`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-revalidate-secret": env.revalidateSecret },
    body: JSON.stringify({ slug }),
  });
  if (!res.ok) console.warn(`[revalidate] ${slug ?? "all"} → ${res.status}`);
}

/**
 * Publishes slots that are due. Autopilot rule: a post goes live on its own only when it passed the audit
 * AND either the post itself or its whole batch was approved. Anything else raises a signal and waits.
 */
export async function publishDue() {
  const now = new Date().toISOString();
  const [posts, batches, banned, ranges] = await Promise.all([allPosts(), allBatches(), settings.banned(), settings.wordRanges()]);
  const approvedBatches = new Set(batches.filter((b) => b.approved_at).map((b) => b.id));
  const due = posts.filter((p) => p.stage !== "live" && p.scheduled_for && p.scheduled_for <= now);
  const published: string[] = [];

  for (const post of due) {
    const approved = Boolean(post.approved_at) || (post.batch_id !== null && approvedBatches.has(post.batch_id));
    const audit = post.body_html
      ? auditPost(post, { posts, bannedPhrases: banned, wordRange: post.brief?.wordRange ?? ranges[post.track === 1 ? "track1" : "spoke"] })
      : null;

    if (!approved || !audit?.ok) {
      const reason = !post.body_html ? `still at ${post.stage}` : !audit?.ok ? "audit failing" : "not approved";
      await raiseSignal({
        kind: "audit_failed",
        title: `Missed slot: "${post.title}" is ${reason}`,
        detail: { scheduledFor: post.scheduled_for, reason },
        priority: "P0",
        post_id: post.id,
        topic_id: post.topic_id,
        dedupe_key: `missed:${post.id}:${todayIst()}`,
      });
      continue;
    }

    check(
      await db
        .from("posts")
        .update({ status: "published", stage: "live", published_at: post.scheduled_for, audit })
        .eq("id", post.id),
      "publish",
    );
    if (post.topic_id) await db.from("topics").update({ status: "published" }).eq("id", post.topic_id);
    published.push(post.slug);
    await raiseBacklinks(post, posts);
  }

  if (published.length) {
    for (const slug of published) await revalidate(slug);
    console.log(`[publish] live: ${published.join(", ")}`);
  }
  return published;
}

/** After a post goes live, ask for links into it from the articles the link plan says should point here. */
async function raiseBacklinks(post: StudioPost, posts: StudioPost[]) {
  const path = `/blog/${post.slug}`;
  const plan = await linkPlan();
  const sources = new Set(plan.filter((l) => l.to_path === path && l.status === "planned").map((l) => l.from_slug));
  for (const source of posts.filter((p) => p.stage === "live" && sources.has(p.slug))) {
    if (internalLinks(source.body_html).some((l) => l.href === path)) continue;
    await raiseSignal({
      kind: "backlink_needed",
      title: `Link from "${source.title}" to the new "${post.title}"`,
      detail: { fromSlug: source.slug, toPath: path },
      priority: "P2",
      post_id: source.id,
      topic_id: null,
      dedupe_key: `backlink:${source.slug}:${path}`,
    });
  }
}

/** Approved batches move themselves along: tickets due within 3 days get drafted, bannered and audited. */
export async function advanceApprovedBatches() {
  const [posts, batches, active] = await Promise.all([
    allPosts(),
    allBatches(),
    db.from("jobs").select("payload").in("status", ["queued", "running"]),
  ]);
  const approved = new Set(batches.filter((b) => b.approved_at).map((b) => b.id));
  const busy = new Set((active.data ?? []).map((j) => (j.payload as { postId?: string }).postId).filter(Boolean));
  const horizon = new Date(Date.now() + 3 * 86_400_000).toISOString();

  for (const post of posts) {
    if (!post.batch_id || !approved.has(post.batch_id) || busy.has(post.id)) continue;
    if (!post.scheduled_for || post.scheduled_for > horizon) continue;
    if (post.stage === "brief") await enqueue("write_draft", { postId: post.id });
    else if (post.stage === "draft") await enqueue(post.image_prompt ? "generate_image" : "run_audit", { postId: post.id });
    else if (post.stage === "image") await enqueue("run_audit", { postId: post.id });
  }
}

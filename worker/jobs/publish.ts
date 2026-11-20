import { auditPost, internalLinks, wordRangeFor } from "../../src/lib/studio/content";
import type { StudioPost } from "../../src/lib/studio/types";
import { allBatches, allPosts, check, db, enqueue, linkPlan, raiseSignal, settings, todayIst } from "../db";
import { env } from "../env";

export async function revalidate(slug?: string) {
  if (!env.revalidateSecret) return;
  // Every deployment that serves the blog needs its cache refreshed (e.g. the Render app and, later, the real domain).
  for (const base of env.revalidateUrls) {
    try {
      const res = await fetch(`${base}/api/revalidate`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-revalidate-secret": env.revalidateSecret },
        body: JSON.stringify({ slug }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) console.warn(`[revalidate] ${base} ${slug ?? "all"} → ${res.status}`);
    } catch (error) {
      console.warn(`[revalidate] ${base} unreachable: ${error instanceof Error ? error.message : error}`);
    }
  }
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
      ? auditPost(post, { posts, bannedPhrases: banned, wordRange: post.brief?.wordRange ?? wordRangeFor(post, ranges) })
      : null;

    if (!approved || !audit?.ok) {
      // Keep one open "missed slot" alert per post: close earlier days' before raising today's.
      await db
        .from("signals")
        .update({ status: "acted" })
        .eq("post_id", post.id)
        .eq("status", "open")
        .like("dedupe_key", `missed:${post.id}:%`)
        .neq("dedupe_key", `missed:${post.id}:${todayIst()}`);
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
    // It's live: its "missed slot" and SEO-check alerts no longer apply.
    await db.from("signals").update({ status: "acted" }).eq("post_id", post.id).eq("status", "open").eq("kind", "audit_failed");
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

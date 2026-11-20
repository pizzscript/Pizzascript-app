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
  const [posts, batches, banned, ranges, autopilot] = await Promise.all([allPosts(), allBatches(), settings.banned(), settings.wordRanges(), settings.autopilot()]);
  const approvedBatches = new Set(batches.filter((b) => b.approved_at).map((b) => b.id));
  const due = posts.filter((p) => p.stage !== "live" && p.scheduled_for && p.scheduled_for <= now);
  const published: string[] = [];

  for (const post of due) {
    const approved = autopilot || Boolean(post.approved_at) || (post.batch_id !== null && approvedBatches.has(post.batch_id));
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
const PIPELINE = ["write_brief", "write_draft", "generate_image", "run_audit"] as const;

/** The next pipeline step for a post, or null when it's finished (or stuck on a failing SEO check, which raises an alert). */
function nextStep(post: StudioPost): (typeof PIPELINE)[number] | null {
  if (post.stage === "brief") return post.brief?.angle ? "write_draft" : "write_brief";
  // Already checked and failing → leave it (it has an alert). Any edit clears the result, so it's re-checked then.
  if (post.stage === "draft") return post.cover_image_url ? (post.audit ? null : "run_audit") : "generate_image";
  if (post.stage === "image") return post.audit ? null : "run_audit";
  return null;
}

/** 1 for a post already part-way through the pipeline (has a brief, draft or banner), else 0. */
const started = (p: StudioPost) => (p.stage === "draft" || p.stage === "image" || (p.stage === "brief" && p.brief?.angle) ? 1 : 0);

/**
 * Moves posts through brief → draft → banner → SEO check, ONE post at a time (soonest due first), with no clicks.
 * A post qualifies when global autopilot is on and it has a date, when its batch is approved, or when it came from
 * an approved idea (auto_pipeline). Each finished step lets the next pass start the next step, so a post runs
 * start to finish before the next one begins. Posts whose last step failed in the past 6 hours are skipped so a
 * broken step doesn't loop.
 */
export async function advancePipeline() {
  const [posts, batches, autopilot, active, failed] = await Promise.all([
    allPosts(),
    allBatches(),
    settings.autopilot(),
    db.from("jobs").select("id").in("type", [...PIPELINE]).in("status", ["queued", "running"]).limit(1),
    db
      .from("jobs")
      .select("payload")
      .in("type", [...PIPELINE])
      .eq("status", "failed")
      .gte("finished_at", new Date(Date.now() - 6 * 3_600_000).toISOString()),
  ]);
  if ((active.data ?? []).length > 0) return false; // one post at a time

  const approvedBatches = new Set(batches.filter((b) => b.approved_at).map((b) => b.id));
  const recentlyFailed = new Set((failed.data ?? []).map((j) => (j.payload as { postId?: string }).postId).filter(Boolean));
  const queue = posts
    .filter((p) => p.stage !== "live" && !recentlyFailed.has(p.id))
    .filter((p) => (autopilot && p.scheduled_for) || (p.batch_id && approvedBatches.has(p.batch_id)) || p.auto_pipeline)
    // Finish what's started before starting something new (so an approved idea runs straight through), then soonest due first.
    .sort((a, b) => started(b) - started(a) || (a.scheduled_for ?? "9999").localeCompare(b.scheduled_for ?? "9999"));

  for (const post of queue) {
    const step = nextStep(post);
    if (!step) continue;
    await enqueue(step, { postId: post.id });
    return true;
  }
  return false;
}

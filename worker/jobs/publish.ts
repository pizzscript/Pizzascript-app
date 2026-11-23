import { DEEP_CHECK_IDS, REVIEW_PENDING, REVIEW_RETRY_MS, auditPost, deepChecksOf, internalLinks, wordRangeFor } from "../../src/lib/studio/content";
import type { StudioPost } from "../../src/lib/studio/types";
import { allBatches, allPosts, check, db, enqueue, linkPlan, pipelinePosts, raiseSignal, settings, todayIst } from "../db";
import { env } from "../env";
import { RELATED_SIMILARITY, storedMatches } from "../research/embeddings";

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

const reviewRetryWaiting = (post: StudioPost) => {
  const at = (post.seo_plan?.reviewAttempt as { at?: string } | undefined)?.at;
  return Boolean(at) && Date.now() - Date.parse(at!) < REVIEW_RETRY_MS;
};

/**
 * Publishes slots that are due. Autopilot rule: a post goes live on its own only when it passed the audit
 * AND either the post itself or its whole batch was approved. Anything else raises a signal and waits.
 */
export async function publishDue() {
  const now = new Date().toISOString();
  if (!(await pipelinePosts()).some((p) => p.stage !== "live" && p.scheduled_for && p.scheduled_for <= now)) return [];
  const [posts, batches, banned, ranges, autopilot] = await Promise.all([allPosts(), allBatches(), settings.banned(), settings.wordRanges(), settings.autopilot()]);
  const approvedBatches = new Set(batches.filter((b) => b.approved_at).map((b) => b.id));
  const due = posts.filter((p) => p.stage !== "live" && p.scheduled_for && p.scheduled_for <= now);
  const published: string[] = [];

  for (const post of due) {
    const approved = autopilot || Boolean(post.approved_at) || (post.batch_id !== null && approvedBatches.has(post.batch_id));
    const deep = deepChecksOf(post.audit);
    const audit = post.body_html
      ? auditPost(post, { posts, bannedPhrases: banned, wordRange: post.brief?.wordRange ?? wordRangeFor(post, ranges), deep })
      : null;

    // Edited or older posts still need the deeper checks and technical review: run them, then publish on a later pass.
    const missingChecks = deep.length < DEEP_CHECK_IDS.length;
    const reviewPending = deep.some((c) => c.id === "verified" && !c.pass && c.detail === REVIEW_PENDING);
    if (approved && post.body_html && !reviewRetryWaiting(post) && (reviewPending || (missingChecks && audit?.ok))) {
      const { count } = await db
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("type", "run_audit")
        .eq("payload->>postId", post.id)
        .in("status", ["queued", "running"]);
      if (!count) await enqueue("run_audit", { postId: post.id });
    }
    if (approved && missingChecks && audit?.ok) continue;

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
  // Plus the closest related live posts by meaning. These stay suggestions: the admin clicks "Add link".
  const dismissed = new Set(plan.filter((l) => l.to_path === path && l.status === "dismissed").map((l) => l.from_slug));
  const related = await storedMatches("post", post.id, 8).catch(() => []);
  const live = new Map(posts.filter((p) => p.stage === "live" && p.id !== post.id).map((p) => [p.id, p]));
  related
    .filter((m) => m.owner_type === "post" && m.similarity >= RELATED_SIMILARITY && live.has(m.owner_id))
    .map((m) => live.get(m.owner_id)!)
    .filter((p) => !dismissed.has(p.slug))
    .slice(0, 3)
    .forEach((p) => sources.add(p.slug));
  for (const source of posts.filter((p) => p.stage === "live" && p.id !== post.id && sources.has(p.slug))) {
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
  if (needsEarlyReview(post)) return "run_audit";
  return null;
}

/** Runs the full checks up to 48 hours ahead, so a problem surfaces before the publish slot instead of at it. */
function needsEarlyReview(post: StudioPost) {
  if (!["audit", "slotted"].includes(post.stage) || !post.scheduled_for) return false;
  if (Date.parse(post.scheduled_for) > Date.now() + 48 * 3_600_000 || reviewRetryWaiting(post)) return false;
  const deep = deepChecksOf(post.audit);
  return deep.length < DEEP_CHECK_IDS.length || deep.some((c) => c.id === "verified" && !c.pass && c.detail === REVIEW_PENDING);
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
    pipelinePosts(),
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

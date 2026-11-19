/**
 * Pizzascript content agent worker.
 *
 *   npm run worker            # long-running: polls jobs + runs the IST schedule (local use only)
 *   npm run worker -- --once  # runs the schedule once, drains the queue, exits (GitHub Actions)
 */
import type { JobType, RewritePayload } from "../src/lib/studio/types";
import { db, enqueue, setting, todayIst } from "./db";
import { env } from "./env";
import { fixTitle, generateImage, insertLink, rewrite, runAudit, scoreTopic, writeBrief, writeDraft } from "./jobs/content";
import { dailyBriefing, discuss, performanceCheck, qualityGate } from "./jobs/ops";
import { advanceApprovedBatches, publishDue } from "./jobs/publish";

type Handler = (payload: Record<string, unknown>) => Promise<unknown>;

const HANDLERS: Record<JobType, Handler> = {
  daily_briefing: () => dailyBriefing(),
  score_topic: (p) => scoreTopic(p as { topicId: string }),
  write_brief: (p) => writeBrief(p as { topicId?: string; postId?: string }),
  write_draft: (p) => writeDraft(p as { postId: string }),
  rewrite: (p) => rewrite(p as unknown as RewritePayload),
  generate_image: (p) => generateImage(p as { postId: string; prompt?: string }),
  run_audit: (p) => runAudit(p as { postId: string }),
  publish_due: () => publishDue(),
  insert_link: (p) => insertLink(p as { fromSlug: string; toPath: string }),
  fix_title: (p) => fixTitle(p as { postId: string }),
  discuss: (p) => discuss(p as { thread: string }),
  quality_gate: () => qualityGate(),
  performance_check: () => performanceCheck(),
};

const TRANSIENT = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|ECONNRESET|ETIMEDOUT|fetch failed/i;
const MAX_ATTEMPTS = 4;

interface ClaimedJob {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  attempts: number;
}

async function runNext(): Promise<boolean> {
  const { data, error } = await db.rpc("claim_job", { worker_id: env.workerId });
  if (error) throw new Error(`claim_job: ${error.message}`);
  const job = (data as ClaimedJob[] | null)?.[0];
  if (!job) return false;

  const started = Date.now();
  try {
    const handler = HANDLERS[job.type];
    if (!handler) throw new Error(`Unknown job type ${job.type}`);
    const result = await handler(job.payload);
    await db
      .from("jobs")
      .update({ status: "done", result: (result ?? {}) as object, finished_at: new Date().toISOString(), error: null })
      .eq("id", job.id);
    console.log(`[job] ${job.type} done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retry = TRANSIENT.test(message) && job.attempts < MAX_ATTEMPTS;
    await db
      .from("jobs")
      .update(
        retry
          ? { status: "queued", error: message, run_after: new Date(Date.now() + 2 ** job.attempts * 60_000).toISOString() }
          : { status: "failed", error: message, finished_at: new Date().toISOString() },
      )
      .eq("id", job.id);
    console.error(`[job] ${job.type} ${retry ? "will retry" : "failed"}: ${message}`);
  }
  return true;
}

function istClock() {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  return { date: ist.toISOString().slice(0, 10), time: ist.toISOString().slice(11, 16), weekday: ist.getUTCDay() };
}

async function jobPending(type: JobType) {
  const { count } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("type", type).in("status", ["queued", "running"]);
  return (count ?? 0) > 0;
}

let lastAdvance = 0;
let lastGateCheck = 0;

/** Time-based duties, in IST. Idempotent: safe to run every minute or once per cron invocation. */
async function schedule() {
  const { date, time, weekday } = istClock();
  const sched = await setting("schedule", { briefingAt: "06:30", publishAt: "09:00" } as { briefingAt: string; publishAt: string });

  if (time >= sched.briefingAt) {
    const { data } = await db.from("briefings").select("date").eq("date", todayIst()).maybeSingle();
    if (!data && !(await jobPending("daily_briefing"))) await enqueue("daily_briefing");
  }

  await publishDue();

  if (Date.now() - lastAdvance > 30 * 60_000) {
    lastAdvance = Date.now();
    await advanceApprovedBatches();
  }

  if (Date.now() - lastGateCheck > 60 * 60_000) {
    lastGateCheck = Date.now();
    const since = await setting<string>("last_quality_gate", "1970-01-01T00:00:00Z");
    const { count } = await db
      .from("post_versions")
      .select("id", { count: "exact", head: true })
      .eq("note", "Agent draft")
      .gt("created_at", since);
    if ((count ?? 0) >= 5 && !(await jobPending("quality_gate"))) await enqueue("quality_gate");
  }

  if (weekday === 1 && time >= "07:00") {
    const last = await setting<string>("last_performance_check", "");
    if (last !== date && !(await jobPending("performance_check"))) await enqueue("performance_check");
  }
}

async function drain(maxJobs = 25) {
  for (let i = 0; i < maxJobs; i++) {
    if (!(await runNext())) return;
  }
}

async function main() {
  const once = process.argv.includes("--once");
  console.log(`[worker] ${env.workerId} starting (${once ? "once" : "loop"}) · text ${env.textModel} · image ${env.imageModel}`);

  if (once) {
    await schedule();
    await drain();
    return;
  }

  let stopping = false;
  for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, () => (stopping = true));

  let lastSchedule = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastSchedule > 60_000) {
        lastSchedule = Date.now();
        await schedule();
      }
      const worked = await runNext();
      if (!worked) await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      console.error("[worker]", err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
  console.log("[worker] stopped");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

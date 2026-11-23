/** Job handlers, the IST schedule and the queue drain, shared by the CLI loop (index.ts) and the HTTP server (server.ts). */
import type { JobType, RewritePayload } from "../src/lib/studio/types";
import { db, enqueue, setting, todayIst } from "./db";
import { env } from "./env";
import { fixTitle, generateImage, insertLink, rewrite, runAudit, scoreTopic, writeBrief } from "./jobs/content";
import { writeDraft } from "./jobs/draft";
import { dailyBriefing, discuss, performanceCheck, qualityGate } from "./jobs/ops";
import { advancePipeline, publishDue } from "./jobs/publish";

type Handler = (payload: Record<string, unknown>) => Promise<unknown>;

const HANDLERS: Record<JobType, Handler> = {
  daily_briefing: () => dailyBriefing(),
  score_topic: (p) => scoreTopic(p as { topicId: string }),
  write_brief: (p) => writeBrief(p as { topicId?: string; postId?: string; auto?: boolean }),
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

// 504/DEADLINE_EXCEEDED: a request that timed out, or every model in a tier doing the same — worth a fresh attempt
// later rather than leaving the job (and the idea/article it's for) stuck until someone notices and re-clicks it.
const TRANSIENT = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|504|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT|fetch failed/i;
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
  currentJob = job.id;
  // Heartbeat: proves this worker is alive. If it stops (restart, sleep, crash), claim_job reclaims the job after 2 min.
  const beat = setInterval(() => {
    db.from("jobs").update({ heartbeat_at: new Date().toISOString() }).eq("id", job.id).then(() => {});
  }, 30_000);
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
    const retry = TRANSIENT.test(message) && !/limit: 0\b/.test(message) && job.attempts < MAX_ATTEMPTS;
    await db
      .from("jobs")
      .update(
        retry
          ? { status: "queued", error: message, run_after: new Date(Date.now() + 2 ** job.attempts * 60_000).toISOString() }
          : { status: "failed", error: message, finished_at: new Date().toISOString() },
      )
      .eq("id", job.id);
    console.error(`[job] ${job.type} ${retry ? "will retry" : "failed"}: ${message}`);
  } finally {
    clearInterval(beat);
    currentJob = null;
  }
  return true;
}

let currentJob: string | null = null;

/**
 * On shutdown (Render redeploys or puts the instance to sleep with SIGTERM), hand the running job back to the queue
 * straight away so the next wake-up redoes it — instead of waiting for its heartbeat to go stale.
 */
let shutdownHooked = false;
function hookShutdown() {
  if (shutdownHooked) return;
  shutdownHooked = true;
  const release = async () => {
    if (!currentJob) return;
    const id = currentJob;
    currentJob = null;
    await db.from("jobs").update({ status: "queued", run_after: new Date().toISOString(), error: "interrupted by server shutdown" }).eq("id", id).eq("status", "running");
    console.log(`[job] ${id} handed back to the queue (shutdown)`);
  };
  for (const sig of ["SIGTERM", "SIGINT"] as const) process.once(sig, () => void release());
}

/**
 * Render's free plan sleeps after ~15 min without incoming web traffic, even mid-job. While a pass is working, ping
 * our own public URL every 5 min so it stays awake exactly as long as there is work; stop when the pass ends.
 */
function keepAwake() {
  const base = process.env.RENDER_EXTERNAL_URL ?? process.env.AGENT_SELF_URL;
  if (!base) return () => {};
  const timer = setInterval(() => {
    fetch(`${base.replace(/\/$/, "")}/api/agent/health`, { signal: AbortSignal.timeout(20_000) }).catch(() => {});
  }, 5 * 60_000);
  return () => clearInterval(timer);
}

function istClock() {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  return { date: ist.toISOString().slice(0, 10), time: ist.toISOString().slice(11, 16), weekday: ist.getUTCDay() };
}

async function jobPending(type: JobType) {
  const { count } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("type", type).in("status", ["queued", "running"]);
  return (count ?? 0) > 0;
}

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

  if (Date.now() - lastGateCheck > 60 * 60_000) {
    lastGateCheck = Date.now();
    const since = await setting<string>("last_quality_gate", "1970-01-01T00:00:00Z");
    const { count } = await db
      .from("post_versions")
      .select("id", { count: "exact", head: true })
      .eq("note", "Agent draft")
      .gt("created_at", since);
    if ((count ?? 0) >= 3 && !(await jobPending("quality_gate"))) await enqueue("quality_gate");
  }

  if (weekday === 1 && time >= "07:00") {
    const last = await setting<string>("last_performance_check", "");
    if (last !== date && !(await jobPending("performance_check"))) await enqueue("performance_check");
  }
}

/** Runs queued jobs until the queue is empty or the time budget is spent (a job already started always finishes). */
async function drain(deadline: number) {
  while (Date.now() < deadline) {
    if (!(await runNext())) return;
  }
}

let running = false;
let rerun = false;

/**
 * One pass: time-based duties, then drain the queue and keep the pipeline moving (each finished post lets the next
 * one start) until there's nothing left or the time budget runs out. The budget keeps a scheduled GitHub Actions run
 * inside its timeout; anything left over continues on the next run. Returns false if a pass is already in progress.
 */
export async function runOnce(budgetMs = Number(process.env.PASS_BUDGET_MS ?? 7 * 60_000)): Promise<boolean> {
  if (running) return false;
  running = true;
  hookShutdown();
  const stopKeepAwake = keepAwake();
  const deadline = Date.now() + budgetMs;
  try {
    await schedule();
    for (let i = 0; i < 200 && Date.now() < deadline; i++) {
      await drain(deadline);
      if (Date.now() >= deadline || !(await advancePipeline())) break;
    }
    return true;
  } finally {
    stopKeepAwake();
    running = false;
  }
}

/** Starts a pass; if one is already running, makes sure another follows so jobs queued mid-pass aren't missed. */
export async function requestRun(budgetMs?: number): Promise<void> {
  if (running) {
    rerun = true;
    return;
  }
  do {
    rerun = false;
    await runOnce(budgetMs);
  } while (rerun);
}

export { advancePipeline, runNext, schedule };

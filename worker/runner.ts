/** Job handlers, the IST schedule and the queue drain, shared by the CLI loop (index.ts) and the HTTP server (server.ts). */
import type { JobType, RewritePayload } from "../src/lib/studio/types";
import { backlinkScan, competitorScan, findOpportunities, localCheck, localPost, scheduleOffsite } from "./jobs/offsite";
import { contentGrowth, scheduleGrowth } from "./jobs/growth";
import { inspectUrls, rankingAlerts, scheduleMonitoring, speedCheck } from "./jobs/monitor";
import { crawlSite, scheduleCrawl } from "./jobs/crawl";
import { inModule } from "./usage";
import { isBudgetError, moduleForJob, nextBudgetDay } from "../src/lib/studio/plans";
import { activeClaim, anyWorkspace, db, enqueue, forEachWorkspace, setting, todayIst } from "./db";
import { loadProfile, withProfile } from "./profile";
import { DEFAULT_WORKSPACE, inWorkspace } from "./workspace";
import { env } from "./env";
import { isBillingError, isTransientError } from "./gemini";
import { fixTitle, generateImage, insertLink, rewrite, runAudit, scoreTopic, writeBrief } from "./jobs/content";
import { writeDraft } from "./jobs/draft";
import { dailyBriefing, discuss, performanceCheck, qualityGate } from "./jobs/ops";
import { applyConnections } from "./connections";
import { autoPick } from "./jobs/autopick";
import { discoverIdeas, pruneIdeas, scheduleResearch } from "./jobs/research";
import { scanServices } from "./research/services";
import { analyzeSite } from "./jobs/analyze";
import { advancePipeline, approvalReminders, publishDue, unpublishPost } from "./jobs/publish";

type Handler = (payload: Record<string, unknown>) => Promise<unknown>;

const HANDLERS: Record<JobType, Handler> = {
  daily_briefing: () => dailyBriefing(),
  score_topic: (p) => scoreTopic(p as { topicId: string }),
  write_brief: (p) => writeBrief(p as { topicId?: string; postId?: string; auto?: boolean; scheduleFor?: string }),
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
  discover_ideas: () => discoverIdeas(),
  prune_ideas: () => pruneIdeas(),
  scan_services: () => scanServices(),
  analyze_site: () => analyzeSite(),
  unpublish_post: (p) => unpublishPost(p as { postId: string }),
  crawl_site: () => crawlSite(),
  speed_check: () => speedCheck(),
  inspect_urls: () => inspectUrls(),
  sync_rankings: () => rankingAlerts(),
  content_growth: () => contentGrowth(),
  backlink_scan: () => backlinkScan(),
  find_opportunities: () => findOpportunities(),
  competitor_scan: () => competitorScan(),
  local_post: () => localPost(),
  local_check: () => localCheck(),
};

const MAX_ATTEMPTS = 4;
// A billing block can last hours, so those jobs wait longer and get more chances than a brief overload.
const MAX_BILLING_ATTEMPTS = 12;
const BILLING_RETRY_MS = 30 * 60_000;

interface ClaimedJob {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  attempts: number;
  workspace_id?: string;
}

async function runNext(): Promise<boolean> {
  const { data, error } = await db.rpc("claim_job", { worker_id: env.workerId });
  if (error) throw new Error(`claim_job: ${error.message}`);
  const job = (data as ClaimedJob[] | null)?.[0];
  if (!job) return false;
  await runClaimed(job);
  return true;
}

const memory = () => ({ rssMb: Math.round(process.memoryUsage().rss / 1_048_576), peakMb: Math.round(process.resourceUsage().maxRSS / 1024) });
const withMemory = (result: unknown) => ({ ...(result && typeof result === "object" && !Array.isArray(result) ? result : {}), memory: memory() });

/** Runs a job this worker already holds. With handBack, a failure returns it to the queue at once for another worker. */
/** Runs a job this worker already holds, inside the job's own workspace. */
export function runClaimed(job: ClaimedJob, options: { handBack?: boolean } = {}): Promise<boolean> {
  return inWorkspace(job.workspace_id ?? DEFAULT_WORKSPACE, () => runInWorkspace(job, options));
}

function runInWorkspace(job: ClaimedJob, options: { handBack?: boolean }): Promise<boolean> {
  return inModule(moduleForJob(job.type), () => runJob(job, options));
}

async function runJob(job: ClaimedJob, options: { handBack?: boolean }): Promise<boolean> {
  await loadProfile();
  const started = Date.now();
  currentJob = { id: job.id, attempts: job.attempts };
  activeClaim.job = currentJob;
  // Every write is tied to this claim's attempt number, so a worker whose job was reclaimed can't overwrite the newer run.
  const ownJob = <T extends { eq: (column: string, value: string | number) => T }>(query: T) =>
    query.eq("id", job.id).eq("status", "running").eq("attempts", job.attempts);
  // Heartbeat: proves this worker is alive. If it stops (restart, sleep, crash), claim_job reclaims the job after 2 min.
  const beat = setInterval(() => {
    ownJob(db.from("jobs").update({ heartbeat_at: new Date().toISOString() })).then(() => {});
  }, 30_000);
  try {
    const handler = HANDLERS[job.type];
    if (!handler) throw new Error(`Unknown job type ${job.type}`);
    const result = await handler(job.payload);
    await ownJob(db.from("jobs").update({ status: "done", result: withMemory(result) as object, finished_at: new Date().toISOString(), error: null }));
    console.log(`[job] ${job.type} done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isBudgetError(message)) {
      // This client's AI budget is spent for today: wait for tomorrow without using up a retry. Other clients carry on.
      await ownJob(db.from("jobs").update({ status: "queued", error: message, attempts: Math.max(0, job.attempts - 1), run_after: nextBudgetDay().toISOString() }));
      console.warn(`[job] ${job.type} waits for tomorrow: ${message}`);
      return false;
    }
    const billing = isBillingError(message);
    const retry = options.handBack ? job.attempts < MAX_ATTEMPTS : isTransientError(message) && !/limit: 0\b/.test(message) && job.attempts < (billing ? MAX_BILLING_ATTEMPTS : MAX_ATTEMPTS);
    const delay = options.handBack ? 0 : billing ? BILLING_RETRY_MS : 2 ** job.attempts * 60_000;
    await ownJob(
      db.from("jobs").update(
        retry
          ? { status: "queued", error: message, run_after: new Date(Date.now() + delay).toISOString() }
          : { status: "failed", error: message, finished_at: new Date().toISOString() },
      ),
    );
    console.error(`[job] ${job.type} ${retry ? "will retry" : "failed"}: ${message}`);
    return false;
  } finally {
    clearInterval(beat);
    currentJob = null;
    activeClaim.job = null;
  }
}

let currentJob: { id: string; attempts: number } | null = null;

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
    const { id, attempts } = currentJob;
    currentJob = null;
    await db.from("jobs").update({ status: "queued", run_after: new Date().toISOString(), error: "interrupted by server shutdown" }).eq("id", id).eq("status", "running").eq("attempts", attempts);
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
  await approvalReminders();
  await scheduleOffsite().catch((error) => console.warn(`[offsite] ${error instanceof Error ? error.message : error}`));
  await scheduleGrowth().catch((error) => console.warn(`[growth] ${error instanceof Error ? error.message : error}`));
  await scheduleMonitoring().catch((error) => console.warn(`[monitor] ${error instanceof Error ? error.message : error}`));
  await scheduleCrawl().catch((error) => console.warn(`[crawl] ${error instanceof Error ? error.message : error}`));

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
  await applyConnections().catch((error) => console.warn(`[connections] ${error instanceof Error ? error.message : error}`));
  const stopKeepAwake = keepAwake();
  const deadline = Date.now() + budgetMs;
  try {
    await forEachWorkspace(withProfile(() => schedule()));
    for (let i = 0; i < 200 && Date.now() < deadline; i++) {
      await drain(deadline);
      if (Date.now() >= deadline) break;
      if (await anyWorkspace(withProfile(() => advancePipeline()))) continue;
      const researching = await anyWorkspace(withProfile(() => scheduleResearch())).catch((error) => {
        console.error(`[research] ${error instanceof Error ? error.message : error}`);
        return false;
      });
      if (researching) continue;
      const picked = await anyWorkspace(withProfile(() => autoPick())).catch((error) => {
        console.error(`[auto-pick] ${error instanceof Error ? error.message : error}`);
        return false;
      });
      if (!picked) break;
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

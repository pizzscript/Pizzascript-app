/**
 * Runs one heavy job on GitHub Actions. It takes the job only if it's still waiting, so GitHub and the Render fallback
 * can never both run it. If it fails here, the job goes straight back to the queue for Render.
 */
import { db, rawDb } from "./db";
import { inWorkspace } from "./workspace";
import { env } from "./env";
import { runClaimed } from "./runner";

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function runHeavyJob(id: string) {
  if (!JOB_ID.test(id)) throw new Error("Invalid job ID");
  // The job ID alone tells us which client it belongs to; everything after runs inside that client.
  const { data: waiting, error } = await rawDb.from("jobs").select("id,type,payload,attempts,status,workspace_id").eq("id", id).maybeSingle();
  if (error) throw new Error(`read job: ${error.message}`);
  if (!waiting || waiting.status !== "queued" || waiting.type !== "generate_image" || !(waiting.payload as { plan?: unknown }).plan) {
    console.log("[heavy] nothing to do: job already taken or not a heavy job");
    return true;
  }
  return inWorkspace(waiting.workspace_id, () => claimAndRun(waiting));
}

async function claimAndRun(waiting: { id: string; attempts: number; workspace_id: string }) {
  const id = waiting.id;
  const now = new Date().toISOString();
  const { data: job, error: claimError } = await db
    .from("jobs")
    .update({ status: "running", started_at: now, heartbeat_at: now, attempts: waiting.attempts + 1, locked_by: `github-${env.workerId}` })
    .eq("id", id)
    .eq("status", "queued")
    .eq("attempts", waiting.attempts)
    .select("id,type,payload,attempts,workspace_id")
    .maybeSingle();
  if (claimError) throw new Error(`claim job: ${claimError.message}`);
  if (!job) {
    console.log("[heavy] another worker took the job first");
    return true;
  }
  return runClaimed(job as Parameters<typeof runClaimed>[0], { handBack: true });
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("worker/heavy-cli.ts")) {
  runHeavyJob(process.argv[2] ?? "")
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((error) => {
      console.error(`[heavy] ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    });
}

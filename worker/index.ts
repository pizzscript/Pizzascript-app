/**
 * Pizzascript content agent worker.
 *
 *   npm run worker            # long-running: polls jobs + runs the IST schedule (local use only)
 *   npm run worker -- --once  # runs the schedule once, drains the queue, exits (GitHub Actions)
 */
import { anyWorkspace, forEachWorkspace } from "./db";
import { withProfile } from "./profile";
import { env } from "./env";
import { advancePipeline, runNext, runOnce, schedule } from "./runner";

async function main() {
  const once = process.argv.includes("--once");
  console.log(`[worker] ${env.workerId} starting (${once ? "once" : "loop"}) · text ${env.textModel}`);

  if (once) {
    await runOnce();
    return;
  }

  let stopping = false;
  for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, () => (stopping = true));

  let lastSchedule = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastSchedule > 60_000) {
        lastSchedule = Date.now();
        await forEachWorkspace(withProfile(() => schedule()));
      }
      const worked = (await runNext()) || (await anyWorkspace(withProfile(() => advancePipeline())));
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

/**
 * Publish-only run for the scheduler: puts ready posts live once their IST publish time has passed and refreshes
 * the blog cache. No AI, no job queue — the app server (Render) does all AI work.
 *
 *   npm run publish:due
 */
import { publishDue } from "./jobs/publish";

publishDue()
  .then(() => console.log("[publish] done"))
  .catch((err) => {
    console.error("[publish]", err instanceof Error ? err.message : err);
    process.exit(1);
  });

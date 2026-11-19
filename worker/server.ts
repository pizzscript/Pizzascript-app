/**
 * HTTP entrypoint for hosting the agent on an always-available Node server (e.g. a Render free Web Service).
 *
 *   npm run worker:server
 *
 *   POST /run      header x-worker-secret: <WORKER_SECRET>  → starts one pass (schedule + drain queue) in the background
 *   GET  /health   → 200 (also what a cron pinger can hit to keep the instance warm)
 *
 * The admin calls POST /run whenever it queues a job, so work starts immediately instead of waiting for a schedule.
 */
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { runOnce } from "./runner";

const secret = process.env.WORKER_SECRET;
if (!secret) throw new Error("Missing environment variable WORKER_SECRET");

function authorized(header: string | string[] | undefined) {
  if (typeof header !== "string") return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret!);
  return a.length === b.length && timingSafeEqual(a, b);
}

const server = createServer((req, res) => {
  const send = (status: number, body: object) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });

  if (req.method === "POST" && req.url === "/run") {
    if (!authorized(req.headers["x-worker-secret"])) return send(401, { error: "unauthorized" });
    // Respond right away; the pass continues in the background and reports through the jobs table.
    runOnce()
      .then((started) => !started && console.log("[server] run requested while a pass was already in progress"))
      .catch((err) => console.error("[server] pass failed:", err instanceof Error ? err.message : err));
    return send(202, { accepted: true });
  }

  send(404, { error: "not found" });
});

const port = Number(process.env.PORT ?? 8787);
server.listen(port, () => console.log(`[server] listening on :${port} · text ${env.textModel} · image ${env.imageModel}`));

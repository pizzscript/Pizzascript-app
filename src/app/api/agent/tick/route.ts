import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";

function authorized(request: Request) {
  const secret = process.env.AGENT_SECRET;
  const provided = request.headers.get("x-agent-secret");
  if (!secret || !provided) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The doorbell's target: the scheduler calls this (with x-agent-secret) only when the database says AI work is
 * waiting. The request wakes a sleeping server; the agent then works through the queue after the response is sent.
 */
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.RUN_JOBS_IN_PROCESS !== "1") return Response.json({ error: "This server doesn't run jobs" }, { status: 409 });
  after(async () => {
    try {
      const { requestRun } = await import("../../../../../worker/runner");
      await requestRun(30 * 60_000);
    } catch (error) {
      console.error("[tick]", error instanceof Error ? error.message : error);
    }
  });
  return Response.json({ accepted: true }, { status: 202 });
}

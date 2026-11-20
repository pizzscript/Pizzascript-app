/** Liveness check. The agent pings this while it's busy so Render's free plan doesn't put the server to sleep mid-job. */
export function GET() {
  return Response.json({ ok: true });
}

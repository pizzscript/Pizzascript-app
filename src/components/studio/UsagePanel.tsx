import { MODEL_LIMITS } from "@/lib/studio/models";
import type { AiCall } from "@/lib/studio/server";

/** IST calendar day of a timestamp — Google's free-tier daily quota resets on Pacific time, so this is our own view. */
function istDay(iso: string) {
  return new Date(new Date(iso).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Gemini usage from our own log (Gemini has no API for "quota remaining"). Every request counts, including retries.
 * When Google refuses a request for quota it states the daily limit, which we show as the limit for that model.
 */
export function UsagePanel({ calls }: { calls: AiCall[] }) {
  const today = istDay(new Date().toISOString());
  const models = [...new Set(calls.map((c) => c.model))].sort();
  const limitOf = (model: string) => MODEL_LIMITS[model]?.rpd ?? calls.find((c) => c.model === model && c.quota_limit !== null)?.quota_limit ?? null;

  const todayRows = models.map((model) => {
    const mine = calls.filter((c) => c.model === model && istDay(c.created_at) === today);
    return { model, total: mine.length, failed: mine.filter((c) => !c.ok).length, limit: limitOf(model) };
  });

  const days = [...new Set(calls.map((c) => istDay(c.created_at)))].sort().reverse();

  return (
    <>
      <div>
        <h2 className="font-semibold text-[16px]">AI usage</h2>
        <p className="s-dim mt-1 max-w-[60ch]">
          Gemini requests the agent made, counted by this app (retries included). Google doesn&apos;t report how much quota is left, so for exact limits
          check{" "}
          <a href="https://ai.dev/rate-limit" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--s-accent)]">
            your usage on Google AI Studio
          </a>
          .
        </p>
      </div>

      {calls.length === 0 ? (
        <p className="s-dim">No Gemini requests in the last 7 days.</p>
      ) : (
        <>
          <div className="overflow-x-auto relative">
            <table className="s-table">
              <caption className="sr-only">Requests today per model</caption>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Today</th>
                  <th>Failed</th>
                  <th title="Free-tier daily limit from Google AI Studio">Daily limit</th>
                </tr>
              </thead>
              <tbody>
                {todayRows.map((r) => (
                  <tr key={r.model}>
                    <td className="font-medium whitespace-nowrap">{r.model}</td>
                    <td>{r.total}</td>
                    <td className={r.failed ? "text-[var(--s-bad)]" : "s-dim"}>{r.failed}</td>
                    <td className="s-dim">
                      {r.limit === null ? "Not reported" : r.limit === 0 ? <span className="text-[var(--s-bad)]">0 — not available on this key</span> : r.limit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto relative">
            <table className="s-table">
              <caption className="text-left font-semibold text-[14px] pb-2">Last 7 days</caption>
              <thead>
                <tr>
                  <th>Day</th>
                  {models.map((m) => (
                    <th key={m}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d}>
                    <td className="whitespace-nowrap">{d === today ? "Today" : d}</td>
                    {models.map((m) => (
                      <td key={m} className="s-dim">
                        {calls.filter((c) => c.model === m && istDay(c.created_at) === d).length}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

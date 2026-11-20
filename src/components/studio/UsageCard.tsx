import Link from "next/link";
import type { AiCall } from "@/lib/studio/server";

/** IST calendar day of a timestamp. */
const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const istTime = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3_600_000).toISOString().slice(11, 16);

/** Compact Gemini usage for the Dashboard: today's requests per model (IST day), failures, reported limit. */
export function UsageCard({ calls }: { calls: AiCall[] }) {
  const today = istDay(new Date().toISOString());
  const todays = calls.filter((c) => istDay(c.created_at) === today);
  const models = [...new Set(todays.map((c) => c.model))].sort();
  const lastFailure = todays.find((c) => !c.ok);

  return (
    <section className="card" aria-labelledby="usage-title">
      <div className="card-head">
        <h2 id="usage-title" className="card-title">
          Gemini usage <span className="s-faint font-normal">· today (IST)</span>
        </h2>
        <Link href="/admin/settings?tab=usage" className="s-faint text-[12px] hover:text-[var(--s-text)]">
          Details →
        </Link>
      </div>
      {todays.length === 0 ? (
        <p className="card-body s-dim">No requests yet today.</p>
      ) : (
        <ul>
          {models.map((m) => {
            const mine = todays.filter((c) => c.model === m);
            const failed = mine.filter((c) => !c.ok).length;
            const limit = calls.find((c) => c.model === m && c.quota_limit !== null)?.quota_limit ?? null;
            return (
              <li key={m} className="flex items-center gap-3 px-5 py-2.5 border-b s-line last:border-0 text-[13px]">
                <span className="truncate flex-1">{m}</span>
                <span>{mine.length - failed} ok</span>
                <span className={failed ? "text-[var(--s-bad)]" : "s-faint"}>{failed} failed</span>
                {limit !== null && <span className="s-faint" title="Daily limit Google reported">/ {limit}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {lastFailure && (
        <p className="px-5 pb-4 pt-1 s-faint text-[12px]">
          Last failure at {istTime(lastFailure.created_at)} IST —{" "}
          {lastFailure.quota_limit === 0 ? "model not available on this key" : /429|quota/i.test(lastFailure.error ?? "") ? "quota used up" : /50[34]/.test(lastFailure.error ?? "") ? "Gemini overloaded" : "request failed"}.
        </p>
      )}
    </section>
  );
}

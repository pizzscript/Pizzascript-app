import Link from "next/link";
import { loadHealth } from "@/lib/studio/health";
import { getStudio } from "@/lib/studio/session";

const tone = (used: number) => (used >= 0.9 ? "var(--s-bad)" : used >= 0.7 ? "var(--s-warn)" : "var(--s-ok)");

export function SystemHealthSkeleton() {
  return (
    <section className="card" aria-label="System health loading">
      <div className="card-head">
        <h2 className="card-title">System health</h2>
      </div>
      <p className="card-body s-dim">Checking limits…</p>
    </section>
  );
}

/** Folded to one line unless a limit is nearly used up; the full list opens on click. */
export async function SystemHealth() {
  const { studio, data } = await getStudio();
  const rows = await loadHealth(studio, data.aiUsage);
  const busy = rows.filter((r) => r.used !== null && r.used >= 0.7);
  const off = rows.filter((r) => !r.connected);
  const summary = busy.length ? `${busy.length} limit${busy.length > 1 ? "s" : ""} nearly used` : "All limits fine";

  return (
    <details className="card s-health" open={busy.length > 0}>
      <summary className="card-head cursor-pointer list-none">
        <span className="card-title">
          System health{" "}
          <span className="font-normal" style={{ color: busy.length ? "var(--s-warn)" : "var(--s-ok)" }}>
            · {summary}
          </span>
          {off.length > 0 && <span className="s-faint font-normal"> · {off.length} not connected</span>}
        </span>
        <span className="s-faint text-[12px]">Details</span>
      </summary>
      <ul>
        {rows.map((r) => (
          <li key={r.name} className="px-5 py-3 border-t s-line text-[13px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{r.name}</span>
              <span className={r.connected ? "" : "s-faint"}>{r.value}</span>
            </div>
            {r.used !== null && (
              <div
                role="progressbar"
                aria-label={`${r.name} usage`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(r.used * 100)}
                className="h-1.5 rounded-full mt-2 overflow-hidden"
                style={{ background: "var(--s-raised)" }}
              >
                <div className="h-full rounded-full" style={{ width: `${Math.max(r.used * 100, 1)}%`, background: tone(r.used) }} />
              </div>
            )}
            <p className="s-faint text-[12px] mt-1">{r.note}</p>
          </li>
        ))}
        <li className="px-5 py-3 border-t s-line">
          <Link href="/settings?tab=usage" className="s-faint text-[12px] hover:text-[var(--s-text)]">
            AI usage details →
          </Link>
        </li>
      </ul>
    </details>
  );
}

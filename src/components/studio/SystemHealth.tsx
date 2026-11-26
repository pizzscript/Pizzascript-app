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

export async function SystemHealth() {
  const { studio, data } = await getStudio();
  const rows = await loadHealth(studio, data.aiUsage);

  return (
    <section className="card" aria-labelledby="health-title">
      <div className="card-head">
        <h2 id="health-title" className="card-title">
          System health <span className="s-faint font-normal">· free limits</span>
        </h2>
        <Link href="/settings?tab=usage" className="s-faint text-[12px] hover:text-[var(--s-text)]">
          AI details →
        </Link>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.name} className="px-5 py-3 border-b s-line last:border-0 text-[13px]">
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
      </ul>
    </section>
  );
}

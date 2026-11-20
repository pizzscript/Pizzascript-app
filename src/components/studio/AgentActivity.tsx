"use client";

import Link from "next/link";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";
import { jobActivity } from "@/lib/studio/jobs";
import type { JobType } from "@/lib/studio/types";
import { useStudio } from "./StudioProvider";

interface Row {
  key: string;
  type: JobType | undefined;
  label: string;
  subject?: string;
  postId?: string;
  running: boolean;
  count: number;
}

const MAX_ROWS = 5;

/** Sidebar panel: what the agent is doing now and what's next, one line per task, duplicates grouped. */
export function AgentActivity({ titles }: { titles: Map<string, string> }) {
  const { pending, preview, health } = useStudio();
  if (preview) return null;
  const warnings = [
    health.oldestWaitMin >= 60 ? `A task has waited ${health.oldestWaitMin >= 120 ? `${Math.round(health.oldestWaitMin / 60)} h` : `${health.oldestWaitMin} min`}` : null,
    health.failed24h > 0 ? `${health.failed24h} failed in 24 h` : null,
  ].filter(Boolean);

  const rows: Row[] = [];
  for (const job of pending) {
    const subject = job.subject ?? (job.postId ? titles.get(job.postId) : undefined);
    const running = job.status === "running";
    const key = `${job.type ?? job.label}|${job.postId ?? subject ?? ""}`;
    const existing = rows.find((r) => r.key === key);
    if (existing) {
      existing.count += 1;
      existing.running ||= running;
    } else {
      rows.push({ key, type: job.type, label: job.type ? jobActivity(job.type) : job.label, subject, postId: job.postId, running, count: 1 });
    }
  }
  rows.sort((a, b) => Number(b.running) - Number(a.running));
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <section className="agent-panel" aria-labelledby="agent-panel-title">
      <h2 id="agent-panel-title" className="agent-panel-title">
        <span className={`s-dot ${pending.length ? "animate-pulse" : ""}`} data-idle={pending.length === 0} aria-hidden="true" />
        Agent
        <span className="s-faint font-normal">{pending.length ? `· ${pending.length} task${pending.length > 1 ? "s" : ""}` : "· idle"}</span>
      </h2>
      {rows.length > 0 && (
        <ul className="space-y-1.5" aria-live="polite">
          {shown.map((r) => {
            const body = (
              <>
                {r.running ? <Loader2 size={14} className="animate-spin flex-none mt-0.5 text-[var(--s-accent)]" aria-hidden="true" /> : <Clock size={14} className="flex-none mt-0.5 s-faint" aria-hidden="true" />}
                <span className="min-w-0">
                  <span className="block text-[13px] leading-tight">
                    <span className="sr-only">{r.running ? "Running: " : "Next: "}</span>
                    {r.label}
                    {r.count > 1 && <span className="s-faint"> ×{r.count}</span>}
                  </span>
                  {r.subject && <span className="block s-faint text-[12px] truncate">{r.subject}</span>}
                </span>
              </>
            );
            return (
              <li key={r.key}>
                {r.postId ? (
                  <Link href={`/admin/posts/${r.postId}`} className="agent-row">
                    {body}
                  </Link>
                ) : (
                  <div className="agent-row">{body}</div>
                )}
              </li>
            );
          })}
          {rows.length > MAX_ROWS && <li className="s-faint text-[12px] px-2">+{rows.length - MAX_ROWS} more queued</li>}
        </ul>
      )}
      {warnings.length > 0 && (
        <Link href="/admin/settings?tab=usage" className="agent-health" title="See Gemini usage and errors">
          <AlertTriangle size={13} aria-hidden="true" className="flex-none mt-0.5" />
          <span>{warnings.join(" · ")}</span>
        </Link>
      )}
    </section>
  );
}

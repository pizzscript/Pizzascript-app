"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, Link2, MousePointerClick, RefreshCw, Search, ShieldAlert, Sparkles, Zap } from "lucide-react";
import { approveBatch, approvePost, createTopic, enqueue, setSignal, slotPost } from "@/app/admin/actions";
import type { AgentMessage, Batch, Briefing, Signal, SignalKind, StudioPost } from "@/lib/studio/types";
import { AgentThread } from "./AgentThread";
import { useStudio } from "./StudioProvider";
import { SeoBadge, StatusBadge, formatDate } from "./ui";

const SIGNAL_ICON: Record<SignalKind, { icon: typeof Zap; tone: string; label: string }> = {
  rank_up: { icon: ArrowUp, tone: "var(--s-ok)", label: "Ranking up" },
  rank_down: { icon: ArrowDown, tone: "var(--s-bad)", label: "Ranking down" },
  low_ctr: { icon: MousePointerClick, tone: "var(--s-warn)", label: "Low click-through" },
  query_gap: { icon: Search, tone: "var(--s-accent)", label: "Missing topic" },
  trend: { icon: Zap, tone: "var(--s-accent)", label: "Trend" },
  index: { icon: ShieldAlert, tone: "var(--s-bad)", label: "Indexing" },
  backlink_needed: { icon: Link2, tone: "var(--s-info)", label: "Link needed" },
  audit_failed: { icon: AlertTriangle, tone: "var(--s-bad)", label: "Needs attention" },
  quality_gate: { icon: AlertTriangle, tone: "var(--s-warn)", label: "Quality check" },
  refresh: { icon: RefreshCw, tone: "var(--s-warn)", label: "Needs refresh" },
};

function nextDay(iso: string) {
  return new Date(new Date(iso).getTime() + 5.5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
}

export function DashboardView({
  date,
  briefing,
  signals,
  today,
  upcoming,
  batch,
  messages,
  stats,
}: {
  date: string;
  briefing: Briefing;
  signals: Signal[];
  today: StudioPost | null;
  upcoming: StudioPost[];
  batch: Batch | null;
  messages: AgentMessage[];
  stats: { live: number; drafts: number; scheduled: number; ideas: number };
}) {
  const { run, busy } = useStudio();
  const [discussing, setDiscussing] = useState(messages.length > 0);

  const actionsFor = (s: Signal): { label: string; href?: string; go?: () => void }[] => {
    const postId = s.post_id ?? undefined;
    const done = () => setSignal(s.id, "acted");
    switch (s.kind) {
      case "low_ctr":
        return [{ label: "Rewrite title", go: () => run("Title", async () => { const id = await enqueue("fix_title", { postId }); await done(); return id; }) }];
      case "rank_down":
      case "refresh":
        return [{ label: "Refresh post", go: () => run("Rewrite", async () => { const id = await enqueue("rewrite", { postId, scope: "article", instruction: "Refresh for current search intent; keep verified facts only." }); await done(); return id; }) }];
      case "query_gap":
        return [{ label: "Add as idea", go: () => run("Idea added", async () => { await createTopic({ query: String(s.detail.query ?? s.title), clusterId: null, track: 1, source: "gsc" }); await done(); }) }];
      case "trend":
        return [{ label: "Write now", go: () => run("Brief", async () => { const id = await enqueue("write_brief", { topicId: s.topic_id }); await done(); return id; }) }];
      case "backlink_needed":
        return [{ label: "Add link", go: () => run("Link", async () => { const id = await enqueue("insert_link", s.detail); await done(); return id; }) }];
      default:
        return postId ? [{ label: "Open", href: `/admin/posts/${postId}` }] : [];
    }
  };

  const dateLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(
    new Date(`${date}T09:00:00+05:30`),
  );

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">{dateLabel}</p>
        </div>
        {batch && (
          <button
            type="button"
            className={`s-chip ${batch.approved_at ? "s-chip--ok" : "s-chip--warn"} !h-8 !px-3`}
            onClick={() => run(batch.approved_at ? "Autopilot paused" : "Autopilot on", () => approveBatch(batch.id, !batch.approved_at))}
          >
            {batch.approved_at ? `Autopilot on · ${batch.name}` : `Autopilot off · Approve ${batch.name}`}
          </button>
        )}
      </div>

      <section aria-label="Overview" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { value: stats.live, label: "Live posts", href: "/admin/posts?status=live" },
          { value: stats.drafts, label: "In progress", href: "/admin/posts?status=draft" },
          { value: stats.scheduled, label: "Scheduled", href: "/admin/calendar" },
          { value: stats.ideas, label: "Ideas to review", href: "/admin/ideas" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="card stat hover:border-[var(--s-line-strong)] transition-colors">
            <p className="stat-value">{s.value}</p>
            <p className="stat-label">{s.label}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6 min-w-0">
          <section className="card" aria-labelledby="suggestion-title">
            <div className="card-head">
              <h2 id="suggestion-title" className="card-title flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--s-accent)]" aria-hidden="true" /> Agent suggests
              </h2>
            </div>
            <div className="card-body">
              <p className="text-[17px] leading-relaxed">{briefing.content.recommendation.text}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {briefing.content.recommendation.actions.map((action) =>
                  action.type === "navigate" ? (
                    <Link key={action.label} href={action.href ?? "/admin"} className="s-btn s-btn--primary">
                      {action.label}
                    </Link>
                  ) : (
                    <button key={action.label} type="button" className="s-btn s-btn--primary" disabled={busy} onClick={() => run(action.label, () => enqueue(action.type as never, action.payload))}>
                      {action.label}
                    </button>
                  ),
                )}
                <button type="button" className="s-btn" onClick={() => setDiscussing((d) => !d)} aria-expanded={discussing}>
                  Discuss
                </button>
              </div>
              {discussing && <AgentThread thread={`briefing:${date}`} messages={messages} placeholder="Ask why, push back, or suggest something else…" />}
            </div>
          </section>

          <section className="card" aria-labelledby="alerts-title">
            <div className="card-head">
              <h2 id="alerts-title" className="card-title">
                Alerts {signals.length > 0 && <span className="s-faint font-normal">· {signals.length}</span>}
              </h2>
            </div>
            {signals.length === 0 ? (
              <p className="card-body s-dim">Nothing needs your attention.</p>
            ) : (
              <ul>
                {signals.map((s) => {
                  const meta = SIGNAL_ICON[s.kind];
                  const Icon = meta.icon;
                  return (
                    <li key={s.id} className="flex flex-wrap items-start gap-3 px-5 py-4 border-b s-line last:border-0">
                      <span className="mt-0.5 grid place-items-center w-8 h-8 rounded-lg flex-none" style={{ background: "var(--s-raised)", color: meta.tone }}>
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-[180px] flex-1">
                        <p className="break-words">{s.title}</p>
                        <p className="s-faint text-[12px] mt-0.5">
                          {meta.label}
                          {s.priority === "P0" || s.priority === "P1" ? " · High priority" : ""}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-none">
                        {actionsFor(s).map((a) =>
                          a.href ? (
                            <Link key={a.label} href={a.href} className="s-btn s-btn--sm">
                              {a.label}
                            </Link>
                          ) : (
                            <button key={a.label} type="button" className="s-btn s-btn--sm" disabled={busy} onClick={a.go}>
                              {a.label}
                            </button>
                          ),
                        )}
                        <button type="button" className="s-btn s-btn--sm s-btn--ghost" onClick={() => run("Dismissed", () => setSignal(s.id, "dismissed"))}>
                          Dismiss
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card" aria-labelledby="today-title">
            <div className="card-head">
              <h2 id="today-title" className="card-title">
                Publishing today
              </h2>
              <span className="s-faint text-[12px]">09:00 IST</span>
            </div>
            <div className="card-body">
              {today ? (
                <>
                  <Link href={`/admin/posts/${today.id}`} className="font-medium text-[15px] hover:text-[var(--s-accent)]">
                    {today.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <StatusBadge stage={today.stage} />
                    <SeoBadge audit={today.audit} />
                    {today.approved_at && <span className="s-chip s-chip--ok">Approved</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Link href={`/admin/posts/${today.id}`} className="s-btn s-btn--primary s-btn--sm">
                      Review
                    </Link>
                    {!today.approved_at && today.audit?.ok && (
                      <button type="button" className="s-btn s-btn--sm" onClick={() => run("Approved", () => approvePost(today.id, true))}>
                        Approve
                      </button>
                    )}
                    <button type="button" className="s-btn s-btn--sm" onClick={() => run("Moved to tomorrow", () => slotPost(today.id, nextDay(today.scheduled_for!)))}>
                      Move to tomorrow
                    </button>
                  </div>
                </>
              ) : (
                <p className="s-dim">Nothing scheduled today.</p>
              )}
            </div>
          </section>

          <section className="card" aria-labelledby="upcoming-title">
            <div className="card-head">
              <h2 id="upcoming-title" className="card-title">
                Coming up
              </h2>
              <Link href="/admin/calendar" className="s-faint text-[12px] hover:text-[var(--s-text)]">
                Calendar →
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="card-body s-dim">Nothing scheduled.</p>
            ) : (
              <ol>
                {upcoming.map((p) => (
                  <li key={p.id} className="border-b s-line last:border-0">
                    <Link href={`/admin/posts/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--s-hover)]">
                      <span className="s-faint text-[12px] w-14 flex-none">{formatDate(p.scheduled_for).replace(/ \d{4}$/, "")}</span>
                      <span className={`cat-dot c-${p.cluster_id}`} aria-hidden="true" />
                      <span className="truncate flex-1">{p.title}</span>
                      <StatusBadge stage={p.stage} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

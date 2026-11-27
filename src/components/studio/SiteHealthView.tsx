"use client";

import { useMemo, useState } from "react";
import { enqueue } from "@/app/actions";
import { ISSUE_TYPES, type IssueType } from "@/lib/studio/crawl";
import { useStudio } from "./StudioProvider";
import { EmptyState, PageHead, formatDate } from "./ui";

export interface HealthData {
  site: string;
  runs: { id: string; started_at: string; finished_at: string | null; status: string; pages: number; score: number | null; summary: { new?: number; fixed?: number; outboundChecked?: number; outboundFound?: number } }[];
  issues: { url: string; type: IssueType; detail: string | null; first_seen: string; last_seen: string }[];
  fixed: { url: string; type: IssueType; fixed_at: string }[];
  metrics: { date: string; url: string; metric: string; value: number }[];
  inspections: { url: string; indexed: boolean; coverage: string; checked_at: string }[];
}

const TONE = { error: "s-chip--bad", warning: "s-chip--warn", notice: "" } as const;
const path = (url: string) => {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
};

function ScoreCard({ data }: { data: HealthData }) {
  const last = data.runs.find((r) => r.status === "done");
  const running = data.runs.find((r) => r.status === "running");
  const previous = data.runs.filter((r) => r.status === "done")[1];
  const change = last?.score != null && previous?.score != null ? last.score - previous.score : null;
  return (
    <div className="card card-body flex flex-wrap items-center gap-6">
      <div>
        <div className="s-dim text-[13px]">Health score</div>
        <div className="text-[40px] font-semibold leading-none" style={{ color: last?.score == null ? undefined : last.score >= 85 ? "#30a46c" : last.score >= 60 ? "#f5a524" : "#e5484d" }}>
          {last?.score ?? "—"}
        </div>
        {change !== null && change !== 0 && <div className="s-faint text-[13px]">{change > 0 ? `+${change}` : change} since the crawl before</div>}
      </div>
      <div className="text-[14px] space-y-1">
        <div>{last ? `${last.pages} pages checked ${formatDate(last.finished_at, true)}` : "Not checked yet"}</div>
        {last && (
          <div className="s-dim">
            {last.summary.new ?? 0} new problems · {last.summary.fixed ?? 0} fixed
            {(last.summary.outboundFound ?? 0) > (last.summary.outboundChecked ?? 0) ? ` · ${last.summary.outboundChecked} of ${last.summary.outboundFound} outside links checked` : ""}
          </div>
        )}
        {running && <div className="s-chip s-chip--info">Checking now: {running.pages} pages so far</div>}
      </div>
    </div>
  );
}

function SpeedCard({ data }: { data: HealthData }) {
  const latest = useMemo(() => {
    const byUrl = new Map<string, Record<string, number>>();
    const dates = [...new Set(data.metrics.map((m) => m.date))].sort();
    const last = dates.at(-1);
    for (const m of data.metrics.filter((x) => x.date === last)) byUrl.set(m.url, { ...(byUrl.get(m.url) ?? {}), [m.metric]: m.value });
    return { date: last, rows: [...byUrl.entries()].slice(0, 10) };
  }, [data.metrics]);
  if (!latest.rows.length) return null;
  return (
    <section className="card card-body space-y-2">
      <h2 className="section-title">Speed (mobile) · {latest.date}</h2>
      <table className="w-full text-[14px]">
        <thead>
          <tr className="s-dim text-left">
            <th className="py-1">Page</th>
            <th>Score</th>
            <th>LCP</th>
            <th>CLS</th>
            <th>INP</th>
          </tr>
        </thead>
        <tbody>
          {latest.rows.map(([url, m]) => (
            <tr key={url} className="border-t s-line">
              <td className="py-1 truncate max-w-[260px]">{path(url)}</td>
              <td>{m.performance ?? "—"}</td>
              <td>{m.lcp != null ? `${(m.lcp / 1000).toFixed(1)} s` : "—"}</td>
              <td>{m.cls != null ? m.cls.toFixed(2) : "—"}</td>
              <td>{m.inp != null ? `${Math.round(m.inp)} ms` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function IndexingCard({ data }: { data: HealthData }) {
  if (!data.inspections.length) return null;
  const latest = new Map<string, HealthData["inspections"][number]>();
  for (const i of data.inspections) if (!latest.has(i.url)) latest.set(i.url, i);
  const rows = [...latest.values()];
  const notIndexed = rows.filter((r) => !r.indexed);
  return (
    <section className="card card-body space-y-2">
      <h2 className="section-title">
        Indexing: {rows.length - notIndexed.length} of {rows.length} checked pages are in Google
      </h2>
      {notIndexed.length > 0 && (
        <ul className="text-[14px] space-y-1">
          {notIndexed.slice(0, 15).map((r) => (
            <li key={r.url}>
              <span className="truncate">{path(r.url)}</span> <span className="s-faint">— {r.coverage}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SiteHealthView({ data }: { data: HealthData }) {
  const { run, busy, preview } = useStudio();
  const [open, setOpen] = useState<IssueType | null>(null);
  const groups = useMemo(() => {
    const map = new Map<IssueType, HealthData["issues"]>();
    for (const i of data.issues) if (ISSUE_TYPES[i.type]) map.set(i.type, [...(map.get(i.type) ?? []), i]);
    const order = { error: 0, warning: 1, notice: 2 };
    return [...map.entries()].sort((a, b) => order[ISSUE_TYPES[a[0]].severity] - order[ISSUE_TYPES[b[0]].severity] || b[1].length - a[1].length);
  }, [data.issues]);
  return (
    <div className="space-y-6">
      <PageHead title="Site health" sub={`Weekly check of ${data.site.replace(/^https:\/\//, "")}: broken pages and links, titles, headings, indexing blocks, images and speed.`}>
        <button type="button" className="s-btn s-btn--primary" disabled={busy || preview || data.runs[0]?.status === "running"} onClick={() => run("Site check started", () => enqueue("crawl_site"), { type: "crawl_site" })}>
          Check now
        </button>
      </PageHead>
      <ScoreCard data={data} />
      <SpeedCard data={data} />
      <IndexingCard data={data} />
      {groups.length === 0 ? (
        <EmptyState title={data.runs.length ? "No open problems" : "No check yet"}>{data.runs.length ? "Everything the crawler checks looks fine." : "The first check runs this week, or click Check now."}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {groups.map(([type, rows]) => (
            <li key={type} className="card">
              <button type="button" className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left" aria-expanded={open === type} onClick={() => setOpen(open === type ? null : type)}>
                <span className="flex items-center gap-2">
                  <span className={`s-chip ${TONE[ISSUE_TYPES[type].severity]}`}>{ISSUE_TYPES[type].severity}</span>
                  {ISSUE_TYPES[type].label}
                </span>
                <span className="font-mono s-dim">{rows.length}</span>
              </button>
              {open === type && (
                <ul className="px-5 pb-4 space-y-1 text-[14px]">
                  {rows.slice(0, 100).map((r) => (
                    <li key={r.url} className="flex flex-wrap gap-x-2">
                      <a className="underline truncate max-w-full" href={r.url} target="_blank" rel="noopener noreferrer">
                        {path(r.url)}
                      </a>
                      {r.detail && <span className="s-faint truncate">{r.detail}</span>}
                    </li>
                  ))}
                  {rows.length > 100 && <li className="s-faint">…and {rows.length - 100} more (Export has the full list)</li>}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.fixed.length > 0 && (
        <section className="card card-body">
          <h2 className="section-title mb-2">Fixed in the last 30 days ({data.fixed.length})</h2>
          <ul className="text-[14px] space-y-1">
            {data.fixed.slice(0, 20).map((f) => (
              <li key={`${f.url}${f.type}`}>
                {ISSUE_TYPES[f.type]?.label ?? f.type} — <span className="s-dim">{path(f.url)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

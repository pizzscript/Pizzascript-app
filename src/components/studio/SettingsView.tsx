"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { addFact, approveBatch, deleteFact, runAgent, saveScoring, saveSetting, setFactVerified, signOut } from "@/app/admin/actions";
import type { AiCall } from "@/lib/studio/server";
import { SCORE_FACTORS, type Batch, type Fact, type ScheduleSettings, type ScoreFactor, type ScoringSettings } from "@/lib/studio/types";
import type { ConnectionView } from "@/lib/studio/connections-server";
import { AutoPickToggle } from "./AutoPickToggle";
import { ResearchToggle } from "./ResearchToggle";
import { ConnectionsPanel } from "./ConnectionsPanel";
import { AutopilotToggle } from "./AutopilotToggle";
import { useStudio } from "./StudioProvider";
import { UsagePanel } from "./UsagePanel";
import { PageHead } from "./ui";

const TABS = [
  { id: "schedule", label: "Schedule" },
  { id: "autopilot", label: "Autopilot" },
  { id: "connections", label: "Connections" },
  { id: "usage", label: "AI usage" },
  { id: "writing", label: "Writing rules" },
  { id: "scoring", label: "Idea scoring" },
  { id: "facts", label: "Facts" },
  { id: "account", label: "Account" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const FACTOR_LABEL: Record<ScoreFactor, string> = {
  authority: "Builds expertise",
  intent: "Matches what we sell",
  volume: "Search volume",
  backlink: "Link potential",
  difficulty: "Easy to rank",
  internalLink: "Fits our other posts",
};

const RANGE_LABEL: Record<string, string> = {
  track1: "Traffic posts",
  spoke: "Expert posts",
  pillar: "Main articles",
  edge: "Niche posts",
  "case-study": "Case studies",
  trend: "Trend posts",
};

interface Props {
  initialTab: string;
  schedule: ScheduleSettings;
  scoring: ScoringSettings;
  bannedPhrases: string[];
  wordRanges: Record<string, [number, number]>;
  facts: Fact[];
  batches: Batch[];
  email: string | null;
  autopilot: boolean;
  autoPick: { enabled: boolean; pausedReason: string | null };
  connections: ConnectionView[];
  research: Record<string, unknown> & { enabled: boolean };
  aiUsage: AiCall[];
}

export function SettingsView({ initialTab, schedule, scoring, bannedPhrases, wordRanges, facts, batches, email, autopilot, autoPick, connections, research, aiUsage }: Props) {
  const { run, busy, preview } = useStudio();
  const [tab, setTab] = useState<TabId>((TABS.find((t) => t.id === initialTab)?.id ?? "schedule") as TabId);
  const [sched, setSched] = useState(schedule);
  const [banned, setBanned] = useState(bannedPhrases.join("\n"));
  const [ranges, setRanges] = useState(wordRanges);
  const [weights, setWeights] = useState(scoring);
  const [fact, setFact] = useState({ subject: "", statement: "", source: "" });

  return (
    <div>
      <PageHead title="Settings" />
      <div className="grid gap-8 grid-cols-[minmax(0,1fr)] md:grid-cols-[200px_minmax(0,1fr)]">
        <div role="tablist" aria-label="Settings sections" aria-orientation="vertical" className="flex md:flex-col gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`cms-nav-link !h-9 whitespace-nowrap ${tab === t.id ? "!bg-[var(--s-raised)] !text-[var(--s-text)]" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="card card-body max-w-[760px] space-y-6">
          {tab === "schedule" && (
            <>
              <Intro title="Publishing schedule" text="When posts go live and when the agent prepares your daily suggestion. Times are in India Standard Time." />
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField label="Publish time" type="time" value={sched.publishAt} onChange={(v) => setSched({ ...sched, publishAt: v })} />
                <TextField label="Daily suggestion at" type="time" value={sched.briefingAt} onChange={(v) => setSched({ ...sched, briefingAt: v })} />
                <TextField label="Posts per day" type="number" value={String(sched.perDay)} onChange={(v) => setSched({ ...sched, perDay: Math.max(1, Number(v) || 1) })} />
              </div>
              <SaveButton disabled={busy || JSON.stringify(sched) === JSON.stringify(schedule)} onClick={() => run("Schedule saved", () => saveSetting("schedule", sched))} />
            </>
          )}

          {tab === "autopilot" && (
            <>
              <Intro
                title="Autopilot"
                text="When it's on, every scheduled post is written, gets a banner, is quality-checked and published on its date — no approvals. Posts are prepared one at a time, soonest first. A post that fails the quality check doesn't publish; it shows up as an alert."
              />
              <div className="flex flex-wrap items-center gap-3">
                <AutopilotToggle enabled={autopilot} />
                <button type="button" className="s-btn" disabled={busy} onClick={() => run("Agent started", () => runAgent())}>
                  Run agent now
                </button>
              </div>

              <div className="pt-4 border-t s-line space-y-3">
                <Intro
                  title="Auto-pick ideas"
                  text="When it's on, the agent chooses at most one qualified idea a day and schedules it at least 3 days ahead, so you can remove it first. It skips overlapping topics, checks quota first, and pauses after 2 failed articles in a row."
                />
                <AutoPickToggle enabled={autoPick.enabled} autopilot={autopilot} pausedReason={autoPick.pausedReason} />
              </div>

              <div className="pt-4 border-t s-line space-y-3">
                <Intro
                  title="Idea research"
                  text="Each morning after the briefing, the agent finds new ideas from real Google searches (Pune and India first), checks them against your service pages and existing articles, and keeps the best. Weekly it re-reads your service pages and archives weak, old or duplicate ideas. It uses only the light AI models, about 2 requests a day."
                />
                <ResearchToggle settings={research} />
              </div>

              <div className="pt-4 border-t s-line">
                <Intro
                  title="Batches"
                  text="With autopilot off, approving a batch does the same for just that batch: its posts are prepared one by one and publish on their dates if they pass."
                />
                {batches.length === 0 ? (
                  <p className="s-dim mt-3">No batches yet.</p>
                ) : (
                  <ul className="divide-y divide-[var(--s-line)] mt-2">
                    {batches.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-4 py-3">
                        <span>
                          <span className="font-medium">{b.name}</span>
                          <span className="block s-faint text-[13px]">{b.approved_at ? "Approved — running automatically" : "Not approved"}</span>
                        </span>
                        <button
                          type="button"
                          className={`s-btn s-btn--sm ${b.approved_at ? "" : "s-btn--primary"}`}
                          onClick={() => {
                            if (!b.approved_at && !window.confirm(`Approve ${b.name}?\n\nAll its posts will be written, bannered, quality-checked and published on their dates — one at a time. This uses your Gemini quota.`)) return;
                            run(b.approved_at ? "Batch stopped" : "Batch approved", () => approveBatch(b.id, !b.approved_at));
                          }}
                        >
                          {b.approved_at ? "Stop batch" : "Approve batch"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {tab === "usage" && <UsagePanel calls={aiUsage} />}

          {tab === "writing" && (
            <>
              <Intro title="Writing rules" text="The AI never uses these phrases, and the quality check flags them. One phrase per line." />
              <label className="block">
                <span className="s-label">Banned phrases</span>
                <textarea className="s-input min-h-[180px]" value={banned} onChange={(e) => setBanned(e.target.value)} />
              </label>
              <SaveButton
                disabled={busy || banned === bannedPhrases.join("\n")}
                onClick={() => run("Saved", () => saveSetting("banned_phrases", banned.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean)))}
              />
              <div className="pt-4 border-t s-line">
                <Intro title="Word count targets" text="The AI aims for these ranges, and the quality check warns when a post is far outside them." />
                <div className="grid gap-3 sm:grid-cols-2 mt-4">
                  {Object.entries(ranges).map(([key, [min, max]]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-28 s-dim text-[13px]">{RANGE_LABEL[key] ?? key}</span>
                      <input className="s-input !w-20" type="number" aria-label={`${RANGE_LABEL[key] ?? key} minimum words`} value={min} onChange={(e) => setRanges({ ...ranges, [key]: [Number(e.target.value), max] })} />
                      <span className="s-faint">–</span>
                      <input className="s-input !w-20" type="number" aria-label={`${RANGE_LABEL[key] ?? key} maximum words`} value={max} onChange={(e) => setRanges({ ...ranges, [key]: [min, Number(e.target.value)] })} />
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <SaveButton disabled={busy || JSON.stringify(ranges) === JSON.stringify(wordRanges)} onClick={() => run("Saved", () => saveSetting("word_ranges", ranges))} />
                </div>
              </div>
            </>
          )}

          {tab === "scoring" && (
            <>
              <Intro title="Idea scoring" text="How much each factor counts when the AI judges an idea as Good, Maybe or Skip. Weights are balanced automatically." />
              <div className="space-y-4">
                {SCORE_FACTORS.map((factor) => (
                  <label key={factor} className="block">
                    <span className="flex justify-between text-[13px] mb-1">
                      <span>{FACTOR_LABEL[factor]}</span>
                      <span className="s-faint">{Math.round(weights.base[factor] * 100)}</span>
                    </span>
                    <input
                      type="range"
                      className="s-range"
                      min={0}
                      max={0.5}
                      step={0.01}
                      value={weights.base[factor]}
                      onChange={(e) => setWeights({ ...weights, base: { ...weights.base, [factor]: Number(e.target.value) } })}
                    />
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <SaveButton disabled={busy || JSON.stringify(weights) === JSON.stringify(scoring)} onClick={() => run("Saved — ideas re-ranked", () => saveScoring(weights))} />
                <button type="button" className="s-btn s-btn--ghost" onClick={() => setWeights(scoring)}>
                  Reset
                </button>
              </div>
            </>
          )}

          {tab === "facts" && (
            <>
              <Intro
                title="Facts the AI can quote"
                text="Real results from your projects. The AI only ever cites facts you've marked verified, so it never invents numbers."
              />
              <ul className="divide-y divide-[var(--s-line)]">
                {facts.map((f) => (
                  <li key={f.id} className="flex items-start gap-3 py-3">
                    <label className="flex items-start gap-3 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 accent-[var(--s-accent)]"
                        checked={Boolean(f.verified)}
                        onChange={(e) => run(e.target.checked ? "Marked verified" : "Unverified", () => setFactVerified(f.id, e.target.checked))}
                      />
                      <span>
                        <span className="s-faint">{f.subject}:</span> {f.statement}
                        {f.source && <span className="block s-faint text-[12px]">{f.source}</span>}
                      </span>
                    </label>
                    <button type="button" className="s-btn s-btn--icon s-btn--ghost" aria-label={`Delete fact: ${f.statement}`} onClick={() => run("Deleted", () => deleteFact(f.id))}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] pt-4 border-t s-line"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = fact;
                  setFact({ subject: "", statement: "", source: "" });
                  run("Fact added", () => addFact(value.subject, value.statement, value.source));
                }}
              >
                <TextField label="Project or client" value={fact.subject} onChange={(v) => setFact({ ...fact, subject: v })} />
                <TextField label="Fact" value={fact.statement} onChange={(v) => setFact({ ...fact, statement: v })} placeholder="e.g. Page load time dropped from 4.5s to 1.1s" />
                <div className="sm:col-span-2">
                  <TextField label="Source (optional)" value={fact.source} onChange={(v) => setFact({ ...fact, source: v })} placeholder="Analytics report, client email…" />
                </div>
                <div>
                  <button type="submit" className="s-btn s-btn--primary" disabled={busy || fact.subject.trim().length < 2 || fact.statement.trim().length < 8}>
                    Add fact
                  </button>
                </div>
              </form>
            </>
          )}

          {tab === "connections" && (
            <>
              <Intro
                title="Connections"
                text="Keys for the services the agent uses. A key saved here replaces the one in Render's settings within about 5 minutes, with no redeploy. Keys are tested before saving, stored encrypted, and never shown again in full."
              />
              <ConnectionsPanel connections={connections} />
            </>
          )}

          {tab === "account" && (
            <>
              <Intro title="Account" text={preview ? "You're in preview mode. Connect Supabase to sign in and make changes." : `Signed in as ${email}.`} />
              {!preview && (
                <button type="button" className="s-btn" onClick={() => run("Signed out", () => signOut())}>
                  Sign out
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Intro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="font-semibold text-[16px]">{title}</h2>
      <p className="s-dim mt-1 max-w-[60ch]">{text}</p>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="s-label">{label}</span>
      <input className="s-input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function SaveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="s-btn s-btn--primary" disabled={disabled} onClick={onClick}>
      Save changes
    </button>
  );
}

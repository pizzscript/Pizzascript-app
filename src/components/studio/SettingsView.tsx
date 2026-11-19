"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { addFact, approveBatch, deleteFact, saveScoring, saveSetting, setFactVerified, signOut } from "@/app/admin/actions";
import { SCORE_FACTORS, type Batch, type Fact, type ScheduleSettings, type ScoreFactor, type ScoringSettings } from "@/lib/studio/types";
import { useStudio } from "./StudioProvider";
import { PageHead } from "./ui";

const TABS = [
  { id: "schedule", label: "Schedule" },
  { id: "autopilot", label: "Autopilot" },
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
}

export function SettingsView({ initialTab, schedule, scoring, bannedPhrases, wordRanges, facts, batches, email }: Props) {
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
      <div className="grid gap-8 md:grid-cols-[200px_minmax(0,1fr)]">
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
                text="A post publishes on its own only when it passes the SEO check and its batch (or the post itself) is approved. Approved batches also prepare posts due in the next 3 days. Anything else waits for you and shows up as an alert."
              />
              {batches.length === 0 ? (
                <p className="s-dim">No batches yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--s-line)]">
                  {batches.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-4 py-3">
                      <span>
                        <span className="font-medium">{b.name}</span>
                        <span className="block s-faint text-[13px]">{b.approved_at ? "Publishing automatically" : "Waiting for approval"}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(b.approved_at)}
                        aria-label={`Autopilot for ${b.name}`}
                        className={`s-btn s-btn--sm ${b.approved_at ? "" : "s-btn--primary"}`}
                        onClick={() => run(b.approved_at ? "Autopilot paused" : "Autopilot on", () => approveBatch(b.id, !b.approved_at))}
                      >
                        {b.approved_at ? "Pause" : "Approve"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "writing" && (
            <>
              <Intro title="Writing rules" text="The AI never uses these phrases, and the SEO check flags them. One phrase per line." />
              <label className="block">
                <span className="s-label">Banned phrases</span>
                <textarea className="s-input min-h-[180px]" value={banned} onChange={(e) => setBanned(e.target.value)} />
              </label>
              <SaveButton
                disabled={busy || banned === bannedPhrases.join("\n")}
                onClick={() => run("Saved", () => saveSetting("banned_phrases", banned.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean)))}
              />
              <div className="pt-4 border-t s-line">
                <Intro title="Word count targets" text="The AI aims for these ranges, and the SEO check warns when a post is far outside them." />
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

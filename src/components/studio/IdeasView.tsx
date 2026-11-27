"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { createTopic, enqueue, reviewIdea, setTopicStatus } from "@/app/actions";
import { computeScore } from "@/lib/studio/scoring";
import { FILTERS, verdictFor, type Cluster, type ScoringSettings, type Topic, type Verdict } from "@/lib/studio/types";
import { useStudio } from "./StudioProvider";
import { CategoryLabel, EmptyState, PageHead } from "./ui";

const VERDICT: Record<Verdict, { label: string; tone: string }> = {
  good: { label: "Good", tone: "s-chip--ok" },
  maybe: { label: "Maybe", tone: "s-chip--warn" },
  skip: { label: "Skip", tone: "s-chip--bad" },
  unresearched: { label: "Not researched", tone: "" },
};

const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = {
  uniqueness: "Unique angle",
  depth: "Enough depth",
  audience: "Clear reader",
  cannibalism: "No overlap with our posts",
  demand: "People search for it",
};

const ORDER: Record<Verdict, number> = { good: 0, maybe: 1, unresearched: 2, skip: 3 };

/** A researched new-article idea still waiting for the owner's OK before Auto-pick may write it. */
const needsOk = (t: Topic) => t.status === "candidate" && t.research?.action === "new_article" && t.research.review?.state !== "approved";

const isDone = (t: Topic) => ["approved", "in_production", "published", "rejected", "archived"].includes(t.status);
const inTab = (t: Topic, which: "todo" | "review" | "done") => (which === "done" ? isDone(t) : which === "review" ? needsOk(t) : !isDone(t));

const ACTION_LABEL = { new_article: "New article", update_page: "Update an existing page", service_page: "New service page" } as const;
const LEVEL_LABEL = { measured: "measured", weak: "some signs", unknown: "unknown" } as const;

/** Why research suggested an idea: the evidence, what's still unknown and what to do with it. */
function IdeaEvidence({ topic }: { topic: Topic }) {
  const r = topic.research!;
  return (
    <div className="space-y-2 text-[13px]">
      <p>
        <span className="s-faint">Suggested action:</span> {ACTION_LABEL[r.action!]}
        {r.updatePath ? ` (${r.updatePath})` : ""}
        {r.review?.state === "approved" && <span className="s-chip s-chip--ok ml-2">OK for Auto-pick</span>}
      </p>
      {r.why && (
        <p>
          <span className="s-faint">Why:</span> {r.why}
        </p>
      )}
      {r.customer && (
        <p>
          <span className="s-faint">For:</span> {r.customer}
        </p>
      )}
      {r.evidence && r.evidence.length > 0 && (
        <div>
          <p className="s-faint">Evidence</p>
          <ul className="list-disc pl-5 s-dim">
            {r.evidence.map((e) => (
              <li key={e.detail}>{e.detail}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="s-dim">
        Search demand: {LEVEL_LABEL[r.demand ?? "unknown"]} · Ranking chance: {LEVEL_LABEL[r.ranking ?? "unknown"]}
      </p>
      {r.unknowns && r.unknowns.length > 0 && <p className="s-faint">Not known yet: {r.unknowns.join(", ")}.</p>}
    </div>
  );
}

export function IdeasView({ topics, clusters, scoring, openNew }: { topics: Topic[]; clusters: Cluster[]; scoring: ScoringSettings; openNew: boolean }) {
  const { run, busy } = useStudio();
  const [tab, setTab] = useState<"todo" | "review" | "done">("todo");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(openNew);
  const [draft, setDraft] = useState({ query: "", clusterId: clusters[0]?.id ?? "", track: 1 as 1 | 2 });
  const [query, setQuery] = useState("");

  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics
      .filter((t) => inTab(t, tab))
      .filter((t) => !q || t.query.toLowerCase().includes(q))
      .sort((a, b) => ORDER[verdictFor(a)] - ORDER[verdictFor(b)] || (b.score ?? 0) - (a.score ?? 0));
  }, [topics, tab, query]);

  const reasonFor = (t: Topic) => {
    const failed = FILTERS.find((f) => t.filters[f] && !t.filters[f]!.pass);
    if (failed) return t.filters[failed]!.reason;
    return t.research?.angle ?? t.reason ?? (verdictFor(t) === "unresearched" ? "Click Research to let the AI check it." : "");
  };

  const skip = (topic: Topic) => {
    const reason = window.prompt("Why skip this idea? Research avoids similar ideas next time. (e.g. not our service, wrong customer, too technical)");
    if (reason === null) return;
    if (topic.research?.action) run("Skipped", () => reviewIdea(topic.id, "rejected", reason || "Skipped"));
    else run("Skipped", () => setTopicStatus(topic.id, "rejected", reason || "Skipped"));
  };

  const statusText = (t: Topic) =>
    t.status === "published" ? "Published" : t.status === "in_production" ? "Being written" : t.status === "approved" ? "Approved" : t.status === "rejected" ? "Rejected" : "Archived";

  return (
    <div>
      <PageHead title="Ideas" sub="Found by research from real searches, questions and reviews. Give a quick OK to the ones worth writing; skip the rest and say why.">
        <button type="button" className="s-btn s-btn--primary" onClick={() => setAdding(true)}>
          <Plus size={16} aria-hidden="true" /> New idea
        </button>
      </PageHead>

      {adding && (
        <form
          className="card card-body mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const input = draft;
            setDraft((d) => ({ ...d, query: "" }));
            run("Idea added — researching", async () => {
              await createTopic({ query: input.query, clusterId: input.clusterId || null, track: input.track });
            });
          }}
        >
          <div>
            <label htmlFor="idea-query" className="s-label">
              Topic or search phrase
            </label>
            <input
              id="idea-query"
              autoFocus
              className="s-input"
              placeholder="e.g. next.js vs wordpress for small business"
              value={draft.query}
              onChange={(e) => setDraft((d) => ({ ...d, query: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="idea-category" className="s-label">
              Category
            </label>
            <select id="idea-category" className="s-input" value={draft.clusterId} onChange={(e) => setDraft((d) => ({ ...d, clusterId: e.target.value }))}>
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="s-btn s-btn--primary" disabled={busy || draft.query.trim().length < 4}>
              Research
            </button>
            <button type="button" className="s-btn s-btn--ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
          <fieldset className="md:col-span-3 flex flex-wrap gap-4 text-[13px] s-dim">
            <legend className="sr-only">Goal</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="track" checked={draft.track === 1} onChange={() => setDraft((d) => ({ ...d, track: 1 }))} className="accent-[var(--s-accent)]" />
              Bring in traffic (broad, helpful topic)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="track" checked={draft.track === 2} onChange={() => setDraft((d) => ({ ...d, track: 2 }))} className="accent-[var(--s-accent)]" />
              Win clients (expert, specific topic)
            </label>
          </fieldset>
        </form>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div role="tablist" aria-label="Ideas" className="s-tabs">
          {(["todo", "review", "done"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="s-tab" onClick={() => setTab(t)}>
              {t === "todo" ? "All waiting" : t === "review" ? "Needs your OK" : "Done"} <span className="s-faint">{topics.filter((x) => inTab(x, t)).length}</span>
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-[280px]">
          <span className="sr-only">Search ideas</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 s-faint" aria-hidden="true" />
          <input className="s-input !pl-9" placeholder="Search ideas" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={tab === "done" ? "Nothing here yet" : tab === "review" ? "Nothing needs your OK" : "No ideas waiting"}>{tab === "done" ? "Approved and rejected ideas appear here." : tab === "review" ? "New researched ideas appear here for a quick OK or skip." : "Add a topic and the AI will research it."}</EmptyState>
      ) : (
        <ul className="card">
          {rows.map((topic) => {
            const verdict = verdictFor(topic);
            const expanded = open === topic.id;
            const breakdown = topic.score !== null ? computeScore(topic.scores, topic.track, scoring) : null;
            return (
              <li key={topic.id} className="border-b s-line last:border-0">
                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <button type="button" className="flex-1 min-w-[240px] text-left" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : topic.id)}>
                    <span className="block font-medium">{topic.research?.title ?? topic.query}</span>
                    <span className="block s-dim text-[13px] mt-0.5 line-clamp-1">{reasonFor(topic)}</span>
                    {topic.research?.action && (
                      <span className="flex flex-wrap items-center gap-1.5 mt-2">
                        {topic.score !== null && topic.score !== undefined && <span className="s-chip s-chip--accent">Score {Math.round(topic.score)}</span>}
                        {topic.research.group && <span className="s-chip">{topic.research.group.replace(/-/g, " ")}</span>}
                        {topic.research.evidenceSource && <span className="s-chip s-chip--info">{topic.research.evidenceSource}</span>}
                        {topic.research.review?.state === "approved" && <span className="s-chip s-chip--ok">OK for Auto-pick</span>}
                      </span>
                    )}
                  </button>
                  <span className="text-[13px] whitespace-nowrap hidden md:inline">
                    <CategoryLabel cluster={clusterById.get(topic.cluster_id ?? "")} />
                  </span>
                  {tab === "todo" ? <span className={`s-chip ${VERDICT[verdict].tone}`}>{VERDICT[verdict].label}</span> : <span className="s-chip">{statusText(topic)}</span>}
                  {tab !== "done" && needsOk(topic) ? (
                    <span className="flex gap-2">
                      <button type="button" className="s-btn s-btn--sm s-btn--primary" disabled={busy} title="Lets Auto-pick schedule and write this idea when a slot is free." onClick={() => run("OK for Auto-pick", () => reviewIdea(topic.id, "approved"))}>
                        OK
                      </button>
                      <button type="button" className="s-btn s-btn--sm s-btn--ghost" disabled={busy} onClick={() => skip(topic)}>
                        Skip
                      </button>
                    </span>
                  ) : tab !== "done" &&
                    (verdict === "unresearched" ? (
                      <button type="button" className="s-btn s-btn--sm" disabled={busy} onClick={() => run("Scoring", () => enqueue("score_topic", { topicId: topic.id }))}>
                        Research
                      </button>
                    ) : (
                      <button type="button" className="s-btn s-btn--sm s-btn--primary" disabled={busy} onClick={() => run("Approved — the agent will write the brief, draft, banner and quality check", () => setTopicStatus(topic.id, "approved"))}
                        title="Approves the idea. The agent then writes the brief, draft and banner and runs the quality check, with no more clicks."
                      >
                        Write it
                      </button>
                    ))}
                </div>

                {expanded && (
                  <div className="px-5 pb-5 grid gap-6 md:grid-cols-2">
                    <div className="space-y-3 text-[14px]">
                      <p>
                        <span className="s-faint">Search phrase:</span> {topic.query}
                      </p>
                      {topic.research?.action && <IdeaEvidence topic={topic} />}
                      {topic.research?.summary ? (
                        <>
                          <p className="leading-relaxed">{topic.research.summary}</p>
                          {topic.research.angle && (
                            <p>
                              <span className="s-faint">Our angle:</span> {topic.research.angle}
                            </p>
                          )}
                          {topic.research.outline && topic.research.outline.length > 0 && (
                            <div>
                              <p className="s-faint mb-1">Suggested outline</p>
                              <ol className="list-decimal pl-5 space-y-0.5 s-dim">
                                {topic.research.outline.map((o) => (
                                  <li key={o}>{o}</li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="s-dim">No research yet.</p>
                      )}
                    </div>
                    <div className="space-y-4">
                      {Object.keys(topic.filters).length > 0 && (
                        <ul className="space-y-1.5 text-[13px]">
                          {FILTERS.map((f) => {
                            const r = topic.filters[f];
                            if (!r) return null;
                            return (
                              <li key={f} className={r.pass ? "s-dim" : "text-[var(--s-bad)]"} title={r.reason}>
                                {r.pass ? "✓" : "✕"} {FILTER_LABEL[f]}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {breakdown && (
                        <details className="text-[13px]">
                          <summary className="cursor-pointer s-dim">Score details · {breakdown.score.toFixed(0)}/100</summary>
                          <ul className="mt-2 space-y-1.5">
                            {breakdown.parts.map((p) => (
                              <li key={p.factor} className="grid grid-cols-[110px_1fr_36px] items-center gap-2" title={topic.scores[p.factor]?.reason}>
                                <span className="s-faint capitalize">{p.factor.replace("internalLink", "internal links")}</span>
                                <span className="s-bar-track">
                                  <span className="s-bar-fill" style={{ width: `${p.value}%` }} />
                                </span>
                                <span className="text-right s-faint">{p.value}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {tab !== "done" && (
                        <div className="flex flex-wrap gap-2">
                          {(topic.research?.action ?? "new_article") === "new_article" && verdict !== "unresearched" && topic.research?.review?.state !== "approved" && (
                            <button
                              type="button"
                              className="s-btn s-btn--sm"
                              disabled={busy}
                              title="Lets Auto-pick schedule and write this idea when a slot is free."
                              onClick={() => run("OK for Auto-pick", () => reviewIdea(topic.id, "approved"))}
                            >
                              OK for Auto-pick
                            </button>
                          )}
                          {topic.research?.review?.state === "approved" && (
                            <button type="button" className="s-btn s-btn--sm s-btn--ghost" disabled={busy} onClick={() => run("Removed from Auto-pick", () => reviewIdea(topic.id, "pending"))}>
                              Remove from Auto-pick
                            </button>
                          )}
                          {verdict !== "unresearched" && (
                            <button type="button" className="s-btn s-btn--sm" onClick={() => run("Scoring", () => enqueue("score_topic", { topicId: topic.id }))}>
                              Research again
                            </button>
                          )}
                          {verdict !== "unresearched" && (
                            <button type="button" className="s-btn s-btn--sm" disabled={busy} onClick={() => run("Approved — the agent will write the brief, draft, banner and quality check", () => setTopicStatus(topic.id, "approved"))}>
                              Write it now
                            </button>
                          )}
                          <button type="button" className="s-btn s-btn--sm s-btn--ghost" onClick={() => skip(topic)}>
                            Skip idea
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

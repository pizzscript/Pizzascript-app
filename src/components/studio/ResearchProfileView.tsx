"use client";

import { useState } from "react";
import { analyzeClientSite, approveResearchProfile, saveResearchDraft } from "@/app/research";
import { EMPTY_BRIEF, isGroupMode, profileChanges, type GroupMode, type ResearchProfile, type ResearchService, type Source } from "@/lib/studio/research-profile";
import type { ClientOverview } from "@/lib/studio/server";
import { useStudio } from "./StudioProvider";

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const cells = (l: string) => l.split("|").map((c) => c.trim());

function sourceLabel(source: Source) {
  if (source.confirmed) return "confirmed";
  if (source.kind === "website" && source.url) {
    const path = new URL(source.url).pathname;
    return path === "/" ? "from the home page" : `from ${path}`;
  }
  if (source.kind === "gsc") return "from Search Console";
  return "guessed";
}

/** The text form of a profile, so the owner can edit it as plain lines. */
function toForm(p: ResearchProfile) {
  return {
    business: p.business.value,
    industry: p.industry.value,
    tone: p.tone.value,
    customers: p.customers.map((c) => c.value).join("\n"),
    services: p.services.map((s) => `${s.name} | ${s.path ?? ""} | ${s.priority}`).join("\n"),
    locations: p.locations.map((l) => `${l.name} | ${l.countryCode}`).join("\n"),
    groups: p.topicGroups.map((g) => `${g.label} | ${g.share} | ${g.mode ?? "auto"} | ${g.description}`).join("\n"),
    avoid: p.avoid.join("\n"),
    questions: p.customerQuestions.join("\n"),
    competitors: p.competitors.join("\n"),
  };
}

function fromForm(base: ResearchProfile, f: ReturnType<typeof toForm>): ResearchProfile {
  const owner: Source = { kind: "owner", confirmed: true };
  const keep = <T,>(old: { value: T; source: Source }, value: T) => (old.value === value ? old : { value, source: owner });
  const oldService = (name: string) => base.services.find((s) => s.name.toLowerCase() === name.toLowerCase());
  return {
    ...base,
    business: keep(base.business, f.business.trim()),
    industry: keep(base.industry, f.industry.trim()),
    tone: keep(base.tone, f.tone.trim()),
    customers: lines(f.customers).map((v) => base.customers.find((c) => c.value === v) ?? { value: v, source: owner }),
    services: lines(f.services).map((l): ResearchService => {
      const [name, path = "", priority = "keep"] = cells(l);
      const old = oldService(name);
      return {
        name,
        path: path || null,
        priority: priority === "grow" || priority === "ignore" ? priority : "keep",
        description: old?.description ?? "",
        source: old && (old.path ?? "") === path ? old.source : owner,
      };
    }),
    locations: lines(f.locations).map((l, i) => {
      const [name, code = "in"] = cells(l);
      return { name, countryCode: code.toLowerCase(), primary: i === 0 };
    }),
    topicGroups: lines(f.groups).map((l) => {
      const [label, share = "0", ...rest] = cells(l);
      // Older lines have no mode cell: "label | share | description".
      const first = rest[0]?.toLowerCase();
      const mode = isGroupMode(first) ? (rest.shift(), first) : "auto";
      return { ...base.topicGroups.find((g) => g.label === label), id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), label, share: Number(share) || 0, mode, description: rest.join(" | ") || label };
    }),
    avoid: lines(f.avoid),
    customerQuestions: lines(f.questions),
    competitors: lines(f.competitors),
  };
}

type GroupRow = { label: string; share: number; mode: GroupMode; description: string };

const MODE_HINT: Record<GroupMode, string> = {
  auto: "Written by its share",
  boost: "Favoured by Auto-pick",
  mandatory: "Written first whenever it's behind",
};

/** Topic groups as editable rows. It reads and writes the same "label | share | mode | description" lines the profile saves. */
function GroupsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const rows: GroupRow[] = lines(value).map((l) => {
    const [label, share = "0", ...rest] = cells(l);
    const first = rest[0]?.toLowerCase();
    const mode = isGroupMode(first) ? (rest.shift(), first) : "auto";
    return { label, share: Number(share) || 0, mode, description: rest.join(" | ") };
  });
  const clean = (s: string) => s.replace(/\|/g, "/").replace(/\n/g, " ");
  const save = (next: GroupRow[]) => onChange(next.map((r) => `${clean(r.label)} | ${r.share} | ${r.mode} | ${clean(r.description)}`).join("\n"));
  const update = (i: number, patch: Partial<GroupRow>) => save(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const total = rows.reduce((s, r) => s + r.share, 0);

  return (
    <fieldset className="space-y-2">
      <legend className="s-dim text-[13px]">Topic groups</legend>
      <p className="s-faint text-[12px]">
        What research looks for and how Auto-pick spreads articles. Shares add up to {total}%
        {total !== 100 ? " and are rescaled to 100 when saved" : ""}.
      </p>
      {rows.length === 0 && <p className="s-faint text-[13px]">No topic groups yet.</p>}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="grid gap-2 rounded-lg border s-line p-3 sm:grid-cols-[minmax(0,1.2fr)_96px_minmax(0,1fr)_auto] sm:items-end">
            <label className="block space-y-1 min-w-0">
              <span className="s-faint text-[12px]">Name</span>
              <input className="s-input w-full" value={r.label} onChange={(e) => update(i, { label: e.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className="s-faint text-[12px]">Share %</span>
              <input className="s-input w-full" type="number" min={0} max={100} value={r.share} onChange={(e) => update(i, { share: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            </label>
            <label className="block space-y-1 min-w-0">
              <span className="s-faint text-[12px]">Auto-pick</span>
              <select className="s-input w-full" value={r.mode} onChange={(e) => update(i, { mode: e.target.value as GroupMode })}>
                {(Object.keys(MODE_HINT) as GroupMode[]).map((m) => (
                  <option key={m} value={m}>
                    {m === "auto" ? "Auto" : m === "boost" ? "Boost" : "Mandatory"} — {MODE_HINT[m]}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="s-btn s-btn--sm s-btn--ghost" onClick={() => save(rows.filter((_, j) => j !== i))} aria-label={`Remove topic group ${r.label || i + 1}`}>
              Remove
            </button>
            <label className="block space-y-1 sm:col-span-4">
              <span className="s-faint text-[12px]">What belongs in it</span>
              <input className="s-input w-full" value={r.description} onChange={(e) => update(i, { description: e.target.value })} />
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="s-btn s-btn--sm" onClick={() => save([...rows, { label: "New group", share: 0, mode: "auto", description: "" }])}>
        Add topic group
      </button>
    </fieldset>
  );
}

function Area({ label, hint, value, onChange, rows = 3 }: { label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block space-y-1">
      <span className="s-dim text-[13px]">{label}</span>
      <textarea className="s-input w-full font-mono text-[13px]" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="s-faint text-[12px]">{hint}</span>}
    </label>
  );
}

export function ResearchProfileView({ client }: { client: ClientOverview }) {
  const { run, busy, preview } = useStudio();
  const { draft, approved, analysing } = client.research;
  const base = draft ?? approved;
  const [form, setForm] = useState(base ? toForm(base) : null);
  const [brief, setBrief] = useState({ ...EMPTY_BRIEF, ...client.research.brief });
  const set = (key: keyof NonNullable<typeof form>) => (v: string) => setForm((f) => (f ? { ...f, [key]: v } : f));
  const id = client.workspace.id;
  const changes = draft && approved && draft.status === "draft" ? profileChanges(approved, draft) : [];
  const isDraft = Boolean(draft && draft.status === "draft");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="section-title">Research profile</h3>
          <p className="s-dim text-[13px]">
            {approved?.approvedAt
              ? `Approved ${new Date(approved.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. Idea research uses this.`
              : "Not approved yet. Idea research for this client waits until you approve it."}
            {isDraft && approved ? " A newer draft is waiting for review." : ""}
          </p>
        </div>
        <button type="button" className="s-btn s-btn--sm" disabled={busy || preview || analysing} onClick={() => run("Analysing the website — the draft appears here when it's done", () => analyzeClientSite(id, brief))}>
          {analysing ? "Analysing…" : base ? "Re-analyse website" : "Analyse website"}
        </button>
      </div>

      <div className="grid gap-3">
        {(
          [
            ["hire", "Who is your target audience?", "Example: small business owners in Pune who need more enquiries"],
            ["grow", "What do you most want to sell?", "Example: business websites, redesigns"],
            ["never", "What should we never cover or target? (separate with commas)", "Example: developer tutorials, hosting comparisons"],
          ] as const
        ).map(([key, label, hint]) => (
          <label key={key} className="block space-y-1">
            <span className="s-dim text-[13px]">{label}</span>
            <input className="s-input w-full" value={brief[key]} placeholder={hint} onChange={(e) => setBrief((b) => ({ ...b, [key]: e.target.value }))} />
          </label>
        ))}
        <p className="s-faint text-[12px]">Your answers outrank the website and search data. They are used the next time you analyse.</p>
      </div>

      {!form || !base ? (
        <p className="s-dim text-[13px]">No profile yet. Analyse the website to draft one: the agent reads up to 25 pages{client.setup.searchConsole ? " and Search Console" : ""}, then you check and approve it.</p>
      ) : (
        <>
          {changes.length > 0 && (
            <div className="rounded-lg border s-line p-3 text-[13px]">
              <p className="font-medium mb-1">Changes in the new draft</p>
              <ul className="list-disc pl-5 space-y-0.5">{changes.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="s-dim text-[13px]">What the business does <span className="s-faint">· {sourceLabel(base.business.source)}</span></span>
              <input className="s-input w-full" value={form.business} onChange={(e) => set("business")(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="s-dim text-[13px]">Industry <span className="s-faint">· {sourceLabel(base.industry.source)}</span></span>
              <input className="s-input w-full" value={form.industry} onChange={(e) => set("industry")(e.target.value)} />
            </label>
          </div>
          <Area label="Customers (one per line: who they are and their problem)" value={form.customers} onChange={set("customers")} />
          <Area label="Services (name | page path | grow, keep or ignore)" hint="Mark the services this client most wants more customers for as grow." value={form.services} onChange={set("services")} rows={5} />
          {base.services.some((s) => !s.source.confirmed) && (
            <ul className="s-faint text-[12px] space-y-0.5">
              {base.services.map((s) => (
                <li key={s.name}>
                  {s.name}: {sourceLabel(s.source)}
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Area label="Locations (name | country code), most important first" value={form.locations} onChange={set("locations")} />
            <Area label="Never cover (one per line)" value={form.avoid} onChange={set("avoid")} />
            <Area label="Questions customers ask (one per line)" hint="Research weighs these with search data when suggesting ideas." value={form.questions} onChange={set("questions")} />
            <Area label="Competitors (domains, optional)" value={form.competitors} onChange={set("competitors")} />
            <label className="block space-y-1">
              <span className="s-dim text-[13px]">Tone</span>
              <input className="s-input w-full" value={form.tone} onChange={(e) => set("tone")(e.target.value)} />
            </label>
          </div>
          <GroupsEditor value={form.groups} onChange={set("groups")} />
          {base.topicGroups.some((g) => g.service) && (
            <ul className="text-[12px] s-faint space-y-1">
              {base.topicGroups.map((g) => (
                <li key={g.id}>
                  <span className="s-dim">{g.label}:</span> sells {g.service || "—"}
                  {g.customer ? ` to ${g.customer}` : ""}. {g.why}
                </li>
              ))}
            </ul>
          )}
          {base.pagesRead && (
            <details className="text-[13px]">
              <summary className="cursor-pointer s-dim">
                What the analysis read: {base.pagesRead.length} pages
                {base.searchData ? `; search data ${base.searchData.used ? "used" : "too little to use"} (${base.searchData.impressions} impressions)` : ""}
              </summary>
              <ul className="mt-2 s-faint space-y-0.5">
                {base.pagesRead.map((p) => (
                  <li key={p.path}>
                    {p.path}: {p.how === "title-only" ? "only title and description" : `${p.words} words${p.how === "reader" ? " (needed the rendering reader)" : ""}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {base.gaps.length > 0 && (
            <div className="text-[13px]">
              <p className="s-dim mb-1">The analysis couldn&apos;t find out</p>
              <ul className="list-disc pl-5 s-faint space-y-0.5">{base.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="s-btn s-btn--sm" disabled={busy || preview} onClick={() => run("Draft saved", () => saveResearchDraft(id, fromForm(base, form)))}>
              Save draft
            </button>
            <button type="button" className="s-btn s-btn--primary s-btn--sm" disabled={busy || preview} onClick={() => run("Research profile approved", () => approveResearchProfile(id, fromForm(base, form)))}>
              Approve
            </button>
          </div>
        </>
      )}
    </section>
  );
}

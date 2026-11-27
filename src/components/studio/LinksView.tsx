"use client";

import { useState } from "react";
import { enqueue, saveSetting, setOpportunityStatus } from "@/app/actions";
import { useStudio } from "./StudioProvider";
import { PageHead, formatDate } from "./ui";

export interface LinksData {
  opportunities: { id: string; kind: string; target: string; search: string | null; why: string | null; subject: string | null; draft: string | null; status: string; created_at: string }[];
  backlinks: { source_url: string; target_url: string; anchor: string | null; first_seen: string; lost_at: string | null }[];
  competitors: string[];
  competitorPages: { competitor: string; url: string; title: string | null; first_seen: string }[];
  local: { name?: string; address?: string; phone?: string };
  localPosts: { created_at: string; status: string; detail: string | null }[];
}

const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function Opportunity({ o }: { o: LinksData["opportunities"][number] }) {
  const { run, busy, preview } = useStudio();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <li className="py-3 space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="s-chip mr-2">{o.kind}</span>
          <span className="font-medium">{o.target}</span>
          {o.why && <p className="s-dim text-[13px]">{o.why}</p>}
          {o.search && (
            <a className="underline text-[13px]" href={`https://www.google.com/search?q=${encodeURIComponent(o.search)}`} target="_blank" rel="noopener noreferrer">
              Find them: {o.search}
            </a>
          )}
        </div>
        <div className="flex gap-1">
          {o.status === "new" && (
            <button type="button" className="s-btn s-btn--sm" disabled={busy || preview} onClick={() => run("Marked as sent", () => setOpportunityStatus(o.id, "sent"))}>
              Sent
            </button>
          )}
          {o.status === "sent" && (
            <button type="button" className="s-btn s-btn--sm" disabled={busy || preview} onClick={() => run("Marked as won", () => setOpportunityStatus(o.id, "won"))}>
              Got the link
            </button>
          )}
          <button type="button" className="s-btn s-btn--sm" disabled={busy || preview} onClick={() => run("Dismissed", () => setOpportunityStatus(o.id, "dismissed"))}>
            Dismiss
          </button>
        </div>
      </div>
      {o.draft && (
        <div>
          <button type="button" className="s-faint text-[13px] underline" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Show"} outreach draft
          </button>
          {open && (
            <div className="mt-2 p-3 rounded-lg border s-line text-[14px] whitespace-pre-wrap">
              <div className="font-medium mb-1">{o.subject}</div>
              {o.draft}
              <div className="mt-2">
                <button
                  type="button"
                  className="s-btn s-btn--sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(`${o.subject}\n\n${o.draft}`);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <span className="s-faint text-[12px] ml-2">Read it, make it personal, then send it yourself.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function LinksView({ data }: { data: LinksData }) {
  const { run, busy, preview } = useStudio();
  const [competitors, setCompetitors] = useState(data.competitors.join("\n"));
  const [local, setLocal] = useState({ name: data.local.name ?? "", address: data.local.address ?? "", phone: data.local.phone ?? "" });
  const live = data.backlinks.filter((b) => !b.lost_at);
  const lost = data.backlinks.filter((b) => b.lost_at);
  const domains = new Set(live.map((b) => host(b.source_url)));
  return (
    <div className="space-y-6">
      <PageHead title="Links & local" sub="Who links to this client, ideas for earning more links (you send every email), competitors and Business Profile.">
        <button type="button" className="s-btn" disabled={busy || preview} onClick={() => run("Looking for link ideas", () => enqueue("find_opportunities"), { type: "find_opportunities" })}>
          New link ideas
        </button>
        <button type="button" className="s-btn" disabled={busy || preview} onClick={() => run("Checking backlinks", () => enqueue("backlink_scan"), { type: "backlink_scan" })}>
          Check backlinks
        </button>
      </PageHead>

      <section className="card card-body">
        <h2 className="section-title">Link ideas</h2>
        {data.opportunities.length ? (
          <ul className="divide-y divide-[var(--s-line)]">{data.opportunities.map((o) => <Opportunity key={o.id} o={o} />)}</ul>
        ) : (
          <p className="s-dim text-[14px] mt-1">None yet. Ten new ideas arrive on the 1st of each month, or click New link ideas.</p>
        )}
      </section>

      <section className="card card-body space-y-2">
        <h2 className="section-title">
          Backlinks: {live.length} links from {domains.size} sites{lost.length ? ` · ${lost.length} lost` : ""}
        </h2>
        {live.length === 0 && <p className="s-dim text-[14px]">Connect Bing Webmaster in Settings → Connections to see who links here.</p>}
        <ul className="text-[14px] space-y-1">
          {[...lost.slice(0, 5), ...live.slice(0, 25)].map((b) => (
            <li key={b.source_url + b.target_url} className="flex flex-wrap gap-x-2">
              {b.lost_at && <span className="s-chip s-chip--bad">lost</span>}
              <a className="underline" href={b.source_url} target="_blank" rel="noopener noreferrer">
                {host(b.source_url)}
              </a>
              <span className="s-faint truncate">→ {b.target_url.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
              {b.anchor && <span className="s-faint">“{b.anchor}”</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card card-body space-y-2">
        <h2 className="section-title">Competitors</h2>
        <p className="s-dim text-[13px]">One site address per line. Every Thursday their new articles are read; topics you haven&apos;t covered become ideas.</p>
        <textarea className="s-input w-full font-mono text-[13px]" rows={4} value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder="https://competitor.example" />
        <button
          type="button"
          className="s-btn s-btn--sm s-btn--primary"
          disabled={busy || preview}
          onClick={() =>
            run("Competitors saved", () =>
              saveSetting(
                "competitors",
                competitors
                  .split(/\s+/)
                  .map((s) => s.trim())
                  .filter((s) => /^https?:\/\/[^\s/]+\.[^\s/]+/.test(s))
                  .slice(0, 10),
              ),
            )
          }
        >
          Save competitors
        </button>
        {data.competitorPages.length > 0 && (
          <ul className="text-[13px] space-y-1 pt-2">
            {data.competitorPages.slice(0, 10).map((p) => (
              <li key={p.url}>
                <span className="s-faint">{host(p.competitor)} · {formatDate(p.first_seen)}</span> — {p.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card card-body space-y-2">
        <h2 className="section-title">Business details (local SEO)</h2>
        <p className="s-dim text-[13px]">Exactly as on the Google Business Profile. Each month the site is checked to show the same name, address and phone.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className="s-input" placeholder="Business name" value={local.name} onChange={(e) => setLocal({ ...local, name: e.target.value })} />
          <input className="s-input" placeholder="Street, city" value={local.address} onChange={(e) => setLocal({ ...local, address: e.target.value })} />
          <input className="s-input" placeholder="Phone" value={local.phone} onChange={(e) => setLocal({ ...local, phone: e.target.value })} />
        </div>
        <button type="button" className="s-btn s-btn--sm s-btn--primary" disabled={busy || preview} onClick={() => run("Business details saved", () => saveSetting("local_profile", local))}>
          Save details
        </button>
        {data.localPosts.length > 0 && (
          <p className="s-faint text-[13px]">
            Business Profile posts: {data.localPosts.filter((p) => p.status === "posted").length} posted
            {data.localPosts.some((p) => p.status === "failed") ? ` · last error: ${data.localPosts.find((p) => p.status === "failed")?.detail}` : ""}
          </p>
        )}
      </section>
    </div>
  );
}

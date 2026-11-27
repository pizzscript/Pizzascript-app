"use client";

import Link from "next/link";
import { approveBatch, runAgent } from "@/app/actions";
import type { Batch } from "@/lib/studio/types";
import { AutoPickToggle } from "./AutoPickToggle";
import { AutopilotToggle } from "./AutopilotToggle";
import { ResearchToggle } from "./ResearchToggle";
import { useStudio } from "./StudioProvider";
import { PageHead } from "./ui";

interface Props {
  autopilot: boolean;
  autoPick: { enabled: boolean; pausedReason: string | null };
  research: Record<string, unknown> & { enabled: boolean };
  batches: Batch[];
  profileApproved: boolean;
}

/** One step of the automatic pipeline: what it does, in order, with its switch. */
function Step({ n, title, text, children }: { n: number; title: string; text: string; children?: React.ReactNode }) {
  return (
    <section className="card card-body grid gap-4 sm:grid-cols-[32px_minmax(0,1fr)]" aria-labelledby={`step-${n}`}>
      <span className="grid place-items-center w-8 h-8 rounded-full text-[13px] font-semibold" style={{ background: "var(--s-accent-soft)", color: "var(--s-accent)" }} aria-hidden="true">
        {n}
      </span>
      <div className="min-w-0 space-y-3">
        <div>
          <h2 id={`step-${n}`} className="section-title">
            {title}
          </h2>
          <p className="s-dim mt-1 max-w-[68ch]">{text}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

export function AutomationView({ autopilot, autoPick, research, batches, profileApproved }: Props) {
  const { run, busy } = useStudio();
  return (
    <div className="space-y-4 max-w-[900px]">
      <PageHead title="Automation" sub="What runs on its own, in the order it happens. Each step has its own switch.">
        <button type="button" className="s-btn" disabled={busy} onClick={() => run("Agent started", () => runAgent())}>
          Run agent now
        </button>
      </PageHead>

      <Step
        n={1}
        title="Research profile"
        text="Everything below follows the client's approved research profile: what they sell, to whom and where, and the topic groups (auto, boost or mandatory)."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className={`s-chip ${profileApproved ? "s-chip--ok" : "s-chip--warn"}`}>{profileApproved ? "Approved" : "Not approved yet: research waits"}</span>
          <Link href="/clients?tab=profile" className="s-btn s-btn--sm">
            Edit profile and topic groups
          </Link>
        </div>
      </Step>

      <Step
        n={2}
        title="Idea research"
        text="Each morning it looks up phrases built from the profile in Google suggestions, Search Console, People also ask and Reddit/Quora, reads recent reviews, and keeps ideas that fit. With “Review ideas first” on, nothing is written until you mark an idea OK on the Ideas page."
      >
        <ResearchToggle settings={research} />
      </Step>

      <Step n={3} title="Auto-pick" text="Once a day it picks the best approved idea, balancing your topic groups, and schedules it at least 3 days ahead so you can still remove it. It pauses itself after 2 failed articles in a row.">
        <AutoPickToggle enabled={autoPick.enabled} autopilot={autopilot} pausedReason={autoPick.pausedReason} />
      </Step>

      <Step n={4} title="Autopilot" text="Every scheduled post is written, gets a banner, is quality-checked and published on its date. A post that fails the check doesn't publish; it shows up on the dashboard instead.">
        <AutopilotToggle enabled={autopilot} />
      </Step>

      <Step n={5} title="Batches" text="With Autopilot off, approving a batch does the same for just that batch: its posts are prepared one by one and publish on their dates if they pass.">
        {batches.length === 0 ? (
          <p className="s-faint">No batches yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--s-line)]">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
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
      </Step>
    </div>
  );
}

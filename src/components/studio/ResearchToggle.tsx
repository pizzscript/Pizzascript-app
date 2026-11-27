"use client";

import { Search, ShieldCheck } from "lucide-react";
import { saveSetting } from "@/app/actions";
import { useStudio } from "./StudioProvider";

/** Daily idea research: finds and checks new ideas each morning, and cleans the idea list weekly. */
export function ResearchToggle({ settings }: { settings: Record<string, unknown> & { enabled: boolean } }) {
  const { run, busy } = useStudio();
  // Unset means on: Auto-pick writes only ideas marked "OK for Auto-pick" unless this is switched off.
  const review = settings.requireApproval !== false;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={settings.enabled}
        disabled={busy}
        className={`s-btn ${settings.enabled ? "s-btn--primary" : ""}`}
        onClick={() => run(settings.enabled ? "Research off" : "Research on", () => saveSetting("research", { ...settings, enabled: !settings.enabled }))}
      >
        <Search size={16} aria-hidden="true" /> Idea research: {settings.enabled ? "On" : "Off"}
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={review}
        disabled={busy}
        className={`s-btn ${review ? "s-btn--primary" : ""}`}
        onClick={() => {
          if (review && !window.confirm("Let Auto-pick write ideas you haven't reviewed?\n\nIt will choose from every idea that clears the score, without waiting for your OK.")) return;
          run(review ? "Ideas no longer need your OK" : "Ideas need your OK again", () => saveSetting("research", { ...settings, requireApproval: !review }));
        }}
      >
        <ShieldCheck size={16} aria-hidden="true" /> Review ideas first: {review ? "On" : "Off"}
      </button>
    </div>
  );
}

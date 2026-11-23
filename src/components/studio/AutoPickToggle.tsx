"use client";

import { Sparkles } from "lucide-react";
import { setAutoPick } from "@/app/admin/actions";
import { useStudio } from "./StudioProvider";

const CONFIRM_ON =
  "Turn Auto-pick on?\n\nEach day the agent can choose one qualified idea, schedule it at least 3 days ahead, write it and publish it on that date if it passes every check. This uses your Gemini quota.";
const CONFIRM_OFF = "Turn Auto-pick off?\n\nThe agent stops choosing new ideas. Posts already scheduled stay on the calendar.";

/** Lets the agent choose its own ideas. Separate from Autopilot, and needs Autopilot on to do anything. */
export function AutoPickToggle({ enabled, autopilot, pausedReason }: { enabled: boolean; autopilot: boolean; pausedReason: string | null }) {
  const { run, busy } = useStudio();
  return (
    <div className="space-y-2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={busy || (!enabled && !autopilot)}
        className={`s-btn ${enabled ? "s-btn--primary" : ""}`}
        onClick={() => {
          if (!window.confirm(enabled ? CONFIRM_OFF : CONFIRM_ON)) return;
          run(enabled ? "Auto-pick off" : "Auto-pick on", () => setAutoPick(!enabled));
        }}
      >
        <Sparkles size={16} aria-hidden="true" /> Auto-pick: {enabled ? (pausedReason ? "Paused" : "On") : "Off"}
      </button>
      {!autopilot && <p className="s-faint text-[13px]">Turn on Autopilot first.</p>}
      {pausedReason && <p className="s-faint text-[13px]">Paused: {pausedReason}. Turn it off and on again after checking those articles.</p>}
    </div>
  );
}

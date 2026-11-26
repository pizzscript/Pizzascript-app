"use client";

import { Bot } from "lucide-react";
import { setAutopilot } from "@/app/actions";
import { useStudio } from "./StudioProvider";

const CONFIRM_ON =
  "Turn autopilot on?\n\nEvery scheduled post will be written, get a banner, be quality-checked and published on its date automatically — no approvals. This uses your Gemini quota.";
const CONFIRM_OFF = "Turn autopilot off?\n\nNothing will publish until you approve it.";

/** Global autopilot switch. Asks before changing, because turning it on starts writing and publishing on its own. */
export function AutopilotToggle({ enabled, size = "md" }: { enabled: boolean; size?: "sm" | "md" }) {
  const { run, busy } = useStudio();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={busy}
      className={`s-btn ${size === "sm" ? "s-btn--sm" : ""} ${enabled ? "s-btn--primary" : ""}`}
      onClick={() => {
        if (!window.confirm(enabled ? CONFIRM_OFF : CONFIRM_ON)) return;
        run(enabled ? "Autopilot off" : "Autopilot on", () => setAutopilot(!enabled));
      }}
    >
      <Bot size={16} aria-hidden="true" /> Autopilot: {enabled ? "On" : "Off"}
    </button>
  );
}

"use client";

import { Search } from "lucide-react";
import { saveSetting } from "@/app/admin/actions";
import { useStudio } from "./StudioProvider";

/** Daily idea research: finds and checks new ideas each morning, and cleans the idea list weekly. */
export function ResearchToggle({ settings }: { settings: Record<string, unknown> & { enabled: boolean } }) {
  const { run, busy } = useStudio();
  return (
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
  );
}

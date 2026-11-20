import type { JobType } from "./types";

/** Short names for the agent's jobs, shown in toasts and the "Agent:" pill. Shared by server and client code. */
export const JOB_LABELS: Partial<Record<JobType, string>> = {
  daily_briefing: "Briefing",
  score_topic: "Scoring",
  write_brief: "Brief",
  write_draft: "Draft",
  rewrite: "Rewrite",
  generate_image: "Banner",
  run_audit: "Audit",
  insert_link: "Link",
  fix_title: "Title",
  discuss: "Agent reply",
};

export function jobLabel(type: JobType) {
  return JOB_LABELS[type] ?? type;
}

/** Quick, non-AI jobs: run them before anything slow so a 1-second check never waits behind minutes of drafting. */
const QUICK: JobType[] = ["run_audit", "publish_due", "insert_link"];

/**
 * Queue priority (higher runs first): quick checks, then chat replies, then what the admin clicked,
 * then autopilot/scheduled work.
 */
export function jobPriority(type: JobType, source: "admin" | "agent") {
  if (QUICK.includes(type)) return 8;
  if (type === "discuss") return 6;
  return source === "admin" ? 4 : 0;
}

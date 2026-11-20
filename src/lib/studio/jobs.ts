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

/** What the agent is doing, in words, for the activity panel. */
export const JOB_ACTIVITY: Partial<Record<JobType, string>> = {
  daily_briefing: "Preparing today's suggestion",
  score_topic: "Researching idea",
  write_brief: "Writing brief",
  write_draft: "Writing draft",
  rewrite: "Rewriting",
  generate_image: "Making banner",
  run_audit: "SEO check",
  publish_due: "Publishing",
  insert_link: "Adding link",
  fix_title: "Rewriting title",
  discuss: "Replying",
  quality_gate: "Quality check",
  performance_check: "Performance check",
};

export function jobActivity(type: JobType) {
  return JOB_ACTIVITY[type] ?? jobLabel(type);
}

/** Turns a raw job error (often a Gemini API JSON dump) into one plain sentence for the admin. */
export function friendlyJobError(error: string | null | undefined): string {
  const e = error ?? "";
  if (/limit: 0\b/.test(e)) return "this Gemini model isn't available on your API key (free keys can't generate images).";
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(e)) return "Gemini's free quota is used up for now. It resets daily — try again later (see Settings → AI usage).";
  if (/503|UNAVAILABLE|overloaded|high demand/i.test(e)) return "Gemini is overloaded right now. Try again in a few minutes.";
  if (/API key|PERMISSION_DENIED|401|403/i.test(e)) return "Gemini rejected the API key. Check GEMINI_API_KEY.";
  if (/fetch failed|ECONNRESET|ETIMEDOUT|timeout/i.test(e)) return "couldn't reach Gemini (network). It will retry.";
  return e.length > 160 ? `${e.slice(0, 160)}…` : e || "unknown error";
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

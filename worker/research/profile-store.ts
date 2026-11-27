import { PROFILE_KEYS, type ResearchProfile } from "../../src/lib/studio/research-profile";
import { setting } from "../db";

/** The current client's approved research profile, or null when none has been approved yet. Research waits for it. */
export async function approvedResearchProfile(): Promise<ResearchProfile | null> {
  const saved = await setting<ResearchProfile | null>(PROFILE_KEYS.approved, null);
  return saved && saved.status === "approved" ? saved : null;
}

export const draftResearchProfile = () => setting<ResearchProfile | null>(PROFILE_KEYS.draft, null);

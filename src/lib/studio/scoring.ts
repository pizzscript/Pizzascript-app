import { SCORE_FACTORS, type Priority, type ScoringSettings, type Topic, type TopicScores, type Track } from "./types";

export const DEFAULT_SCORING: ScoringSettings = {
  base: { authority: 0.28, intent: 0.22, volume: 0.2, backlink: 0.15, difficulty: 0.1, internalLink: 0.05 },
  track1: { authority: 0.2, volume: 0.28 },
  track2: { authority: 0.33, volume: 0.12 },
  priority: { P1: 75, P2: 60, P3: 45 },
};

/**
 * Track overrides are applied, then weights are normalised to sum to 1. AGENT.md's Track 2 modifier
 * (authority 0.33, volume 0.12) sums to 0.97, which would cap Track 2 scores below Track 1.
 */
export function weightsFor(track: Track, settings: ScoringSettings = DEFAULT_SCORING) {
  const raw = { ...settings.base, ...(track === 1 ? settings.track1 : settings.track2) };
  const total = SCORE_FACTORS.reduce((sum, f) => sum + raw[f], 0) || 1;
  return Object.fromEntries(SCORE_FACTORS.map((f) => [f, raw[f] / total])) as Record<(typeof SCORE_FACTORS)[number], number>;
}

/** AGENT.md Part 7 formula. Difficulty is inverted: easier queries score higher. */
export function computeScore(scores: TopicScores, track: Track, settings: ScoringSettings = DEFAULT_SCORING) {
  const weights = weightsFor(track, settings);
  let total = 0;
  const parts: { factor: (typeof SCORE_FACTORS)[number]; value: number; weight: number; points: number }[] = [];
  for (const factor of SCORE_FACTORS) {
    const raw = scores[factor]?.value ?? 0;
    const value = factor === "difficulty" ? 100 - raw : raw;
    const points = value * weights[factor];
    parts.push({ factor, value, weight: weights[factor], points });
    total += points;
  }
  return { score: Math.round(total * 10) / 10, parts };
}

export function priorityFor(score: number, settings: ScoringSettings = DEFAULT_SCORING): Priority {
  if (score >= settings.priority.P1) return "P1";
  if (score >= settings.priority.P2) return "P2";
  if (score >= settings.priority.P3) return "P3";
  return "P4";
}

export function filtersPass(topic: Pick<Topic, "filters">) {
  const values = Object.values(topic.filters);
  return values.length === 5 && values.every((f) => f?.pass);
}

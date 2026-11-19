// Sanity checks for the shared studio logic against the seed dataset. Run: npx tsx scripts/check-studio-logic.ts
import assert from "node:assert/strict";
import seed from "../supabase/seed/studio.json";
import { composeBriefing } from "../src/lib/studio/briefing";
import { auditPost, funnelViolations, internalLinks, joinSections, splitSections } from "../src/lib/studio/content";
import { computeScore, priorityFor } from "../src/lib/studio/scoring";
import type { StudioPost } from "../src/lib/studio/types";

const posts = seed.posts as unknown as StudioPost[];
const live = posts.filter((p) => p.stage === "live");

for (const post of live) {
  const sections = splitSections(post.body_html);
  assert.equal(joinSections(sections).replace(/\s+/g, ""), post.body_html.replace(/\s+/g, ""), `${post.slug}: split/join must be lossless`);
  assert.ok(sections.length >= 2, `${post.slug}: expected h2 sections`);
}

const audits = live.map((p) => ({ slug: p.slug, audit: auditPost(p, { posts, bannedPhrases: ["in conclusion", "comprehensive guide"], wordRange: [500, 4000] }) }));
for (const { slug, audit } of audits) {
  const failing = audit.checks.filter((c) => !c.pass).map((c) => `${c.id}${c.detail ? `(${c.detail})` : ""}`);
  console.log(`${slug.padEnd(34)} ${failing.length ? failing.join(", ") : "pass"}`);
}

const ai = live.find((p) => p.slug === "ai-assisted-web-development")!;
assert.ok(funnelViolations(ai, posts).some((v) => v.includes("in-depth guide")), "T1 linking only to a T1 spoke must be flagged");

const links = internalLinks('<p><a href="https://www.pizzascript.com/blog/x#y">X</a> <a href="https://example.com">ext</a></p>');
assert.deepEqual(links, [{ href: "/blog/x", text: "X" }]);

const scores = {
  authority: { value: 80, reason: "" },
  intent: { value: 70, reason: "" },
  volume: { value: 60, reason: "" },
  backlink: { value: 40, reason: "" },
  difficulty: { value: 30, reason: "" },
  internalLink: { value: 90, reason: "" },
};
const t1 = computeScore(scores, 1);
const t2 = computeScore(scores, 2);
for (const result of [t1, t2]) {
  assert.ok(Math.abs(result.parts.reduce((s, p) => s + p.weight, 0) - 1) < 0.001, "track weights must sum to 1 (AGENT.md Part 7)");
}
assert.ok(Math.abs(t1.parts.find((p) => p.factor === "volume")!.weight - 0.28) < 0.001);
assert.ok(t2.parts.find((p) => p.factor === "authority")!.weight > t1.parts.find((p) => p.factor === "authority")!.weight);
console.log(`\nscore T1 ${t1.score} (${priorityFor(t1.score)}) · T2 ${t2.score} (${priorityFor(t2.score)})`);

const briefing = composeBriefing("2026-11-18", {
  posts,
  signals: [],
  clusters: seed.clusters as never,
  topics: seed.topics as never,
  batches: seed.batches as never,
});
console.log(`briefing: ${briefing.content.recommendation.text}`);
console.log("\nall checks passed");

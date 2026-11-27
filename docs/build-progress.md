# Build progress (local only — nothing applied or deployed)

Rules: build and test locally; no push, no live database change, no deploy until the owner approves.
Lab: `../pizzascript-review-lab` (copy `worker`, `src`, `supabase` over before running). Local Postgres tests:
`npx tsx lab/sql/migrations.mts` (PGlite, all migrations + per-phase `lab/sql/phase-*.mts`).

| Phase | State | Migration | Tests |
|---|---|---|---|
| 1A schema | live (applied 24 Nov) | 20261129 | lab/workspaces.mts |
| 1B worker scoping | built locally | 20261130 | lab/workspaces.mts |
| 1C remove hard-coding | built locally | — | lab/profile.mts (prompts word-for-word, banners pixel-identical) |
| 1D plans and budgets | built locally | 20261201 | lab/plans.mts, lab/sql/migrations.mts |
| 1E clients admin | built locally | 20261202 | lab/sql/phase-1e.mts |
| 2 publishing (feed + embed) | built locally | 20261203 | lab/publishing.mts |
| 0 review fixes | built locally | — | (prompt change; real test needs quota) |
| 3 monthly report (email alerts dropped) | built locally | — | page loads in preview |
| 4 site health crawler | built locally | 20261204 | lab/modules.mts |
| 5–6 speed, indexing, rankings | built locally | 20261205 | lab/modules.mts |
| 7 content growth | built locally | — | lab/modules.mts |
| 8–10 backlinks, competitors, local | built locally | 20261206 | lab/modules.mts (competitors) |
| 11 setup checklist, client portal | built locally | — | build + preview |

Final local run (24 Nov): 152 worker tests + 276 matrix cases + 20 database tests pass; typecheck, lint,
check:studio and production build pass; new admin pages load in preview mode.

Apply order when approved: deploy 1B–1C code first (works on the current schema), then 20261130, 20261201, 20261202
(20261202 only after the 1B code is live), then 20261203–20261206 in order.

Decisions taken while building (owner can change):
- Default client plan: Starter (4 articles/month, 60 AI requests/day, research twice a week, site health, speed, reports).
- New clients: approval "you approve", Autopilot and Auto-pick off.
- Shared keys (Bright Data, Jina, GitHub, email, PageSpeed) are set on PizzaScript only; Gemini, Search Console account,
  Bing and alert address can be per client or shared; site-specific ones (Search Console property, WordPress,
  Business Profile) are per client and never fall back to PizzaScript's.
- Client categories get ids prefixed with the client's short name (category ids are global).
- Client articles stay in Supabase; client sites show them with /embed/blog.js (or a server fetch of /api/feed/<client>).
  No WordPress push, no hosted blog. Email alerts dropped for now (owner, 24 Nov).
- From Phase 4 on: quick checks (typecheck + lint) per phase, full tests at the end (owner, 24 Nov).

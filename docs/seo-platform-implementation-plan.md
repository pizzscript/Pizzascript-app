# PizzaScript SEO Platform — Implementation Plan

Status: approved direction, not yet implemented. Written 24 Nov 2026 (IST). Free tier first; paid AI and data later.

## 1. Goal

Turn the PizzaScript content agent into a multi-client SEO automation platform. For each client it researches, writes,
checks, publishes, monitors and reports, within limits you set. PizzaScript is client #1 and the pilot for every feature.

**Success means:** a new client can be set up in about 10 minutes, receives the agreed number of articles each month
without manual rescue, and gets a monthly report covering content, technical health, rankings and links.

## 2. Where we are (24 Nov 2026)

| Area | State |
|---|---|
| Writing, banners, review, repair, publishing | Live, single site |
| Supabase 10-minute timer + GitHub backup doorbell | Live, tested |
| GitHub heavy jobs (banners) with Render fallback | Live, tested |
| Auto-pick (1 idea/day, scheduled 3+ days ahead) | Live, on |
| Daily idea research + weekly cleanup + service scan + intent routing | Live |
| Connections page (service keys in Vault) | Live |
| Weak point | AI review blocks most articles; Gemini often overloaded |

## 3. Plan audit — what was wrong with the first draft, and the fix

| # | Problem found in the first plan | Risk | Fix in this plan |
|---|---|---|---|
| 1 | Article reviews block almost everything | No output, so nothing else matters | Phase 0 makes review reliability a hard gate before new building |
| 2 | "Client foundation" was one huge step | Long, risky change to every table | Split into 1A–1E, each shippable and reversible |
| 3 | Client publishing came after all SEO modules | Clients get no value for months | Publishing moved to Phase 2 |
| 4 | Alerts only in the admin panel | Silent failures with paying clients | Email alerts and monthly reports moved to Phase 3, before modules |
| 5 | Shared free Gemini quota for all clients | One client starves another | Per-client AI budget and optional per-client key in Phase 1D |
| 6 | Code still hard-codes PizzaScript (identity, feeds, services, logos, banners) | Wrong content for clients | Inventory and removal in Phase 1C |
| 7 | Public GitHub repo receives job runs | Client info could leak in logs | Only IDs in logs (already), plus a decision to make the repo private before client #2 |
| 8 | Free-tier capacity not calculated | Over-selling | Capacity table (section 6) and plan limits enforced in code |
| 9 | No offboarding or data deletion | Legal and trust risk (India DPDP Act) | Export and delete per client in Phase 1E |
| 10 | Google Business Profile API needs approval with long lead time | Phase blocked late | Apply for access now; build it last |
| 11 | Crawler politeness not specified | Getting blocked, harming client sites | robots.txt, rate limits, same-site only (Phase 4) |
| 12 | Test harness is single-site | Isolation bugs ship | Lab harness gains workspaces in 1A; cross-client leak tests required |
| 13 | No rollback plan for migrations | Broken production | Every migration: dry-run in a rolled-back transaction, backup, down-script |
| 14 | Billing implied but unplanned | Scope creep | Manual invoicing until Phase 12 |
| 15 | Default approval mode unclear | AI publishing on a client's site unchecked | New clients default to "you approve"; automatic only by choice |

## 4. Target architecture

```text
Workspace (client) ── settings, plan, connections, budgets
   │
   ├── Research ── ideas pool ── Auto-pick ── calendar
   ├── Content ── brief → draft → banner → review/repair → approval → publish (own blog or client CMS)
   ├── Monitor ── site health · speed · indexing · rankings · links · competitors · local
   └── Report  ── alerts (email + admin) · monthly report
Shared engine: Supabase (data, Vault, timer) · Render (worker + admin) · GitHub (heavy jobs) · Gemini (AI)
```

Principles:
- **Isolation by default.** Every client-owned row has `workspace_id`; Row Level Security enforces it; the worker always
  passes a workspace explicitly. No global queries in client code paths.
- **Modules are switches.** Each SEO feature is a module enabled per workspace, with its own schedule and budget.
- **Free first, paid pluggable.** Every external service sits behind a Connections entry, so a paid provider replaces a
  free one without code changes.
- **Safe by default.** Nothing publishes unless every check passes and the workspace's approval mode allows it.

## 5. Data model changes (summary)

| Table | Change |
|---|---|
| `workspaces` (new) | id, name, site_url, cms (`hosted`/`wordpress`/`webflow`/`shopify`), location, language, timezone, status, approval_mode, plan (jsonb), created_at |
| `workspace_members` (new) | workspace_id, user email, role (`owner`/`editor`/`client_viewer`) |
| Existing: posts, topics, clusters, jobs, signals, settings, facts, batches, link_plan, post_versions, content_embeddings, briefings, ai_calls, doorbell_log, connections, connection_log | Add `workspace_id` (not null after backfill), indexes on `(workspace_id, …)`, RLS policies by membership |
| `settings` | Primary key becomes `(workspace_id, key)`; global settings use a reserved platform workspace |
| `connections` / Vault | Secret names become `conn:<workspace>:<name>` |
| `usage_ledger` (new) | workspace_id, day, module, ai_requests, articles, crawl_pages — for plan limits and reports |
| `crawl_pages`, `crawl_issues` (new, Phase 4) | URL, status, issue type, first/last seen |
| `metrics_daily` (new, Phases 5–6) | workspace_id, url, date, metric, value (speed, clicks, impressions, position) |
| `backlinks` (new, Phase 8) | source URL, target URL, anchor, first/last seen, status |

`claim_job()` and `agent_doorbell()` become workspace-aware with fair scheduling (section 7).

## 6. Free-tier capacity (planning numbers)

| Resource | Free limit (approx.) | What it supports |
|---|---|---|
| Gemini writer models | ~20 requests/day each (3 models) | ~1–3 articles/day across all clients |
| Gemini light models | ~1,000 requests/day | Research for many clients |
| Antigravity | 100/day | Unreliable today; treat as bonus |
| Render free | 512 MB, sleeps after 15 min, 750 h/month | One worker; ~310 MB peak today |
| Supabase free | 500 MB database, 1 GB storage, pauses after long inactivity | A handful of small clients; banners are ~30 KB each |
| GitHub Actions | Unlimited while public; 2,000 min/month if private | Banners at ~1 min each |
| PageSpeed Insights API | ~25,000/day | Speed checks for all clients |
| Search Console URL Inspection | ~2,000/day per property | Indexing for each client |
| Bing Webmaster API | Free with daily limits | Keywords and backlinks |

**Rule:** sell no more articles than the AI budget allows. With the free Gemini key, plan for **at most ~30–60
articles/month total**. Above that, switch to paid Gemini (no code changes, Connections only).

## 7. Scheduling and fairness

- One worker processes jobs one at a time (memory-safe on 512 MB).
- `claim_job()` picks the next job by: priority (publish > repair/review > writing > research > monitoring), then the
  workspace that has used the smallest share of its monthly plan, then age.
- Daily per-workspace AI budget; when spent, that client's jobs wait until tomorrow; other clients continue.
- The Supabase timer wakes Render when any workspace has due work. GitHub stays as backup.

## 8. Phases

Sizes: S ≈ 1 session, M ≈ 2–3 sessions, L ≈ 4+ sessions. Each phase ships behind a switch and only after approval.

### Phase 0 — Stabilize (M) · gate for everything else
- Tune technical review: block only errors that would mislead a reader, with proof (source or test); everything else a
  warning. Cap issues per review; stop re-reviewing unchanged passages.
- Retry the 2 pending reviews; fix the review retry for far-dated drafts (currently waits until 48 h before).
- Research fixes: add "studio", "developer in [city]" to service intent; better duplicate detection via embeddings.
- Test Connections in production; add Jina and Search Console keys.
- Create Business Automation and Custom Software service pages.
- **Acceptance:** 3 consecutive real articles pass review and schedule without manual edits, using ≤ 12 AI requests each.

### Phase 1 — Multi-client foundation (L, split)
- **1A Schema and isolation:** `workspaces`, `workspace_members`, `workspace_id` everywhere, RLS, backfill PizzaScript,
  lab harness with two workspaces, cross-client leak tests. *Accept: no query returns another workspace's rows.*
- **1B Worker scoping:** every job carries `workspace_id`; all loaders and writes scoped; workspace-aware `claim_job`,
  doorbell and Auto-pick. *Accept: two test workspaces run a full article each without mixing.*
- **1C Remove hard-coding:** identity, audience, location, service pages, feeds, banned topics, banner logo/colors/fonts,
  categories and the site URL all come from workspace settings. *Accept: grep finds no PizzaScript-specific strings in
  shared code paths.*
- **1D Plans and budgets:** plan settings (articles/month, research level, modules, approval mode), usage ledger,
  per-workspace AI budget, optional per-workspace Gemini key in Connections. *Accept: a client hitting its limit stops;
  others continue.*
- **1E Admin and lifecycle:** client switcher, client list, create/pause/archive, export and delete all client data.
  *Accept: create → run → export → delete leaves no rows behind.*

### Phase 2 — Client publishing and approvals (M)
- Publishing connectors: **WordPress** (application password, REST API, categories, featured image, Yoast/RankMath
  meta), then **hosted blog** per client (subdomain or path). Webflow and Shopify later.
- Approval modes: you approve / client approves / automatic. Approval queue in admin.
- Retry and rollback: unpublish or revert from the version history.
- *Accept: a test WordPress site receives a full article with banner and meta; reverting works.*

### Phase 3 — Alerts and reports (M) · required before the first paying client
- Email alerts (free tier email provider, e.g. Resend or Brevo) for: missed publish, Auto-pick paused, Render not
  answering the doorbell, no successful AI request for 6 h, key expiring in 7 days, site down.
- Daily digest option instead of instant alerts.
- Monthly report per client (web page + PDF): articles published, rankings, clicks, health score, issues fixed.
- *Accept: a simulated failure produces an email within 15 minutes; a report generates for PizzaScript.*

### Phase 4 — Site health crawler (M)
- Crawl the client site weekly from its sitemap plus internal links (same domain only, obey robots.txt, ≤ 1 request/s,
  page cap per plan).
- Detect: 4xx/5xx, broken internal and outbound links, redirect chains and loops, missing/duplicate titles and meta,
  missing H1, canonical and noindex problems, sitemap errors, missing alt text, invalid structured data, mixed content.
- Health score with issues ranked by impact; auto-fix only for our own blog; client sites get a task list.
- *Accept: finds seeded broken links and duplicate titles on a test site; second crawl shows fixed vs new.*

### Phase 5 — Speed (S)
- PageSpeed Insights API (lab) + Chrome UX Report API (field) for key templates and top pages, weekly.
- Trend storage in `metrics_daily`; alert when a page drops a Core Web Vitals band.
- *Accept: 4 weeks of trend for PizzaScript; slowdown alert fires on a simulated drop.*

### Phase 6 — Indexing and rankings (M)
- Search Console: daily performance sync (queries, pages, positions), URL Inspection for new and changed pages.
- Bing Webmaster: keyword stats and inbound link data.
- Rank changes, newly indexed pages, pages excluded and why.
- *Accept: new posts show "indexed" or the reason within 7 days; ranking changes appear in alerts and the report.*

### Phase 7 — Content growth (M)
- Refresh queue: pages losing clicks or position; high impressions with low CTR → better title/meta suggestions.
- Internal linking: suggest and (for our blog) insert links; detect orphan pages.
- Feeds research (Phase 0 engine) with real Search Console queries once data exists.
- *Accept: refresh suggestions feed Auto-pick; orphan pages get at least one link.*

### Phase 8 — Backlinks (M)
- Monitor: Bing inbound links + Search Console links export; new, lost and suspicious links.
- Opportunities: unlinked brand mentions, resource pages, local directories, partner sites (AI with Google Search
  grounding, light budget).
- Outreach: AI drafts personalised emails; **a person approves and sends**. Never automatic sending.
- *Accept: monthly list of 10+ qualified opportunities per client with drafts.*

### Phase 9 — Competitors (S)
- Track 3–5 competitors per client via RSS and sitemaps; detect new pages and topic gaps; feed research.
- *Accept: weekly gap list with at least 3 relevant topics.*

### Phase 10 — Local SEO (M) · start the Google access request now
- Google Business Profile: posts from new articles, review alerts, business details consistency checks.
- Local citation consistency (name, address, phone) across major directories.
- *Accept: a profile post published from an article; review alert works.*

### Phase 11 — Client experience (M)
- Onboarding wizard: site, CMS, Search Console, Bing, plan, approval mode, automatic first scan.
- Client login (Supabase Auth) with view-only reports and approvals.
- *Accept: a new client is set up end to end in about 10 minutes.*

### Phase 12 — Paid upgrades (later)
- Paid Gemini or Claude API for writing and review; paid SEO data (Ahrefs/Semrush/DataForSEO) via Connections; billing.

## 9. Dependencies and order

```text
Phase 0 ──► 1A ► 1B ► 1C ► 1D ► 1E ──► 2 ──► 3 ──┬─► 4 ─► 5
                                                  ├─► 6 ─► 7
                                                  ├─► 8 ─► 9
                                                  └─► 10, 11 (parallel)  ──► 12
```
First paying client possible after Phase 3. Modules 4–10 can be added while clients are live.

## 10. Engineering rules for every phase

- Build and test in the local lab first with 0 AI quota (Claude plays the AI), then real tests with a request cap.
- Tests: unit tests for pure logic, scenario tests on the fake database, cross-workspace leak tests (from 1A on),
  typecheck, lint, production build.
- Migrations: dry-run inside a rolled-back transaction, backup affected tables, keep a down-script, apply before deploy.
- Deploy: never while a job is running; confirm queue empty; commit author only the owner; verify after deploy.
- Every module: switch in Settings, per-workspace budget, alerts on failure, entry in the monthly report.
- Secrets only in Vault/Connections; never in logs, code, GitHub inputs or chat.

## 11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Free Gemini too slow/unreliable for clients | High | Budget per client; paid Gemini or Claude API via Connections |
| Isolation bug leaks client data | Medium | RLS + leak tests + workspace-scoped helpers only |
| Render free sleeps or restarts mid-job | Medium | Heartbeats, hand-back, Supabase timer, paid instance when clients grow |
| Client CMS changes break publishing | Medium | Connector health checks, retries, alert on failure |
| Google API quota or approval delays | Medium | Apply early; degrade gracefully; cache results |
| Over-promising articles per month | Medium | Capacity table enforced by plan limits |
| Supabase free limits reached | Low–Medium | Usage ledger; upgrade before 70% use |

## 12. Open decisions (needed before Phase 1)

1. Make the GitHub repo private before client #2? (Recommended; costs GitHub minutes, ~1 min per banner.)
2. Which email provider for alerts (Resend or Brevo free tier)?
3. Hosted client blogs: subdomain on the client's domain, or a path on ours?
4. Default plan offered to clients (e.g. 4 articles/month, research + site health + speed).

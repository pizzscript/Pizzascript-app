# PizzaScript — Next.js app

The unified PizzaScript website (marketing site, `/freelance-pune`, blog) plus **Studio**, the admin control room
for the content agent, and the **agent worker** that runs on a GitHub Actions schedule.

Replaces the legacy `../website` (Vite SPA) and `../blogs/blog` (static HTML on `blog.pizzascript.com`); both stay
read-only for reference. The agent's rules come from `../blogs/automation/AGENT.md`.

## Stack

- Next.js 16 (App Router, Cache Components, Turbopack), React 19, TypeScript, Tailwind CSS 4
- GSAP ScrollTrigger + Lenis for scroll sequences, `next/font` for self-hosted fonts
- Supabase: Postgres (posts, studio state, job queue), Storage (images), Auth (admin magic link)
- Agent worker (`worker/`): Gemini (free API key) for writing/scoring/images, Google Search Console for signals

## Getting started

```bash
cp .env.example .env.local
npm install
npm run dev            # site on :3000, studio on /admin
```

Without Supabase keys everything still runs: the blog renders an empty state and `/admin` opens in **preview
mode** (read-only, data from `supabase/seed/studio.json`).

## One-time setup

1. **Supabase project.** Run both migrations in `supabase/migrations/` in order (SQL editor or `supabase db push`).
2. **Keys.** Fill `.env.local` (see `.env.example` for which key goes where).
3. **Admin user.** Supabase → Authentication → Users → *Invite user* with your email (sign-ups are disabled), and
   set `ADMIN_EMAIL` to the same address.
4. **Content.** `npm run migrate:blog` (posts + banners), then `npm run seed:studio -- --write` (clusters, topics,
   Batch 2 slots, link plan, facts, signals, admin email).
5. **Vercel.** Add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `REVALIDATE_SECRET`.
6. **GitHub Actions.** Repo → Settings → Secrets and variables → Actions. Add `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GSC_SERVICE_ACCOUNT_JSON`, `REVALIDATE_SECRET` as repo secrets.
   The schedule lives in `.github/workflows/agent.yml` (every 15 min; `workflow_dispatch` for manual runs).
7. **Search Console.** Add the service account's email as a user on the `pizzascript.com` property.

## Studio (`/admin`)

A plain CMS dashboard: Dashboard, Posts, Ideas, Calendar, Categories, Settings (see `src/components/studio/`).
`Ctrl K` jumps anywhere.

**Autopilot:** a slot publishes at 09:00 IST on its own only if it passed the audit **and** its batch (or the post
itself) is approved. Approved batches also draft/banner/audit tickets due in the next 3 days automatically.
Anything else raises a P0 "missed slot" signal on the Pass.

## Agent worker

`npm run worker` (always-on loop, for local use) or `npm run worker -- --once` (one pass: schedule + drain queue,
then exit — what GitHub Actions runs). `.github/workflows/agent.yml` runs `--once` every 15 minutes, free on
GitHub's Actions minutes; trigger a run manually any time from the Actions tab (`workflow_dispatch`).

Schedule (IST): 06:30 briefing (GSC sync → signals, trend scan, recommendation) · every run: publish due slots ·
every 30 min: advance approved batches · hourly: quality gate after every 5 drafts · Mondays: W4/W12 performance.

The admin never calls Gemini directly: it inserts rows into `jobs`, the worker claims them (`claim_job`, row
locks), and results appear in the admin on refresh. API keys live only as GitHub Actions repo secrets.

## Scripts

| Script | What it does |
| --- | --- |
| `dev` / `build` / `start` / `lint` / `typecheck` | Next.js + tooling |
| `migrate:blog` | Imports `../blogs/blog` posts + banners into Supabase (`-- --dry-run` to preview) |
| `seed:studio` | Converts `../blogs/automation` markdown into studio rows (`-- --write` to upsert) |
| `worker` | Runs the agent worker locally |
| `check:studio` | Sanity-checks scoring, audit, funnel and section logic against the seed data |
| `assets:import` / `css:import` | One-time imports from the legacy site |

## Deployment notes

- Scroll-animation frames stay on Cloudflare R2: put a custom domain in front of the bucket, set
  `Cache-Control: public, max-age=31536000, immutable`, and set `NEXT_PUBLIC_FRAMES_BASE_URL`.
- After DNS moves, redirect `blog.pizzascript.com/*` → `https://www.pizzascript.com/:path*` (permanent).
- Optional: a Supabase Database Webhook on `public.posts` → `POST /api/revalidate` with header
  `x-revalidate-secret` for instant updates from manual table edits (the worker already revalidates itself).

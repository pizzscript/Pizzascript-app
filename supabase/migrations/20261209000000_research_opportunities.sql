-- Client research: raw evidence behind idea suggestions (Search Console searches, Google suggestions, customer
-- questions, site gaps). One row per search and source, so repeat sightings add evidence instead of duplicates.
-- Removed with the client. Rollback: supabase/rollback/20261209000000_research_opportunities_down.sql

create table if not exists public.research_opportunities (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  query        text not null,
  source       text not null check (source in ('gsc', 'autocomplete', 'question', 'site_gap', 'feed', 'competitor')),
  evidence     jsonb not null default '{}'::jsonb,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  topic_id     uuid references public.topics (id) on delete set null,
  unique (workspace_id, query, source)
);
create index if not exists research_opportunities_ws_idx on public.research_opportunities (workspace_id, last_seen desc);

alter table public.research_opportunities enable row level security;
drop policy if exists "Members read research_opportunities" on public.research_opportunities;
create policy "Members read research_opportunities" on public.research_opportunities
  for select to authenticated using (public.can_access_workspace(workspace_id));
drop policy if exists "Admins manage research_opportunities" on public.research_opportunities;
create policy "Admins manage research_opportunities" on public.research_opportunities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

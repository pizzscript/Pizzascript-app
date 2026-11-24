-- Phase 4: site health crawler. Everything is per client and is removed with the client.
-- Rollback: supabase/rollback/20261204000000_site_health_down.sql

create table if not exists public.crawl_runs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running' check (status in ('running', 'done', 'failed')),
  pages        integer not null default 0,
  score        integer,
  -- Pages still to read, so a big site is crawled over several short runs.
  frontier     jsonb not null default '[]'::jsonb,
  summary      jsonb not null default '{}'::jsonb
);
create index if not exists crawl_runs_ws_idx on public.crawl_runs (workspace_id, started_at desc);

create table if not exists public.crawl_pages (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  run_id       uuid not null references public.crawl_runs (id) on delete cascade,
  url          text not null,
  status       integer not null,
  redirects    integer not null default 0,
  loop         boolean not null default false,
  ms           integer not null default 0,
  in_sitemap   boolean not null default false,
  facts        jsonb,
  crawled_at   timestamptz not null default now(),
  primary key (run_id, url)
);
create index if not exists crawl_pages_ws_idx on public.crawl_pages (workspace_id);

create table if not exists public.crawl_issues (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  url          text not null,
  type         text not null,
  detail       text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  fixed_at     timestamptz,
  primary key (workspace_id, url, type)
);
create index if not exists crawl_issues_open_idx on public.crawl_issues (workspace_id) where fixed_at is null;

do $$
declare
  t text;
begin
  foreach t in array array['crawl_runs', 'crawl_pages', 'crawl_issues'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Members read %1$s" on public.%1$I', t);
    execute format('create policy "Members read %1$s" on public.%1$I for select to authenticated using (public.can_access_workspace(workspace_id))', t);
    execute format('drop policy if exists "Admins manage %1$s" on public.%1$I', t);
    execute format('create policy "Admins manage %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end;
$$;

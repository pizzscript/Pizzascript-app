-- Phases 8–10: backlinks, link opportunities, competitor pages and local (Business Profile) posts. Per client, removed
-- with the client. Rollback: supabase/rollback/20261206000000_growth_modules_down.sql

create table if not exists public.backlinks (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source_url   text not null,
  target_url   text not null,
  anchor       text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  lost_at      timestamptz,
  primary key (workspace_id, source_url, target_url)
);

create table if not exists public.link_opportunities (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind         text not null,
  target       text not null,
  search       text,
  why          text,
  subject      text,
  draft        text,
  status       text not null default 'new' check (status in ('new', 'sent', 'won', 'dismissed')),
  created_at   timestamptz not null default now()
);
create index if not exists link_opportunities_ws_idx on public.link_opportunities (workspace_id, status, created_at desc);

create table if not exists public.competitor_pages (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  competitor   text not null,
  url          text not null,
  title        text,
  first_seen   timestamptz not null default now(),
  primary key (workspace_id, url)
);

create table if not exists public.local_posts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  post_id      uuid references public.posts (id) on delete set null,
  remote_name  text,
  status       text not null default 'posted' check (status in ('posted', 'failed')),
  detail       text,
  created_at   timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['backlinks', 'link_opportunities', 'competitor_pages', 'local_posts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Members read %1$s" on public.%1$I', t);
    execute format('create policy "Members read %1$s" on public.%1$I for select to authenticated using (public.can_access_workspace(workspace_id))', t);
    execute format('drop policy if exists "Admins manage %1$s" on public.%1$I', t);
    execute format('create policy "Admins manage %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end;
$$;

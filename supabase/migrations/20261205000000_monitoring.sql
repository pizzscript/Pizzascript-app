-- Phases 5–6: speed history and indexing checks, per client (removed with the client).
-- Rollback: supabase/rollback/20261205000000_monitoring_down.sql

create table if not exists public.metrics_daily (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  date         date not null,
  url          text not null,
  metric       text not null,
  value        double precision not null,
  primary key (workspace_id, date, url, metric)
);

create table if not exists public.url_inspections (
  id           bigserial primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  url          text not null,
  indexed      boolean not null,
  verdict      text,
  coverage     text,
  last_crawl   timestamptz,
  canonical    text,
  checked_at   timestamptz not null default now()
);
create index if not exists url_inspections_ws_idx on public.url_inspections (workspace_id, url, checked_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['metrics_daily', 'url_inspections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Members read %1$s" on public.%1$I', t);
    execute format('create policy "Members read %1$s" on public.%1$I for select to authenticated using (public.can_access_workspace(workspace_id))', t);
    execute format('drop policy if exists "Admins manage %1$s" on public.%1$I', t);
    execute format('create policy "Admins manage %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end;
$$;

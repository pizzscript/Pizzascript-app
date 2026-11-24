-- Phase 1D: plans, usage and budgets, and per-client connections.
-- - usage_ledger: AI requests, articles and crawled pages per client, day and module (plan limits and reports).
-- - ai_calls.key_owner: whose Gemini key a request used, so clients sharing PizzaScript's key share its quota.
-- - connections per client: Vault names 'conn:<name>' for PizzaScript (unchanged) and 'conn:<workspace>:<name>' for clients.
-- - claim_job: skips paused clients; among equal priorities, the client furthest behind its monthly plan goes first.
-- Rollback: supabase/rollback/20261201000000_plans_usage_down.sql

create table if not exists public.usage_ledger (
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  day           date not null,
  module        text not null,
  ai_requests   integer not null default 0,
  articles      integer not null default 0,
  crawl_pages   integer not null default 0,
  primary key (workspace_id, day, module)
);
alter table public.usage_ledger enable row level security;
drop policy if exists "Members read usage" on public.usage_ledger;
create policy "Members read usage" on public.usage_ledger for select to authenticated using (public.can_access_workspace(workspace_id));

-- Adds to a day's counters in one statement, so two workers never lose a count.
create or replace function public.add_usage(ws uuid, d date, mod text, ai integer default 0, art integer default 0, pages integer default 0)
returns void language sql security definer set search_path = public as $$
  insert into public.usage_ledger (workspace_id, day, module, ai_requests, articles, crawl_pages)
  values (ws, d, mod, ai, art, pages)
  on conflict (workspace_id, day, module) do update
    set ai_requests = public.usage_ledger.ai_requests + excluded.ai_requests,
        articles    = public.usage_ledger.articles + excluded.articles,
        crawl_pages = public.usage_ledger.crawl_pages + excluded.crawl_pages;
$$;
revoke execute on function public.add_usage(uuid, date, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.add_usage(uuid, date, text, integer, integer, integer) to service_role;

-- Backfill: today's numbers start from what ai_calls already recorded, so budgets are right on the first day.
insert into public.usage_ledger (workspace_id, day, module, ai_requests)
select workspace_id, (created_at at time zone 'Asia/Kolkata')::date, 'content', count(*)
  from public.ai_calls
 group by 1, 2
on conflict (workspace_id, day, module) do nothing;

alter table public.ai_calls add column if not exists key_owner uuid not null default public.default_workspace();
create index if not exists ai_calls_key_owner_idx on public.ai_calls (key_owner, created_at desc);

-- Connections per client.
alter table public.connections drop constraint if exists connections_pkey;
alter table public.connections add primary key (workspace_id, name);

create or replace function public.connection_names() returns text[]
language sql immutable as $$
  select array['gemini_api_key','gsc_service_account_json','gsc_site_url','bright_data_api_key','bright_data_serp_zone','jina_api_key','github_dispatch_token',
               'pagespeed_api_key',
               'bing_webmaster_api_key','gbp_oauth_json','gbp_location'];
$$;

-- Shared keys belong to PizzaScript only; a client may never set them.
create or replace function public.platform_connection_names() returns text[]
language sql immutable as $$
  select array['bright_data_api_key','bright_data_serp_zone','jina_api_key','github_dispatch_token','pagespeed_api_key'];
$$;

create or replace function public.conn_secret_name(ws uuid, conn text) returns text
language sql immutable as $$
  select case when ws = public.default_workspace() then 'conn:' || conn else 'conn:' || ws::text || ':' || conn end;
$$;

create or replace function public.check_connection_target(ws uuid, conn text) returns void
language plpgsql stable as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if not (conn = any(public.connection_names())) then raise exception 'Unknown connection'; end if;
  if ws <> public.default_workspace() and conn = any(public.platform_connection_names()) then raise exception 'This key is shared by all clients and is set on PizzaScript'; end if;
  if not exists (select 1 from public.workspaces where id = ws) then raise exception 'Unknown client'; end if;
end;
$$;

drop function if exists public.save_connection(text, text, text, text, timestamptz);
create or replace function public.save_connection(conn text, conn_value text, conn_shown text, conn_detail text, conn_expires timestamptz, ws uuid default public.default_workspace())
returns void language plpgsql security definer set search_path = public as $$
declare
  secret_id uuid;
  actor text := auth.jwt() ->> 'email';
begin
  perform public.check_connection_target(ws, conn);
  if conn_value is null or length(trim(conn_value)) < 2 then raise exception 'Empty value'; end if;
  select id into secret_id from vault.secrets where name = public.conn_secret_name(ws, conn);
  if secret_id is null then
    perform vault.create_secret(conn_value, public.conn_secret_name(ws, conn), 'Managed from the admin panel');
  else
    perform vault.update_secret(secret_id, conn_value);
  end if;
  insert into public.connections (workspace_id, name, shown, status, detail, expires_at, checked_at, updated_at, updated_by)
  values (ws, conn, conn_shown, 'ok', conn_detail, conn_expires, now(), now(), actor)
  on conflict (workspace_id, name) do update
    set shown = excluded.shown, status = 'ok', detail = excluded.detail, expires_at = excluded.expires_at,
        checked_at = now(), updated_at = now(), updated_by = excluded.updated_by;
  insert into public.connection_log (workspace_id, name, action, ok, detail, actor) values (ws, conn, 'replaced', true, conn_detail, actor);
end;
$$;

drop function if exists public.clear_connection(text);
create or replace function public.clear_connection(conn text, ws uuid default public.default_workspace())
returns void language plpgsql security definer set search_path = public as $$
declare
  secret_id uuid;
  actor text := auth.jwt() ->> 'email';
begin
  perform public.check_connection_target(ws, conn);
  select id into secret_id from vault.secrets where name = public.conn_secret_name(ws, conn);
  if secret_id is not null then perform vault.update_secret(secret_id, ''); end if;
  delete from public.connections where workspace_id = ws and name = conn;
  insert into public.connection_log (workspace_id, name, action, ok, detail, actor)
  values (ws, conn, 'cleared', true, case when ws = public.default_workspace() then 'Using the server setting again' else 'Cleared' end, actor);
end;
$$;

drop function if exists public.record_connection_check(text, boolean, text, timestamptz, text);
create or replace function public.record_connection_check(conn text, conn_ok boolean, conn_detail text, conn_expires timestamptz, conn_action text, ws uuid default public.default_workspace())
returns void language plpgsql security definer set search_path = public as $$
declare
  actor text := auth.jwt() ->> 'email';
begin
  perform public.check_connection_target(ws, conn);
  if conn_action = 'tested' then
    insert into public.connections (workspace_id, name, status, detail, expires_at, checked_at)
    values (ws, conn, case when conn_ok then 'ok' else 'failing' end, conn_detail, conn_expires, now())
    on conflict (workspace_id, name) do update
      set status = excluded.status, detail = excluded.detail, expires_at = coalesce(excluded.expires_at, public.connections.expires_at), checked_at = now();
  end if;
  insert into public.connection_log (workspace_id, name, action, ok, detail, actor) values (ws, conn, conn_action, conn_ok, left(conn_detail, 300), actor);
end;
$$;

drop function if exists public.connection_status();
create or replace function public.connection_status(ws uuid default public.default_workspace())
returns table (name text, shown text, status text, detail text, expires_at timestamptz, checked_at timestamptz, updated_at timestamptz, updated_by text, in_vault boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return query
    select n.name, c.shown, coalesce(c.status, 'unchecked'), c.detail, c.expires_at, c.checked_at, c.updated_at, c.updated_by,
           exists (select 1 from vault.decrypted_secrets s where s.name = public.conn_secret_name(ws, n.name) and length(s.decrypted_secret) > 0)
      from unnest(public.connection_names()) as n(name)
      left join public.connections c on c.name = n.name and c.workspace_id = ws;
end;
$$;

-- PizzaScript's (shared) values: unchanged; names with a workspace in them are never returned here.
create or replace function public.connection_values()
returns table (name text, value text)
language sql stable security definer set search_path = public as $$
  select substring(s.name from 6), s.decrypted_secret
    from vault.decrypted_secrets s
   where s.name like 'conn:%' and length(s.decrypted_secret) > 0 and substring(s.name from 6) = any(public.connection_names());
$$;

-- One client's own values (server only).
create or replace function public.connection_values_for(ws uuid)
returns table (name text, value text)
language sql stable security definer set search_path = public as $$
  select n.name, s.decrypted_secret
    from unnest(public.connection_names()) as n(name)
    join vault.decrypted_secrets s on s.name = 'conn:' || ws::text || ':' || n.name
   where ws <> public.default_workspace() and length(s.decrypted_secret) > 0 and not (n.name = any(public.platform_connection_names()));
$$;

revoke execute on function public.save_connection(text, text, text, text, timestamptz, uuid) from public, anon;
revoke execute on function public.clear_connection(text, uuid) from public, anon;
revoke execute on function public.record_connection_check(text, boolean, text, timestamptz, text, uuid) from public, anon;
revoke execute on function public.connection_status(uuid) from public, anon;
revoke execute on function public.connection_values() from public, anon, authenticated;
revoke execute on function public.connection_values_for(uuid) from public, anon, authenticated;
grant execute on function public.save_connection(text, text, text, text, timestamptz, uuid) to authenticated;
grant execute on function public.clear_connection(text, uuid) to authenticated;
grant execute on function public.record_connection_check(text, boolean, text, timestamptz, text, uuid) to authenticated;
grant execute on function public.connection_status(uuid) to authenticated;
grant execute on function public.connection_values() to service_role;
grant execute on function public.connection_values_for(uuid) to service_role;

-- Fair queue: paused or archived clients wait; within a priority, the client with the smallest share of its monthly
-- articles done goes first, then the oldest job.
create or replace function public.claim_job(worker_id text) returns setof public.jobs
language sql as $$
  update public.jobs
     set status = 'failed',
         finished_at = now(),
         error = coalesce(error, 'Worker stopped during this job 4 times')
   where status = 'running'
     and attempts >= 4
     and coalesce(heartbeat_at, started_at) < now() - interval '2 minutes';

  update public.jobs
     set status = 'running', started_at = now(), heartbeat_at = now(), attempts = attempts + 1, locked_by = worker_id
   where id = (
     select j.id from public.jobs j
       join public.workspaces w on w.id = j.workspace_id and w.status = 'active'
      where (j.status = 'queued' and j.run_after <= now())
         or (j.status = 'running' and j.attempts < 4 and coalesce(j.heartbeat_at, j.started_at) < now() - interval '2 minutes')
      order by j.priority desc,
               (select coalesce(sum(u.articles), 0) from public.usage_ledger u
                 where u.workspace_id = j.workspace_id
                   and u.day >= date_trunc('month', now() at time zone 'Asia/Kolkata')::date)::numeric
                 / greatest(coalesce((w.plan ->> 'articlesPerMonth')::int, 4), 1),
               j.created_at
      for update of j skip locked
      limit 1
   )
  returning *;
$$;
revoke execute on function public.claim_job(text) from public, anon, authenticated;

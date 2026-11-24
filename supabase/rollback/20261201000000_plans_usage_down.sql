-- Rollback of 20261201000000_plans_usage.sql. Restores the single-site connection functions and claim_job exactly as
-- they were (copied from 20261127000000_connections.sql and 20261125000000_job_safety_early_review.sql).
-- Client-owned keys are removed from Vault first, because the old functions only know PizzaScript's.

delete from vault.secrets where name ~ '^conn:[0-9a-f-]{36}:';
delete from public.connections where workspace_id <> public.default_workspace();
alter table public.connections drop constraint if exists connections_pkey;
alter table public.connections add primary key (name);

drop function if exists public.save_connection(text, text, text, text, timestamptz, uuid);
drop function if exists public.clear_connection(text, uuid);
drop function if exists public.record_connection_check(text, boolean, text, timestamptz, text, uuid);
drop function if exists public.connection_status(uuid);
drop function if exists public.connection_values_for(uuid);
drop function if exists public.check_connection_target(uuid, text);
drop function if exists public.conn_secret_name(uuid, text);
drop function if exists public.platform_connection_names();

create or replace function public.connection_names() returns text[]
language sql immutable as $$
  select array['gemini_api_key','gsc_service_account_json','gsc_site_url','bright_data_api_key','bright_data_serp_zone','jina_api_key','github_dispatch_token'];
$$;

create or replace function public.save_connection(conn text, conn_value text, conn_shown text, conn_detail text, conn_expires timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  secret_id uuid;
  actor text := auth.jwt() ->> 'email';
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if not (conn = any(public.connection_names())) then raise exception 'Unknown connection'; end if;
  if conn_value is null or length(trim(conn_value)) < 2 then raise exception 'Empty value'; end if;
  select id into secret_id from vault.secrets where name = 'conn:' || conn;
  if secret_id is null then
    perform vault.create_secret(conn_value, 'conn:' || conn, 'Managed from the admin panel');
  else
    perform vault.update_secret(secret_id, conn_value);
  end if;
  insert into public.connections (name, shown, status, detail, expires_at, checked_at, updated_at, updated_by)
  values (conn, conn_shown, 'ok', conn_detail, conn_expires, now(), now(), actor)
  on conflict (name) do update
    set shown = excluded.shown, status = 'ok', detail = excluded.detail, expires_at = excluded.expires_at,
        checked_at = now(), updated_at = now(), updated_by = excluded.updated_by;
  insert into public.connection_log (name, action, ok, detail, actor) values (conn, 'replaced', true, conn_detail, actor);
end;
$$;

-- Clearing blanks the stored value, so the server falls back to its own environment setting again.
create or replace function public.clear_connection(conn text)
returns void language plpgsql security definer set search_path = public as $$
declare
  secret_id uuid;
  actor text := auth.jwt() ->> 'email';
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if not (conn = any(public.connection_names())) then raise exception 'Unknown connection'; end if;
  select id into secret_id from vault.secrets where name = 'conn:' || conn;
  if secret_id is not null then perform vault.update_secret(secret_id, ''); end if;
  delete from public.connections where name = conn;
  insert into public.connection_log (name, action, ok, detail, actor) values (conn, 'cleared', true, 'Using the server setting again', actor);
end;
$$;

create or replace function public.record_connection_check(conn text, conn_ok boolean, conn_detail text, conn_expires timestamptz, conn_action text)
returns void language plpgsql security definer set search_path = public as $$
declare
  actor text := auth.jwt() ->> 'email';
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if not (conn = any(public.connection_names())) then raise exception 'Unknown connection'; end if;
  if conn_action = 'tested' then
    insert into public.connections (name, status, detail, expires_at, checked_at)
    values (conn, case when conn_ok then 'ok' else 'failing' end, conn_detail, conn_expires, now())
    on conflict (name) do update
      set status = excluded.status, detail = excluded.detail, expires_at = coalesce(excluded.expires_at, public.connections.expires_at), checked_at = now();
  end if;
  insert into public.connection_log (name, action, ok, detail, actor) values (conn, conn_action, conn_ok, left(conn_detail, 300), actor);
end;
$$;

create or replace function public.connection_status()
returns table (name text, shown text, status text, detail text, expires_at timestamptz, checked_at timestamptz, updated_at timestamptz, updated_by text, in_vault boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return query
    select n.name, c.shown, coalesce(c.status, 'unchecked'), c.detail, c.expires_at, c.checked_at, c.updated_at, c.updated_by,
           exists (select 1 from vault.decrypted_secrets s where s.name = 'conn:' || n.name and length(s.decrypted_secret) > 0)
      from unnest(public.connection_names()) as n(name)
      left join public.connections c on c.name = n.name;
end;
$$;

create or replace function public.connection_values()
returns table (name text, value text)
language sql stable security definer set search_path = public as $$
  select substring(s.name from 6), s.decrypted_secret
    from vault.decrypted_secrets s
   where s.name like 'conn:%' and length(s.decrypted_secret) > 0 and substring(s.name from 6) = any(public.connection_names());
$$;

revoke execute on function public.save_connection(text, text, text, text, timestamptz) from public, anon;
revoke execute on function public.clear_connection(text) from public, anon;
revoke execute on function public.record_connection_check(text, boolean, text, timestamptz, text) from public, anon;
revoke execute on function public.connection_status() from public, anon;
revoke execute on function public.connection_values() from public, anon, authenticated;
grant execute on function public.save_connection(text, text, text, text, timestamptz) to authenticated;
grant execute on function public.clear_connection(text) to authenticated;
grant execute on function public.record_connection_check(text, boolean, text, timestamptz, text) to authenticated;
grant execute on function public.connection_status() to authenticated;
grant execute on function public.connection_values() to service_role;

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
     select id from public.jobs
      where (status = 'queued' and run_after <= now())
         or (status = 'running' and attempts < 4 and coalesce(heartbeat_at, started_at) < now() - interval '2 minutes')
      order by priority desc, created_at
      for update skip locked
      limit 1
   )
  returning *;
$$;
revoke execute on function public.claim_job(text) from public, anon, authenticated;

drop index if exists public.ai_calls_key_owner_idx;
alter table public.ai_calls drop column if exists key_owner;
drop function if exists public.add_usage(uuid, date, text, integer, integer, integer);
drop table if exists public.usage_ledger;

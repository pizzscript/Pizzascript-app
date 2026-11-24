-- Phase 1E: client lifecycle. Run only after the Phase 1B code is live (it already writes per-client keys).
-- - Old site-wide unique rules go; the per-client ones from 1B stay (slugs, settings keys and briefings are per client).
-- - create_workspace(): a new client with safe defaults (owner approval, autopilot off) in one step.
-- - delete_workspace(): removes every row a client owns, its keys and the client itself. PizzaScript can't be deleted,
--   and a client must be archived first, so nothing is deleted by one mistaken click.
-- - track_event() counts PizzaScript's own pages only (client sites have their own analytics).
-- Rollback: supabase/rollback/20261202000000_clients_down.sql

alter table public.posts drop constraint if exists posts_slug_key;
alter table public.topics drop constraint if exists topics_slug_key;
alter table public.signals drop constraint if exists signals_dedupe_key_key;
alter table public.link_plan drop constraint if exists link_plan_from_slug_to_path_key;

alter table public.settings drop constraint if exists settings_pkey;
alter table public.settings add constraint settings_pkey primary key using index settings_workspace_key;
alter table public.briefings drop constraint if exists briefings_pkey;
alter table public.briefings add constraint briefings_pkey primary key using index briefings_workspace_date_key;
alter table public.gsc_daily drop constraint if exists gsc_daily_pkey;
alter table public.gsc_daily add constraint gsc_daily_pkey primary key using index gsc_daily_workspace_key;
alter table public.page_stats drop constraint if exists page_stats_pkey;
alter table public.page_stats add constraint page_stats_pkey primary key (workspace_id, date, path);

create or replace function public.track_event(event_path text, event_kind text default 'view')
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  clean text := nullif(regexp_replace(split_part(split_part(coalesce(event_path, ''), '?', 1), '#', 1), '(.)/$', '\1'), '');
  day date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if event_kind not in ('view', 'conversion') or clean is null or length(clean) > 140 then return; end if;
  if clean ~ '^/portfolio/[a-z0-9-]+$' then clean := '/portfolio/*'; end if;
  if not (
    clean in ('/', '/about', '/blog', '/services', '/portfolio', '/portfolio/*', '/freelance-pune',
              '/services/custom-website-development', '/services/business-websites', '/services/landing-page-development',
              '/services/website-redesign', '/services/seo-friendly-websites', '/services/website-maintenance',
              '/services/website-speed-optimization')
    or (clean like '/blog/%' and exists (select 1 from public.posts p where p.workspace_id = public.default_workspace() and p.stage = 'live' and p.slug = substr(clean, 7)))
  ) then
    return;
  end if;
  insert into public.page_stats (workspace_id, date, path, views, conversions)
  values (public.default_workspace(), day, clean, (event_kind = 'view')::int, (event_kind = 'conversion')::int)
  on conflict (workspace_id, date, path) do update
    set views = public.page_stats.views + excluded.views,
        conversions = public.page_stats.conversions + excluded.conversions;
end;
$$;
revoke execute on function public.track_event(text, text) from public;
grant execute on function public.track_event(text, text) to anon, authenticated;

-- Every table that holds a client's rows, children before parents (the order delete_workspace uses).
create or replace function public.workspace_tables() returns text[]
language sql immutable as $$
  select array['post_versions','content_embeddings','link_plan','signals','agent_messages','jobs','posts','topics','batches',
               'clusters','facts','briefings','settings','ai_calls','connection_log','connections','doorbell_log','gsc_daily','page_stats'];
$$;

create or replace function public.create_workspace(
  ws_slug text, ws_name text, ws_site text, ws_location text default null, ws_language text default 'en',
  ws_cms text default 'hosted', ws_approval text default 'owner', ws_plan jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  actor text := lower(auth.jwt() ->> 'email');
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if ws_slug !~ '^[a-z0-9][a-z0-9-]{1,38}$' then raise exception 'Use 2-39 lowercase letters, numbers and dashes for the short name'; end if;
  if ws_site !~ '^https://[^/\s]+\.[^/\s]+' then raise exception 'The site address must start with https://'; end if;
  insert into public.workspaces (slug, name, site_url, location, language, cms, approval_mode, plan)
  values (ws_slug, trim(ws_name), regexp_replace(ws_site, '/+$', ''), nullif(trim(coalesce(ws_location, '')), ''), coalesce(ws_language, 'en'), ws_cms, ws_approval, coalesce(ws_plan, '{}'::jsonb))
  returning workspaces.id into new_id;
  if actor is not null then
    insert into public.workspace_members (workspace_id, email, role) values (new_id, actor, 'owner') on conflict do nothing;
  end if;
  -- Safe defaults: nothing writes or publishes until you switch it on.
  insert into public.settings (workspace_id, key, value) values
    (new_id, 'schedule', '{"timezone":"Asia/Kolkata","publishAt":"09:00","briefingAt":"06:30","perDay":1}'),
    (new_id, 'autopilot', '{"enabled":false}'),
    (new_id, 'autopick', '{"enabled":false}'),
    (new_id, 'research', '{"enabled":true}');
  insert into public.clusters (id, name, audience, position, workspace_id)
  values (ws_slug || '-general', 'General', 'client', 1, new_id);
  return new_id;
end;
$$;

create or replace function public.delete_workspace(ws uuid, confirm_slug text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  t text;
  n integer;
  counts jsonb := '{}'::jsonb;
  w public.workspaces;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if ws = public.default_workspace() then raise exception 'PizzaScript itself can''t be deleted'; end if;
  select * into w from public.workspaces where id = ws;
  if w.id is null then raise exception 'Unknown client'; end if;
  if w.status <> 'archived' then raise exception 'Archive the client before deleting it'; end if;
  if w.slug <> confirm_slug then raise exception 'Type the client''s short name to confirm'; end if;
  foreach t in array public.workspace_tables() loop
    execute format('delete from public.%I where workspace_id = $1', t) using ws;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object(t, n);
  end loop;
  delete from vault.secrets where name like 'conn:' || ws::text || ':%';
  get diagnostics n = row_count;
  counts := counts || jsonb_build_object('keys', n);
  -- Tables added by later phases cascade from the client row.
  delete from public.workspaces where id = ws;
  return counts::json;
end;
$$;

revoke execute on function public.create_workspace(text, text, text, text, text, text, text, jsonb) from public, anon;
revoke execute on function public.delete_workspace(uuid, text) from public, anon;
grant execute on function public.create_workspace(text, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.delete_workspace(uuid, text) to authenticated;

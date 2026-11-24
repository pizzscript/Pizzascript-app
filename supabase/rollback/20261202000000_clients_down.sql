-- Rollback of 20261202000000_clients.sql. Only possible while PizzaScript is the only client, because the old site-wide
-- unique rules can't hold two clients' data. track_event is restored exactly (from 20261124000000_research_quality_analytics.sql).
do $$
begin
  if exists (select 1 from public.workspaces where id <> public.default_workspace()) then
    raise exception 'Delete the other clients first';
  end if;
end;
$$;

drop function if exists public.delete_workspace(uuid, text);
drop function if exists public.create_workspace(text, text, text, text, text, text, text, jsonb);
drop function if exists public.workspace_tables();

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
    or (clean like '/blog/%' and exists (select 1 from public.posts p where p.stage = 'live' and p.slug = substr(clean, 7)))
  ) then
    return;
  end if;
  insert into public.page_stats (date, path, views, conversions)
  values (day, clean, (event_kind = 'view')::int, (event_kind = 'conversion')::int)
  on conflict (date, path) do update
    set views = public.page_stats.views + excluded.views,
        conversions = public.page_stats.conversions + excluded.conversions;
end;
$$;
revoke execute on function public.track_event(text, text) from public;
grant execute on function public.track_event(text, text) to anon, authenticated;

alter table public.page_stats drop constraint if exists page_stats_pkey;
alter table public.page_stats add constraint page_stats_pkey primary key (date, path);
alter table public.gsc_daily drop constraint if exists gsc_daily_pkey;
create unique index if not exists gsc_daily_workspace_key on public.gsc_daily (workspace_id, date, page, query);
alter table public.gsc_daily add constraint gsc_daily_pkey primary key (date, page, query);
alter table public.briefings drop constraint if exists briefings_pkey;
create unique index if not exists briefings_workspace_date_key on public.briefings (workspace_id, date);
alter table public.briefings add constraint briefings_pkey primary key (date);
alter table public.settings drop constraint if exists settings_pkey;
create unique index if not exists settings_workspace_key on public.settings (workspace_id, key);
alter table public.settings add constraint settings_pkey primary key (key);

alter table public.link_plan add constraint link_plan_from_slug_to_path_key unique (from_slug, to_path);
alter table public.signals add constraint signals_dedupe_key_key unique (dedupe_key);
alter table public.topics add constraint topics_slug_key unique (slug);
alter table public.posts add constraint posts_slug_key unique (slug);

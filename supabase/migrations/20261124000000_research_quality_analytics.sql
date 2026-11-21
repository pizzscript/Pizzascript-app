-- Local-model embeddings (384 dimensions) for duplicate detection and related-post link suggestions.
create extension if not exists vector with schema extensions;

create table if not exists public.content_embeddings (
  owner_type text not null check (owner_type in ('post', 'topic')),
  owner_id uuid not null,
  content_hash text not null,
  embedding extensions.vector(384) not null,
  updated_at timestamptz not null default now(),
  primary key (owner_type, owner_id)
);
alter table public.content_embeddings enable row level security;

create or replace function public.match_content(query_embedding extensions.vector(384), exclude_id uuid, match_count int default 5)
returns table (owner_type text, owner_id uuid, similarity double precision)
language sql stable
set search_path = public, extensions
as $$
  select e.owner_type, e.owner_id, 1 - (e.embedding <=> query_embedding)
    from public.content_embeddings e
   where e.owner_id <> exclude_id
   order by e.embedding <=> query_embedding
   limit least(match_count, 25);
$$;
revoke execute on function public.match_content(extensions.vector, uuid, int) from public, anon, authenticated;

-- Daily counters per page: no cookies or personal data, and the row count stays bounded by the path allowlist below.
create table if not exists public.page_stats (
  date date not null,
  path text not null,
  views integer not null default 0,
  conversions integer not null default 0,
  primary key (date, path)
);
alter table public.page_stats enable row level security;
drop policy if exists "admins read page_stats" on public.page_stats;
create policy "admins read page_stats" on public.page_stats for select to authenticated using (public.is_admin());

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

-- Database size for the System Health panel.
create or replace function public.system_usage()
returns json
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not allowed';
  end if;
  return json_build_object('db_bytes', pg_database_size(current_database()));
end;
$$;
revoke execute on function public.system_usage() from public, anon;
grant execute on function public.system_usage() to authenticated;

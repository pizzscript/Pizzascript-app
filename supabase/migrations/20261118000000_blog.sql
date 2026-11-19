-- Blog content schema. Public visitors can read published posts only;
-- writes go through the service-role key (migration script, future automation/admin).

create type public.post_status as enum ('draft', 'published', 'archived');

create table public.posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status           public.post_status not null default 'draft',
  title            text not null,
  excerpt          text not null default '',
  body_html        text not null,
  cover_image_url  text,
  cover_image_alt  text,
  seo_title        text,
  seo_description  text,
  og_image_url     text,
  category         text,
  tags             text[] not null default '{}',
  reading_minutes  integer check (reading_minutes > 0),
  word_count       integer check (word_count > 0),
  -- Editorial/SEO planning data (target query, cluster, internal link plan). Never rendered.
  seo_plan         jsonb not null default '{}'::jsonb,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint published_posts_have_date check (status <> 'published' or published_at is not null)
);

create index posts_published_idx on public.posts (published_at desc) where status = 'published';

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

alter table public.posts enable row level security;

create policy "Published posts are public"
  on public.posts for select
  to anon, authenticated
  using (status = 'published' and published_at <= now());

-- Public bucket for blog imagery (banners, inline images).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  5242880,
  array['image/webp', 'image/avif', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

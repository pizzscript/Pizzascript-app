-- Business Profile management: posts you can see, edit, retry, skip or delete, your own posts, and reviews with
-- replies you approve. Only adds columns, values and a table; existing rows keep working.

alter table public.local_posts
  add column if not exists source     text not null default 'article',
  add column if not exists summary    text,
  add column if not exists photo_url  text,
  add column if not exists cta_type   text not null default 'LEARN_MORE',
  add column if not exists cta_url    text,
  add column if not exists attempts   integer not null default 0,
  add column if not exists posted_at  timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Rows from before this change were all attempts already made once.
update public.local_posts set attempts = 1 where attempts = 0 and status in ('posted', 'failed');
update public.local_posts set posted_at = created_at where posted_at is null and status = 'posted';

alter table public.local_posts drop constraint if exists local_posts_status_check;
alter table public.local_posts add constraint local_posts_status_check
  check (status in ('draft', 'queued', 'posted', 'failed', 'skipped', 'deleting', 'deleted'));
alter table public.local_posts drop constraint if exists local_posts_source_check;
alter table public.local_posts add constraint local_posts_source_check check (source in ('article', 'custom'));
alter table public.local_posts drop constraint if exists local_posts_cta_check;
alter table public.local_posts add constraint local_posts_cta_check
  check (cta_type in ('NONE', 'LEARN_MORE', 'BOOK', 'ORDER', 'SHOP', 'SIGN_UP', 'CALL'));

create table if not exists public.gbp_reviews (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null,
  reviewer     text,
  stars        integer,
  comment      text,
  review_time  timestamptz,
  reply        text,
  reply_time   timestamptz,
  draft_reply  text,
  reply_status text not null default 'none' check (reply_status in ('none', 'drafting', 'drafted', 'sending', 'sent', 'failed')),
  reply_error  text,
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, name)
);
create index if not exists gbp_reviews_ws_time_idx on public.gbp_reviews (workspace_id, review_time desc);

alter table public.gbp_reviews enable row level security;
drop policy if exists "Members read gbp_reviews" on public.gbp_reviews;
create policy "Members read gbp_reviews" on public.gbp_reviews for select to authenticated using (public.can_access_workspace(workspace_id));
drop policy if exists "Admins manage gbp_reviews" on public.gbp_reviews;
create policy "Admins manage gbp_reviews" on public.gbp_reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

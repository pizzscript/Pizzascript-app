-- Approving an idea marks its post to be carried through the whole pipeline (brief → draft → banner → SEO check)
-- without a click per step.
alter table public.posts add column if not exists auto_pipeline boolean not null default false;

-- One row per Gemini request (each retry counts — that's what the quota counts), for the usage panel.
-- quota_limit is the daily limit Google reports in a 429, when it does.
create table if not exists public.ai_calls (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  model text not null,
  kind text not null check (kind in ('text', 'json', 'image')),
  ok boolean not null,
  error text,
  quota_limit integer
);
create index if not exists ai_calls_created_at_idx on public.ai_calls (created_at desc);

alter table public.ai_calls enable row level security;
drop policy if exists "admins read ai_calls" on public.ai_calls;
create policy "admins read ai_calls" on public.ai_calls for select to authenticated using (public.is_admin());

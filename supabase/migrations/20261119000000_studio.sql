-- Studio: the admin control room + automation worker state.
-- Replaces the markdown state in blogs/automation (BRAIN, QUEUE, CLUSTERS, BATCH/*, KEYWORDS/*, LOGS/*).

-- ───────────────────────── Access ─────────────────────────

create table public.admins (
  email text primary key check (email = lower(email))
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(auth.jwt() ->> 'email'));
$$;

-- ───────────────────────── Content structure ─────────────────────────

create table public.clusters (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  name        text not null,
  audience    text not null default 'both' check (audience in ('client', 'developer', 'both')),
  target_t1   smallint not null default 60 check (target_t1 between 0 and 100),
  position    smallint not null default 0
);

create table public.batches (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create type public.topic_status as enum ('candidate', 'approved', 'in_production', 'published', 'rejected', 'archived');
create type public.priority as enum ('P0', 'P1', 'P2', 'P3', 'P4');

create table public.topics (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  query        text not null,
  cluster_id   text references public.clusters (id) on delete set null,
  track        smallint not null check (track in (1, 2)),
  role         text not null default 'spoke' check (role in ('pillar', 'spoke', 'edge', 'case-study', 'trend')),
  intent       text check (intent in ('informational', 'commercial', 'transactional')),
  audience     text check (audience in ('client', 'developer', 'both')),
  -- { authority, intent, volume, backlink, difficulty, internalLink: { value, reason }, caseStudy: boolean }
  scores       jsonb not null default '{}'::jsonb,
  score        numeric(5, 1),
  priority     public.priority,
  -- { uniqueness|depth|audience|cannibalism|demand: { pass, reason } }
  filters      jsonb not null default '{}'::jsonb,
  status       public.topic_status not null default 'candidate',
  reason       text,
  source       text not null default 'manual' check (source in ('manual', 'gsc', 'trend', 'agent', 'seed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Production fields on posts. The public RLS policy (published + published_at <= now) is unchanged;
-- pipeline progress lives in `stage`, and only the worker's publish step flips status to 'published'.
alter table public.posts
  add column topic_id       uuid references public.topics (id) on delete set null,
  add column cluster_id     text references public.clusters (id) on delete set null,
  add column track          smallint check (track in (1, 2)),
  add column role           text check (role in ('pillar', 'spoke', 'edge', 'case-study', 'trend')),
  add column stage          text not null default 'live' check (stage in ('brief', 'draft', 'image', 'audit', 'slotted', 'live')),
  add column batch_id       uuid references public.batches (id) on delete set null,
  add column scheduled_for  timestamptz,
  add column approved_at    timestamptz,
  -- { angle, audience, depth, servicePage, linksTo[], outline[], wordRange }
  add column brief          jsonb not null default '{}'::jsonb,
  -- { ok, ranAt, checks: [{ id, label, pass, detail }] }
  add column audit          jsonb,
  add column image_prompt   text,
  add column version        integer not null default 1;

create index posts_stage_idx on public.posts (stage, scheduled_for);

create table public.post_versions (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  version     integer not null,
  title       text not null,
  body_html   text not null,
  cover_image_url text,
  note        text,
  author      text not null default 'agent' check (author in ('agent', 'admin')),
  created_at  timestamptz not null default now(),
  unique (post_id, version)
);

-- Planned internal links (LINK-MAP). Links already present are read from body_html.
create table public.link_plan (
  id          uuid primary key default gen_random_uuid(),
  from_slug   text not null,
  to_path     text not null,
  anchor      text,
  status      text not null default 'planned' check (status in ('planned', 'inserted', 'dismissed')),
  created_at  timestamptz not null default now(),
  unique (from_slug, to_path)
);

-- Verified numbers the agent is allowed to cite (Depth criterion B/E). Nothing else may be quoted as a result.
create table public.facts (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,
  statement   text not null,
  source      text,
  created_at  timestamptz not null default now()
);

-- ───────────────────────── Signals & briefing ─────────────────────────

create table public.gsc_daily (
  date        date not null,
  page        text not null,
  query       text not null,
  clicks      integer not null,
  impressions integer not null,
  ctr         real not null,
  position    real not null,
  primary key (date, page, query)
);

create table public.signals (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('rank_up', 'rank_down', 'low_ctr', 'query_gap', 'trend', 'index', 'backlink_needed', 'audit_failed', 'quality_gate', 'refresh')),
  title       text not null,
  detail      jsonb not null default '{}'::jsonb,
  priority    public.priority not null default 'P2',
  post_id     uuid references public.posts (id) on delete cascade,
  topic_id    uuid references public.topics (id) on delete set null,
  status      text not null default 'open' check (status in ('open', 'acted', 'dismissed')),
  dedupe_key  text unique,
  created_at  timestamptz not null default now()
);

create index signals_open_idx on public.signals (created_at desc) where status = 'open';

create table public.briefings (
  date        date primary key,
  -- { headline, recommendation: { text, action }, notes[] }
  content     jsonb not null,
  created_at  timestamptz not null default now()
);

create table public.agent_messages (
  id          uuid primary key default gen_random_uuid(),
  thread      text not null,
  role        text not null check (role in ('admin', 'agent')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index agent_messages_thread_idx on public.agent_messages (thread, created_at);

create table public.settings (
  key         text primary key,
  value       jsonb not null
);

-- ───────────────────────── Job queue (admin → worker) ─────────────────────────

create type public.job_status as enum ('queued', 'running', 'done', 'failed');

create table public.jobs (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,
  payload      jsonb not null default '{}'::jsonb,
  status       public.job_status not null default 'queued',
  result       jsonb,
  error        text,
  attempts     smallint not null default 0,
  priority     smallint not null default 0,
  run_after    timestamptz not null default now(),
  locked_by    text,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

create index jobs_queue_idx on public.jobs (priority desc, created_at) where status = 'queued';

create function public.claim_job(worker_id text) returns setof public.jobs
language sql as $$
  update public.jobs
     set status = 'running', started_at = now(), attempts = attempts + 1, locked_by = worker_id
   where id = (
     select id from public.jobs
      where status = 'queued' and run_after <= now()
      order by priority desc, created_at
      for update skip locked
      limit 1
   )
  returning *;
$$;

revoke execute on function public.claim_job(text) from public, anon, authenticated;

-- ───────────────────────── Triggers ─────────────────────────

create trigger topics_set_updated_at before update on public.topics
  for each row execute function public.set_updated_at();

-- ───────────────────────── RLS: admins only ─────────────────────────

alter table public.admins enable row level security;
alter table public.clusters enable row level security;
alter table public.batches enable row level security;
alter table public.topics enable row level security;
alter table public.post_versions enable row level security;
alter table public.link_plan enable row level security;
alter table public.facts enable row level security;
alter table public.gsc_daily enable row level security;
alter table public.signals enable row level security;
alter table public.briefings enable row level security;
alter table public.agent_messages enable row level security;
alter table public.settings enable row level security;
alter table public.jobs enable row level security;

create policy "Admins read admins" on public.admins for select to authenticated using (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['clusters', 'batches', 'topics', 'post_versions', 'link_plan', 'facts', 'gsc_daily',
                           'signals', 'briefings', 'agent_messages', 'settings', 'jobs'] loop
    execute format('create policy "Admins manage %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

create policy "Admins manage posts" on public.posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage blog images" on storage.objects for all to authenticated
  using (bucket_id = 'blog-images' and public.is_admin())
  with check (bucket_id = 'blog-images' and public.is_admin());

-- ───────────────────────── Defaults ─────────────────────────

insert into public.settings (key, value) values
  ('schedule', '{"timezone": "Asia/Kolkata", "publishAt": "09:00", "briefingAt": "06:30", "perDay": 1}'),
  ('scoring', '{"base": {"authority": 0.28, "intent": 0.22, "volume": 0.20, "backlink": 0.15, "difficulty": 0.10, "internalLink": 0.05}, "track1": {"authority": 0.20, "volume": 0.28}, "track2": {"authority": 0.33, "volume": 0.12}, "caseStudyBonus": 15, "priority": {"P1": 75, "P2": 60, "P3": 45}}'),
  ('banned_phrases', '["in today''s digital age", "ever-changing landscape", "unlock the power of", "more important than ever", "comprehensive guide", "everything you need to know", "in conclusion", "as a freelancer", "performance is more important than ever", "in this article we will", "whether you''re a", "as the web evolves"]'),
  ('never_cover', '["generic wordpress templates — contradicts custom code value proposition"]'),
  ('word_ranges', '{"track1": [1000, 1800], "spoke": [1500, 2500], "pillar": [2500, 4000], "edge": [1200, 2000], "case-study": [1500, 2500], "trend": [800, 1500]}');

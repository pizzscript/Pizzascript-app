-- Jobs report a heartbeat while they run. A job whose worker stopped (restart, sleep, crash) is reclaimed once its
-- heartbeat is 2 minutes old, instead of staying "running" forever.
alter table public.jobs add column if not exists heartbeat_at timestamptz;

create or replace function public.claim_job(worker_id text) returns setof public.jobs
language sql as $$
  update public.jobs
     set status = 'running', started_at = now(), heartbeat_at = now(), attempts = attempts + 1, locked_by = worker_id
   where id = (
     select id from public.jobs
      where (status = 'queued' and run_after <= now())
         or (status = 'running' and coalesce(heartbeat_at, started_at) < now() - interval '2 minutes')
      order by priority desc, created_at
      for update skip locked
      limit 1
   )
  returning *;
$$;
revoke execute on function public.claim_job(text) from public, anon, authenticated;

-- The doorbell: one cheap check the scheduler runs every 30 minutes, so the app server is only woken when there is
-- real work. All times are India Standard Time (Asia/Kolkata).
--   wake    → AI work is waiting: queued jobs, today's suggestion not made yet (after briefingAt IST), or posts
--             that autopilot / an approved batch / an approved idea should move forward.
--   publish → a ready post's publish time (IST) has passed.
create or replace function public.agent_doorbell() returns json
language sql stable as $$
  with s as (
    select
      coalesce((select (value->>'enabled')::boolean from public.settings where key = 'autopilot'), false) as autopilot,
      coalesce((select value->>'briefingAt' from public.settings where key = 'schedule'), '06:30') as briefing_at,
      (now() at time zone 'Asia/Kolkata') as ist_now
  ),
  ready as (
    select p.* from public.posts p
     where p.stage <> 'live'
  ),
  recent_fail as (
    select distinct (payload->>'postId') as post_id from public.jobs
     where status = 'failed' and type in ('write_brief','write_draft','generate_image','run_audit')
       and finished_at > now() - interval '6 hours'
  )
  select json_build_object(
    'ist_now', to_char((select ist_now from s), 'YYYY-MM-DD HH24:MI'),
    'wake',
      exists (select 1 from public.jobs where status = 'queued' and run_after <= now())
      or exists (select 1 from public.jobs where status = 'running' and coalesce(heartbeat_at, started_at) < now() - interval '2 minutes')
      or (
        to_char((select ist_now from s), 'HH24:MI') >= (select briefing_at from s)
        and not exists (select 1 from public.briefings where date = ((select ist_now from s))::date)
      )
      or exists (
        select 1 from ready p
          left join public.batches b on b.id = p.batch_id
         where p.id::text not in (select post_id from recent_fail where post_id is not null)
           and p.audit is null
           and p.stage in ('brief','draft','image')
           and ( ((select autopilot from s) and p.scheduled_for is not null) or b.approved_at is not null or p.auto_pipeline )
      ),
    'publish',
      exists (
        select 1 from ready p
          left join public.batches b on b.id = p.batch_id
         where p.scheduled_for <= now()
           and (p.audit->>'ok')::boolean is true
           and p.stage in ('audit','slotted')
           and ( p.stage = 'slotted' or p.approved_at is not null or b.approved_at is not null or (select autopilot from s) )
      )
  );
$$;
revoke execute on function public.agent_doorbell() from public, anon, authenticated;

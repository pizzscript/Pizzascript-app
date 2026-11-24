-- Phase 2: client articles stay in Supabase and appear on the client's own site through the article feed
-- (embed script or server snippet); approvals.
-- - posts.remote / published_url / approved_by: the article's address on the client's site and who approved it.
-- - public_workspace(): the few public facts the feed needs (anonymous visitors can't read workspaces).
-- - agent_doorbell(): Autopilot publishes on its own only for clients set to "automatic"; others wait for approval.
-- Rollback: supabase/rollback/20261203000000_publishing_down.sql

alter table public.posts add column if not exists remote jsonb not null default '{}'::jsonb;
alter table public.posts add column if not exists published_url text;
alter table public.posts add column if not exists approved_by text;

create or replace function public.public_workspace(ws_slug text)
returns table (id uuid, slug text, name text, site_url text, language text, article_url text)
language sql stable security definer set search_path = public as $$
  select w.id, w.slug, w.name, w.site_url, w.language,
         coalesce((select s.value->>'articleUrl' from public.settings s where s.workspace_id = w.id and s.key = 'profile'), w.site_url || '/blog?article={slug}')
    from public.workspaces w
   where w.slug = ws_slug and w.status = 'active' and w.id <> public.default_workspace();
$$;
revoke execute on function public.public_workspace(text) from public;
grant execute on function public.public_workspace(text) to anon, authenticated, service_role;

create or replace function public.agent_doorbell() returns json
language sql stable as $$
  with clock as (select (now() at time zone 'Asia/Kolkata') as ist_now),
  ws as (
    select
      w.id,
      coalesce((select (st.value->>'enabled')::boolean from public.settings st where st.workspace_id = w.id and st.key = 'autopilot'), false) as autopilot,
      coalesce((select st.value->>'briefingAt' from public.settings st where st.workspace_id = w.id and st.key = 'schedule'), '06:30') as briefing_at,
      w.approval_mode
    from public.workspaces w
    where w.status = 'active'
  ),
  ready as (
    select p.*, ws.autopilot, ws.approval_mode from public.posts p join ws on ws.id = p.workspace_id where p.stage <> 'live'
  ),
  recent_fail as (
    select distinct (payload->>'postId') as post_id from public.jobs
     where status = 'failed' and type in ('write_brief','write_draft','generate_image','run_audit')
       and finished_at > now() - interval '6 hours'
  )
  select json_build_object(
    'ist_now', to_char((select ist_now from clock), 'YYYY-MM-DD HH24:MI'),
    'wake',
      exists (select 1 from public.jobs where status = 'queued' and run_after <= now())
      or exists (select 1 from public.jobs where status = 'running' and coalesce(heartbeat_at, started_at) < now() - interval '2 minutes')
      or exists (
        select 1 from ws
         where to_char((select ist_now from clock), 'HH24:MI') >= ws.briefing_at
           and not exists (select 1 from public.briefings b where b.workspace_id = ws.id and b.date = ((select ist_now from clock))::date)
      )
      or exists (
        select 1 from ready p
          left join public.batches b on b.id = p.batch_id
         where p.id::text not in (select post_id from recent_fail where post_id is not null)
           and p.audit is null
           and p.stage in ('brief','draft','image')
           and ( (p.autopilot and p.scheduled_for is not null) or b.approved_at is not null or p.auto_pipeline )
      )
      or exists (
        select 1 from ready p
          left join public.batches b on b.id = p.batch_id
         where p.id::text not in (select post_id from recent_fail where post_id is not null)
           and p.stage in ('audit','slotted')
           and p.scheduled_for <= now() + interval '48 hours'
           and ( p.autopilot or b.approved_at is not null or p.approved_at is not null or p.auto_pipeline )
           and coalesce((p.seo_plan->'reviewAttempt'->>'at')::timestamptz, 'epoch'::timestamptz) < now() - interval '3 hours'
           and (
             not exists (select 1 from jsonb_array_elements(coalesce(p.audit->'checks', '[]'::jsonb)) c where c->>'id' = 'verified')
             or exists (select 1 from jsonb_array_elements(coalesce(p.audit->'checks', '[]'::jsonb)) c where c->>'id' = 'verified' and c->>'detail' = 'Review pending')
           )
      ),
    'publish',
      exists (
        select 1 from ready p
          left join public.batches b on b.id = p.batch_id
         where p.scheduled_for <= now()
           and (p.audit->>'ok')::boolean is true
           and p.stage in ('audit','slotted')
           and ( p.stage = 'slotted' or p.approved_at is not null or b.approved_at is not null or (p.autopilot and p.approval_mode = 'automatic') )
      )
  );
$$;
revoke execute on function public.agent_doorbell() from public, anon, authenticated;

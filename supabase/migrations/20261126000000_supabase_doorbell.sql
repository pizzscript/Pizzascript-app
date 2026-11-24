-- Supabase becomes the main clock: every 10 minutes it asks agent_doorbell() what's due and, only if something is,
-- wakes the app server. GitHub Actions stays as the backup. Every ring and its answer is kept for 30 days.
-- The app URL and secret live in Supabase Vault as 'agent_url' and 'agent_secret', never in this file.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.doorbell_log (
  id          bigserial primary key,
  rang_at     timestamptz not null default now(),
  source      text not null,
  wake        boolean,
  publish     boolean,
  request_id  bigint,
  status      integer,
  timed_out   boolean,
  response    text
);
create index if not exists doorbell_log_rang_at_idx on public.doorbell_log (rang_at desc);
alter table public.doorbell_log enable row level security;
revoke all on public.doorbell_log from anon, authenticated;

create or replace function public.ring_doorbell(ring_source text default 'supabase') returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  due json;
  secret text;
  base text;
  request bigint;
begin
  -- Answers arrive after the call returns, so each run records the replies to earlier rings.
  update public.doorbell_log l
     set status = r.status_code, timed_out = r.timed_out, response = left(coalesce(r.error_msg, r.content::text, ''), 300)
    from net._http_response r
   where r.id = l.request_id and l.status is null and l.timed_out is null;
  delete from public.doorbell_log where rang_at < now() - interval '30 days';

  due := public.agent_doorbell();
  if not (coalesce((due->>'wake')::boolean, false) or coalesce((due->>'publish')::boolean, false)) then
    return due;
  end if;

  select decrypted_secret into secret from vault.decrypted_secrets where name = 'agent_secret';
  select decrypted_secret into base from vault.decrypted_secrets where name = 'agent_url';
  if secret is null or base is null then
    insert into public.doorbell_log (source, wake, publish, response)
    values (ring_source, (due->>'wake')::boolean, (due->>'publish')::boolean, 'Missing agent_url or agent_secret in Vault');
    return due;
  end if;

  -- A sleeping free server needs up to a minute or two to start, so allow 2 minutes for its answer.
  select net.http_post(
           url := rtrim(base, '/') || '/api/agent/tick',
           headers := jsonb_build_object('x-agent-secret', secret, 'content-type', 'application/json'),
           body := '{}'::jsonb,
           timeout_milliseconds := 120000
         ) into request;
  insert into public.doorbell_log (source, wake, publish, request_id)
  values (ring_source, (due->>'wake')::boolean, (due->>'publish')::boolean, request);
  return due;
end;
$$;
revoke execute on function public.ring_doorbell(text) from public, anon, authenticated;

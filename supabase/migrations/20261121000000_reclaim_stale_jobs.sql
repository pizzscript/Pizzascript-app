-- A job whose worker died mid-run (instance restart, spin-down, crash) stayed 'running' forever.
-- claim_job now also reclaims jobs that have been running for more than 15 minutes; the attempts counter
-- still increases, so the worker's retry limit applies to them too.
create or replace function public.claim_job(worker_id text) returns setof public.jobs
language sql as $$
  update public.jobs
     set status = 'running', started_at = now(), attempts = attempts + 1, locked_by = worker_id
   where id = (
     select id from public.jobs
      where (status = 'queued' and run_after <= now())
         or (status = 'running' and started_at < now() - interval '15 minutes')
      order by priority desc, created_at
      for update skip locked
      limit 1
   )
  returning *;
$$;

revoke execute on function public.claim_job(text) from public, anon, authenticated;

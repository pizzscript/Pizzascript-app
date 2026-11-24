-- Undoes Phase 1A (20261129000000_workspaces.sql). Safe only while all rows still belong to PizzaScript.
do $$
declare
  t text;
begin
  foreach t in array array[
    'agent_messages', 'ai_calls', 'batches', 'briefings', 'clusters', 'connection_log', 'connections', 'content_embeddings',
    'doorbell_log', 'facts', 'gsc_daily', 'jobs', 'link_plan', 'page_stats', 'post_versions', 'posts', 'settings', 'signals', 'topics'
  ] loop
    execute format('alter table public.%I drop column if exists workspace_id', t);
  end loop;
end;
$$;
drop table if exists public.workspace_members;
drop table if exists public.workspaces;
drop function if exists public.can_access_workspace(uuid);
drop function if exists public.default_workspace();

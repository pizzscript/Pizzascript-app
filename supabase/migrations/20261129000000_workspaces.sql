-- Phase 1A: client workspaces. Additive only: every existing row belongs to PizzaScript (client #1) through a default,
-- so current code keeps working unchanged. Phase 1B scopes the code and the unique keys per workspace.
-- Rollback: supabase/rollback/20261129000000_workspaces_down.sql

create table if not exists public.workspaces (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name           text not null,
  site_url       text not null,
  cms            text not null default 'hosted' check (cms in ('hosted', 'wordpress', 'webflow', 'shopify')),
  location       text,
  language       text not null default 'en',
  timezone       text not null default 'Asia/Kolkata',
  status         text not null default 'active' check (status in ('active', 'paused', 'archived')),
  approval_mode  text not null default 'owner' check (approval_mode in ('owner', 'client', 'automatic')),
  plan           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  email         text not null,
  role          text not null default 'owner' check (role in ('owner', 'editor', 'client_viewer')),
  created_at    timestamptz not null default now(),
  primary key (workspace_id, email)
);

-- PizzaScript keeps a fixed id so existing rows, jobs and scripts can refer to it.
insert into public.workspaces (id, slug, name, site_url, cms, location, approval_mode, plan)
values ('00000000-0000-4000-8000-000000000001', 'pizzascript', 'PizzaScript', 'https://pizzascript-app.onrender.com', 'hosted', 'Pune, India', 'automatic',
        '{"articlesPerMonth": 30, "modules": ["research", "autopick", "connections"]}'::jsonb)
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, email, role)
select '00000000-0000-4000-8000-000000000001', lower(email), 'owner' from public.admins
on conflict do nothing;

create or replace function public.default_workspace() returns uuid
language sql immutable as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;

-- Platform admins see every workspace; members (later: client logins) see only their own.
create or replace function public.can_access_workspace(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.email = lower(auth.jwt() ->> 'email'));
$$;
revoke execute on function public.can_access_workspace(uuid) from public, anon;
grant execute on function public.can_access_workspace(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
drop policy if exists "Members read their workspaces" on public.workspaces;
create policy "Members read their workspaces" on public.workspaces for select to authenticated using (public.can_access_workspace(id));
drop policy if exists "Admins manage workspaces" on public.workspaces;
create policy "Admins manage workspaces" on public.workspaces for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Members read memberships" on public.workspace_members;
create policy "Members read memberships" on public.workspace_members for select to authenticated using (public.can_access_workspace(workspace_id));
drop policy if exists "Admins manage memberships" on public.workspace_members;
create policy "Admins manage memberships" on public.workspace_members for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Every client-owned table gets a workspace. "restrict" means a workspace with data can't be deleted by accident;
-- Phase 1E adds a proper export-and-delete flow.
do $$
declare
  t text;
begin
  foreach t in array array[
    'agent_messages', 'ai_calls', 'batches', 'briefings', 'clusters', 'connection_log', 'connections', 'content_embeddings',
    'doorbell_log', 'facts', 'gsc_daily', 'jobs', 'link_plan', 'page_stats', 'post_versions', 'posts', 'settings', 'signals', 'topics'
  ] loop
    execute format('alter table public.%I add column if not exists workspace_id uuid not null default public.default_workspace() references public.workspaces (id) on delete restrict', t);
    execute format('create index if not exists %I on public.%I (workspace_id)', t || '_workspace_idx', t);
  end loop;
end;
$$;

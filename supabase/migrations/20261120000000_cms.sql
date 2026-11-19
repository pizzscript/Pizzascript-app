-- CMS redesign: research summaries for Ideas, verification for citable facts.

alter table public.topics
  -- { summary, angle, title, outline[], competitors[] } written by the agent when it researches a topic.
  add column research jsonb not null default '{}'::jsonb;

alter table public.facts
  add column verified boolean not null default false;

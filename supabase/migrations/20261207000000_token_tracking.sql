-- Tracks real token usage per AI call, so the admin can see TPM pressure (today only Google's own dashboard shows
-- it). input_tokens matches what Google calls TPM ("tokens per minute (input)"); total_tokens is input+output+
-- thinking, for our own cost/budget picture. Both come straight from each response's usage field.
-- Rollback: supabase/rollback/20261207000000_token_tracking_down.sql

alter table public.ai_calls add column if not exists input_tokens integer;
alter table public.ai_calls add column if not exists total_tokens integer;
create index if not exists ai_calls_model_created_idx on public.ai_calls (model, created_at desc);

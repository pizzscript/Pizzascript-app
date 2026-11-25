-- Rollback of 20261207000000_token_tracking.sql.
drop index if exists public.ai_calls_model_created_idx;
alter table public.ai_calls drop column if exists total_tokens;
alter table public.ai_calls drop column if exists input_tokens;

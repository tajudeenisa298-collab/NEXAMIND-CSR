alter table messages
  add column if not exists context_package jsonb not null default '{}'::jsonb,
  add column if not exists escalation_decision jsonb not null default '{}'::jsonb,
  add column if not exists reasoning_pipeline jsonb not null default '{}'::jsonb;

alter table message_intelligence
  add column if not exists context_package jsonb not null default '{}'::jsonb,
  add column if not exists escalation_decision jsonb not null default '{}'::jsonb,
  add column if not exists reasoning_pipeline jsonb not null default '{}'::jsonb;

alter table conversation_summaries
  add column if not exists last_context_package jsonb not null default '{}'::jsonb,
  add column if not exists last_escalation_decision jsonb not null default '{}'::jsonb;

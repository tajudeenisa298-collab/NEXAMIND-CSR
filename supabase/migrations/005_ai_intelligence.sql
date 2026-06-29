alter table messages
  add column if not exists intent text,
  add column if not exists intent_confidence numeric(5, 4),
  add column if not exists priority text,
  add column if not exists sentiment text,
  add column if not exists retrieval_confidence numeric(5, 4),
  add column if not exists reasoning_confidence numeric(5, 4),
  add column if not exists final_confidence numeric(5, 4),
  add column if not exists validation_status text,
  add column if not exists validation_results jsonb not null default '{}'::jsonb,
  add column if not exists extracted_entities jsonb not null default '{}'::jsonb;

alter table conversation_summaries
  add column if not exists rolling_memory jsonb not null default '{}'::jsonb,
  add column if not exists extracted_entities jsonb not null default '{}'::jsonb,
  add column if not exists sentiment text,
  add column if not exists priority text;

create table if not exists message_intelligence (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  message_id uuid references messages(id) on delete cascade,
  intent text not null,
  intent_confidence numeric(5, 4) not null,
  priority text not null,
  sentiment text not null,
  entities jsonb not null default '{}'::jsonb,
  retrieval_confidence numeric(5, 4),
  reasoning_confidence numeric(5, 4),
  final_confidence numeric(5, 4),
  validation_status text,
  validation_results jsonb not null default '{}'::jsonb,
  rolling_memory jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_message_intelligence_conversation
  on message_intelligence(conversation_id, created_at desc);

create index if not exists idx_message_intelligence_org_intent
  on message_intelligence(organization_id, intent, created_at desc);

alter table message_intelligence enable row level security;

create policy "service role can manage message intelligence"
  on message_intelligence for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

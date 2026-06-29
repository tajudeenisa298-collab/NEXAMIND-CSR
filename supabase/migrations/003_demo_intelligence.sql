create table if not exists conversation_replay_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  message_id uuid references messages(id) on delete set null,
  step_key text not null check (
    step_key in (
      'customer',
      'embedding',
      'vector_search',
      'retrieved_documents',
      'reasoning',
      'final_response'
    )
  ),
  title text not null,
  detail text not null,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_replay_steps_conversation_order
  on conversation_replay_steps(conversation_id, sort_order, created_at);

create index if not exists idx_replay_steps_message
  on conversation_replay_steps(message_id);

alter table conversation_replay_steps enable row level security;

create policy "service role can manage conversation replay steps"
  on conversation_replay_steps for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists ai_response_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  reviewer_name text not null default 'Admin',
  original_response text not null,
  improved_response text not null,
  improvement_notes text not null,
  prompt_guidance text not null,
  quality_score numeric(5, 4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_response_feedback_org_created
  on ai_response_feedback(organization_id, created_at desc);

create index if not exists idx_ai_response_feedback_message
  on ai_response_feedback(message_id, created_at desc);

alter table ai_response_feedback enable row level security;

drop policy if exists "service role can manage ai response feedback" on ai_response_feedback;
create policy "service role can manage ai response feedback"
  on ai_response_feedback for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

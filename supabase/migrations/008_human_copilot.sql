alter table conversations
  add column if not exists assigned_agent text,
  add column if not exists takeover_status text not null default 'ai_active'
    check (takeover_status in ('ai_active', 'human_requested', 'human_active', 'resolved')),
  add column if not exists takeover_reason text,
  add column if not exists takeover_at timestamptz;

create table if not exists internal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  author_name text not null default 'Support Agent',
  body text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'handoff')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists copilot_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  action_type text not null check (
    action_type in (
      'send_reply',
      'human_takeover',
      'create_ticket',
      'refund_review',
      'slack_notify',
      'email_followup',
      'resolve_conversation'
    )
  ),
  status text not null default 'completed' check (status in ('completed', 'failed', 'skipped')),
  label text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_notes_conversation_created
  on internal_notes(conversation_id, created_at desc);

create index if not exists idx_copilot_actions_conversation_created
  on copilot_actions(conversation_id, created_at desc);

create index if not exists idx_conversations_org_takeover
  on conversations(organization_id, takeover_status, updated_at desc);

alter table internal_notes enable row level security;
alter table copilot_actions enable row level security;

drop policy if exists "service role can manage internal notes" on internal_notes;
create policy "service role can manage internal notes"
  on internal_notes for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage copilot actions" on copilot_actions;
create policy "service role can manage copilot actions"
  on copilot_actions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

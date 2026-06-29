create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  title text not null default 'New support conversation',
  status text not null default 'open' check (status in ('open', 'waiting', 'resolved', 'escalated')),
  customer_name text,
  customer_email text,
  current_issue text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  participant_type text not null check (participant_type in ('customer', 'agent', 'ai')),
  display_name text not null,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('customer', 'assistant', 'system', 'tool')),
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  confidence numeric(5, 4),
  retrieval_score numeric(6, 5),
  documents_used integer not null default 0,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade unique,
  summary text not null default '',
  customer_name text,
  current_issue text,
  previous_troubleshooting text[] not null default array[]::text[],
  key_facts jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_suggested_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  question text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(organization_id, question)
);

create index if not exists idx_conversations_org_updated on conversations(organization_id, updated_at desc);
create index if not exists idx_conversation_participants_conversation on conversation_participants(conversation_id);
create index if not exists idx_messages_conversation_created on messages(conversation_id, created_at asc);
create index if not exists idx_messages_org_created on messages(organization_id, created_at desc);
create index if not exists idx_conversation_summaries_org on conversation_summaries(organization_id);
create index if not exists idx_suggested_questions_org_order on organization_suggested_questions(organization_id, sort_order);

alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;
alter table conversation_summaries enable row level security;
alter table organization_suggested_questions enable row level security;

create policy "service role can manage conversations"
  on conversations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role can manage conversation participants"
  on conversation_participants for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role can manage messages"
  on messages for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role can manage conversation summaries"
  on conversation_summaries for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role can manage suggested questions"
  on organization_suggested_questions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function match_knowledge_chunks(
  match_organization_id text,
  query_embedding vector(1536),
  match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  title text,
  source_url text,
  category text,
  similarity double precision
)
language sql
stable
as $$
  select
    kc.id as chunk_id,
    kd.id as document_id,
    kc.content,
    coalesce(kc.metadata->>'title', kd.title) as title,
    coalesce(kc.metadata->>'source_url', kd.source_url) as source_url,
    coalesce(kc.metadata->>'category', kd.category) as category,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  join knowledge_documents kd on kd.id = kc.document_id
  where kc.organization_id = match_organization_id
    and kc.embedding is not null
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

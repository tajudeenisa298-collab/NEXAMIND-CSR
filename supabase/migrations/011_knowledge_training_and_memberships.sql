create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  user_id uuid not null,
  email text not null,
  role text not null default 'manager' check (role in ('owner', 'admin', 'manager', 'agent')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, user_id),
  unique(organization_id, email)
);

create table if not exists knowledge_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  uploaded_by uuid,
  file_name text not null,
  file_type text not null,
  file_size bigint not null default 0,
  storage_bucket text not null default 'knowledge-uploads',
  storage_path text not null,
  status text not null default 'queued' check (status in ('queued', 'parsed', 'indexed', 'needs_review', 'failed')),
  parser_status text not null default 'pending',
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  created_by uuid,
  title text not null,
  body text not null,
  update_type text not null default 'instruction' check (update_type in ('instruction', 'policy', 'release_note', 'faq', 'correction')),
  status text not null default 'indexed' check (status in ('draft', 'queued', 'indexed', 'needs_review', 'archived')),
  source_id uuid references knowledge_sources(id) on delete set null,
  document_id uuid references knowledge_documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_members_org on organization_members(organization_id);
create index if not exists idx_org_members_user on organization_members(user_id);
create index if not exists idx_knowledge_uploads_org_created on knowledge_uploads(organization_id, created_at desc);
create index if not exists idx_knowledge_updates_org_created on knowledge_updates(organization_id, created_at desc);

alter table organization_members enable row level security;
alter table knowledge_uploads enable row level security;
alter table knowledge_updates enable row level security;

drop policy if exists "service role can manage organization members" on organization_members;
create policy "service role can manage organization members"
  on organization_members for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage knowledge uploads" on knowledge_uploads;
create policy "service role can manage knowledge uploads"
  on knowledge_uploads for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage knowledge updates" on knowledge_updates;
create policy "service role can manage knowledge updates"
  on knowledge_updates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into storage.buckets (id, name, public)
values ('knowledge-uploads', 'knowledge-uploads', false)
on conflict (id) do nothing;

drop policy if exists "service role can manage knowledge upload objects" on storage.objects;
create policy "service role can manage knowledge upload objects"
  on storage.objects for all
  using (bucket_id = 'knowledge-uploads' and auth.role() = 'service_role')
  with check (bucket_id = 'knowledge-uploads' and auth.role() = 'service_role');

create or replace function production_readiness_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with expected_tables(table_name) as (
    values
      ('organizations'),
      ('organization_members'),
      ('knowledge_sources'),
      ('knowledge_documents'),
      ('knowledge_chunks'),
      ('knowledge_uploads'),
      ('knowledge_updates'),
      ('embeddings'),
      ('crawl_jobs'),
      ('crawl_pages'),
      ('conversations'),
      ('messages'),
      ('conversation_participants'),
      ('conversation_summaries'),
      ('organization_suggested_questions'),
      ('conversation_replay_steps'),
      ('message_intelligence')
  ),
  table_status as (
    select
      expected_tables.table_name,
      pg_class.relname is not null as exists,
      coalesce(pg_class.relrowsecurity, false) as rls_enabled,
      (
        select count(*)::integer
        from pg_policies
        where pg_policies.schemaname = 'public'
          and pg_policies.tablename = expected_tables.table_name
      ) as policy_count
    from expected_tables
    left join pg_class
      on pg_class.relname = expected_tables.table_name
    left join pg_namespace
      on pg_namespace.oid = pg_class.relnamespace
      and pg_namespace.nspname = 'public'
  )
  select jsonb_build_object(
    'checked_at', now(),
    'pgvector_enabled', exists (
      select 1 from pg_extension where extname = 'vector'
    ),
    'retrieval_function_ready', exists (
      select 1 from pg_proc where proname = 'match_knowledge_chunks'
    ),
    'knowledge_upload_bucket_ready', exists (
      select 1 from storage.buckets where id = 'knowledge-uploads'
    ),
    'reasoning_pipeline_columns_ready', exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'messages'
        and column_name = 'reasoning_pipeline'
    ),
    'readiness_function_ready', true,
    'tables', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'table', table_name,
            'exists', exists,
            'rls_enabled', rls_enabled,
            'policy_count', policy_count
          )
          order by table_name
        )
        from table_status
      ),
      '[]'::jsonb
    )
  );
$$;

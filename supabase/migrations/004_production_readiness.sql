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
      ('knowledge_sources'),
      ('knowledge_documents'),
      ('knowledge_chunks'),
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

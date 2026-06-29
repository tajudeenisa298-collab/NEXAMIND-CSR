create table if not exists ai_evaluation_tests (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  question text not null,
  expected_intent text not null,
  expected_documents text[] not null default array[]::text[],
  expected_answer text not null,
  expected_workflow text,
  expected_confidence numeric(5, 4) not null default 0.90,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ai_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  overall_score numeric(5, 4),
  passing_count integer not null default 0,
  failing_count integer not null default 0,
  average_confidence numeric(5, 4),
  average_latency_ms integer,
  prompt_version text,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists ai_evaluation_results (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  run_id uuid not null references ai_evaluation_runs(id) on delete cascade,
  test_id uuid not null references ai_evaluation_tests(id) on delete cascade,
  question text not null,
  answer text not null,
  expected_intent text not null,
  actual_intent text not null,
  expected_documents text[] not null default array[]::text[],
  retrieved_documents text[] not null default array[]::text[],
  expected_workflow text,
  actual_workflow text,
  expected_confidence numeric(5, 4),
  actual_confidence numeric(5, 4),
  latency_ms integer not null default 0,
  tokens integer not null default 0,
  correct boolean not null default false,
  hallucinated boolean not null default false,
  wrong_document boolean not null default false,
  wrong_intent boolean not null default false,
  escalated boolean not null default false,
  grade_notes text[] not null default array[]::text[],
  created_at timestamptz not null default now()
);

create table if not exists ai_playground_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  question text not null,
  embedding_summary jsonb not null default '{}'::jsonb,
  retrieved_documents jsonb not null default '[]'::jsonb,
  prompt text not null,
  reasoning text not null,
  final_answer text not null,
  latency_breakdown jsonb not null default '{}'::jsonb,
  prompt_version text not null default 'default',
  created_at timestamptz not null default now()
);

create table if not exists ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  prompt text not null,
  notes text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists roi_assumptions (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade unique,
  monthly_tickets integer not null default 2000,
  average_resolution_minutes numeric(8, 2) not null default 8,
  average_agent_hourly_cost numeric(10, 2) not null default 25,
  ai_resolution_rate numeric(5, 4) not null default 0.80,
  ai_cost_per_conversation numeric(10, 4) not null default 0.12,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_eval_tests_org_active on ai_evaluation_tests(organization_id, active);
create index if not exists idx_ai_eval_runs_org_started on ai_evaluation_runs(organization_id, started_at desc);
create index if not exists idx_ai_eval_results_run on ai_evaluation_results(run_id);
create index if not exists idx_ai_playground_runs_org_created on ai_playground_runs(organization_id, created_at desc);
create index if not exists idx_ai_prompt_versions_org_active on ai_prompt_versions(organization_id, active);

alter table ai_evaluation_tests enable row level security;
alter table ai_evaluation_runs enable row level security;
alter table ai_evaluation_results enable row level security;
alter table ai_playground_runs enable row level security;
alter table ai_prompt_versions enable row level security;
alter table roi_assumptions enable row level security;

drop policy if exists "service role can manage ai evaluation tests" on ai_evaluation_tests;
create policy "service role can manage ai evaluation tests"
  on ai_evaluation_tests for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage ai evaluation runs" on ai_evaluation_runs;
create policy "service role can manage ai evaluation runs"
  on ai_evaluation_runs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage ai evaluation results" on ai_evaluation_results;
create policy "service role can manage ai evaluation results"
  on ai_evaluation_results for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage ai playground runs" on ai_playground_runs;
create policy "service role can manage ai playground runs"
  on ai_playground_runs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage ai prompt versions" on ai_prompt_versions;
create policy "service role can manage ai prompt versions"
  on ai_prompt_versions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage roi assumptions" on roi_assumptions;
create policy "service role can manage roi assumptions"
  on roi_assumptions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

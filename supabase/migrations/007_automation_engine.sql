create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  message_id uuid references messages(id) on delete set null,
  customer_name text,
  customer_email text,
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'waiting', 'resolved', 'escalated')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  intent text,
  assigned_queue text not null default 'support',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists refund_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  ticket_id uuid references support_tickets(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  amount numeric(10, 2),
  currency text not null default 'USD',
  reason text not null,
  status text not null default 'pending_review' check (status in ('draft', 'pending_review', 'approved', 'rejected', 'processed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  action_type text not null check (
    action_type in (
      'make_workflow',
      'webhook',
      'ticket_create',
      'refund_workflow',
      'slack_notify',
      'discord_notify',
      'email_notify'
    )
  ),
  destination text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, action_type, name)
);

create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  workflow_id uuid references automation_workflows(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  message_id uuid references messages(id) on delete set null,
  action_type text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'skipped')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists workflow_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  run_id uuid references automation_runs(id) on delete set null,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  run_id uuid references automation_runs(id) on delete set null,
  channel text not null check (channel in ('make', 'webhook', 'slack', 'discord', 'email')),
  status text not null default 'queued' check (status in ('queued', 'succeeded', 'failed', 'skipped')),
  destination text,
  payload jsonb not null default '{}'::jsonb,
  response_status integer,
  response_body text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_org_status
  on support_tickets(organization_id, status, created_at desc);

create index if not exists idx_refund_requests_org_status
  on refund_requests(organization_id, status, created_at desc);

create index if not exists idx_automation_workflows_org_action
  on automation_workflows(organization_id, action_type);

create index if not exists idx_automation_runs_org_created
  on automation_runs(organization_id, created_at desc);

create index if not exists idx_workflow_logs_org_created
  on workflow_logs(organization_id, created_at desc);

create index if not exists idx_notification_deliveries_org_created
  on notification_deliveries(organization_id, created_at desc);

alter table support_tickets enable row level security;
alter table refund_requests enable row level security;
alter table automation_workflows enable row level security;
alter table automation_runs enable row level security;
alter table workflow_logs enable row level security;
alter table notification_deliveries enable row level security;

drop policy if exists "service role can manage support tickets" on support_tickets;
create policy "service role can manage support tickets"
  on support_tickets for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage refund requests" on refund_requests;
create policy "service role can manage refund requests"
  on refund_requests for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage automation workflows" on automation_workflows;
create policy "service role can manage automation workflows"
  on automation_workflows for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage automation runs" on automation_runs;
create policy "service role can manage automation runs"
  on automation_runs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage workflow logs" on workflow_logs;
create policy "service role can manage workflow logs"
  on workflow_logs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role can manage notification deliveries" on notification_deliveries;
create policy "service role can manage notification deliveries"
  on notification_deliveries for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

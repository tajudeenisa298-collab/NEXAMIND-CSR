create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists organizations (
  id text primary key,
  name text not null,
  slug text not null,
  website text,
  industry text,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  website text not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  pages_discovered integer not null default 0,
  pages_indexed integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  crawl_job_id uuid references crawl_jobs(id) on delete set null,
  type text not null,
  title text not null,
  url text not null,
  status text not null default 'indexed',
  discovered_by text not null default 'crawler',
  article_estimate integer not null default 0,
  chunk_estimate integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists crawl_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  crawl_job_id uuid not null references crawl_jobs(id) on delete cascade,
  source_id uuid references knowledge_sources(id) on delete set null,
  url text not null,
  title text,
  status text not null check (status in ('indexed', 'failed', 'skipped')),
  http_status integer,
  raw_html text,
  clean_text text,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  crawled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  source_id uuid references knowledge_sources(id) on delete set null,
  crawl_page_id uuid references crawl_pages(id) on delete cascade,
  title text not null,
  source_url text not null,
  category text not null,
  document_type text not null default 'html',
  status text not null default 'ready',
  checksum text,
  clean_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  chunk_number integer not null,
  content text not null,
  token_count integer not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_number)
);

create table if not exists embeddings (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  chunk_id uuid not null references knowledge_chunks(id) on delete cascade,
  embedding_model text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(chunk_id, embedding_model)
);

create index if not exists idx_organizations_slug on organizations(slug);
create index if not exists idx_crawl_jobs_org_created on crawl_jobs(organization_id, created_at desc);
create index if not exists idx_knowledge_sources_org on knowledge_sources(organization_id);
create index if not exists idx_crawl_pages_org_job on crawl_pages(organization_id, crawl_job_id);
create index if not exists idx_documents_org on knowledge_documents(organization_id);
create index if not exists idx_chunks_org_document on knowledge_chunks(organization_id, document_id);
create index if not exists idx_embeddings_org on embeddings(organization_id);
create index if not exists idx_embeddings_vector on embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_chunks_embedding_vector on knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table organizations enable row level security;
alter table crawl_jobs enable row level security;
alter table knowledge_sources enable row level security;
alter table crawl_pages enable row level security;
alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;
alter table embeddings enable row level security;

create policy "service role can manage organizations"
  on organizations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role can manage crawl jobs"
  on crawl_jobs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role can manage knowledge sources"
  on knowledge_sources for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role can manage crawl pages"
  on crawl_pages for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role can manage documents"
  on knowledge_documents for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role can manage chunks"
  on knowledge_chunks for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role can manage embeddings"
  on embeddings for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


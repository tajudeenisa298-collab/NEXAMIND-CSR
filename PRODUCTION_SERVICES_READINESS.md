# Production Services Readiness

Use this pause before building automations. The goal is to prove that staging behaves like local with real Supabase, OpenAI, pgvector retrieval, and Vercel environment variables.

## 1. Supabase

Create or select the staging Supabase project.

Required environment values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Run every migration in order:

1. `supabase/migrations/001_company_brain.sql`
2. `supabase/migrations/002_support_chat.sql`
3. `supabase/migrations/003_demo_intelligence.sql`
4. `supabase/migrations/004_production_readiness.sql`

Confirm:

- `vector` extension is enabled.
- All application tables exist.
- Row-Level Security is enabled on every application table.
- Service-role policies exist.
- `match_knowledge_chunks` exists.
- `production_readiness_snapshot` exists.

## 2. OpenAI

Required environment values:

- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_EMBEDDING_DIMENSIONS`

Recommended defaults:

- `OPENAI_CHAT_MODEL="gpt-4.1-mini"`
- `OPENAI_EMBEDDING_MODEL="text-embedding-3-small"`
- `OPENAI_EMBEDDING_DIMENSIONS="1536"`

Verify:

- Embedding requests return 1536 dimensions.
- Chat model responds successfully.
- Company Brain build stores real embeddings in Supabase.
- AI Support Chat retrieves real chunks before answering.

## 3. Vercel

Configure staging environment variables:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_DEMO_MODE`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_EMBEDDING_DIMENSIONS`
- `PRODUCTION_HEALTH_CHECK_TOKEN`

Deploy staging, then run:

```bash
npm run smoke:production -- https://your-staging-url.vercel.app org_picx
```

When checking a deployed Vercel environment, also set this locally before running the smoke test:

```bash
PRODUCTION_HEALTH_CHECK_TOKEN="same-token-used-in-vercel"
```

## 4. End-to-End Verification

Use the staging app:

1. Sign in.
2. Open Company Brain.
3. Build or rebuild `picxstudio.com`.
4. Confirm crawl history shows a successful run.
5. Open AI Chat.
6. Ask: `My credits disappeared`.
7. Confirm the answer streams.
8. Confirm Sources are visible.
9. Click a source and confirm chunk text, similarity score, title, and URL are visible.
10. Confirm AI Thinking and Conversation Replay appear when demo mode is enabled.

## 5. Expected Readiness Endpoint

Local:

```bash
http://127.0.0.1:3000/api/health/production-readiness?organizationId=org_picx
```

Staging:

```bash
https://your-staging-url.vercel.app/api/health/production-readiness?organizationId=org_picx
```

In production mode, the endpoint requires:

```bash
Authorization: Bearer <PRODUCTION_HEALTH_CHECK_TOKEN>
```

The readiness result should show:

- Environment variables: pass
- Production health token: pass
- Supabase connection: pass
- Migrations applied: pass
- Database tables: pass
- Row-Level Security: pass
- pgvector and retrieval RPC: pass
- Multi-tenant isolation: pass
- OpenAI embeddings: pass
- OpenAI chat model: pass
- End-to-end retrieval: pass or warn if the selected organization has no embedded chunks yet

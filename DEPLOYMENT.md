# Deployment Checklist

Use this checklist when deploying Nexamind CSR to Vercel.

## 1. Supabase

Run migrations in this exact order:

1. `supabase/migrations/001_company_brain.sql`
2. `supabase/migrations/002_support_chat.sql`
3. `supabase/migrations/003_demo_intelligence.sql`
4. `supabase/migrations/004_production_readiness.sql`
5. `supabase/migrations/005_ai_intelligence.sql`
6. `supabase/migrations/006_reasoning_pipeline.sql`
7. `supabase/migrations/007_automation_engine.sql`
8. `supabase/migrations/008_human_copilot.sql`
9. `supabase/migrations/009_ai_improvement_center.sql`
10. `supabase/migrations/010_evaluation_playground_roi.sql`

Confirm in Supabase:

- `vector` extension is enabled.
- All application tables exist.
- Row-Level Security is enabled.
- Service-role policies exist.
- `match_knowledge_chunks` exists.
- `production_readiness_snapshot` exists.

## 2. Vercel Environment Variables

Required:

```env
NEXT_PUBLIC_APP_NAME=Nexamind
NEXT_PUBLIC_DEMO_MODE=true
DEMO_MODE=true
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
PRODUCTION_HEALTH_CHECK_TOKEN=make-a-long-random-secret
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
AUTOMATION_DRY_RUN=true
```

Optional integrations:

```env
MAKE_WEBHOOK_URL=
AUTOMATION_WEBHOOK_URL=
REFUND_WORKFLOW_WEBHOOK_URL=
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
EMAIL_WEBHOOK_URL=
DEMO_MAKE_WEBHOOK_URL=
DEMO_AUTOMATION_WEBHOOK_URL=
DEMO_REFUND_WORKFLOW_WEBHOOK_URL=
DEMO_SLACK_WEBHOOK_URL=
DEMO_DISCORD_WEBHOOK_URL=
DEMO_EMAIL_WEBHOOK_URL=
DEMO_NOTIFICATION_INBOX=
```

## 3. Vercel Import

1. Open `https://vercel.com/new`.
2. Import the GitHub repository.
3. Framework preset should be `Next.js`.
4. Build command should be `npm run build`.
5. Install command should be `npm install`.
6. Output directory should stay blank/default.
7. Add environment variables.
8. Deploy.

## 4. Production Smoke Test

Set the same token locally:

```bash
PRODUCTION_HEALTH_CHECK_TOKEN="same-token-used-in-vercel"
```

Run:

```bash
npm run smoke:production -- https://your-vercel-url.vercel.app org_picx
```

Expected result:

- Environment variables pass
- Supabase connection pass
- Migrations pass
- RLS pass
- pgvector pass
- OpenAI embeddings pass
- OpenAI chat pass
- Retrieval pass or warn only if the organization has no chunks yet

## 5. Manual Demo Test

Open the deployed app and verify:

1. Login works.
2. Dashboard loads.
3. Company Brain loads.
4. AI Chat answers.
5. Sources appear.
6. Retrieval Inspector opens source chunks.
7. AI Evaluation loads.
8. Automation dashboard loads.
9. Admin Panel loads.
10. No red runtime overlays appear.

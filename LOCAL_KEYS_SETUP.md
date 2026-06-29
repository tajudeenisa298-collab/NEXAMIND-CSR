# Local Keys Setup

Edit this file:

```text
C:\Users\USER\Documents\Codex\2026-06-22\phase-2-ai-architecture-next-these\.env.local
```

## OpenAI

Replace:

```env
OPENAI_API_KEY="PASTE_OPENAI_API_KEY_HERE"
```

Keep these defaults:

```env
OPENAI_CHAT_MODEL="gpt-4.1-mini"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
OPENAI_EMBEDDING_DIMENSIONS="1536"
```

## Supabase

Create a Supabase project, then open Project Settings > API.

Replace:

```env
NEXT_PUBLIC_SUPABASE_URL="PASTE_SUPABASE_PROJECT_URL_HERE"
NEXT_PUBLIC_SUPABASE_ANON_KEY="PASTE_SUPABASE_ANON_PUBLIC_KEY_HERE"
SUPABASE_SERVICE_ROLE_KEY="PASTE_SUPABASE_SERVICE_ROLE_KEY_HERE"
```

Then open Supabase SQL Editor and run these files in order:

```text
supabase/migrations/001_company_brain.sql
supabase/migrations/002_support_chat.sql
supabase/migrations/003_demo_intelligence.sql
supabase/migrations/004_production_readiness.sql
supabase/migrations/005_ai_intelligence.sql
supabase/migrations/006_reasoning_pipeline.sql
supabase/migrations/007_automation_engine.sql
supabase/migrations/008_human_copilot.sql
supabase/migrations/009_ai_improvement_center.sql
supabase/migrations/010_evaluation_playground_roi.sql
```

## Check

After replacing the values:

```bash
npm run check:env
npm run dev
```

Then open:

```text
http://127.0.0.1:3000/api/health/production-readiness?organizationId=org_picx
```

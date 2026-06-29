# Nexamind CSR

Nexamind CSR is an AI customer-support platform built with Next.js, Supabase, pgvector, and OpenAI. It turns a company's public website into a searchable Company Brain, then uses that knowledge to power AI support chat, human copilot workflows, automation, analytics, evaluation, and demo workspaces.

## What Is Built

- SaaS shell with authentication, organizations, tenant switching, dashboard, settings, and dark mode.
- Company Brain pipeline for crawling public pages, cleaning text, chunking, embedding, and storing knowledge in Supabase.
- AI Support Chat with retrieval, citations, confidence metrics, conversation memory, thinking panel, source inspector, and replay data.
- AI Intelligence layer for intent detection, entity extraction, sentiment, response validation, confidence, and escalation decisions.
- Automation Engine with workflows, tickets, refunds, webhooks, Slack, Discord, email, logs, and dry-run/demo mode.
- Human Copilot workspace with summaries, suggested replies, notes, customer history, sources, actions, and takeover.
- Executive analytics, business impact dashboard, AI evaluation, AI playground, AI improvement center, admin panel, and AI Workspace Builder.
- Supabase migrations for Company Brain, support chat, reasoning, automation, copilot, evaluation, improvement, ROI, and production readiness.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Supabase PostgreSQL
- pgvector
- OpenAI chat and embeddings
- Vercel deployment

## Project Structure

```text
app/                  Next.js pages and API routes
components/           Shared UI components
lib/                  Product logic, AI pipelines, Supabase clients, automation, analytics
supabase/migrations/  SQL migrations to run in Supabase SQL Editor
outputs/              Product and architecture documentation
scripts/              Environment and production smoke-test helpers
work/source_text/     Extracted source material used for planning documentation
```

## Local Setup

Install dependencies:

```bash
npm install
```

Create local environment file:

```bash
cp .env.example .env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
PRODUCTION_HEALTH_CHECK_TOKEN=
```

Run all Supabase migrations in order from `supabase/migrations`.

Check local environment:

```bash
npm run check:env
```

Start local development:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000/dashboard
```

## Verification

Run TypeScript checks:

```bash
npm run typecheck
```

Build production bundle:

```bash
npm run build
```

Run production readiness smoke test after deploying:

```bash
npm run smoke:production -- https://your-vercel-url.vercel.app org_picx
```

## Production Readiness

The readiness endpoint checks:

- Environment variables
- Supabase connection
- Applied migrations
- Required tables
- Row-Level Security
- pgvector and retrieval RPC
- Multi-tenant isolation smoke test
- OpenAI embeddings
- OpenAI chat model
- End-to-end retrieval

Local:

```text
http://127.0.0.1:3000/api/health/production-readiness?organizationId=org_picx
```

Production requires:

```text
Authorization: Bearer <PRODUCTION_HEALTH_CHECK_TOKEN>
```

## Deployment

Deploy through Vercel by importing this GitHub repository, selecting Next.js, and adding the environment variables from `.env.example`.

Use the base Supabase project URL:

```text
https://your-project.supabase.co
```

Do not use the REST URL ending in `/rest/v1/`.

## Security Notes

- `.env.local` is ignored and must never be committed.
- Use private repositories while keys, client demos, and production-hardening work are active.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Enable RLS on every application table.
- Use the production readiness endpoint before onboarding a real customer.

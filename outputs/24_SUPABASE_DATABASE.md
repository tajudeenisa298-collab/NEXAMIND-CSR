# 24_SUPABASE_DATABASE.md

# Supabase Database

## Overview

SupportFlow AI uses Supabase PostgreSQL as the primary database.

The database stores the operational state of the platform:

- Organizations
- Users
- Conversations
- Messages
- Attachments
- Tickets
- Escalations
- Knowledge documents
- Document chunks
- Embeddings
- Automations
- Analytics
- Feedback
- Settings
- Audit logs

pgvector supports semantic search for the RAG Knowledge System.

Supabase Row Level Security protects tenant boundaries.

## Design Philosophy

The database should be:

- Multi-tenant
- Normalized
- Secure
- Audit-friendly
- AI-friendly
- Fast for dashboard queries
- Safe for future enterprise deployment

Every table that stores organization data should include `organization_id` unless it is truly global.

Every critical table should include:

- `id`
- `created_at`
- `updated_at`
- `organization_id` where applicable

The database should make unsafe access difficult.

## Core Tables

## organizations

Stores every company using SupportFlow AI.

Key fields:

- `id`
- `company_name`
- `company_slug`
- `logo_url`
- `website`
- `support_email`
- `brand_color`
- `timezone`
- `plan`
- `status`
- `created_at`
- `updated_at`

Example:

PicX Studio as a demo organization with branded support settings.

## users

Stores authenticated internal users and customer records where applicable.

Key fields:

- `id`
- `organization_id`
- `first_name`
- `last_name`
- `email`
- `avatar_url`
- `role`
- `status`
- `last_login`
- `created_at`
- `updated_at`

Roles:

- Customer
- Agent
- Manager
- Admin
- Owner

## conversations

Stores every support conversation.

Key fields:

- `id`
- `organization_id`
- `customer_id`
- `assigned_agent`
- `status`
- `priority`
- `channel`
- `current_intent`
- `sentiment`
- `confidence_score`
- `ai_resolved`
- `escalated`
- `started_at`
- `closed_at`
- `created_at`
- `updated_at`

Statuses:

- Open
- Waiting
- Escalated
- Resolved
- Closed

## messages

Stores every message inside a conversation.

Key fields:

- `id`
- `organization_id`
- `conversation_id`
- `sender_type`
- `sender_id`
- `message`
- `model`
- `tokens`
- `citations`
- `created_at`

Sender types:

- Customer
- AI
- Human
- System

## attachments

Stores metadata for uploaded files.

Key fields:

- `id`
- `organization_id`
- `conversation_id`
- `message_id`
- `file_name`
- `file_size`
- `mime_type`
- `storage_path`
- `purpose`
- `created_at`

Supported file types:

- Images
- PDF
- ZIP
- TXT
- DOCX
- Screenshots

## intents

Stores detected intents.

Key fields:

- `id`
- `organization_id`
- `conversation_id`
- `intent`
- `confidence`
- `reasoning`
- `created_at`

Examples:

- Billing
- Refund
- Credits
- API
- Login
- Generation Failure
- Feature Request
- Sales
- Bug
- Unknown

## ai_decisions

Stores AI reasoning steps and decisions.

Used for debugging, observability, and manager review.

Key fields:

- `id`
- `organization_id`
- `conversation_id`
- `decision_type`
- `confidence`
- `action_taken`
- `reason`
- `latency`
- `model`
- `created_at`

Decision examples:

- Intent detected
- Knowledge retrieved
- Escalate
- Trigger workflow
- Safety blocked

## knowledge_documents

Stores uploaded or synced knowledge sources.

Key fields:

- `id`
- `organization_id`
- `title`
- `category`
- `source_url`
- `document_type`
- `status`
- `checksum`
- `created_at`
- `updated_at`

Categories:

- Pricing
- FAQ
- Policies
- API
- Release Notes
- Documentation
- Tutorial
- Internal Notes

## document_chunks

Stores split document content for retrieval.

Key fields:

- `id`
- `organization_id`
- `document_id`
- `chunk_index`
- `content`
- `token_count`
- `metadata`
- `created_at`

## embeddings

Stores vector metadata and pgvector values.

Key fields:

- `id`
- `organization_id`
- `chunk_id`
- `embedding_model`
- `vector`
- `created_at`

Vectors must never be shared across tenants.

## tickets

Stores support tickets created by humans or escalations.

Key fields:

- `id`
- `organization_id`
- `conversation_id`
- `assigned_agent`
- `status`
- `priority`
- `summary`
- `internal_notes`
- `created_at`
- `resolved_at`

Statuses:

- New
- Open
- In Progress
- Waiting
- Resolved
- Closed

## escalations

Tracks AI-to-human transfers.

Key fields:

- `id`
- `organization_id`
- `conversation_id`
- `reason`
- `trigger`
- `summary`
- `assigned_to`
- `created_at`

Triggers:

- Low Confidence
- Negative Sentiment
- Refund
- Security
- Bug
- Manual Request

## automations

Tracks Make.com and internal workflow executions.

Key fields:

- `id`
- `organization_id`
- `conversation_id`
- `workflow_name`
- `status`
- `input`
- `output`
- `latency`
- `retry_count`
- `idempotency_key`
- `created_at`

Examples:

- Create Ticket
- Slack Notification
- Email Customer
- CRM Update

## analytics_daily

Stores daily support metrics.

Key fields:

- `organization_id`
- `date`
- `conversations`
- `resolved_by_ai`
- `escalated`
- `average_response_time`
- `average_resolution_time`
- `csat`

## analytics_monthly

Stores monthly summaries.

Metrics:

- Conversation growth
- Resolution rate
- Automation percentage
- Money saved
- Ticket reduction
- Average wait time

## feedback

Stores customer feedback.

Key fields:

- `id`
- `organization_id`
- `conversation_id`
- `rating`
- `comment`
- `created_at`

## audit_logs

Stores administrative and sensitive actions.

Key fields:

- `id`
- `organization_id`
- `user_id`
- `action`
- `resource`
- `resource_id`
- `ip_address`
- `metadata`
- `created_at`

Examples:

- Updated prompt
- Deleted document
- Added agent
- Changed API key
- Uploaded knowledge

## api_keys

Stores encrypted integration credentials.

Key fields:

- `id`
- `organization_id`
- `provider`
- `encrypted_key`
- `status`
- `created_at`
- `updated_at`

Providers:

- OpenAI
- Slack
- Discord
- Stripe
- GitHub
- Make.com

Secrets should never be returned in plaintext.

## organization_settings

Stores workspace configuration.

Settings:

- Brand name
- Logo
- Theme
- AI tone
- Greeting message
- Escalation threshold
- Business hours
- Support email
- Language
- Enabled integrations

## conversation_memory

Stores summarized conversation memory.

Purpose:

Avoid sending entire conversations to the LLM.

Key fields:

- `id`
- `organization_id`
- `conversation_id`
- `summary`
- `token_count`
- `updated_at`

## ai_metrics

Tracks AI performance.

Metrics:

- Model
- Latency
- Token usage
- Prompt tokens
- Completion tokens
- Cost
- Cache hits
- Failures

## Row Level Security

Every organization-scoped table must enforce RLS.

Primary rule:

Users may only access rows where:

`organization_id = current_user.organization_id`

Role examples:

- Customers can access only their own conversations.
- Agents can access assigned tickets and organization conversations permitted by role.
- Managers can access the entire organization.
- Admins can manage organization settings.
- Owners can manage billing, roles, and integrations.

Service-role operations must be limited to trusted backend functions.

## Index Strategy

Required indexes:

- `organization_id`
- `conversation_id`
- `customer_id`
- `created_at`
- `intent`
- `status`
- `priority`
- `document_id`
- `ticket.status`
- `embedding.vector`
- `idempotency_key`

Vector indexes should support fast semantic retrieval.

Dashboard queries should avoid scanning large message tables.

## Data Lifecycle

## Soft Deletes

Critical business data should use soft deletes where appropriate.

Examples:

- Knowledge documents
- Conversations
- Tickets
- Files

## Backups

The system should support:

- Daily automatic backups
- Point-in-time recovery
- Document version history
- Audit logging

## Demo Dataset

For the PicX Studio demo, seed realistic but fictional data.

Seed data should include:

- Subscription plans
- Credit system documentation
- AI image generation guides
- Rendering troubleshooting
- API documentation
- Refund policy
- Customer conversations
- Escalated tickets
- Workflow history
- Analytics trends

The demo data should feel real without exposing real customer information.

## Implementation Expectations

The MVP database should include:

- Core support tables.
- Knowledge and embedding tables.
- Automation and notification tracking.
- Organization settings.
- Audit logs.
- RLS policies on organization-scoped data.
- Indexes for conversation, knowledge, ticket, and dashboard queries.

Future versions can add:

- Dedicated customer identity model.
- Enterprise organization hierarchy.
- Advanced permissions tables.
- Data retention policies per organization.
- More detailed billing and usage tables.

## Success Criteria

The Supabase Database is successful when:

- Every organization is isolated.
- Conversations and messages are easy to query.
- Knowledge retrieval is fast.
- AI decisions are auditable.
- Settings and secrets are protected.
- Dashboard analytics load quickly.
- The PicX Studio demo data feels production-ready.

The database should quietly make the entire product trustworthy.


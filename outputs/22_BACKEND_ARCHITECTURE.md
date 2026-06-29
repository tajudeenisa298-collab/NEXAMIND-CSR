# 22_BACKEND_ARCHITECTURE.md

# Backend Architecture

## Overview

The Backend Architecture is the operational foundation of SupportFlow AI.

It connects the customer chat experience, agent workspace, admin dashboard, AI engines, knowledge
system, automation workflows, notifications, storage, authentication, and analytics into one secure
multi-tenant platform.

The backend should be modular enough for the PicX Studio demo and durable enough to become a real
SaaS product.

Its purpose is to make every support interaction reliable, traceable, and safe.

## Design Philosophy

The backend should be:

- Modular
- Multi-tenant
- API-driven
- AI-first
- Secure
- Observable
- Extensible
- Vendor-aware but not permanently locked to one vendor

Every major backend function should be separated by responsibility.

The chat UI should not know how RAG works.

The AI engine should not directly write arbitrary database records.

The automation layer should not bypass permissions.

The backend should coordinate these systems through clear APIs, shared contracts, events, and audit
logs.

## Core Backend Responsibilities

The backend has ten primary responsibilities.

## 1. Serve Product APIs

The backend exposes APIs for:

- Customer chat
- Agent workspace
- Admin dashboard
- Knowledge management
- Automation workflows
- Notifications
- Analytics
- Settings
- File upload
- Authentication state

The API layer should be predictable, typed, and tenant-safe.

## 2. Enforce Multi-Tenancy

Every backend request must be scoped to an organization.

Organization isolation applies to:

- Users
- Customers
- Conversations
- Messages
- Tickets
- Knowledge documents
- Embeddings
- Files
- Automations
- Notifications
- Analytics
- API keys
- Settings

No customer data should ever be shared across organizations.

## 3. Coordinate AI Workflows

The backend routes customer messages through the AI architecture.

It coordinates:

- Prompt Engine
- Memory System
- Context Engine
- Tool Calling Engine
- Reasoning Pipeline
- Agent Prompts
- AI Safety System
- RAG Knowledge System

The backend should store AI decisions so support managers can inspect what happened.

## 4. Persist Support Data

Supabase PostgreSQL is the primary database.

It stores:

- Organizations
- Users
- Conversations
- Messages
- Attachments
- Tickets
- Escalations
- Knowledge documents
- Document chunks
- Embedding metadata
- Automations
- Analytics
- Settings
- Audit logs

pgvector supports semantic retrieval for knowledge chunks and future memory search.

## 5. Manage File Storage

Supabase Storage stores:

- Screenshots
- Attachments
- Knowledge uploads
- Conversation files
- Exports
- Logs where appropriate

Files should be private by default and accessed through signed URLs or permissioned routes.

## 6. Execute Automations

The backend works with Make.com for MVP workflow execution.

It should send structured workflow payloads and receive structured results.

Examples:

- Create ticket
- Notify Slack
- Send email
- Submit refund review
- Escalate rendering failure
- Create sales lead

Automation results must update the conversation and analytics records.

## 7. Deliver Notifications

The backend routes notifications through:

- Email
- Slack
- Discord
- Webhooks

Future channels may include SMS, Microsoft Teams, Zendesk, Intercom, Linear, Jira, GitHub, and HubSpot.

## 8. Protect Security

Security principles:

- Role-based permissions
- Row Level Security
- Encrypted API keys
- Secure file uploads
- Input validation
- Rate limiting
- Prompt injection protection
- Audit logs for administrative actions
- Tenant-isolated knowledge and embeddings

Security should be enforced in both the API layer and the database layer.

## 9. Emit Events

Important backend actions should emit events.

Examples:

- Conversation started
- Message created
- Intent detected
- Knowledge retrieved
- AI responded
- Workflow triggered
- Ticket created
- Escalated
- Conversation closed
- Notification sent

Events power analytics, notifications, automations, and observability.

## 10. Monitor Platform Health

The backend should track:

- API latency
- AI latency
- Retrieval latency
- Workflow duration
- Notification delivery
- Error rate
- Token usage
- Cost
- Cache hits
- Safety failures
- Escalation rate

Backend observability should help support managers and developers understand system behavior.

## High-Level Architecture

Customer Chat Widget

API Layer

Conversation Service

AI Orchestration Layer

Context and Retrieval Services

Tool Calling and Automation Services

Notification Engine

Supabase PostgreSQL

Supabase Storage

Analytics and Event Bus

Admin and Agent Dashboards

This architecture keeps the product experience clean while preserving strong backend boundaries.

## Backend Modules

## API Gateway

The API Gateway receives product requests.

Responsibilities:

- Authenticate requests
- Resolve organization context
- Validate inputs
- Apply rate limits
- Route to services
- Return consistent errors

## Conversation Service

Responsibilities:

- Create conversations
- Store messages
- Update conversation state
- Track intent and sentiment
- Assign conversations
- Close or reopen conversations

## AI Orchestration Service

Responsibilities:

- Start the Reasoning Pipeline
- Request context packages
- Call agent prompts
- Store AI decisions
- Run safety validation
- Return customer responses

## Knowledge Service

Responsibilities:

- Store knowledge documents
- Manage document chunks
- Store embedding metadata
- Query pgvector
- Return ranked knowledge

## Automation Service

Responsibilities:

- Validate workflow requests
- Send Make.com payloads
- Track execution status
- Retry failures
- Store automation history

## Notification Service

Responsibilities:

- Route notifications
- Apply notification preferences
- Render templates
- Send through providers
- Track delivery status

## File Service

Responsibilities:

- Validate uploads
- Store files
- Generate signed URLs
- Attach files to messages or documents
- Track file metadata

## Settings Service

Responsibilities:

- Store organization configuration
- Store integration configuration
- Store AI tone and thresholds
- Store feature flags
- Protect encrypted secrets

## Analytics Service

Responsibilities:

- Aggregate support metrics
- Track AI performance
- Track workflow performance
- Support dashboard queries

## Request Lifecycle

Example customer message lifecycle:

1. Customer sends message.
2. API authenticates or resolves anonymous chat session.
3. Conversation Service stores message.
4. Event Bus emits `message.created`.
5. AI Orchestration Service starts the Reasoning Pipeline.
6. Context Engine loads customer, memory, tool, and knowledge context.
7. RAG Knowledge System retrieves relevant chunks.
8. Reasoning Pipeline produces a decision.
9. Tool Calling Engine executes workflow if needed.
10. Safety System validates final response.
11. Conversation Service stores AI response.
12. Notification Engine notifies human team if needed.
13. Analytics Service updates metrics.

The customer should experience this as a fast, natural support reply.

## Performance Targets

Initial performance targets:

- Chat response begins within 2 seconds.
- Intent detection completes under 500ms.
- Knowledge retrieval completes under 1 second.
- Escalation creation completes under 3 seconds.
- Average dashboard page load completes under 2 seconds.
- Dashboard refresh completes under 1 second.
- Platform uptime target is 99.9%.

The backend should degrade gracefully when AI or workflow providers are slow.

## Failure Modes

## AI Provider Failure

Fallback:

- Store customer message.
- Notify support team.
- Send a safe temporary response when appropriate.

## Retrieval Failure

Fallback:

- Do not invent an answer.
- Ask clarifying question or escalate.

## Workflow Failure

Fallback:

- Retry based on policy.
- Notify admin if retries fail.
- Tell customer the request was received but needs human follow-up.

## Database Failure

Fallback:

- Return stable error response.
- Do not execute external workflows without persistence.

## Notification Failure

Fallback:

- Store delivery failure.
- Retry.
- Surface in admin dashboard.

## Implementation Expectations

The MVP backend should include:

- Next.js API routes or equivalent API layer.
- Supabase PostgreSQL as primary database.
- Supabase Auth for user identity.
- Supabase Storage for private files.
- pgvector for embeddings.
- Make.com for workflow orchestration.
- Email, Slack, Discord, and webhook notification paths.
- Event log or outbox table for system events.
- Organization-scoped RLS policies.
- Audit logs for admin and sensitive actions.

Future versions can add:

- Dedicated background workers.
- Queue infrastructure.
- Enterprise SSO.
- Advanced rate limiting.
- Dedicated vector database providers.
- Customer-owned API keys per provider.

## Success Criteria

The Backend Architecture is successful when:

- Every product surface uses consistent APIs.
- Every record is tenant-scoped.
- AI decisions are traceable.
- Files are private and permissioned.
- Workflows are validated before execution.
- Notifications are reliable.
- Analytics reflect real support activity.
- Backend failures degrade safely.

SupportFlow AI should feel effortless in the UI because the backend is disciplined underneath.


# 23_API_SPECIFICATION.md

# API Specification

## Overview

The API Specification defines how SupportFlow AI product surfaces communicate with the backend.

The API supports:

- Customer chat widget
- Agent workspace
- Admin dashboard
- AI engines
- Knowledge management
- Automation workflows
- File storage
- Notifications
- Analytics
- Organization settings

The API should be simple enough for the MVP and structured enough to support a real multi-tenant SaaS
platform.

## Design Philosophy

The API should be:

- Predictable
- Tenant-safe
- Consistent
- Versioned
- Easy to debug
- Safe for AI-driven workflows

Every request should resolve:

- Who is making the request.
- Which organization owns the data.
- What role or permission applies.
- Which resource is being accessed.
- Whether the action should be audited.

## API Conventions

## Base Path

All MVP API routes should use:

`/api/v1`

## Response Format

Successful response:

```json
{
  "data": {},
  "meta": {}
}
```

Error response:

```json
{
  "error": {
    "code": "validation_error",
    "message": "A required field is missing.",
    "details": {}
  }
}
```

## Common Headers

- `Authorization`
- `Content-Type`
- `X-Organization-Id`
- `X-Request-Id`

For embedded customer chat, anonymous or session-based access may be used instead of full user auth.

## Pagination

List endpoints should support:

- `limit`
- `cursor`
- `sort`
- `direction`

Pagination response:

```json
{
  "data": [],
  "meta": {
    "next_cursor": "cursor_123",
    "has_more": true
  }
}
```

## Authentication APIs

## GET `/api/v1/auth/session`

Returns the current session and organization context.

Used by:

- Admin dashboard
- Agent workspace

## POST `/api/v1/auth/invite`

Invites an internal user to an organization.

Required role:

- Admin
- Owner

## POST `/api/v1/auth/switch-organization`

Switches active organization for users with access to multiple organizations.

## Organization APIs

## GET `/api/v1/organizations/current`

Returns active organization settings and branding.

Includes:

- Company name
- Logo
- Brand color
- Support email
- Timezone
- Plan
- Enabled features

## PATCH `/api/v1/organizations/current`

Updates organization profile fields.

Audited:

- Yes

## Conversation APIs

## GET `/api/v1/conversations`

Lists conversations for the current organization.

Filters:

- Status
- Priority
- Intent
- Sentiment
- Assigned agent
- Channel
- Date range

## POST `/api/v1/conversations`

Creates a conversation.

Used by:

- Customer chat widget
- Admin demo tools

## GET `/api/v1/conversations/{conversation_id}`

Returns conversation detail.

Includes:

- Conversation metadata
- Customer context
- Messages
- Attachments
- AI summary
- Ticket state
- Escalation state

## PATCH `/api/v1/conversations/{conversation_id}`

Updates conversation status, priority, assignment, or tags.

## POST `/api/v1/conversations/{conversation_id}/close`

Closes a conversation.

## Message APIs

## GET `/api/v1/conversations/{conversation_id}/messages`

Returns messages for a conversation.

## POST `/api/v1/conversations/{conversation_id}/messages`

Creates a new message.

Sender types:

- Customer
- AI
- Human
- System

When customer messages are created, the backend may trigger the AI Reasoning Pipeline.

## AI APIs

## POST `/api/v1/ai/respond`

Runs the AI response pipeline for a conversation message.

Input:

```json
{
  "conversation_id": "conv_123",
  "message_id": "msg_123",
  "mode": "standard"
}
```

Output:

```json
{
  "data": {
    "response_message_id": "msg_456",
    "decision_id": "decision_123",
    "safety_status": "pass"
  }
}
```

This endpoint may be internal-only in production.

## GET `/api/v1/ai/decisions/{decision_id}`

Returns AI decision details for debugging and manager visibility.

Required role:

- Agent
- Manager
- Admin

## Knowledge APIs

## GET `/api/v1/knowledge/documents`

Lists knowledge documents.

Filters:

- Category
- Status
- Source
- Date

## POST `/api/v1/knowledge/documents`

Creates a knowledge document record.

May be paired with file upload.

## GET `/api/v1/knowledge/documents/{document_id}`

Returns document details, chunk status, and sync state.

## PATCH `/api/v1/knowledge/documents/{document_id}`

Updates document title, category, status, or metadata.

## DELETE `/api/v1/knowledge/documents/{document_id}`

Soft deletes a knowledge document.

## POST `/api/v1/knowledge/search`

Runs organization-scoped knowledge search.

Input:

```json
{
  "query": "Why are credits missing after upgrade?",
  "filters": {
    "category": ["FAQ", "Policies"]
  },
  "limit": 5
}
```

Output:

```json
{
  "data": {
    "results": []
  }
}
```

## File APIs

## POST `/api/v1/files/upload-url`

Creates a signed upload URL.

Input:

```json
{
  "file_name": "screenshot.png",
  "mime_type": "image/png",
  "file_size": 123456,
  "purpose": "conversation_attachment"
}
```

## POST `/api/v1/files/complete`

Confirms upload and creates an attachment or document record.

## GET `/api/v1/files/{file_id}/download-url`

Returns a signed download URL if the user has permission.

## Ticket APIs

## GET `/api/v1/tickets`

Lists support tickets.

Filters:

- Status
- Priority
- Assigned agent
- Conversation
- Date range

## POST `/api/v1/tickets`

Creates a ticket manually or from AI escalation.

## GET `/api/v1/tickets/{ticket_id}`

Returns ticket details.

## PATCH `/api/v1/tickets/{ticket_id}`

Updates status, priority, assignment, summary, or internal notes.

## Automation APIs

## GET `/api/v1/automations`

Lists workflow executions.

## POST `/api/v1/automations/trigger`

Triggers a workflow through the Tool Calling Engine.

This endpoint should validate permissions, inputs, confirmation, and idempotency.

## GET `/api/v1/automations/{automation_id}`

Returns execution status and result.

## Notification APIs

## GET `/api/v1/notifications`

Lists notifications and delivery events.

## POST `/api/v1/notifications/test`

Sends a test notification to a configured channel.

Required role:

- Admin
- Owner

## Analytics APIs

## GET `/api/v1/analytics/summary`

Returns dashboard metrics.

Includes:

- Total conversations
- AI resolution rate
- Escalations
- Average response time
- CSAT
- Workflow success rate

## GET `/api/v1/analytics/conversations`

Returns conversation trends.

## GET `/api/v1/analytics/ai`

Returns AI performance metrics.

Includes:

- Latency
- Token usage
- Cost
- Safety events
- Knowledge retrieval quality

## Settings APIs

## GET `/api/v1/settings`

Returns organization settings.

## PATCH `/api/v1/settings`

Updates settings.

Audited:

- Yes

## GET `/api/v1/settings/integrations`

Lists configured integrations.

Secrets should never be returned in plaintext.

## PATCH `/api/v1/settings/integrations/{provider}`

Updates provider configuration.

## Webhook APIs

## POST `/api/v1/webhooks/make`

Receives Make.com workflow callbacks.

Must validate:

- Signature or shared secret
- Organization ID
- Workflow ID
- Idempotency key

## POST `/api/v1/webhooks/provider/{provider}`

Reserved for future external provider callbacks.

## Error Codes

Common error codes:

- `unauthorized`
- `forbidden`
- `not_found`
- `validation_error`
- `rate_limited`
- `tenant_scope_error`
- `conflict`
- `workflow_failed`
- `ai_unavailable`
- `safety_blocked`
- `internal_error`

Errors should be safe for display and useful for debugging.

## API Security

Every API route should enforce:

- Authentication or valid chat session
- Organization scoping
- Role-based permission
- Input validation
- Rate limiting where needed
- Audit logging for sensitive actions

Sensitive actions:

- Updating settings
- Managing API keys
- Deleting documents
- Triggering workflows
- Exporting data
- Changing roles

## Implementation Expectations

The MVP API should implement:

- Versioned `/api/v1` routes.
- Consistent response and error format.
- Organization-scoped authorization.
- CRUD APIs for conversations, messages, tickets, knowledge, files, analytics, and settings.
- Internal AI response endpoint.
- Make.com webhook callback endpoint.
- Audit logging for admin actions.

Future versions can add:

- Public developer API.
- API key authentication for customers.
- GraphQL or typed RPC layer.
- WebSocket subscriptions.
- Dedicated webhook subscriptions.

## Success Criteria

The API is successful when:

- Product screens can be built without hidden backend assumptions.
- Every request is tenant-scoped.
- Errors are predictable.
- Sensitive actions are audited.
- AI and automation flows have clear internal contracts.
- Future integrations can be added without rewriting the core API.

SupportFlow AI should feel modern because its API is calm, consistent, and trustworthy.


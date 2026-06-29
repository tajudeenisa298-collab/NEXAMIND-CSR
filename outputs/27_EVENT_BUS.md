# 27_EVENT_BUS.md

# Event Bus

## Overview

The Event Bus connects backend systems without forcing every service to know about every other
service.

SupportFlow AI has many things happening at once:

- Customer messages
- AI decisions
- Knowledge retrieval
- Workflow execution
- Notifications
- Escalations
- Ticket updates
- Analytics updates
- Audit logs

The Event Bus provides a consistent way to record and react to these moments.

In the MVP, the Event Bus can begin as a database-backed event log or outbox table.

Future versions can move to a dedicated queue or streaming system.

## Design Philosophy

The Event Bus should make the backend more reliable and easier to extend.

When something important happens, the system should emit an event.

Other services can react without tightly coupling to the original action.

Example:

A message is created.

The conversation service emits `message.created`.

The AI pipeline can respond.

Analytics can update.

Notifications can decide whether to alert an agent.

The original message creation does not need to know every downstream behavior.

## Core Responsibilities

The Event Bus has seven primary responsibilities.

## 1. Record Important System Events

Events should be emitted for important backend activity.

Examples:

- Conversation started
- Message created
- Intent detected
- Knowledge retrieved
- AI responded
- Workflow triggered
- Workflow failed
- Ticket created
- Escalation created
- Notification sent
- Conversation closed
- Settings updated

Events create a timeline of platform behavior.

## 2. Decouple Services

The Event Bus prevents tight service dependencies.

The Conversation Service should not directly update every analytics counter.

The Automation Service should not directly call every notification channel.

Instead, services emit events and subscribers react.

## 3. Support Async Workflows

Some work should happen after the initial request.

Examples:

- Sending notifications
- Updating analytics
- Creating audit trails
- Processing documents
- Retrying failed workflows
- Generating summaries

The Event Bus gives the backend a safe way to schedule and retry this work.

## 4. Improve Reliability

Events should be durable.

If a downstream process fails, the event should remain available for retry.

This prevents silent failure.

Example:

If Slack is unavailable, `notification.send_requested` should stay retryable.

## 5. Power Analytics

Analytics depend on accurate event history.

Events should track:

- Conversation volume
- AI response activity
- Escalation rate
- Workflow success
- Notification delivery
- Knowledge retrieval usage
- Safety events

The analytics service can aggregate these events into daily and monthly tables.

## 6. Support Auditability

Some events should also create audit logs.

Examples:

- API key changed
- Knowledge document deleted
- User role changed
- High-risk workflow triggered
- Safety block occurred

Audit events must be immutable from the product UI.

## 7. Enable Future Integrations

The Event Bus makes future integrations easier.

Examples:

- Send support events to external webhooks.
- Sync tickets to Zendesk.
- Send bugs to Linear or Jira.
- Create GitHub issues.
- Notify enterprise SIEM tools.

New subscribers should be able to consume events without rewriting core flows.

## Shared Contract: SupportFlowEvent

`SupportFlowEvent` is the conceptual interface for events.

It is not production code yet.

```json
{
  "event_id": "evt_123",
  "organization_id": "org_picx",
  "event_type": "message.created",
  "resource_type": "message",
  "resource_id": "msg_456",
  "conversation_id": "conv_789",
  "actor_type": "customer",
  "actor_id": "cust_123",
  "payload": {
    "channel": "customer_chat",
    "sender_type": "customer"
  },
  "idempotency_key": "message.created.msg_456",
  "created_at": "2026-06-22T00:00:00Z"
}
```

Every event should include:

- Event ID
- Organization ID
- Event type
- Resource type
- Resource ID
- Actor
- Payload
- Idempotency key
- Timestamp

## Event Categories

## Conversation Events

Examples:

- `conversation.created`
- `conversation.updated`
- `conversation.assigned`
- `conversation.escalated`
- `conversation.resolved`
- `conversation.closed`

## Message Events

Examples:

- `message.created`
- `message.ai_created`
- `message.human_created`
- `message.customer_created`
- `message.attachment_added`

## AI Events

Examples:

- `ai.intent_detected`
- `ai.context_built`
- `ai.knowledge_retrieved`
- `ai.reasoning_completed`
- `ai.safety_reviewed`
- `ai.response_created`
- `ai.low_confidence`

## Knowledge Events

Examples:

- `knowledge.document_uploaded`
- `knowledge.document_parsed`
- `knowledge.chunked`
- `knowledge.embedded`
- `knowledge.sync_completed`
- `knowledge.sync_failed`

## Automation Events

Examples:

- `automation.requested`
- `automation.started`
- `automation.completed`
- `automation.failed`
- `automation.retry_scheduled`
- `automation.blocked`

## Ticket Events

Examples:

- `ticket.created`
- `ticket.assigned`
- `ticket.priority_changed`
- `ticket.resolved`
- `ticket.closed`

## Notification Events

Examples:

- `notification.requested`
- `notification.sent`
- `notification.failed`
- `notification.retry_scheduled`

## Configuration Events

Examples:

- `settings.updated`
- `integration.enabled`
- `integration.disabled`
- `api_key.updated`
- `prompt_config.updated`

## Safety Events

Examples:

- `safety.prompt_injection_detected`
- `safety.response_blocked`
- `safety.tool_call_blocked`
- `safety.cross_tenant_blocked`

Safety events should be visible to admins and developers.

## MVP Architecture

For MVP, use a database-backed event model.

Recommended tables:

- `events`
- `event_deliveries`
- `event_subscriptions` if external webhooks are supported

The event table stores durable event records.

Background workers or scheduled jobs process pending events.

This is simpler than introducing a dedicated queue too early.

## Event Lifecycle

1. Service performs action.
2. Service writes primary database record.
3. Service writes event in same transaction where possible.
4. Event processor finds pending event.
5. Subscribers handle event.
6. Delivery status is stored.
7. Failed deliveries retry based on policy.
8. Analytics and audit systems consume event.

The event should not be lost if a notification or workflow fails.

## Outbox Pattern

The MVP should use an outbox pattern for important async side effects.

Example:

When a conversation escalates:

1. Insert escalation record.
2. Insert `conversation.escalated` event.
3. Commit transaction.
4. Event processor sends notification and updates analytics.

This prevents the system from sending a notification about a record that failed to save.

## Idempotency

Event consumers must be idempotent.

The same event may be processed more than once during retries.

Consumers should use:

- `event_id`
- `idempotency_key`
- Resource status checks
- Delivery records

Duplicate processing should not create duplicate tickets, notifications, or workflow executions.

## Retry Policy

Event handling should support retries.

Default retry pattern:

- Attempt 1 immediately
- Attempt 2 after 30 seconds
- Attempt 3 after 2 minutes
- Attempt 4 after 10 minutes
- Mark failed and surface in admin view

Some events should not retry automatically if failure is due to permissions or validation.

## Event Payload Rules

Event payloads should be useful but not reckless.

Rules:

- Include IDs instead of full sensitive records.
- Include organization ID.
- Include enough metadata for routing.
- Avoid raw customer secrets.
- Avoid full message content unless necessary.
- Keep payloads stable across versions.

Consumers can fetch full records through permissioned backend services.

## Event Observability

The admin and developer view should track:

- Pending events
- Failed events
- Retry count
- Processing latency
- Subscriber failures
- Notification delivery failures
- Workflow execution failures

Events should make hidden system behavior visible.

## PicX Studio Examples

Example:

Customer says:

"My credits disappeared after I upgraded."

Events:

- `message.created`
- `ai.intent_detected`
- `ai.knowledge_retrieved`
- `ai.reasoning_completed`
- `message.ai_created`

If the issue escalates:

- `conversation.escalated`
- `ticket.created`
- `notification.requested`
- `notification.sent`

These events should support the demo's AI thinking timeline and dashboard metrics.

## Failure Modes

## Event Insert Fails

If the primary action depends on the event, the transaction should fail.

If the event is optional analytics, log the failure and alert developers.

## Consumer Fails

Retry.

If repeated failure occurs, mark failed and surface in monitoring.

## Duplicate Event

Use idempotency key to prevent duplicate side effects.

## Poison Event

If an event always fails due to malformed payload, stop retrying and mark as failed.

## Subscriber Down

Keep event delivery pending until retry policy completes.

## Implementation Expectations

The MVP Event Bus should include:

- Durable `events` table.
- Event type taxonomy.
- Organization-scoped events.
- Outbox pattern for important side effects.
- Delivery tracking.
- Retry handling.
- Idempotency keys.
- Analytics consumption.
- Notification and workflow subscribers.

Future versions can add:

- Dedicated queue workers.
- Webhook subscriptions.
- Streaming event pipeline.
- External audit sinks.
- Enterprise event export.

## Success Criteria

The Event Bus is successful when:

- Important actions are recorded.
- Async work is reliable.
- Notifications and analytics do not tightly couple to core writes.
- Failed side effects can be retried.
- Duplicate events do not duplicate business actions.
- Managers can see system activity.
- Future integrations can subscribe without major rewrites.

SupportFlow AI should be event-driven where it matters, not tangled where it hurts.


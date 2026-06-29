# 18_TOOL_CALLING_ENGINE.md

# Tool Calling Engine

## Overview

The Tool Calling Engine allows SupportFlow AI to perform useful actions.

It is the layer that turns AI decisions into operational support work.

Without tool calling, the AI can only explain.

With tool calling, the AI can:

- Create support tickets.
- Trigger Make.com workflows.
- Send Slack notifications.
- Create Discord alerts.
- Send emails.
- Request files.
- Schedule follow-ups.
- Update customer records.
- Escalate cases to human teams.

The Tool Calling Engine should make SupportFlow AI feel less like a chatbot and more like a support
operations teammate.

## Design Philosophy

The AI decides.

The Tool Calling Engine executes.

The AI should not directly perform business operations without structure.

Every tool call should be:

- Registered
- Permissioned
- Validated
- Confirmed when needed
- Idempotent where possible
- Logged
- Auditable
- Safe to retry

Tool calling should feel powerful, but never reckless.

## Core Responsibilities

The Tool Calling Engine has eight primary responsibilities.

## 1. Maintain Tool Registry

The registry defines every action available to the AI.

Each tool should include:

- Tool name
- Description
- Category
- Required inputs
- Optional inputs
- Permissions
- Confirmation rules
- Timeout
- Retry policy
- Success output
- Error output
- Audit requirements

The AI should only call registered tools.

There should be no hidden actions.

## 2. Validate Tool Inputs

Before execution, every tool call must validate inputs.

Validation checks:

- Required fields exist.
- Field types are correct.
- Customer identity is known.
- Organization ID is present.
- Permissions are valid.
- Tool is enabled for the organization.
- Sensitive action rules are satisfied.

If validation fails, the AI should ask a focused question or escalate.

Example:

Customer:

"Send me my invoice."

Missing:

Invoice month

AI:

"Which month would you like the invoice for?"

## 3. Enforce Permissions

Tool calling must respect permissions.

Permissions may depend on:

- Organization settings
- Customer account state
- Agent role
- Conversation channel
- Tool risk level
- Required human approval

Examples:

- AI can create a ticket without approval.
- AI can request a refund review but cannot approve a refund.
- AI can notify Slack but cannot post private customer details into a public channel.
- AI can collect information before triggering billing workflows.

The AI should understand what it is allowed to do.

## 4. Require Confirmation for Sensitive Actions

Some actions should require customer or human confirmation.

Confirmation may be required for:

- Subscription changes
- Refund requests
- Account deletion
- Billing updates
- Customer data export
- Security-sensitive actions
- Public notifications

Confirmation language should be clear.

Example:

"Before I submit the refund review, please confirm that you want me to send this request to the billing
team."

The AI should not bury confirmation inside a long response.

## 5. Execute Workflows

The MVP uses Make.com as the workflow orchestrator.

SupportFlow AI sends structured JSON to Make.com.

Example:

```json
{
  "workflow": "refund_request",
  "organization_id": "org_picx",
  "customer_email": "customer@example.com",
  "conversation_id": "conv_123",
  "reason": "Duplicate charge",
  "priority": "High"
}
```

Make.com performs the business logic and returns structured results.

Example:

```json
{
  "status": "success",
  "ticket": "SUP-1042"
}
```

The AI then explains the result to the customer.

## 6. Handle Errors and Retries

Tool failures should never silently fail.

The Tool Calling Engine should handle:

- Timeout
- Missing input
- Permission failure
- Workflow unavailable
- API error
- Duplicate request
- Partial success
- Invalid response

Retry policy should be tool-specific.

Example default:

Attempt 1

Wait 5 seconds

Attempt 2

Wait 15 seconds

Attempt 3

Notify admin and inform customer

If a tool fails, the AI should tell the customer what happened in plain language.

## 7. Store Tool History

Every tool execution should be stored.

Fields:

- Tool name
- Organization ID
- Conversation ID
- Customer ID
- Requested by
- Inputs
- Outputs
- Status
- Duration
- Error
- Retry count
- Timestamp
- Idempotency key

Tool history prevents duplicate actions and supports auditability.

## 8. Return Action Results to the AI

After execution, the Tool Calling Engine returns structured results.

The AI should use those results to respond.

Example:

Tool result:

```json
{
  "status": "success",
  "ticket_id": "SUP-1042",
  "next_step": "Finance team will review."
}
```

Customer response:

"I submitted the refund review and created ticket SUP-1042. The finance team will review it next."

The AI should not invent tool outcomes.

It should only report what the tool returned.

## Shared Contract: ToolInvocation

`ToolInvocation` is the conceptual interface for a tool call.

It is not production code yet.

```json
{
  "tool_invocation_id": "tool_123",
  "organization_id": "org_picx",
  "conversation_id": "conv_789",
  "customer_id": "cust_456",
  "tool_name": "refund_request",
  "category": "billing",
  "requested_by": "action_agent",
  "risk_level": "medium",
  "requires_confirmation": true,
  "confirmation_status": "confirmed",
  "inputs": {
    "customer_email": "customer@example.com",
    "reason": "Duplicate charge"
  },
  "idempotency_key": "conv_789_refund_request_001",
  "status": "pending",
  "created_at": "2026-06-22T00:00:00Z"
}
```

Every tool invocation should be traceable from decision to result.

## Tool Categories

## Customer Support Tools

Examples:

- Create ticket
- Assign agent
- Close ticket
- Reopen ticket
- Change priority
- Request screenshot
- Request logs

## Billing Tools

Examples:

- Invoice request
- Refund review
- Payment issue report
- Subscription upgrade request
- Subscription cancellation request
- Credit adjustment review

The AI should be careful with billing.

It can gather information and initiate review workflows, but final financial decisions may require
human approval.

## Product Support Tools

Examples:

- Known incident lookup
- Status check
- API request escalation
- Bug report
- Feature request
- Maintenance lookup

## Notification Tools

Examples:

- Slack notification
- Discord alert
- Email notification
- Webhook event

Notifications should include only appropriate information for the channel.

## Customer Success Tools

Examples:

- Schedule demo
- Book meeting
- Enterprise follow-up
- Customer feedback collection

## Tool Calling Lifecycle

Every tool call follows a lifecycle.

AI Decision

Tool Candidate Selected

Permission Check

Input Validation

Confirmation Check

Idempotency Check

Execute Tool

Receive Result

Store History

Update Conversation

Notify Customer or Team

Update Analytics

The AI should never skip validation or logging.

## Tool Registry Example

```json
{
  "tool_name": "create_ticket",
  "description": "Create a support ticket for human follow-up.",
  "category": "customer_support",
  "enabled": true,
  "required_inputs": [
    "organization_id",
    "conversation_id",
    "customer_id",
    "summary",
    "priority"
  ],
  "permissions": {
    "ai_allowed": true,
    "human_approval_required": false
  },
  "retry_policy": {
    "max_attempts": 3,
    "backoff_seconds": [5, 15]
  },
  "success_response": {
    "ticket_id": "string",
    "status": "string"
  }
}
```

## Action Agent Relationship

The Action Agent decides whether a tool should be called.

The Tool Calling Engine decides whether the tool call is allowed and executes it.

The Action Agent can propose:

- No action
- Ask for missing information
- Create ticket
- Trigger workflow
- Notify team
- Escalate

The Tool Calling Engine validates the proposal.

If validation fails, the system returns a reason.

The AI should then ask for more information or choose a safer path.

## Idempotency

Duplicate tool execution can create real support problems.

Examples:

- Two refund requests
- Two tickets
- Two Slack alerts
- Two customer emails

Every tool call that changes external state should use an idempotency key.

Recommended key structure:

`organization_id + conversation_id + tool_name + workflow_goal`

If the same action was already completed, the system should return the existing result instead of
executing again.

## Auditability

Every tool decision should be auditable.

Support managers should be able to see:

- Why the AI selected a tool.
- Which inputs were used.
- Whether confirmation was required.
- Whether the customer confirmed.
- What result came back.
- Whether the action succeeded.
- Whether a human was notified.

This is critical for trust.

## Tool Failure Modes

## Missing Inputs

The AI asks for the missing detail.

## Permission Denied

The AI explains that it cannot perform the action and escalates if needed.

## Workflow Timeout

The system retries based on policy.

If the workflow still fails, notify the support team.

## Duplicate Action

Return the previous result.

Do not execute again.

## Unsafe Action

Block the action and create a safety event.

## Partial Success

Explain what completed and what still needs human follow-up.

## PicX Studio Example Workflows

For a PicX Studio demo, the Tool Calling Engine should support examples such as:

- Missing credits after upgrade
- Refund review
- Rendering failure escalation
- Commercial license question
- Enterprise sales handoff

Example:

Customer:

"My render failed three times and used credits."

AI decision:

- Retrieve troubleshooting docs.
- Ask for generation ID if missing.
- Create ticket if repeated failure is confirmed.
- Notify support if customer is frustrated.

Tool call:

`create_ticket`

Result:

Ticket created with summary, sentiment, generation ID, and suggested next step.

## Implementation Expectations

The MVP Tool Calling Engine should support:

- Tool registry.
- Tool input validation.
- Organization-level enablement.
- Permission checks.
- Confirmation for sensitive actions.
- Make.com workflow execution.
- Slack, Discord, email, and webhook notification patterns.
- Retry policy.
- Idempotency key.
- Tool history.
- Tool result returned to the AI.

Future versions can add:

- Visual workflow builder.
- Advanced approval chains.
- Sandboxed tool simulation.
- Tool quality analytics.
- Custom organization tools.

## Success Criteria

The Tool Calling Engine is successful when:

- The AI performs useful actions safely.
- Workflows never execute with missing required inputs.
- Sensitive actions require confirmation.
- Duplicate actions are avoided.
- Tool results are accurately reflected to customers.
- Failures are visible and recoverable.
- Every action is logged and auditable.

SupportFlow AI should not only answer support questions.

It should help resolve them.


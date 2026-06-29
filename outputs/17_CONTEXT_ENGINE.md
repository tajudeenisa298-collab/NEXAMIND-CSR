# 17_CONTEXT_ENGINE.md

# Context Engine

## Overview

The Context Engine decides what the AI needs to know before it responds.

It sits between the raw support system and the AI agents.

Its job is to assemble a clean, relevant, tenant-safe context package for each customer message.

The Context Engine should answer one question:

"What information does the AI need right now to solve this support issue accurately?"

The AI should not receive everything.

It should receive the right things.

## Design Philosophy

Great AI support depends on great context.

If the AI receives too little context, it guesses.

If it receives too much context, it becomes noisy and unreliable.

The Context Engine exists to choose the middle path.

It should provide:

- The current customer message.
- The conversation state.
- Relevant memory.
- Relevant customer details.
- Retrieved knowledge.
- Active workflow state.
- Safety constraints.
- UI or channel context.

Every context package should be scoped, minimal, and explainable.

## Core Responsibilities

The Context Engine has eight primary responsibilities.

## 1. Load Conversation State

The engine loads the current conversation.

This includes:

- Recent messages
- Conversation summary
- Current status
- Assigned agent
- Channel
- Open questions
- Previous AI decisions
- Previous escalations

The AI should understand where the conversation currently stands.

## 2. Load Customer Context

The engine loads customer information relevant to the current issue.

Examples:

- Name
- Email
- Plan
- Account status
- Recent purchases
- Past tickets
- Known issues
- Support priority

Customer context should be limited to support-relevant information.

The AI should not receive unnecessary personal data.

## 3. Load Organization Context

The engine loads organization-specific support rules.

Examples:

- Product categories
- Refund policy
- Escalation paths
- Support hours
- Tone rules
- Workflow permissions
- Active incidents
- Internal notes

Organization context ensures the AI behaves like that company's support team.

## 4. Load Memory

The Context Engine requests relevant memory from the Memory System.

It may include:

- Conversation summary
- Customer history
- Entity memory
- Workflow memory
- Previous support outcomes
- Knowledge gaps

Memory should be included only when useful for the current turn.

## 5. Load Knowledge

The Context Engine requests relevant knowledge from the RAG Knowledge System.

Knowledge may include:

- Documentation
- FAQ passages
- Pricing
- Policies
- Release notes
- Known issue notes
- Internal guides

Only the highest-quality chunks should be included.

The AI should not see the entire knowledge base.

## 6. Load Tool and Workflow Context

The engine loads available actions.

Examples:

- Create ticket
- Request refund review
- Notify Slack
- Send email
- Trigger Make.com workflow
- Request screenshot
- Check status page
- Schedule follow-up

The AI should know what actions are available and what permissions are required.

## 7. Load UI and Channel Context

The engine should understand where the request is happening.

Channels may include:

- Customer chat widget
- Agent workspace
- Admin dashboard
- Email
- Slack
- Discord
- API

UI context may include:

- Current page
- Selected customer
- Selected conversation
- Agent role
- Draft reply
- Active filters

The Copilot can use UI context to provide better internal assistance.

## 8. Enforce Context Safety

The Context Engine must protect the AI from unsafe or irrelevant context.

It should:

- Exclude cross-tenant data.
- Remove unnecessary sensitive data.
- Separate internal-only context from customer-visible facts.
- Label source trust level.
- Mark stale or uncertain information.
- Preserve citations.
- Respect permissions.

Context safety happens before the AI sees the prompt.

## Shared Contract: ContextPackage

`ContextPackage` is the conceptual interface passed into AI agents.

It is not production code yet.

```json
{
  "context_package_id": "ctx_123",
  "organization_id": "org_picx",
  "conversation_id": "conv_789",
  "customer_id": "cust_456",
  "channel": "customer_chat",
  "current_message": {
    "text": "My credits disappeared after I upgraded.",
    "received_at": "2026-06-22T00:00:00Z"
  },
  "conversation_state": {
    "status": "open",
    "summary": "Customer is asking about missing credits after upgrade.",
    "open_questions": []
  },
  "customer_context": {
    "plan": "Pro",
    "account_status": "active"
  },
  "memory": [],
  "knowledge": [],
  "available_tools": [],
  "safety_constraints": [
    "Do not expose internal billing notes.",
    "Verify billing event before promising credit adjustment."
  ]
}
```

Every context package should be:

- Organization-scoped
- Traceable
- Minimal
- Fresh
- Safe
- Useful

## Context Assembly Lifecycle

Every customer message follows a context assembly lifecycle.

Customer Message

Identify Conversation

Load Conversation State

Load Customer Context

Load Organization Policy

Retrieve Memory

Retrieve Knowledge

Load Tool Availability

Apply Permissions

Filter Sensitive Data

Rank Relevance

Build ContextPackage

Send to Prompt Engine

The Context Engine should run before the Prompt Engine assembles final agent prompts.

## Relevance Ranking

The Context Engine should rank context by usefulness.

Ranking factors:

- Current intent
- Conversation stage
- Customer plan
- Recent activity
- Knowledge confidence
- Source freshness
- Source authority
- Sentiment
- Escalation risk
- Workflow state

Example:

Customer asks:

"Why are my credits missing?"

High-relevance context:

- Current plan
- Recent upgrade
- Credits FAQ
- Billing event status
- Previous credit-related tickets

Low-relevance context:

- API documentation
- Avatar generation guide
- Old resolved login issue

The AI should receive the high-relevance context first.

## Context Sources

## Conversation Database

Provides:

- Messages
- Participants
- Status
- Assignment
- Escalation state

## Customer Database

Provides:

- Profile
- Plan
- Account status
- Support priority
- Historical tickets

## Knowledge Base

Provides:

- Documentation
- Policies
- FAQs
- Internal support notes
- Release notes

## Memory System

Provides:

- Summaries
- Entities
- Workflow history
- Preference memory

## Tool Registry

Provides:

- Available actions
- Required inputs
- Permission requirements
- Confirmation requirements

## Analytics and Events

Provides:

- Recent incidents
- Repeated issues
- Workflow success or failure
- Customer sentiment trends

## Context for Customer Chat

Customer chat context should be focused and careful.

It should include:

- Current message
- Conversation summary
- Relevant customer account status
- Retrieved support knowledge
- Safe next actions

It should not include:

- Internal agent notes unless needed for reasoning
- Other customer data
- Private organization analytics
- Sensitive billing details not needed for the answer

The customer-facing response should only reveal information that is appropriate to share.

## Context for Agent Workspace

Agent workspace context can be richer.

It may include:

- AI summary
- Customer profile
- Past tickets
- Suggested replies
- Knowledge references
- Workflow history
- Escalation reason
- Recommended next action

The goal is to help the human agent solve the issue quickly.

Agents should see what matters, not everything the platform knows.

## Context for Admin Dashboard

Admin dashboard context supports insight and decision-making.

It may include:

- Support volume
- AI resolution rate
- Escalation trends
- Knowledge gaps
- Workflow performance
- Customer satisfaction
- Team productivity

The Copilot can use this context to answer manager questions.

Example:

"What are customers asking about most this week?"

The Context Engine should assemble analytics context rather than conversation-only context.

## Context and RAG

The Context Engine works closely with the RAG Knowledge System.

The RAG system retrieves candidate knowledge.

The Context Engine decides how that knowledge fits into the current support situation.

Example:

RAG returns:

- Credits FAQ
- Pricing documentation
- API billing docs
- Release note about subscription changes

Context Engine selects:

- Credits FAQ
- Release note

Reason:

The customer is asking about missing credits after an upgrade, not API billing.

## Context and Tools

The Context Engine should include tool availability.

A tool should be visible to the AI only if:

- The organization has enabled it.
- The user or AI has permission to use it.
- Required inputs can be collected.
- The action is appropriate for the current conversation.
- Safety rules allow it.

Example:

Refund workflow should appear only when billing workflows are enabled and the customer request is
eligible for review.

## Context Compression

The Context Engine should compress long histories.

Compression should preserve:

- Intent
- Important facts
- Open questions
- Commitments made
- Troubleshooting attempted
- Current emotional state
- Action history

Compression should remove:

- Repeated greetings
- Duplicated explanations
- Irrelevant tangents
- Outdated status

The AI should receive a clean summary, not a raw transcript dump.

## Context Failure Modes

## Missing Customer Data

If customer data is missing, the AI should ask for the minimum needed information.

Example:

"Can you confirm the email on the account?"

## Stale Data

If context is stale, the system should prefer fresh source-of-truth data.

## Too Much Context

If the context package is too large, compress or rank down lower-value information.

## Conflicting Sources

If retrieved knowledge conflicts with organization policy, prefer the official current policy.

If conflict remains, escalate.

## Cross-Tenant Risk

If context has the wrong organization ID, block the AI call and log a safety event.

The AI should never receive cross-tenant context.

## Implementation Expectations

The MVP Context Engine should support:

- Conversation state loading.
- Customer context loading.
- Organization policy loading.
- Memory retrieval.
- Knowledge retrieval.
- Tool availability filtering.
- Sensitive context labeling.
- Context package logging.

Future versions can add:

- UI-aware Copilot context.
- Semantic context ranking.
- Context quality scoring.
- Adaptive context windows.
- Advanced permission-aware context filtering.

## Success Criteria

The Context Engine is successful when:

- The AI receives enough context to answer accurately.
- The AI does not receive irrelevant noise.
- Customer data stays tenant-scoped.
- Sensitive information is labeled and protected.
- Retrieved knowledge is tied to the current issue.
- Tool availability reflects real permissions.
- Support agents can inspect why the AI had the context it used.

SupportFlow AI should not be smarter because it sees everything.

It should be smarter because it sees what matters.


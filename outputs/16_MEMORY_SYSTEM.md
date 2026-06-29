# 16_MEMORY_SYSTEM.md

# Memory System

## Overview

The Memory System allows SupportFlow AI to understand what has already happened.

Without memory, every customer message feels like the beginning of a new conversation.

With memory, the AI can remember the customer's issue, previous troubleshooting, account context,
open tickets, past escalations, and what has already been promised.

Memory is what prevents customers from repeating themselves.

The Memory System should make SupportFlow AI feel like a support engineer who has read the case
before responding.

## Design Philosophy

Memory should improve support quality without becoming invasive.

SupportFlow AI should remember what is useful, safe, and relevant.

It should not store everything forever.

It should not expose private details unnecessarily.

It should not use memory from one organization inside another organization.

The purpose of memory is not to make the AI seem magical.

The purpose is to make support feel continuous.

## Core Responsibilities

The Memory System has six primary responsibilities.

## 1. Maintain Conversation Memory

Conversation memory tracks what has happened inside a single support conversation.

It includes:

- Customer messages
- AI responses
- Human agent replies
- Detected intent
- Sentiment changes
- Extracted entities
- Retrieved knowledge used
- Actions taken
- Open questions
- Current status

Conversation memory helps the AI avoid repeating the same questions.

Example:

If the customer already provided an invoice ID, the AI should not ask for it again.

## 2. Maintain Customer Memory

Customer memory captures support-relevant history for a single customer.

It may include:

- Customer profile
- Subscription plan
- Previous conversations
- Past tickets
- Recent purchases
- Previous refund requests
- Known issues
- Account status
- Support preferences

Customer memory should be used carefully.

The AI should use it to be helpful, not to reveal unnecessary personal history.

Example:

"I see this is related to the rendering timeout you contacted us about earlier. I will continue from
there."

## 3. Maintain Organization Memory

Organization memory captures durable company-wide support context.

It may include:

- Product names
- Support policies
- Escalation teams
- Active incidents
- Common issues
- Workflow configuration
- Knowledge quality notes
- Tone preferences

Organization memory helps the AI act consistently across conversations.

For PicX Studio, this may include recurring questions about credits, subscriptions, export issues,
commercial licensing, and AI generation failures.

## 4. Summarize Long Conversations

Long support conversations should not be passed to the AI in full every turn.

The Memory System should generate structured summaries.

Summaries should include:

- Customer identity
- Current issue
- Relevant history
- Steps already tried
- Information collected
- Customer sentiment
- Open questions
- Actions already taken
- Suggested next step

The goal is to preserve meaning while reducing noise.

## 5. Prepare Human Handoff Memory

When a conversation escalates, the human agent should not start from zero.

The Memory System should prepare a handoff summary.

Handoff summary:

- Customer issue
- Intent
- Sentiment
- Priority
- Relevant account details
- Troubleshooting already attempted
- Workflows triggered
- Knowledge sources used
- Recommended next action

The agent should immediately understand the problem.

## 6. Support Learning Over Time

Memory should help the platform improve.

The system should track:

- Repeated questions
- Failed answers
- Missing documentation
- Common escalation reasons
- Agent edits
- Workflow outcomes
- Customer feedback

This information should improve future prompts, knowledge docs, workflows, and analytics.

The AI should learn from support operations without training on private data in unsafe ways.

## Shared Contract: MemoryRecord

`MemoryRecord` is the conceptual interface for memory stored by SupportFlow AI.

It is not production code yet.

```json
{
  "memory_id": "mem_123",
  "organization_id": "org_picx",
  "customer_id": "cust_456",
  "conversation_id": "conv_789",
  "memory_type": "conversation_summary",
  "scope": "conversation",
  "content": {
    "issue": "Credits did not appear after subscription upgrade.",
    "steps_attempted": [
      "Confirmed upgrade completed",
      "Asked for account email"
    ],
    "open_questions": [
      "Need billing email"
    ],
    "sentiment": "confused"
  },
  "confidence": 0.92,
  "source": "ai_summary",
  "created_at": "2026-06-22T00:00:00Z",
  "expires_at": null,
  "sensitivity": "support_internal"
}
```

Every memory record should have:

- Organization scope
- Customer or conversation scope
- Memory type
- Source
- Confidence
- Sensitivity level
- Timestamp

## Memory Types

SupportFlow AI should support multiple memory types.

## Conversation Summary

Short structured summary of the active conversation.

Used for:

- Long conversations
- Follow-up responses
- Handoffs
- Escalation

## Customer Support History

Relevant past support activity for a customer.

Used for:

- Avoiding repeated troubleshooting
- Detecting recurring issues
- Prioritizing escalations

## Entity Memory

Important extracted details.

Examples:

- Invoice ID
- Account email
- Subscription plan
- Error code
- Project ID
- Browser
- Operating system
- Generation ID

Entity memory should have freshness and confidence.

## Workflow Memory

Records actions already attempted.

Examples:

- Refund workflow submitted
- Ticket created
- Slack notification sent
- Follow-up scheduled
- File requested

The AI should not trigger duplicate workflows because it forgot an earlier action.

## Preference Memory

Customer or organization preferences.

Examples:

- Preferred language
- Preferred contact channel
- Tone preference
- Accessibility needs

Preference memory should be used only when relevant.

## Knowledge Gap Memory

Tracks missing information.

Examples:

- Customer asked a question not covered by docs.
- AI escalated because policy was unclear.
- Agent manually corrected an answer.

Knowledge gap memory helps improve the knowledge base.

## Memory Retrieval

The Memory System should retrieve memory based on relevance.

It should consider:

- Current intent
- Customer ID
- Conversation ID
- Organization ID
- Recency
- Sensitivity
- Confidence
- Open workflows
- Current channel

Not every memory belongs in every prompt.

The Context Engine decides which memory is relevant for the current turn.

## Memory Lifecycle

Memory should follow a clear lifecycle.

Capture

Classify

Store

Summarize

Retrieve

Use

Refresh

Expire

Audit

Each step should preserve tenant isolation and privacy.

## Capture

The system captures support-relevant facts during conversation processing.

Examples:

- "Customer is on Enterprise plan."
- "Customer provided invoice INV-45891."
- "Customer is frustrated because this is the third contact."

## Classify

The system classifies memory by type and sensitivity.

Examples:

- Entity
- Preference
- Conversation summary
- Workflow state
- Sensitive billing detail

## Store

Memory is stored in organization-scoped tables.

The system may use Supabase PostgreSQL for structured memory and pgvector for semantic retrieval of
longer summaries or conversation notes.

## Retrieve

Memory is retrieved only when relevant to the current support task.

## Refresh

Memory should be updated when facts change.

Example:

If a ticket is resolved, memory should no longer describe it as open.

## Expire

Some memory should expire.

Examples:

- Temporary workflow state
- One-time verification codes
- Stale troubleshooting details
- Old sentiment state

Durable support history can remain longer, depending on the organization's retention policy.

## Conversation Summary Format

A good conversation summary should be compact and useful.

Example:

```json
{
  "summary": "Customer upgraded plan but credits have not appeared.",
  "intent": ["Billing", "Credits"],
  "sentiment": "Confused",
  "priority": "Medium",
  "known_details": {
    "plan": "Pro",
    "billing_email": "pending",
    "invoice_id": null
  },
  "steps_attempted": [
    "Explained possible billing sync delay",
    "Asked customer for account email"
  ],
  "open_questions": [
    "Confirm account email"
  ],
  "recommended_next_action": "Verify billing event before promising credit adjustment."
}
```

The summary should be written for the next support agent, human or AI.

## Human Handoff Memory

When escalation occurs, memory becomes the bridge between AI and human support.

The handoff should include:

- What the customer wants
- Why the AI escalated
- What the AI already tried
- What information is still missing
- What the agent should do next

Example:

Escalation reason:

"Customer is requesting a refund. Policy eligibility is unclear because purchase date is missing."

Suggested next step:

"Ask for purchase date and payment method, then review refund policy."

## Privacy and Retention

Memory must be safe by design.

Rules:

- Do not store unnecessary sensitive data.
- Do not expose memory across organizations.
- Do not include private internal notes in customer responses.
- Do not use memory for unrelated purposes.
- Respect organization retention settings.
- Allow deletion when required.

Sensitive memory should be labeled.

Examples:

- Billing
- Security
- Legal
- Personal information
- Internal-only notes

The AI should know which memory can be shown to customers and which memory is only for internal
reasoning.

## Memory and Multi-Tenancy

Every memory record must include `organization_id`.

No memory should ever be retrieved across tenants.

This applies to:

- Conversation summaries
- Customer history
- Knowledge gaps
- Workflow history
- Embeddings
- Analytics

Tenant isolation is a safety requirement, not an optimization.

## Memory Failure Modes

## Missing Memory

If memory is unavailable, the AI should continue with the current conversation and ask for necessary
details.

It should not pretend to remember.

## Stale Memory

If memory conflicts with current data, current verified data wins.

Example:

If memory says a ticket is open but the ticket system says it is resolved, the resolved state should be
used.

## Conflicting Memory

If two memory records conflict, the AI should rely on the most recent verified source or escalate.

## Sensitive Memory

If memory contains private or internal-only details, it can guide reasoning but should not be repeated
to the customer.

## Memory Overload

If too much memory is retrieved, the Context Engine should compress it into a smaller summary.

The AI should not receive a noisy memory dump.

## Implementation Expectations

The MVP Memory System should support:

- Conversation summaries.
- Customer support history.
- Entity memory.
- Workflow execution memory.
- Handoff summaries.
- Organization-scoped storage.
- Basic retention labels.
- Memory retrieval for the Context Engine.

Future versions can add:

- Semantic memory search.
- Cross-product memory within the same organization.
- Automated knowledge gap clustering.
- Agent feedback loops.
- Advanced retention controls.

## Success Criteria

The Memory System is successful when:

- Customers do not have to repeat themselves.
- Human agents receive useful summaries.
- The AI remembers previous steps accurately.
- Duplicate workflows are avoided.
- Memory never leaks between tenants.
- Sensitive details are handled carefully.
- Support analytics improve from accumulated patterns.

SupportFlow AI should remember enough to be useful and forget enough to stay safe.


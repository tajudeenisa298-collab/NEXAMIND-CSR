# 19_REASONING_PIPELINE.md

# Reasoning Pipeline

## Overview

The Reasoning Pipeline defines how SupportFlow AI thinks through every customer message.

It is the step-by-step process that turns a customer request into an accurate answer, workflow action,
or human escalation.

The pipeline should make the AI behave like an experienced support engineer.

It should not rush to respond.

It should:

- Understand the message.
- Identify intent.
- Extract useful details.
- Evaluate sentiment.
- Retrieve memory.
- Retrieve knowledge.
- Reason through the issue.
- Decide whether action is needed.
- Validate safety.
- Respond clearly.
- Update analytics and memory.

The AI should search first, think second, respond last.

## Design Philosophy

SupportFlow AI should not be a single model call that immediately writes an answer.

It should be a disciplined sequence of decisions.

Every response should pass through the same mental checklist:

1. What does the customer want?
2. What do we already know?
3. What information is missing?
4. What does company knowledge say?
5. Can the AI solve this?
6. Should a workflow run?
7. Should a human take over?
8. Is the response safe and grounded?

The pipeline should be fast for simple questions and deeper for complex issues.

## Master Flow

Every AI support turn follows this master flow.

Customer Message

Preprocessing

Intent Detection

Entity Extraction

Sentiment Analysis

Context Assembly

Memory Retrieval

Knowledge Retrieval

Reasoning

Action Decision

Escalation Decision

Response Drafting

Safety Validation

Customer Response

Memory Update

Analytics Update

Each step should produce structured output.

The system should be able to inspect why the AI made each decision.

## Step 1: Preprocessing

The system normalizes the incoming message.

Tasks:

- Remove unnecessary formatting.
- Detect language.
- Extract URLs.
- Extract emails.
- Extract IDs.
- Correct obvious spelling issues.
- Preserve the original message.

Example:

Customer:

"my acct is locked and i cant get in"

Normalized:

"My account is locked and I cannot get in."

Preprocessing should clean the message without changing its meaning.

## Step 2: Intent Detection

The Intent Agent determines what the customer wants.

Example intents:

- Billing
- Refund
- Subscription
- Credits
- Generation Failure
- Rendering
- API
- Login
- Password Reset
- Feature Request
- Bug Report
- Enterprise
- Sales
- Security
- Unknown

Multiple intents can exist at the same time.

Example:

Customer:

"My payment went through but I did not receive credits."

Intent 1:

Billing

Intent 2:

Credits

The system should store confidence for each intent.

## Step 3: Entity Extraction

The pipeline extracts important details.

Examples:

- Email
- Invoice ID
- Transaction ID
- Subscription
- Project name
- Generation ID
- Browser
- Operating system
- API key reference
- Error code
- Model name

The AI should use extracted entities to avoid asking questions the customer has already answered.

Example:

Customer:

"My invoice INV-45891 was charged twice."

Extracted:

Invoice ID: INV-45891

## Step 4: Sentiment Analysis

The Sentiment Agent evaluates customer emotion.

Possible states:

- Positive
- Neutral
- Confused
- Frustrated
- Angry
- Urgent
- VIP Concern

Sentiment affects:

- Tone
- Priority
- Escalation score
- Response length
- Workflow selection

Example:

Customer:

"I have contacted support three times already."

Sentiment:

Frustrated

Escalation score increases.

## Step 5: Context Assembly

The Context Engine assembles a `ContextPackage`.

It loads:

- Conversation state
- Customer profile
- Organization policy
- Relevant memory
- Available tools
- Active workflows
- UI or channel context

The Context Engine should keep the package minimal and relevant.

The AI should not receive unrelated customer history or unnecessary internal data.

## Step 6: Memory Retrieval

The Memory System retrieves relevant memory.

It may include:

- Previous conversations
- Previous AI summaries
- Open tickets
- Recent purchases
- Prior workflow attempts
- Extracted entities
- Customer support preferences

Memory avoids repetitive support.

Example:

If the customer already submitted a screenshot, the AI should not ask for another screenshot unless a
new one is needed.

## Step 7: Knowledge Retrieval

The RAG Knowledge System searches company knowledge.

Sources:

- FAQs
- Help center
- Documentation
- Release notes
- Pricing
- Policies
- Internal guides
- Known issue notes

Retrieval should use:

- Semantic search
- Keyword search
- Re-ranking
- Metadata filtering
- Tenant isolation

Only high-quality chunks should be used.

The AI should receive sources and citations.

## Step 8: Reasoning

The Reasoning Agent acts like the support engineer.

It combines:

- Customer message
- Intent
- Entities
- Sentiment
- Context
- Memory
- Retrieved knowledge
- Company policy

The Reasoning Agent decides:

- Diagnosis
- Likely cause
- Missing information
- Best answer path
- Whether automation is needed
- Whether escalation is needed
- Confidence level

This step should not write the final customer response.

It should produce a structured decision.

## Step 9: Action Decision

The Action Agent determines whether the system should do something.

Possible decisions:

- Answer only
- Ask clarifying question
- Collect missing information
- Create ticket
- Trigger workflow
- Notify team
- Request file
- Schedule follow-up
- Escalate

The Action Agent should consider tool availability and permissions.

Example:

Customer:

"I would like a refund."

Decision:

Collect purchase date and payment method before triggering refund review.

## Step 10: Escalation Decision

The Escalation Agent decides whether a human should take over.

Escalation factors:

- Low confidence
- Negative sentiment
- Repeated failure
- Enterprise customer
- Refund request
- Legal issue
- Security issue
- Account compromise
- Complex bug
- VIP customer

Escalation should include a handoff summary.

The AI should never dump the conversation onto a human without context.

## Step 11: Response Drafting

The Response Agent writes the customer-facing answer.

Response structure:

1. Acknowledge.
2. Explain.
3. Solve or ask.
4. Offer next step.
5. Confirm what happens next.

The response should use:

- Retrieved knowledge
- Tool results
- Conversation tone
- Safety constraints
- Organization brand voice

The response should not reveal internal reasoning or private notes.

## Step 12: Safety Validation

The Safety Agent checks the drafted response and proposed actions.

Checks:

- Hallucination risk
- Missing citation
- Policy compliance
- Prompt injection
- Data leakage
- Unsafe tool call
- Cross-tenant context
- Unsupported promise
- Sensitive topic

If validation fails, the response should be revised, blocked, or escalated.

Safety validation happens before the customer sees the answer.

## Step 13: Customer Response

The final response is sent to the customer.

It should be:

- Clear
- Useful
- Grounded
- Human
- Appropriate to the customer's emotion
- Honest about uncertainty

If action was taken, the response should accurately report the result.

If action is pending, the response should say what will happen next.

## Step 14: Memory Update

After the response, the Memory System updates records.

It may store:

- Conversation summary
- Extracted entities
- Workflow status
- Open questions
- Escalation reason
- Customer sentiment
- Knowledge gaps

Memory should preserve what matters for the next turn.

## Step 15: Analytics Update

The pipeline updates analytics.

Metrics:

- Intent
- Resolution status
- Escalation status
- Sentiment
- Response time
- Knowledge sources used
- Workflow executed
- Safety outcome
- Customer feedback

Analytics help managers understand support quality.

## Shared Contract: ReasoningDecision

`ReasoningDecision` is the conceptual interface produced by the Reasoning Agent.

It is not production code yet.

```json
{
  "reasoning_decision_id": "reason_123",
  "organization_id": "org_picx",
  "conversation_id": "conv_789",
  "primary_intent": "Credits",
  "secondary_intents": ["Billing"],
  "sentiment": "Confused",
  "diagnosis": "Customer upgraded plan but credits may not have synchronized yet.",
  "confidence": 0.84,
  "missing_information": [
    "billing email"
  ],
  "recommended_response_type": "clarifying_question",
  "recommended_action": {
    "type": "collect_information",
    "tool_name": null
  },
  "escalation_required": false,
  "rationale": "Billing event cannot be verified until the customer confirms account email.",
  "sources_used": [
    "credits_faq",
    "subscription_upgrade_policy"
  ]
}
```

Every reasoning decision should include confidence, missing information, recommended action, and
whether escalation is required.

## Execution Modes

The pipeline should support different levels of depth.

## Fast Mode

Used for simple FAQs.

Agents:

- Intent
- Retrieval
- Response
- Safety

Example:

"Where can I find invoices?"

## Standard Mode

Used for most conversations.

Agents:

- Intent
- Sentiment
- Context
- Retrieval
- Reasoning
- Response
- Safety

Example:

"My credits did not appear after upgrading."

## Deep Analysis Mode

Used for complex or risky cases.

Agents:

- Intent
- Sentiment
- Context
- Retrieval
- Reasoning
- Action
- Escalation
- Safety
- Memory
- Response

Used for:

- Enterprise
- Security
- Billing
- Legal
- Complex bugs
- Angry customers
- Repeated failures

Deep mode should prioritize correctness over speed.

## Confidence and Fallback

Every major decision should include confidence.

Confidence should influence behavior.

High confidence:

- Answer directly.
- Cite relevant knowledge.
- Offer next step.

Medium confidence:

- Answer carefully.
- Ask one clarifying question if needed.

Low confidence:

- Do not guess.
- Ask for more information or escalate.

If confidence is low and the issue is sensitive, escalate.

## Explainability

Every AI decision should be inspectable.

Support managers should be able to see:

- Detected intent
- Sentiment
- Retrieved knowledge
- Reasoning summary
- Action decision
- Escalation reason
- Safety result

Explainability builds trust.

The system should not expose internal reasoning to customers, but it should be available for audits and
agent review.

## Pipeline Failure Modes

## Agent Failure

If one agent fails, retry once.

If repeated failure occurs, fallback to a simpler path or escalate.

The whole system should not fail because one specialist failed.

## Invalid Output

If structured output is invalid, attempt repair.

If repair fails, escalate or ask for clarification.

## Missing Knowledge

If no reliable knowledge exists, the AI should not invent an answer.

It should say it needs to check and escalate if appropriate.

## Tool Failure

If a workflow fails, the AI should inform the customer and notify the team.

## Safety Failure

If safety validation fails, the response should be revised or blocked.

## Example: Missing Credits

Customer:

"My credits disappeared after I upgraded."

Pipeline:

- Intent: Billing + Credits
- Sentiment: Confused
- Entities: None
- Context: Active account, upgrade likely relevant
- Memory: No prior credit issue
- Knowledge: Credits FAQ and subscription upgrade policy
- Reasoning: Need billing email to verify event
- Action: Ask for account email before workflow
- Escalation: Not yet
- Response: Ask for email and explain likely sync issue
- Safety: Pass

Customer response:

"I can help with that. It sounds like your credits may not have synchronized after the upgrade. Can you
confirm the email on the account? Once I have that, I can check the billing event and credit balance."

## Implementation Expectations

The MVP Reasoning Pipeline should support:

- Structured steps from preprocessing to analytics.
- Multi-agent execution.
- Fast, standard, and deep modes.
- ReasoningDecision output.
- Confidence scoring.
- Escalation rules.
- Safety validation before response.
- Memory and analytics updates after response.

Future versions can add:

- Agent voting.
- Automated scenario evaluation.
- Manager-visible decision timeline.
- Adaptive routing based on historical success.
- Pipeline simulation for testing.

## Success Criteria

The Reasoning Pipeline is successful when:

- The AI does not answer before understanding the issue.
- The AI retrieves knowledge before making policy claims.
- The AI asks for missing information instead of guessing.
- Tool calls happen only after validation.
- Escalations include useful context.
- Safety checks happen before customer responses.
- Every decision can be audited.

SupportFlow AI should not just generate answers.

It should reason through support.


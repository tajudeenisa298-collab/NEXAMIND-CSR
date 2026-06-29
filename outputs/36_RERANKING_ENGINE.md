# 36_RERANKING_ENGINE.md

# Reranking Engine

## Overview

The Reranking Engine decides which retrieved chunks are most useful for the AI.

Vector Search and Hybrid Retrieval produce candidate chunks.

The Reranking Engine sorts those candidates by quality, relevance, freshness, authority, and safety.

Its job is to answer:

"Which pieces of knowledge should the AI actually use before responding?"

Only the best chunks should reach the Context Engine and Prompt Engine.

## Design Philosophy

Retrieval is not finished when search returns results.

Search finds candidates.

Reranking chooses evidence.

The Reranking Engine should prefer knowledge that is:

- Relevant
- Current
- Official
- Specific
- Tenant-safe
- Source-attributed
- Appropriate for the current channel

The AI should not receive ten mediocre chunks when three excellent chunks will solve the issue.

## Core Responsibilities

The Reranking Engine has eight primary responsibilities.

## 1. Score Candidate Relevance

The engine evaluates how directly each chunk answers the customer question.

Signals:

- Vector similarity
- Keyword score
- Intent match
- Entity match
- Heading relevance
- Query term coverage

Example:

For "Why are my credits missing after upgrade?", a Credits FAQ should rank above a general pricing
page.

## 2. Prefer Fresh Content

Freshness matters.

The engine should consider:

- Last updated date
- Document version
- Crawl freshness
- Release note recency
- Stale or archived status

Outdated policy should not outrank current official documentation.

## 3. Prefer Authoritative Sources

Source authority should affect ranking.

Authority examples:

- Official documentation
- Official policy
- Internal support SOP
- Release note
- FAQ
- Tutorial
- Blog post

Official policy should outrank informal content for sensitive questions.

## 4. Apply Category Fit

The engine should compare candidate category with detected intent.

Examples:

- Billing intent should prefer Billing, Pricing, Refunds, Policies.
- API intent should prefer API Docs and Developer Documentation.
- Rendering issue should prefer Troubleshooting and Known Issues.
- Security intent should prefer Security and Escalation Procedure.

Category fit should guide ranking without hiding relevant secondary sources.

## 5. Remove Redundancy

The engine should avoid sending duplicate chunks.

If three chunks say the same thing, choose the best one.

Redundancy removal helps:

- Reduce prompt noise
- Save tokens
- Improve answer focus
- Avoid conflicting phrasing

## 6. Enforce Safety and Visibility

The engine should filter or label content based on visibility.

Visibility types:

- Public
- Customer-visible
- Support internal
- Sensitive
- Restricted

Customer-facing responses should not expose internal-only notes.

Internal notes may be used by the Copilot or human agent when permitted.

## 7. Select Final Context Chunks

The engine should select the final chunks for context assembly.

Default:

- Search returns top 10 to 20 candidates.
- Reranking selects best 3 to 5 chunks.

Only the highest-quality chunks should be sent to the LLM.

## 8. Explain Ranking Decisions

Ranking decisions should be inspectable.

The system should store:

- Candidate scores
- Final score
- Selected or rejected status
- Rejection reason
- Ranking factors

This helps improve retrieval and debug poor answers.

## Shared Contract: RerankRequest

`RerankRequest` is the conceptual interface for reranking candidates.

It is not production code yet.

```json
{
  "rerank_request_id": "rank_123",
  "organization_id": "org_picx",
  "query": "Why are my credits missing after upgrading?",
  "intent": "Credits",
  "candidates": [
    {
      "chunk_id": "chunk_123",
      "title": "Credits FAQ",
      "vector_score": 0.91,
      "keyword_score": 0.88,
      "category": "Billing",
      "last_updated": "2026-06-01"
    }
  ],
  "max_results": 5
}
```

## Reranked Result

```json
{
  "chunk_id": "chunk_123",
  "document_id": "doc_456",
  "title": "Credits FAQ",
  "final_score": 0.96,
  "selected": true,
  "ranking_factors": {
    "relevance": 0.95,
    "freshness": 0.9,
    "authority": 1.0,
    "category_fit": 0.98
  },
  "source_url": "https://help.example.com/docs/credits"
}
```

## Ranking Factors

## Similarity Score

Semantic closeness from Vector Search.

## Keyword Score

Exact match strength from keyword search.

## Freshness

How recently the document was updated or crawled.

## Popularity

How often the document successfully resolves issues.

## Official Documentation Priority

Whether the source is an official support or policy source.

## Category

How closely the document category matches the detected intent.

## Version

Whether the document version is current.

## Visibility

Whether the content is safe for the current user and channel.

## Reranking Lifecycle

1. Receive hybrid candidates.
2. Remove archived or unauthorized chunks.
3. Score relevance.
4. Score freshness.
5. Score authority.
6. Score category fit.
7. Remove duplicates.
8. Select top chunks.
9. Store ranking trace.
10. Send selected chunks to Context Engine.

## Context Selection

The Reranking Engine should optimize for the final context package.

It should choose chunks that together provide:

- Direct answer
- Policy support
- Troubleshooting steps
- Source attribution
- Relevant caveat

The best set may include multiple documents.

Example:

Missing credits after upgrade:

- Credits FAQ
- Subscription upgrade policy
- Known billing sync issue

## Handling Conflicts

If chunks conflict, the engine should prefer:

1. Current official policy
2. Fresh official documentation
3. Internal support SOP
4. FAQ
5. Older documentation
6. Informal or low-priority source

If conflict remains, pass a conflict signal to the Reasoning Pipeline.

The AI should not hide uncertainty.

## PicX Studio Examples

Customer:

"Can I use generated images commercially?"

Candidates:

- Commercial License page
- Terms of Service
- General FAQ
- Pricing page

Reranking should select:

- Commercial License page
- Terms of Service if relevant

It should not prioritize a generic feature page just because it contains "images."

## Safety Rules

Reranking safety rules:

- Never select cross-tenant chunks.
- Do not select archived content.
- Respect visibility.
- Prefer official sources for policy.
- Preserve citations.
- Flag conflicts.
- Flag low-confidence result sets.

## Failure Modes

## All Candidates Low Quality

Return low-confidence result.

The AI should ask for clarification or escalate.

## Conflicting Sources

Return conflict signal.

The AI should avoid definitive claims.

## Internal-Only Best Match

Use internally for agent context if allowed, but do not expose directly to customer.

## No Safe Candidate

Return no usable knowledge.

The AI should not answer from model memory.

## Reranker Failure

Fallback to conservative ranking:

- Official source
- Freshness
- Similarity score
- Category fit

Log failure for review.

## Implementation Expectations

The MVP Reranking Engine should support:

- Candidate scoring.
- Freshness and authority weighting.
- Category fit.
- Deduplication.
- Visibility filtering.
- Top 3 to 5 selection.
- Ranking trace.
- Conflict and low-confidence signals.

Future versions can add:

- Model-based reranking.
- Learning from answer success.
- Per-organization ranking profiles.
- Document quality score integration.
- Admin-visible retrieval comparisons.

## Success Criteria

The Reranking Engine is successful when:

- The best evidence reaches the AI.
- Irrelevant chunks are filtered out.
- Official and fresh content wins.
- Duplicate chunks are removed.
- Internal-only content is protected.
- Ranking decisions are inspectable.
- Customers receive answers grounded in the most relevant source.

Reranking is the final editorial judgment before the AI speaks.


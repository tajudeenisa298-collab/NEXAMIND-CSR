# 35_HYBRID_RETRIEVAL.md

# Hybrid Retrieval

## Overview

Hybrid Retrieval combines semantic search with keyword search.

Vector Search understands meaning.

Keyword search catches exact terms.

Together, they outperform either approach alone.

SupportFlow AI should use Hybrid Retrieval so it can find both conceptually related content and exact
support details like invoice IDs, error codes, API endpoints, product names, and policy terms.

## Design Philosophy

Customer support questions are messy.

Some questions are semantic:

"Why did my credits disappear?"

Some questions depend on exact terms:

"What does error RENDER_429 mean?"

Some questions need both:

"My API request returns 429 after upgrading."

Hybrid Retrieval should search with meaning and precision at the same time.

## Core Responsibilities

Hybrid Retrieval has eight primary responsibilities.

## 1. Build a Retrieval Plan

Before searching, the system should build a retrieval plan.

Inputs:

- Customer message
- Intent
- Extracted entities
- Organization ID
- Conversation context
- Metadata filters

The plan decides:

- Whether to run vector search
- Whether to run keyword search
- Which filters to apply
- How many candidates to retrieve
- Whether to expand the query

## 2. Run Vector Search

Vector Search retrieves semantically related chunks.

Good for:

- Natural language questions
- Policy explanations
- Troubleshooting descriptions
- Conceptual similarity

Example:

"Credits missing after upgrade" can find subscription sync documentation even without exact wording.

## 3. Run Keyword Search

Keyword search retrieves exact matches.

Good for:

- Error codes
- API endpoint names
- Invoice IDs
- Feature names
- Policy names
- Version numbers
- Product-specific terms

Example:

`RENDER_429` should match an exact troubleshooting page.

## 4. Merge Candidates

Hybrid Retrieval merges vector and keyword results.

The merge should:

- Deduplicate chunks
- Preserve both score types
- Keep source metadata
- Track why each result was included

Results should then be passed to the Reranking Engine.

## 5. Apply Metadata Filters

Filters help retrieval stay focused.

Examples:

- Organization ID
- Category
- Product area
- Language
- Document status
- Visibility
- Last updated
- Source priority

Filters should reduce noise without hiding relevant answers.

## 6. Support Fallbacks

If vector search fails, keyword search can still return candidates.

If keyword search fails, vector search can still return semantic matches.

If both fail, the AI should ask for more information or escalate.

## 7. Preserve Citations

Hybrid Retrieval should preserve the source of every candidate.

Citation metadata:

- Document title
- Source URL
- Heading
- Chunk ID
- Version
- Last updated

The AI should know where each fact came from.

## 8. Measure Retrieval Quality

Hybrid Retrieval should track:

- Search latency
- Candidate count
- No-result rate
- Selected source
- Reranking outcome
- Customer feedback
- Escalation after retrieval

These metrics help improve knowledge quality.

## Shared Contract: RetrievalPlan

`RetrievalPlan` is the conceptual interface for hybrid retrieval.

It is not production code yet.

```json
{
  "retrieval_plan_id": "ret_123",
  "organization_id": "org_picx",
  "query": "My API request returns 429 after upgrading.",
  "intent": "API",
  "entities": {
    "error_code": "429"
  },
  "search_modes": ["vector", "keyword"],
  "filters": {
    "category": ["API", "Troubleshooting"],
    "status": "active"
  },
  "vector_top_k": 10,
  "keyword_top_k": 10
}
```

## Hybrid Result

```json
{
  "chunk_id": "chunk_123",
  "document_id": "doc_456",
  "title": "API Rate Limits",
  "match_sources": ["vector", "keyword"],
  "vector_score": 0.84,
  "keyword_score": 0.97,
  "matched_terms": ["429"],
  "metadata": {
    "category": "API",
    "source_url": "https://help.example.com/docs/api/rate-limits"
  }
}
```

## Retrieval Lifecycle

1. Receive query and context.
2. Build retrieval plan.
3. Run vector search.
4. Run keyword search.
5. Merge results.
6. Deduplicate candidates.
7. Attach match explanations.
8. Pass candidates to Reranking Engine.
9. Return final selected chunks to Context Engine.

## Keyword Search Scope

Keyword search should support:

- Title search
- Heading search
- Body search
- Tag search
- Exact entity search
- Source URL search where useful

The system should prioritize title and heading matches above body-only matches.

## Query Expansion

Future versions may expand queries with synonyms or product terms.

Examples:

- "credits" and "billing credits"
- "render failed" and "generation failed"
- "commercial use" and "commercial license"
- "429" and "rate limit"

Query expansion should be controlled.

It should not drift away from the customer's actual issue.

## PicX Studio Examples

Customer:

"My render failed but it still used credits."

Vector search may find:

- Rendering failure troubleshooting
- Credits policy

Keyword search may find:

- Render Failed
- Credits

Hybrid Retrieval should merge both so the AI can answer the real combined issue.

## Safety Rules

Hybrid Retrieval rules:

- Always filter by organization.
- Respect document visibility.
- Avoid archived chunks.
- Preserve source metadata.
- Mark internal-only candidates.
- Pass confidence to reasoning.

If retrieval confidence is weak, the AI should not answer as if it is certain.

## Failure Modes

## Vector Search Fails

Use keyword search and mark lower confidence.

## Keyword Search Fails

Use vector search and continue.

## No Candidates

Return a knowledge gap signal.

The AI should ask for clarification or escalate.

## Too Many Candidates

Reduce through filters and pass best candidates to reranking.

## Conflicting Candidates

Let reranking prefer official, fresh, higher-authority sources.

## Implementation Expectations

The MVP Hybrid Retrieval system should support:

- Retrieval plan creation.
- Vector search.
- Keyword search.
- Candidate merge.
- Deduplication.
- Metadata filters.
- Source preservation.
- Confidence signal.

Future versions can add:

- Query expansion.
- Learning from selected results.
- Per-category retrieval profiles.
- Advanced lexical scoring.
- Manager-visible retrieval diagnostics.

## Success Criteria

Hybrid Retrieval is successful when:

- Semantic questions find relevant docs.
- Exact error codes and product terms are not missed.
- Combined issues retrieve multiple useful sources.
- Candidate chunks are cleanly deduplicated.
- Retrieval confidence is visible.
- Reranking receives strong candidates.

Hybrid Retrieval is where the system stops choosing between meaning and exactness.


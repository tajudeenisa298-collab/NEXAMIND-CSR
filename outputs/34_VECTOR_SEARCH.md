# 34_VECTOR_SEARCH.md

# Vector Search

## Overview

Vector Search finds knowledge chunks by semantic meaning.

When a customer asks a question, SupportFlow AI converts the question into an embedding and searches
for nearby knowledge vectors in pgvector.

Vector Search helps the AI find relevant documentation even when the customer's wording does not
match the exact words in the document.

It is the first retrieval layer in the RAG Knowledge System.

## Design Philosophy

Vector Search should be fast, scoped, and explainable.

It should:

- Search only within the customer's organization.
- Return relevant chunks quickly.
- Include source metadata.
- Support filters.
- Avoid stale or archived content.
- Provide scores for reranking.

The AI should never see the entire knowledge base.

Vector Search should return the best candidates, not the final answer.

## Core Responsibilities

Vector Search has seven primary responsibilities.

## 1. Embed the Query

The customer question or internal support query is converted into a query vector.

Query examples:

- "Why are my credits missing?"
- "My render failed and used credits."
- "How do I authenticate with the API?"
- "Can I use generated images commercially?"

The query embedding should use a compatible model with stored document embeddings.

## 2. Apply Tenant Filter

Every search must filter by `organization_id`.

This is non-negotiable.

No search should return vectors from another organization.

## 3. Apply Metadata Filters

Search can be filtered by metadata.

Filters:

- Category
- Product area
- Document type
- Language
- Status
- Source priority
- Last updated
- Tags

Example:

If the intent is Billing, billing and policy documents should be prioritized.

## 4. Run Similarity Search

The system searches pgvector for nearest chunks.

Default behavior:

- Retrieve top 10 to 20 candidate chunks.
- Exclude archived or stale chunks unless explicitly requested.
- Return score and metadata.

Only the highest-quality candidates should continue to reranking.

## 5. Return Source Metadata

Every search result should include source information.

Source metadata:

- Document title
- Source URL
- Category
- Heading
- Last updated
- Version
- Chunk ID
- Similarity score

This supports citations, debugging, and reranking.

## 6. Meet Latency Targets

Knowledge retrieval should complete quickly.

Target:

- Vector search under 1 second

For normal customer chat, the system should return results fast enough that the AI response begins
within the overall chat target.

## 7. Support Debugging

Vector Search should be inspectable.

Developers and managers should be able to see:

- Query
- Filters
- Returned chunks
- Similarity scores
- Source documents
- Excluded results reason where useful

This helps improve retrieval quality over time.

## Shared Contract: VectorSearchRequest

`VectorSearchRequest` is the conceptual interface for semantic search.

It is not production code yet.

```json
{
  "search_id": "search_123",
  "organization_id": "org_picx",
  "query": "Why are my credits missing after upgrading?",
  "query_intent": "Credits",
  "filters": {
    "category": ["FAQ", "Billing", "Policies"],
    "status": "active"
  },
  "top_k": 10,
  "created_at": "2026-06-22T00:00:00Z"
}
```

## Search Result

```json
{
  "chunk_id": "chunk_123",
  "document_id": "doc_456",
  "title": "Credits FAQ",
  "heading": "Credits After Plan Changes",
  "source_url": "https://help.example.com/docs/credits",
  "similarity_score": 0.91,
  "metadata": {
    "category": "Billing",
    "last_updated": "2026-06-01"
  }
}
```

## Search Lifecycle

1. Receive query from Context Engine or Retrieval Agent.
2. Resolve organization ID.
3. Generate query embedding.
4. Apply organization filter.
5. Apply metadata filters.
6. Run pgvector nearest-neighbor search.
7. Return candidate chunks.
8. Pass candidates to Hybrid Retrieval or Reranking Engine.

## Similarity Scoring

Vector Search should return a similarity score.

The score is not the final truth.

It indicates semantic closeness.

Reranking should later consider:

- Similarity
- Freshness
- Source authority
- Category fit
- Document version
- Popularity
- Safety constraints

## Filters by Intent

Intent can guide search.

Examples:

Billing intent:

- Prefer Billing, Pricing, Refunds, Policies

API intent:

- Prefer API Docs, Developer Documentation

Rendering issue:

- Prefer Troubleshooting, Known Issues, Product Documentation

Security:

- Prefer Security, Policy, Escalation Procedure

The system should avoid over-filtering.

If filters are too strict, relevant documents may disappear.

## PicX Studio Examples

Customer:

"My credits disappeared after upgrading."

Vector Search should find:

- Credits FAQ
- Subscription upgrade documentation
- Billing policy

It should not prioritize:

- API authentication docs
- Avatar generation guide
- General pricing page unless directly relevant

## Safety Rules

Vector Search rules:

- Always filter by organization.
- Exclude archived vectors.
- Respect document visibility.
- Do not return internal-only content to customer-facing responses unless allowed.
- Preserve source metadata.
- Log search for debugging and quality metrics.

## Failure Modes

## No Results

Return empty result with low confidence.

The AI should not invent an answer.

## Low Similarity

Pass low confidence to the Reasoning Pipeline.

Ask clarification or escalate if needed.

## Embedding Provider Failure

Retry or fall back to keyword search through Hybrid Retrieval.

## Slow Search

Log latency and surface in AI metrics.

## Cross-Tenant Result

Block result and create safety event.

## Implementation Expectations

The MVP Vector Search system should support:

- Query embeddings.
- pgvector search.
- Organization filter.
- Metadata filters.
- Top K candidate return.
- Similarity score.
- Source metadata.
- Latency logging.

Future versions can add:

- Approximate nearest-neighbor tuning.
- Query expansion.
- Per-organization search profiles.
- Search quality dashboards.
- Vector provider abstraction.

## Success Criteria

Vector Search is successful when:

- Relevant chunks are found by meaning.
- Search completes under 1 second.
- Results remain tenant-isolated.
- Stale content is avoided.
- Source metadata is preserved.
- The AI can answer from real company knowledge instead of model memory.

Vector Search is the first moment the AI starts reaching for the right shelf.


# 33_EMBEDDING_PIPELINE.md

# Embedding Pipeline

## Overview

The Embedding Pipeline converts clean knowledge chunks into semantic vectors.

Embeddings allow SupportFlow AI to find relevant information by meaning, not only by exact words.

This is what lets the AI understand that:

"My credits disappeared after upgrading"

is related to:

"Credits may sync after billing events and plan changes."

The Embedding Pipeline is the foundation of semantic retrieval.

## Design Philosophy

The pipeline should be accurate, repeatable, tenant-safe, and cost-aware.

It should:

- Embed only clean chunks.
- Preserve source metadata.
- Avoid duplicate vectors.
- Track embedding model version.
- Support re-embedding when content changes.
- Store vectors by organization.
- Keep retrieval fast.

Embeddings are not just technical artifacts.

They are the memory map of the knowledge base.

## Core Responsibilities

The Embedding Pipeline has eight primary responsibilities.

## 1. Receive Parsed Content

The pipeline receives clean parsed sections from the Document Parser.

Input includes:

- Organization ID
- Document ID
- Section text
- Heading
- Source reference
- Metadata
- Quality score

Low-quality parsed content should not be embedded without review.

## 2. Create Semantic Chunks

Large documents should never be embedded whole.

The pipeline should split content into semantic chunks.

Recommended chunk size:

- 400 to 700 tokens

Recommended overlap:

- 50 to 100 tokens

Purpose:

- Preserve context
- Improve retrieval precision
- Avoid oversized prompts
- Support accurate citations

## 3. Attach Metadata

Every chunk should receive metadata.

Metadata:

- Organization ID
- Document ID
- Chunk ID
- Source URL
- Title
- Category
- Product area
- Tags
- Language
- Version
- Last updated
- Document type
- Source priority

Metadata is critical for filtering and reranking.

## 4. Generate Embeddings

Each chunk is converted into a vector using the configured embedding provider.

MVP provider:

- OpenAI embeddings

Future:

- Multiple embedding providers
- Organization-specific providers
- Enterprise-owned models

The embedding record should store the model name and version.

## 5. Store Vectors

Vectors should be stored in Supabase PostgreSQL using pgvector.

Each organization owns its own vector collection through tenant-scoped records.

No embeddings should ever be shared across tenants.

## 6. Detect Duplicates

The pipeline should avoid duplicate embeddings.

Duplicate signals:

- Content hash
- Document checksum
- Chunk hash
- Similarity match
- Same source and version

If duplicate chunks exist, keep the newest canonical version.

## 7. Re-Embed Changed Content

When documentation changes:

- Regenerate chunks.
- Generate new embeddings.
- Delete or archive outdated vectors.
- Re-index retrieval.
- Update freshness status.

The AI should retrieve current documentation, not stale vectors.

## 8. Track Pipeline Status

Every embedding job should have status.

Statuses:

- Pending
- Chunking
- Embedding
- Stored
- Failed
- Skipped
- Archived

Status should be visible in the admin dashboard.

## Shared Contract: EmbeddingJob

`EmbeddingJob` is the conceptual interface for an embedding run.

It is not production code yet.

```json
{
  "embedding_job_id": "emb_job_123",
  "organization_id": "org_picx",
  "document_id": "doc_456",
  "status": "embedding",
  "embedding_model": "text-embedding-model",
  "chunk_count": 18,
  "created_vectors": 18,
  "skipped_duplicates": 2,
  "created_at": "2026-06-22T00:00:00Z"
}
```

## Chunk Record

Each chunk should be stored before or alongside its embedding.

Example:

```json
{
  "chunk_id": "chunk_123",
  "organization_id": "org_picx",
  "document_id": "doc_456",
  "chunk_index": 3,
  "heading": "Credits Reset",
  "content": "Credits reset monthly on the billing date.",
  "token_count": 42,
  "metadata": {
    "category": "Billing",
    "tags": ["credits", "subscription"],
    "source_url": "https://help.example.com/docs/credits"
  }
}
```

## Embedding Record

Example:

```json
{
  "embedding_id": "vec_123",
  "organization_id": "org_picx",
  "chunk_id": "chunk_123",
  "embedding_model": "text-embedding-model",
  "vector": "[...]",
  "created_at": "2026-06-22T00:00:00Z"
}
```

## Pipeline Lifecycle

1. Parser completes document.
2. Embedding job is created.
3. Content is split into semantic chunks.
4. Chunk metadata is attached.
5. Duplicate chunks are skipped.
6. Embeddings are generated in batches.
7. Vectors are stored in pgvector.
8. Document status becomes searchable.
9. Event Bus emits embedding completion.
10. Admin dashboard updates knowledge health.

## Batching and Cost Control

Embedding generation should support batching.

Batching helps:

- Reduce latency
- Control provider calls
- Track cost
- Retry partial failures

The system should track:

- Tokens embedded
- Model used
- Cost
- Job duration
- Failure rate

Embedding cost should appear in AI metrics.

## Freshness and Versioning

Every embedding should connect to a document version.

If a document changes, old embeddings should not remain active.

Recommended behavior:

- New version embeds successfully.
- New vectors become active.
- Old vectors are archived.
- Search uses only active vectors.

If new embedding fails, keep the last valid active version until the issue is resolved.

## Tenant Isolation

Tenant isolation is mandatory.

Every chunk and embedding must include `organization_id`.

Vector search must filter by organization before returning results.

No embedding from one organization should ever influence another organization's retrieval.

## PicX Studio Examples

PicX Studio chunks should preserve product language:

- Credits
- AI Image Generation
- Upscaling
- Background Removal
- AI Headshots
- Commercial License
- Generation Queue
- Render Failed
- Prompt Templates

Good embeddings let the AI retrieve the right support page even when the customer uses casual wording.

## Failure Modes

## Provider Timeout

Retry the batch.

If repeated failure occurs, mark job failed and keep previous vectors active.

## Duplicate Chunk

Skip embedding and link to existing active chunk when appropriate.

## Oversized Chunk

Split into smaller chunks before embedding.

## Low-Quality Parse

Do not embed until reviewed or re-parsed.

## Cross-Tenant Mismatch

Block job and create safety event.

## Implementation Expectations

The MVP Embedding Pipeline should support:

- Semantic chunking.
- Chunk metadata.
- OpenAI embeddings.
- pgvector storage.
- Organization-scoped vectors.
- Duplicate detection.
- Re-embedding changed documents.
- Job status tracking.
- Cost and latency metrics.

Future versions can add:

- Multiple embedding providers.
- Advanced chunk quality scoring.
- Semantic duplicate clustering.
- Incremental embedding updates.
- Admin preview of chunks.

## Success Criteria

The Embedding Pipeline is successful when:

- Clean documents become searchable vectors.
- Chunks preserve enough context.
- Duplicate vectors are avoided.
- Changed documents re-embed safely.
- Search remains tenant-isolated.
- Embedding cost is visible.
- Retrieval improves because vectors represent real product knowledge.

Embeddings are where raw documentation starts becoming AI intuition.


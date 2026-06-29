# 31_WEBSITE_INGESTION.md

# Website Ingestion

## Overview

Website Ingestion converts crawled web pages into usable knowledge records.

The Document Crawler discovers pages.

Website Ingestion fetches, cleans, classifies, deduplicates, and stores those pages so the Document
Parser and Embedding Pipeline can process them.

This is where public product knowledge begins to become AI-ready.

## Design Philosophy

Web pages are messy.

They include navigation, footers, banners, cookie notices, scripts, duplicate sections, marketing copy,
and unrelated links.

Website Ingestion should separate useful support knowledge from page noise.

It should preserve the source.

It should remove clutter.

It should never make the page say something it does not say.

## Core Responsibilities

The Website Ingestion system has eight primary responsibilities.

## 1. Fetch Approved Pages

Website Ingestion receives page candidates from the Document Crawler.

It should fetch only approved URLs.

Each fetch should record:

- URL
- Canonical URL
- HTTP status
- Content type
- Response size
- Fetch duration
- Last modified
- ETag
- Crawl job ID

Failed fetches should be stored and visible.

## 2. Extract Main Content

The system should extract the main article or documentation body.

It should remove:

- Navigation
- Headers
- Footers
- Cookie banners
- Advertisements
- Social widgets
- Scripts
- Tracking markup
- Duplicate menus

Example before:

Home > Docs > API > Authentication

Cookie Settings

Privacy

Sign In

Example after:

Authentication

To authenticate with the API...

## 3. Preserve Source Structure

Useful structure should be preserved.

Keep:

- Headings
- Subheadings
- Lists
- Tables where possible
- Code snippets
- Links
- Page title
- Breadcrumbs when useful

Structure helps chunking and retrieval.

## 4. Classify Page Type

Every page should be classified.

Categories:

- Documentation
- FAQ
- Pricing
- Policy
- Release Notes
- Tutorial
- API
- Troubleshooting
- Known Issues
- Internal Notes where authenticated later

Classification can use URL patterns, metadata, and content signals.

## 5. Normalize Content

Website content should be normalized into a consistent document record.

Normalization includes:

- Convert HTML to clean text or Markdown-like text.
- Resolve relative links.
- Preserve source URL.
- Remove duplicate paragraphs.
- Normalize whitespace.
- Preserve code blocks.
- Store language.
- Store metadata.

The output should be ready for the Document Parser.

## 6. Detect Duplicate Pages

Duplicate pages should not create duplicate knowledge.

Signals:

- Canonical URL
- Content hash
- Similarity score
- Page title
- Source URL variants

If duplicates exist, keep the newest canonical version and archive the older version.

## 7. Track Freshness

Every ingested page should store:

- First seen date
- Last crawled date
- Last changed date
- Version
- Checksum
- Source URL
- Status

If the page changes, downstream chunks and embeddings should be regenerated.

If the page disappears, the document should be marked stale or archived.

## 8. Queue Parser Jobs

Once a page is cleaned and normalized, the system should queue it for parsing.

The parser should receive:

- Organization ID
- Document ID
- Source URL
- Cleaned content
- Metadata
- Document type
- Category

Website Ingestion should not generate embeddings itself.

## Shared Contract: WebsiteIngestionRecord

`WebsiteIngestionRecord` is the conceptual interface for a fetched page.

It is not production code yet.

```json
{
  "ingestion_id": "ing_123",
  "organization_id": "org_picx",
  "crawl_job_id": "crawl_456",
  "source_url": "https://help.example.com/docs/credits",
  "canonical_url": "https://help.example.com/docs/credits",
  "title": "Credits FAQ",
  "category": "FAQ",
  "content_type": "text/html",
  "checksum": "sha256_abc",
  "status": "ready_for_parsing",
  "metadata": {
    "language": "en",
    "last_modified": "2026-06-22T00:00:00Z"
  }
}
```

## Ingestion Lifecycle

1. Receive page candidate.
2. Validate organization and source scope.
3. Fetch page.
4. Extract main content.
5. Remove web clutter.
6. Normalize text and structure.
7. Classify page category.
8. Compute checksum.
9. Detect duplicates.
10. Store ingestion record.
11. Queue parser job.
12. Emit ingestion event.

## Metadata Extraction

Website Ingestion should extract useful metadata.

Metadata:

- Title
- Description
- Canonical URL
- Breadcrumb
- Category
- Product area
- Tags
- Language
- Last modified
- Source priority
- Public or internal status

Metadata dramatically improves retrieval accuracy later.

## Source Priority

Not all pages are equal.

Priority examples:

- Official documentation: High
- Policy page: High
- Release note: High
- FAQ: Medium
- Blog post: Low unless explicitly allowed
- Marketing page: Low

Source priority should influence reranking.

## Content Quality Checks

The system should detect low-quality ingestion.

Warnings:

- Very little extracted text
- Mostly navigation
- Duplicate content
- Missing title
- Unsupported language
- HTTP error
- Content too large
- Content changed dramatically

Low-quality pages should not silently enter retrieval.

## PicX Studio Examples

Useful website ingestion targets:

- Credits FAQ
- Subscription pricing
- Refund policy
- API authentication docs
- Rendering troubleshooting
- Image generation guide
- Commercial license page
- Release notes

When a customer asks about missing credits, the ingested credits documentation should be clean enough
for retrieval to select it over unrelated pricing or API pages.

## Security Rules

Website ingestion rules:

- Ingest only approved sources.
- Treat fetched content as untrusted text.
- Do not execute scripts.
- Do not follow unsafe redirects.
- Do not store cookies or session secrets.
- Do not let page text override system prompts.
- Preserve organization ID on every record.

Website content can inform the AI.

It cannot instruct the AI to ignore safety rules.

## Failure Modes

## Fetch Failure

Store failure and retry based on crawl policy.

## Empty Extraction

Mark page as low quality and do not queue embeddings.

## Unsupported Content Type

Route to Document Parser if it is a supported file type, otherwise mark unsupported.

## Duplicate Page

Skip or archive duplicate.

## Stale Page

Mark stale and keep previous valid version until replacement succeeds.

## Implementation Expectations

The MVP Website Ingestion system should support:

- Fetching approved URLs.
- HTML main-content extraction.
- Noise removal.
- Metadata extraction.
- Page classification.
- Checksum and duplicate detection.
- Parser job creation.
- Ingestion status tracking.

Future versions can add:

- Authenticated website ingestion.
- Provider-specific help center ingestion.
- Sitemap freshness optimization.
- Content quality scoring.
- Automatic page category tuning.

## Success Criteria

Website Ingestion is successful when:

- Web pages become clean support knowledge.
- Navigation and clutter are removed.
- Source metadata is preserved.
- Duplicate pages are avoided.
- Changed pages trigger reprocessing.
- Unsafe webpage instructions do not affect AI behavior.
- Parsed content is ready for chunking and embedding.

The AI feels informed because the website ingestion layer quietly turns messy web pages into trusted
knowledge.


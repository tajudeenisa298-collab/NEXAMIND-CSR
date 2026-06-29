# 30_DOCUMENT_CRAWLER.md

# Document Crawler

## Overview

The Document Crawler is the system that discovers knowledge sources for SupportFlow AI.

It finds documentation, help center pages, public guides, release notes, status pages, policy pages,
and other trusted content that should become part of an organization's knowledge base.

The crawler is the first step in the knowledge pipeline.

If it discovers the wrong content, the AI retrieves the wrong truth.

If it misses important content, the AI becomes less useful.

The crawler should be careful, scoped, and transparent.

## Design Philosophy

The crawler should not behave like a broad internet scraper.

It should behave like a support operations assistant that knows where an organization's product
knowledge lives.

It should:

- Crawl approved sources only.
- Respect organization boundaries.
- Avoid duplicate content.
- Preserve source metadata.
- Detect content freshness.
- Support scheduled recrawls.
- Hand clean source records to ingestion.

The goal is not to collect everything.

The goal is to collect the right support knowledge.

## Core Responsibilities

The Document Crawler has eight primary responsibilities.

## 1. Manage Crawl Sources

Admins should be able to define crawl sources.

Source examples:

- Help center root URL
- Documentation site
- Pricing page
- Terms page
- Refund policy page
- Release notes
- Status page
- Public FAQ
- Developer docs

For PicX Studio, sources may include documentation for credits, subscriptions, image generation,
rendering failures, export issues, API access, commercial licenses, and refund policy.

## 2. Discover URLs

The crawler should discover pages from approved sources.

Discovery methods:

- Sitemap
- Linked pages under allowed domain
- Manually entered URLs
- RSS or release feed
- Help center category pages
- Future provider APIs

The crawler should stay inside allowed scope.

It should not wander across unrelated domains.

## 3. Apply Crawl Rules

Each source should define crawl rules.

Rules:

- Allowed domains
- Allowed paths
- Blocked paths
- Maximum depth
- Maximum pages
- Crawl frequency
- Content type allowlist
- Authentication requirement

Examples:

- Allow `/docs/*`
- Allow `/help/*`
- Block `/login`
- Block `/account`
- Block tracking and marketing pages if not useful for support

## 4. Capture Source Metadata

Every discovered page should include metadata.

Metadata:

- Organization ID
- Source ID
- URL
- Canonical URL
- Page title
- Content type
- Last modified date
- Crawl time
- HTTP status
- Checksum
- Source category
- Language
- Parent URL

Metadata improves retrieval and freshness management later.

## 5. Detect Changes

The crawler should avoid reprocessing unchanged pages.

Change detection should use:

- HTTP headers
- Last modified value
- ETag
- Content checksum
- Canonical URL
- Content hash

If content changes, the system should trigger re-ingestion.

If content is unchanged, the system should skip parsing and embedding.

## 6. Avoid Duplicates

Documentation often repeats content.

Duplicates may appear through:

- Canonical and non-canonical URLs
- Category pages
- Print pages
- Query parameters
- Mobile pages
- Mirrors

The crawler should use checksums, canonical URLs, and content similarity to avoid duplicate ingestion.

## 7. Emit Crawl Events

Important crawl activity should emit events.

Examples:

- `crawler.source_created`
- `crawler.job_started`
- `crawler.page_discovered`
- `crawler.page_changed`
- `crawler.page_unchanged`
- `crawler.job_completed`
- `crawler.job_failed`

These events help the admin dashboard show knowledge freshness.

## 8. Hand Off to Website Ingestion

The crawler should not parse and embed content itself.

It should hand discovered pages to the Website Ingestion system.

The crawler finds.

The ingestion system fetches, cleans, classifies, and prepares the page.

The parser, embedding pipeline, and retrieval systems then continue the work.

## Shared Contract: CrawlJob

`CrawlJob` is the conceptual interface for a crawl run.

It is not production code yet.

```json
{
  "crawl_job_id": "crawl_123",
  "organization_id": "org_picx",
  "source_id": "src_help_center",
  "source_type": "website",
  "start_url": "https://help.example.com",
  "allowed_domains": ["help.example.com"],
  "allowed_paths": ["/docs", "/help"],
  "blocked_paths": ["/login", "/account"],
  "max_depth": 3,
  "max_pages": 500,
  "status": "running",
  "created_at": "2026-06-22T00:00:00Z"
}
```

Every crawl job should be organization-scoped and auditable.

## Crawl Lifecycle

1. Admin creates or updates a crawl source.
2. Backend validates source configuration.
3. Crawl job is scheduled.
4. Crawler fetches sitemap or start URL.
5. Crawler discovers allowed URLs.
6. Crawler checks each URL for freshness and duplicates.
7. Changed pages are queued for ingestion.
8. Crawl summary is stored.
9. Event Bus emits crawl completion.
10. Admin dashboard shows source health.

## Crawl Source Types

## Public Website

Used for public documentation, help centers, product pages, pricing, and policies.

## Sitemap

Preferred when available.

Sitemaps provide cleaner URL discovery and freshness hints.

## RSS or Release Feed

Useful for release notes, announcements, status updates, and maintenance notices.

## Uploaded URL List

Useful for controlled demos and early MVP setup.

Admins can provide exact pages to ingest.

## Future Provider Source

Future integrations may include:

- Notion
- Confluence
- GitHub Wiki
- GitBook
- Zendesk Help Center
- Intercom Articles
- Freshdesk
- Google Drive
- Dropbox

Provider crawlers should use the same source and job concepts.

## Scope and Safety

Crawler safety rules:

- Crawl only approved organization sources.
- Never crawl private account pages without explicit integration support.
- Never store secrets from pages.
- Respect blocked paths.
- Limit page count and depth.
- Rate-limit requests.
- Store crawl errors without exposing sensitive content.
- Keep all discovered records tenant-scoped.

The crawler should protect both SupportFlow AI and customer websites.

## Freshness Management

Every crawled source should have a freshness state.

States:

- Fresh
- Stale
- Changed
- Failed
- Disabled

Admins should be able to see when documentation was last crawled and whether ingestion succeeded.

Freshness affects retrieval quality.

Old documentation should rank lower than current official content.

## PicX Studio Demo Expectations

For the PicX Studio demo, the crawler can be simulated or seeded with controlled source records.

The knowledge base should feel like it came from real PicX support material:

- Credits FAQ
- Subscription plans
- Rendering troubleshooting
- Commercial license policy
- API documentation
- Refund policy
- Prompt guide
- Export issues

The demo does not need to crawl the live internet in real time.

It should show that SupportFlow AI can keep documentation fresh when connected to real sources.

## Failure Modes

## Source Unreachable

Mark source as failed and notify admin.

Do not delete previous working knowledge automatically.

## Too Many Pages

Stop at configured limit and mark crawl as partial.

## Duplicate Content

Keep newest canonical version and skip duplicates.

## Blocked Path

Skip and log as intentionally blocked.

## Parse Unsupported

Queue failure details for the parser or ingestion system.

## Implementation Expectations

The MVP Document Crawler should support:

- Manual source configuration.
- Sitemap or start URL discovery.
- Allowed and blocked path rules.
- Page freshness checks.
- Content checksums.
- Crawl job status.
- Event emission.
- Handoff to website ingestion.

Future versions can add:

- Authenticated provider crawlers.
- Crawl scheduling UI.
- Deep source health dashboard.
- Automatic source recommendations.
- Enterprise connector crawlers.

## Success Criteria

The Document Crawler is successful when:

- Only approved sources are discovered.
- Changed documentation is detected.
- Duplicate content is avoided.
- Crawl status is visible.
- Tenant boundaries are preserved.
- Website ingestion receives clean page candidates.
- The knowledge base stays fresh without manual re-uploading.

SupportFlow AI starts feeling magical when it knows the product as soon as the product changes.


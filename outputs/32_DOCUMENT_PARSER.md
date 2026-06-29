# 32_DOCUMENT_PARSER.md

# Document Parser

## Overview

The Document Parser converts uploaded files and ingested web content into clean, structured text.

It is the bridge between raw documents and AI-ready knowledge.

SupportFlow AI should support many knowledge formats:

- PDF
- Markdown
- HTML
- TXT
- DOCX
- CSV
- JSON
- ZIP documentation
- Notion export
- Confluence export

The parser should preserve meaning, remove noise, and prepare content for semantic chunking.

## Design Philosophy

The parser should be faithful.

It should not rewrite company policy.

It should not invent headings.

It should not remove important support details.

It should transform documents into clean text while preserving the source structure needed for
retrieval.

Good parsing makes the AI feel knowledgeable.

Bad parsing makes the AI quote junk.

## Core Responsibilities

The Document Parser has eight primary responsibilities.

## 1. Detect Document Type

The parser should detect file type using:

- MIME type
- File extension
- Content signature
- Source metadata

Supported parsers:

- Markdown Parser
- PDF Parser
- HTML Parser
- DOCX Parser
- CSV Parser
- JSON Parser
- TXT Parser
- ZIP Parser

Unsupported files should be rejected or marked for manual review.

## 2. Extract Text

The parser extracts text from the source.

Extraction should preserve:

- Headings
- Paragraphs
- Lists
- Tables where possible
- Code blocks
- Links
- Page or section ordering

Extraction should remove:

- Hidden markup
- Scripts
- Duplicated content
- Repeated headers
- Repeated footers
- Empty sections

## 3. Clean Formatting

The cleaner removes unnecessary formatting.

Remove:

- Multiple spaces
- Broken line wraps
- Hidden HTML
- Unused CSS
- Duplicate paragraphs
- Navigation menus
- Cookie banners
- Social widgets

The output should be easy to read and chunk.

## 4. Preserve Source References

Every parsed section should know where it came from.

Source references:

- Document ID
- Source URL
- File name
- Page number where available
- Heading path
- Section index
- Original format

Source references support citations and debugging.

## 5. Extract Metadata

Each parsed document should produce metadata.

Metadata:

- Title
- Category
- Source URL
- Product area
- Last updated
- Document type
- Language
- Tags
- Version
- Organization ID
- Checksum

Metadata improves retrieval quality and freshness management.

## 6. Prepare Semantic Sections

The parser should identify semantic sections before chunking.

Examples:

- "Authentication"
- "Getting API Key"
- "Rate Limits"
- "Refund Policy"
- "Credits Reset"
- "Rendering Troubleshooting"

Chunking should respect these sections.

Large documents should never be embedded whole.

## 7. Validate Parsed Quality

The parser should score parsed output.

Quality checks:

- Text length
- Heading detection
- Duplicate ratio
- Empty content ratio
- Encoding issues
- Table extraction quality
- Language detection
- Parser warnings

Low-quality parses should be visible to admins.

## 8. Queue Chunking

After parsing, the parser queues content for chunking.

It should pass:

- Clean text
- Section structure
- Metadata
- Source references
- Quality status

The parser should not generate embeddings directly.

## Shared Contract: ParsedDocument

`ParsedDocument` is the conceptual interface for parser output.

It is not production code yet.

```json
{
  "parsed_document_id": "parsed_123",
  "organization_id": "org_picx",
  "document_id": "doc_456",
  "title": "Credits FAQ",
  "document_type": "html",
  "category": "FAQ",
  "language": "en",
  "sections": [
    {
      "heading": "Credits Reset",
      "text": "Credits reset monthly on the billing date.",
      "source_ref": {
        "url": "https://help.example.com/docs/credits",
        "section_index": 2
      }
    }
  ],
  "quality_score": 0.94,
  "status": "ready_for_chunking"
}
```

## Parser Types

## Markdown Parser

Preserves headings, lists, code blocks, and links.

Best for technical docs and internal manuals.

## PDF Parser

Extracts text by page and attempts to preserve section order.

PDF parsing should record page references for citations.

If PDF text is image-based, future OCR may be required.

## HTML Parser

Converts cleaned website content into structured text.

Should preserve headings, tables, links, and code snippets.

## DOCX Parser

Extracts document headings, paragraphs, tables, and lists.

Useful for internal policies and support SOPs.

## CSV Parser

Parses rows into structured records.

Useful for FAQ imports, product matrices, and support data.

## JSON Parser

Parses structured documentation or exported knowledge.

Should preserve keys, labels, and nested meaning.

## ZIP Parser

Expands documentation bundles.

Each contained file should be parsed separately and linked to the source archive.

## Chunking Preparation

The parser should prepare content for chunking but not decide final chunk sizes alone.

Recommended chunking handoff:

- Section heading
- Section text
- Source reference
- Category
- Tags
- Product area
- Token estimate

The Embedding Pipeline should split long sections into final chunks.

## Source Attribution

Every parsed section should support source attribution.

Citation source may include:

- Document title
- URL
- Page number
- Heading
- Version
- Last updated date

The AI should know where its information came from before responding.

## PicX Studio Examples

Parser targets for PicX Studio:

- Refund Policy PDF
- Credits FAQ HTML page
- API Docs Markdown
- Rendering Troubleshooting DOCX
- Release Notes page
- Commercial License page
- Prompt Guide PDF

The parser should preserve terms like Credits, Generation Queue, Render Failed, Commercial License,
AI Headshots, Background Removal, and Prompt Templates.

These terms make the AI feel specific to PicX Studio.

## Failure Modes

## Unsupported File

Mark unsupported and notify admin.

## Empty Parse

Do not queue embeddings.

Mark parse as failed or low quality.

## Encoding Error

Try safe decoding.

If output remains broken, mark for review.

## Table Loss

Store parser warning.

Tables may need special handling in future versions.

## Duplicate Sections

Deduplicate before chunking.

## Implementation Expectations

The MVP Document Parser should support:

- Markdown
- PDF
- HTML
- TXT
- DOCX where available
- CSV
- JSON
- Clean text output
- Metadata extraction
- Source references
- Parser quality status
- Chunking handoff

Future versions can add:

- OCR
- Advanced table extraction
- Diagram descriptions
- Provider-specific export parsers
- Parser preview UI
- Manual correction tools

## Success Criteria

The Document Parser is successful when:

- Raw files become clean structured text.
- Important headings and source references are preserved.
- Junk content is removed.
- Parser failures are visible.
- Chunking receives high-quality sections.
- Citations can point back to real sources.

The parser is invisible when it works and painfully obvious when it does not.


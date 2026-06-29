# 26_FILE_STORAGE.md

# File Storage

## Overview

File Storage allows SupportFlow AI to handle screenshots, attachments, knowledge uploads, exports,
logs, and conversation files.

The MVP should use Supabase Storage.

Files are important because support often depends on evidence:

- Screenshots
- Error logs
- PDFs
- ZIP files
- Product exports
- API examples
- Knowledge documents

The storage system should make files easy to upload and safe to access.

## Design Philosophy

Files should be private by default.

Every file should be:

- Tenant-scoped
- Permissioned
- Validated
- Linked to a purpose
- Stored with metadata
- Accessible through signed URLs
- Auditable when sensitive

The AI should be able to reason about file metadata, but it should not expose private files without
permission.

## Storage Responsibilities

The File Storage system has seven primary responsibilities.

## 1. Store Conversation Attachments

Customers and agents can upload files to conversations.

Examples:

- Screenshot of rendering error
- Browser console log
- Invoice PDF
- API response sample
- Exported project file

Attachments should be linked to:

- Organization
- Conversation
- Message
- Uploaded by
- File purpose

## 2. Store Knowledge Documents

Admins can upload knowledge documents.

Supported formats:

- PDF
- Markdown
- HTML
- TXT
- DOCX
- CSV
- JSON
- ZIP documentation

Knowledge uploads should connect to the document ingestion pipeline.

## 3. Store Exports

The platform may generate exports.

Examples:

- Conversation export
- Analytics export
- Ticket report
- Knowledge sync report

Exports should expire or be deleted according to retention policy.

## 4. Store Generated Logs

Some support workflows may attach logs or diagnostic output.

Logs should be treated as sensitive by default.

They may include:

- Account identifiers
- API request details
- Error codes
- Internal IDs

## 5. Validate Uploads

Before accepting a file, the backend should validate:

- File size
- MIME type
- Extension
- Purpose
- Organization
- Conversation or document relationship
- User permission

Invalid files should be rejected before storage completion.

## 6. Generate Signed URLs

Files should not be public by default.

Access should use short-lived signed URLs or backend-proxied downloads.

Signed URLs should only be generated after permission checks.

## 7. Track File Metadata

The database should store file metadata in `attachments` or related tables.

Metadata should include:

- File name
- File size
- MIME type
- Storage path
- Purpose
- Organization ID
- Conversation ID
- Message ID
- Uploaded by
- Created date

The database record is how the product understands the file.

The storage object is where the bytes live.

## Storage Buckets

Recommended MVP buckets:

## conversation-attachments

Stores customer and agent uploads.

Access:

- Customer can access own conversation files.
- Agents can access assigned or permitted organization conversations.
- Managers and admins can access organization files.

## knowledge-documents

Stores uploaded knowledge source files.

Access:

- Admin
- Manager where permitted
- Backend ingestion workers

## exports

Stores generated exports.

Access:

- Requesting user
- Admins
- Owners

## system-artifacts

Stores internal artifacts where needed.

Access:

- Backend only

## Storage Path Convention

Storage paths should include organization scope.

Recommended pattern:

`organizations/{organization_id}/{bucket_purpose}/{resource_id}/{file_id}-{safe_file_name}`

Examples:

`organizations/org_picx/conversations/conv_123/file_456-screenshot.png`

`organizations/org_picx/knowledge/doc_789/refund-policy.pdf`

Paths should not depend on user-provided names alone.

## Upload Lifecycle

File upload should follow a controlled lifecycle.

1. UI requests upload URL.
2. Backend validates file metadata.
3. Backend creates signed upload URL.
4. UI uploads file to Supabase Storage.
5. UI confirms upload completion.
6. Backend creates database metadata record.
7. Event Bus emits file event.
8. File appears in conversation or knowledge system.

Knowledge files then continue into document ingestion.

## Download Lifecycle

1. UI requests download URL.
2. Backend checks organization, role, and resource access.
3. Backend generates signed URL.
4. UI downloads file.
5. Access may be logged if file is sensitive.

The browser should not construct storage URLs directly.

## File Purposes

Every file should have a purpose.

Examples:

- `conversation_attachment`
- `customer_screenshot`
- `knowledge_document`
- `analytics_export`
- `ticket_attachment`
- `workflow_artifact`
- `system_log`

Purpose controls validation, permissions, retention, and AI access.

## AI Access to Files

The AI should not receive raw files automatically.

It may receive:

- File name
- File type
- Upload timestamp
- Extracted text where safe
- Summary from parser
- Link to internal file reference

For images or screenshots, future systems may produce structured descriptions.

For MVP, the AI can know that a screenshot exists and ask a human or workflow to review it if needed.

## Security Rules

File security rules:

- Private buckets by default.
- No public customer uploads.
- Signed URLs should expire.
- Validate file type and size.
- Sanitize file names.
- Store organization ID in metadata.
- Prevent cross-tenant access.
- Never expose storage service keys to the browser.
- Audit sensitive downloads where needed.

## PicX Studio Examples

Relevant demo file scenarios:

- Customer uploads screenshot of failed image generation.
- Customer uploads export error screenshot.
- Admin uploads refund policy PDF.
- Admin uploads API documentation.
- Agent downloads conversation export.
- AI notes that a screenshot was attached before escalating to engineering.

The demo should show files supporting real support workflows.

## Failure Modes

## Upload Fails

The UI should show a clear retry option.

The backend should not create final metadata until upload is confirmed.

## Invalid File Type

Reject with a clear error.

## Oversized File

Reject before upload where possible.

## Permission Denied

Return `forbidden`.

Do not reveal whether unrelated files exist.

## Missing Storage Object

Mark metadata as inconsistent and notify admin if repeated.

## Implementation Expectations

The MVP File Storage system should include:

- Supabase Storage buckets.
- Signed upload URLs.
- Signed download URLs.
- File metadata records.
- Conversation attachments.
- Knowledge document uploads.
- Export storage.
- File purpose validation.
- Organization-scoped storage paths.

Future versions can add:

- Malware scanning.
- OCR for screenshots.
- File previews.
- Versioned knowledge files.
- Advanced retention rules.
- Large-file upload resumability.

## Success Criteria

File Storage is successful when:

- Customers can upload useful support evidence.
- Admins can upload knowledge documents.
- Files remain private.
- Permissions are enforced before download.
- File metadata connects cleanly to conversations and knowledge.
- The AI can reference files safely.
- Storage supports the PicX Studio demo without feeling fragile.

SupportFlow AI should treat files as part of the support story, not as loose attachments.


# 25_AUTHENTICATION.md

# Authentication

## Overview

Authentication controls who can access SupportFlow AI and what they can do.

It protects the admin dashboard, agent workspace, organization settings, knowledge base, API keys,
analytics, tickets, and customer conversations.

The MVP should use Supabase Auth as the identity foundation.

Supported authentication methods:

- Email
- Magic link
- Google
- GitHub
- Microsoft

Future:

- SSO
- SAML
- SCIM
- Enterprise identity providers

## Design Philosophy

Authentication should be secure without making the product feel heavy.

Internal users should be able to sign in quickly.

Admins should be able to invite teammates easily.

Customers using the chat widget should not be forced into a full account flow unless the support task
requires identity verification.

Every authenticated request must resolve:

- User identity
- Organization
- Role
- Permissions
- Session state

## User Types

SupportFlow AI has five primary roles.

## Customer

End user seeking support.

Access:

- Own chat conversation
- Own uploaded files
- Own support status

Customers may be anonymous, session-based, or authenticated depending on the company's setup.

## Agent

Human support representative.

Access:

- Assigned conversations
- Tickets
- Customer context needed for support
- Copilot assistance

## Manager

Support manager.

Access:

- Organization conversations
- Tickets
- Agent performance
- Analytics
- Knowledge quality insights

## Admin

Workspace administrator.

Access:

- Organization settings
- Integrations
- Knowledge base management
- Team management
- Notification settings
- Prompt and AI configuration where allowed

## Owner

Highest organization role.

Access:

- All admin permissions
- Billing
- Critical integrations
- Role changes
- Organization deletion or transfer when supported

## Authentication Flows

## Internal Sign In

Flow:

1. User opens dashboard or agent workspace.
2. User signs in through Supabase Auth.
3. Backend resolves organization membership.
4. Backend loads role and permissions.
5. UI receives session and organization context.

## Magic Link

Magic link should be supported for fast login.

Flow:

1. User enters email.
2. Supabase sends magic link.
3. User clicks link.
4. Session is created.
5. Backend resolves organization and role.

## Social Login

Supported providers:

- Google
- GitHub
- Microsoft

Social login should still require organization membership.

Having a valid identity provider account does not automatically grant access to an organization.

## Team Invitation

Admins and owners can invite internal users.

Flow:

1. Admin enters email and role.
2. Backend creates invitation record.
3. Notification Engine sends invite email.
4. User accepts invite.
5. Supabase Auth session is created.
6. User is attached to organization with assigned role.

Invitations should expire.

Invitation acceptance should be audited.

## Customer Chat Identity

The customer chat widget can support multiple identity modes.

## Anonymous Session

Used for simple demo and early support.

The system creates a chat session without full authentication.

## Verified Email

Used when account-specific support is needed.

Example:

- Billing issue
- Missing credits
- Subscription change
- Refund request

The AI should ask for account email and trigger verification where required.

## Authenticated Customer

Future mode for embedded apps where the host product passes a trusted customer identity.

## Authorization

Authentication proves who the user is.

Authorization decides what they can do.

Authorization should check:

- Organization membership
- Role
- Resource ownership
- Conversation assignment
- Feature flags
- Action risk level

Examples:

- Agent can reply to assigned conversations.
- Manager can view all organization tickets.
- Admin can update knowledge documents.
- Owner can manage billing and critical secrets.
- Customer can only view their own conversation.

## Organization Resolution

Every internal request should resolve an active organization.

Sources:

- Session default organization
- `X-Organization-Id` header
- Route context
- User membership table

If the user does not belong to the organization, the request must be denied.

## Row Level Security

Supabase RLS should enforce tenant isolation.

RLS should prevent:

- Cross-organization conversation access
- Cross-organization knowledge access
- Cross-organization file metadata access
- Cross-organization analytics access
- Unauthorized settings access

The API layer should enforce permissions too.

RLS is the database safety net.

## Sessions

Sessions should be:

- Secure
- Short enough to reduce risk
- Refreshable
- Revocable
- Scoped to user and organization

Session responses should include:

- User profile
- Active organization
- Role
- Permissions
- Enabled features

## API Keys and Service Credentials

Integration keys are not user login credentials.

They should be stored encrypted in the `api_keys` table.

Providers:

- OpenAI
- Slack
- Discord
- Stripe
- GitHub
- Make.com

Only trusted backend services should decrypt and use keys.

Keys should never be sent to the browser in plaintext.

## Sensitive Actions

Sensitive actions should require proper role and audit logging.

Sensitive actions:

- Change user role
- Remove user
- Update API key
- Delete knowledge document
- Export data
- Trigger high-risk workflow
- Change escalation threshold
- Update billing settings

Some future enterprise actions may require re-authentication.

## Audit Logging

Authentication and authorization events should be logged.

Examples:

- User invited
- User accepted invite
- User role changed
- User removed
- Admin logged in
- API key changed
- SSO setting changed
- Permission denied

Audit logs should include:

- User ID
- Organization ID
- Action
- Resource
- IP address
- Timestamp

## Security Failure Modes

## Expired Session

Return `unauthorized`.

The UI should prompt sign-in.

## Missing Organization

Return `tenant_scope_error`.

The UI should ask the user to select an organization.

## Role Denied

Return `forbidden`.

Do not reveal private resource details.

## Suspended User

Invalidate active session and deny access.

## Invalid Customer Verification

Do not expose account details.

Ask for verification again or escalate.

## Implementation Expectations

The MVP Authentication system should include:

- Supabase Auth.
- Email and magic link.
- Google, GitHub, and Microsoft login where configured.
- Organization membership resolution.
- Role-based authorization.
- Customer chat sessions.
- Invitation flow.
- RLS-backed tenant isolation.
- Encrypted integration keys.
- Audit logs for sensitive actions.

Future versions can add:

- SSO
- SAML
- SCIM
- Fine-grained permissions
- Enterprise session controls
- Re-authentication for critical actions

## Success Criteria

Authentication is successful when:

- Internal users can sign in easily.
- Customers can get support without unnecessary friction.
- Organization boundaries are enforced.
- Roles map clearly to product behavior.
- API keys remain encrypted.
- Sensitive actions are audited.
- Unauthorized users cannot infer private data.

SupportFlow AI should feel easy to access and difficult to misuse.


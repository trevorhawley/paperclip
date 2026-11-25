# Conversation history

P2-01 starts with a private, read-only Conversations page backed by existing
Paperclip external AI updates. The base is custom dev commit `450cf22a7`.
Preview at [Paperclip DEV](http://127.0.0.1:4310/PAP/conversations) after signing in.

## Existing sources

- Native Chat is a persistent task-backed conversation for a person and a
  Paperclip agent. Its replies use the native fast-response execution path.
  The workspace links to the existing native Chat page.
- Phase 1 passive updates are human-authored comments with optional self-reported
  platform, model and original URL. The audit entry identifies the passive
  write even if the comment has no provenance. Task and project context comes
  from the existing issue and project records.
- Company search indexes operational objects. The conversation list has its
  own bounded search over the loaded external AI updates.
- Trevor AI Memory already owns standalone cross-platform history. Its
  `sessions_with_links` view exposes title, summary, decisions, actions,
  open questions, a source label, and the effective link. Model information
  may be included in the source label. It has no Paperclip task relation.
  Existing hybrid search combines full-text and semantic ranking.

## First increment

Each passive update is a list item. The task title supplies the display title
and the recorded comment supplies the discussion. Search includes task
identifiers, provenance, project and discussion. The detail links to the
original chat when an HTTP(S) URL exists and to the exact task comment.
The page searches up to 100 recent candidates. The existing issue read policy
filters results and the endpoint accepts authenticated board requests.
The view performs reads only and requires no migration or new dependency.
The DEV database contains existing examples on PAP-2 and PAP-3.

## Review point

The broader library should be able to display standalone records and link
one conversation to multiple tasks. The first increment intentionally makes
no identity inference from a missing chat URL or matching task title.
Review a narrowly scoped, read-only Trevor AI Memory connection before
implementing standalone retrieval. Use the existing session ID as the
external reference and establish the policy for showing private memory in a
Paperclip company. Determine the need for persistent task associations after
reviewing real history in the workspace.

## Unified library preview

On a Vite development server, add `?preview=memory` to the Conversations
URL. This opt-in presents synthetic standalone sessions alongside Paperclip
updates. The source filter switches between them. Search covers decisions
and action items as well as the summary and existing filters. The sample
module uses invented titles and IDs and makes no requests to Supabase.

## Proposed Memory access

The current Memory Edge Function supports query-based hybrid search and a
UUID detail lookup. It requires search text and returns at most 25 hits.
The effective link comes from the existing linked-session view. Source is
a free-form label and sometimes includes a model. The session date describes
the conversation. Supabase insertion time does not describe last activity.

Use a separate server-to-server read credential for this library. Review
whether to add a narrowly scoped Supabase read surface that supports bounded
recent pages, keyword search and UUID lookup with a fixed field allowlist.
Keep the broader Memory search token and service-role credential out of
Paperclip. The Paperclip route should default to disabled and require the
configured company and user IDs, an authenticated browser session and active
owner membership before contacting Memory. Apply the same check to list and
detail and keep credentials server-side. An unavailable source should leave
Paperclip results usable. Review this boundary before implementing live reads.

Keep original Memory UUIDs and Paperclip issue UUIDs. If manual linking is
needed, review a relation that stores only the company ID, Memory UUID and
issue UUID with a unique constraint for that combination. A project may be
attached by its ID independently. Resolve these references through existing
Paperclip authorization. Read and link operations should never create tasks
or request execution. The synthetic preview adds no persistent associations.

## Local-first direction

Trevor selected a hybrid architecture on 2026-11-25. Paperclip's own
conversation and execution records remain available independently of external
history. Trevor AI Memory is an optional external retrieval provider. Do not
introduce synchronization or a cache without measuring the actual need.

The existing memory connectors are company-scoped tool connections. They use
the connection vault, grants and gateway, and agents invoke provider tools
explicitly. They do not currently provide a board conversation library or
automatically import conversations. Personal grants and provider ACLs are
important: a company selector alone is not a security boundary for a personal
memory database. The old memory service surface document is a proposal, not
evidence that a general memory API is implemented.

Native agent chat is an existing task-backed conversation with persistent
visible history. Agent files are durable per-agent directories restored for
execution and collected at turn boundaries. They are agent-owned context,
and simultaneous changes to the same file use the last completed save. They
are not a project-wide shared knowledge base. Existing project documents and
task relationships should be evaluated before introducing project context
storage.

Next, investigate whether an existing personal connection grant and gateway
can provide the owner-only, read-only Memory operations needed by the board.
The current Memory search endpoint needs a query and returns at most 25
results. Recent browsing requires an additional bounded read capability.
The production Memory project and its permissions require separate review
before any changes. DEV validation must use synthetic data.

## Scoped retrieval implementation

The local Paperclip feature branch has a disabled-by-default board read route.
Configuration requires a Supabase function URL, company ID, authenticated owner
ID and dedicated read token in the server environment. The URL is restricted to
HTTPS Supabase function hosts, redirects are rejected, and responses are bounded.
Each request checks the current session and active owner membership. Provider
failure leaves Paperclip's own data available.

The separate th-ai-core feature branch has a dedicated read function and SQL
functions. The dedicated token is checked against its Vault hash. The SQL read
returns at most 25 records, supports recent history, keyword search and UUID
lookup, and grants execution only to the service role. This is a keyword
retrieval path. The existing Memory hybrid search remains separate.

The function and migration are local development artifacts. They have not been
deployed to Trevor AI Memory. No token has been provisioned. Synthetic isolated
PostgreSQL and function tests passed; a complete isolated Supabase runtime and
live security review remain outstanding. Task associations remain to be built.

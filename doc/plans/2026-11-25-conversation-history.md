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

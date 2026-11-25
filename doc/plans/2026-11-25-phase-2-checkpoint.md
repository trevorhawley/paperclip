# Phase 2 checkpoint

Baseline: dev commit `4839a8661`. PRs #4–#7 are integrated. Combined signed-in
DEV acceptance verified project task return navigation, local conversation
history, persistent task links and the Inbox Completed work view. The optional
provider passed browser and local Supabase validation with synthetic records.

| Workstream | Verified baseline | Remaining |
| --- | --- | --- |
| P2-01 Conversations | Paperclip updates, native chats and optional Memory share a searchable workspace. Conversation–task links persist across reloads. | Improve project navigation and access to existing related work. |
| P2-02 Inbox | Pending decisions, decision history and Completed work are available. | DEV increment adds In progress and Blocked work using the existing compact tasks API. Validate task return navigation from each view. |
| P2-03 Projects and tasks | Project task details return to the project's Tasks tab, including after reload. | Surface more of the existing conversation, decision and deliverable context from projects. |
| P2-04 Provenance | Passive updates preserve human attribution and display recorded AI metadata. | Use consistent source labels across conversations, tasks and activity. Mobile Voice passive writes can arrive without structured provenance. Display absent metadata as absent. |
| P2-05 Trevor AI Memory | Optional, read-only provider tested with isolated Supabase. Local history works through disabled, slow and unavailable provider states. | Live configuration requires separate authorization. |
| P2-06 Delegation | Explicit native-agent delegation from mobile ChatGPT Voice passed production acceptance. | Improve discovery and clarity of deliberate handoff in DEV. Preserve the existing execution boundary. |
| P2-07 Platform acceptance | ChatGPT mobile Voice read, passive write and explicit delegation passed production acceptance on November 25. | Accept Claude, Claude Code and Hermes with DEV records. Record the client's actual capabilities and any missing metadata. |
| P2-08 Navigation and density | Trevor asked (2026-11-26) for a compact, Claude-like UI and fewer clicks to daily pages. | Promote Dashboard, Projects, Routines, Artifacts, Agents and Skills to the sidebar; group Connectors, Audit and Settings under Admin (this PR). Compact Inbox and project Context view in their own PRs. |

Use existing task and approval state and delivery infrastructure for lightweight
completion, blocker and approval notifications. Confirm that a passive write
cannot cause delegation, and keep agent invocation behind the existing explicit
handoff action.

Native ChatGPT web and mobile remain Trevor's primary conversational interface.
Paperclip handles operations, context, coordination and deliberate execution
across assistants. Continue using synthetic records in DEV. Production
deployment and live personal Memory connection each require authorization.

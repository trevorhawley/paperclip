# Phase 2 checkpoint

Verified on 2026-11-25. Branch and CI status can change; check GitHub before
integration. Production deployment requires separate authorization.

| Workstream | State | Next step |
| --- | --- | --- |
| P2-01 Conversations | PR #4 adds a read-only list of passive updates. A separate local acceptance branch includes synthetic Memory records, filters, and existing native chat links. | Complete PR #4 CI and integrate. Move the additional preview changes to a focused branch based on the resulting dev head and validate. |
| P2-02 Inbox | PR #5 adds the Coordinator Inbox completed-work view. Synthetic DEV tasks show completion dates and link to the correct task. | Complete CI and remaining acceptance, then integrate against current dev. |
| P2-03 Projects and tasks | Existing Paperclip projects, task links and project documents remain in use. | Add conversation associations after the reference model is implemented. |
| P2-04 Provenance | Phase 1 records self-reported external platform, model and chat URL on passive comments. | Extend presentation as conversation sources become available, preserving human attribution. |
| P2-05 Trevor AI Memory | Local-first hybrid direction approved. Existing retrieval supports query and session lookup. The local unified preview uses synthetic data. | Implement scoped, optional read access and a bounded recent-history capability. Verify with synthetic DEV data before live configuration. |
| P2-06 Delegation | Phase 1 explicit handoff exists. | Separately verify native execution and improve the deliberate handoff experience. |
| P2-07 Platform acceptance | Cloud ChatGPT passive collaboration was previously accepted. | Verify Claude, Claude Code and Hermes integrations as applicable. |

The local acceptance branch contains cherry-picks of PR #5 solely for DEV
browser inspection. The original feature branches and commits remain available.

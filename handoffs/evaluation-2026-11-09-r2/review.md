# Independent code review

Reviewer: evaluation_review subagent, read-only review before the main variance pilot. No tests or simulations launched by reviewer.

Important findings:
1. Python analyzer accepted equal-count foreign paired cells and lacked exact artifact/provenance validation. Fixed with exact expected identity set, tuple/hero/schema verification, source/pool/protocol hashes, paired decks, chip conservation and bb conversion. Foreign replacement test observed failing before fix; it passes after fix. A complete valid archived run is separately accepted.
2. Concurrent runner processes could race on registry read/check/write, lose started records or reuse reserved seeds without marking reuse. Fixed by atomic directory controller lock across freeze/launch/run; competing controller fails before any registry read. Lock regression observed failing before implementation, passes after. No automatic stale-lock removal. Worker parallelism remains within a single controller.

Reviewer observed no engine/policy changes; exact enumeration excludes all dealt holes including folded dead cards and delegates ranking/payout to existing evaluate/settlePots.

Parent fix review: source/workflow snapshots distinguish pre-fix engineering smoke from integrity-only amended diagnostic protocols. Fixed versions require final full-suite/type-check evidence before completion. No repeated independent review requested, consistent with one fix pass.

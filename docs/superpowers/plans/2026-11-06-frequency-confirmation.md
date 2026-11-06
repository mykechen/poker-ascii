# Frequency confirmation implementation plan

Use superpowers:executing-plans in the existing isolated training worktree.

- [x] Add failing tests for frozen-model hash validation and decision logic (5 target, t interval, downside veto, sparse quota/missing support).
- [x] Implement small confirmation analysis module; pass focused tests.
- [x] Add fixed runner reusing runLeagueBatch/replayObservations/panelScores. Preserve failures and per-batch atomic files; reject used/unreserved seeds and changed freeze. Never fit models.
- [x] Independent review of protocol and implementation; resolve findings, run full tests/lint/tsc/diff checks, reserve seeds, commit/push.
- [x] Execute fixed 30 paired profit batches and 10 common-history batches. No peeking-driven changes.
- [x] Independently audit raw matches/aggregations and evidence; write handoff, update indexes/registry, commit/push.

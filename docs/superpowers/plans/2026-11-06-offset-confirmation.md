# Offset confirmation implementation plan

Use superpowers:executing-plans inline in existing training worktree. Spec: docs/superpowers/specs/2026-11-06-offset-confirmation-design.md.

- [x] Verify sunk-cost regression checks: fold negative incremental value, call positive incremental value even with total hand loss.
- [x] Add failing tests for100-batch confirmation gates, incomplete data, sparse minority-action coverage and model hash guard; implement minimal analysis module.
- [x] Add fixed tracked runner:20 panels,100 paired profit seeds,monotonic2h cap,atomic raw/score files,model/source validation,failures retained. No runtime policy changes.
- [x] Review implementation independently; full tests/lint/tsc/diff; reserve fresh seeds; commit/push before computation.
- [x] Run through fixed completion or budget boundary; no adaptive model/sample changes.
- [x] Audit raw matches,forecast scores,bootstrap uncertainty and decision; interpret evidence,update handoffs/registry,commit/push.

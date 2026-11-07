# Continue the poker-bot project

Read [current handoff0018](0018-decision-stability-coverage.md), then [the decision-quality plan](../docs/superpowers/plans/2026-11-07-decision-quality-next.md) and [execution specification](../docs/superpowers/specs/2026-11-07-decision-stability-execution.md).

Implementation worktree /private/tmp/poker-training-foundation; branch poker-training-foundation. Preserve original workspace changes. No computation running.

Latest: instrumentation and bounded collection complete;2520matches/10080hands in32.78minutes. First-paid-hand sampling starved later streets; coverage gate prevented all budget scoring. No candidate, validation, profit evidence or promotion. Need a revised independently reviewed sampling design before another fresh run; no automatic rerun/top-up. Current model/settings remain unchanged.

Source035ea02; collection source ec11da1. Backup pushes failed github.com:443; inspect actual git/remote status before assuming remote availability. Last verified198tests/lint/TypeScript/diff.

Keep no cross-hand memory, private views, within-hand inference and sunk-cost safeguards. Fold is valid; maximize incremental future chips. No live replacement or main merge. Commit/push verified stages without collaborator/co-author additions.

[Consolidated findings](../docs/experiments/2026-11-06-consolidated-findings.md) · [Queue](QUEUE.md) · [Seed registry](seed-registry.json).

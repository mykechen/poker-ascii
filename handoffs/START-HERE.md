# Continue the poker-bot project

**Latest, 2026-11-11.** The fresh lower-power adoption study is running. See [low-power plan](low-power-2026-11-11/PLAN.md) and the controller in `low-power-2026-11-11/confirmation/`. The prior interrupted studies remain excluded. The supervisor runs the pooled analysis and cost check after the complete fixed study.

**Latest (2026-11-10 05:44 UTC):** fresh recovery attempt also stopped for power. Reported adapter17W, battery discharge about65W with14workers; fixed battery rule triggered at14% on its minute check. All workers verified stopped. Saved661fresh clusters (55,524physicalhands), no return analysis, no v1freeze/cost/heuristic. All freshstudy seeds150001–153955 retired, including unstarted batch2. See `adoption-2026-11-10-fresh/POWER-CHECKPOINT.json` and `budget-after.json`. **Do not launch another long attempt until sufficient sustained power is established.** Original and fresh partial studies remain excluded. Deferred heuristic test is now staged as `.txt`, outside the active test tree.

**Resumed 2026-11-10:** owner authorized continue; a complete fresh adoption study is running from `handoffs/adoption-2026-11-10-fresh/study.json` on seeds150001–153955. Both original batches remain uninspected and excluded. Controller command: `python3 scripts/run-adoption-study.py handoffs/adoption-2026-11-10-fresh`. Do not run another controller or inspect returns before BOTH fresh runs finish. Power checks every60seconds. Read the fresh PROGRESS.md and budget-before.json. Code lives in the durable linked worktree below.

**Latest checkpoint (2026-11-10):** adoption study interrupted for imminent battery loss. All code and outputs are saved in the durable linked worktree `/Users/mykechen/Desktop/APPS/poker-ascii/.worktrees/poker-training-foundation`. Read [power interruption handoff](adoption-2026-11-10/POWER-INTERRUPTION.md) before doing anything. Batch1 complete (2,840 clusters), batch2 partial (667 clusters); no outcomes inspected, no v1 decision, no cost/heuristic run. No computation is running. Historical continuation text below is superseded by this checkpoint.

Read [current handoff0018](0018-decision-stability-coverage.md), then [the decision-quality plan](../docs/superpowers/plans/2026-11-07-decision-quality-next.md) and [execution specification](../docs/superpowers/specs/2026-11-07-decision-stability-execution.md).

Implementation worktree /private/tmp/poker-training-foundation; branch poker-training-foundation. Preserve original workspace changes. No computation running.

Latest: instrumentation and bounded collection complete;2520matches/10080hands in32.78minutes. First-paid-hand sampling starved later streets; coverage gate prevented all budget scoring. No candidate, validation, profit evidence or promotion. Need a revised independently reviewed sampling design before another fresh run; no automatic rerun/top-up. Current model/settings remain unchanged.

Source035ea02; collection source ec11da1. Backup pushes failed github.com:443; inspect actual git/remote status before assuming remote availability. Last verified198tests/lint/TypeScript/diff.

Keep no cross-hand memory, private views, within-hand inference and sunk-cost safeguards. Fold is valid; maximize incremental future chips. No live replacement or main merge. Commit/push verified stages without collaborator/co-author additions.

[Consolidated findings](../docs/experiments/2026-11-06-consolidated-findings.md) · [Queue](QUEUE.md) · [Seed registry](seed-registry.json).

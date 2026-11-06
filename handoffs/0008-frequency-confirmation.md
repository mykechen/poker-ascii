# Step 0008 — frozen frequency confirmation complete

Status: fixed experiment completed; profit inconclusive; no promotion. User approved 5 bb/100 target and execution. Source commit 2f661ba; fingerprint b667480ae1c9 (full fingerprint in progress.json). Independent protocol/implementation review found no blockers.

[Run](runs/2026-11-06-confirmation-b667480ae1c9/handoff.md) · [Summary](runs/2026-11-06-confirmation-b667480ae1c9/summary.json) · [Accounting audit](runs/2026-11-06-confirmation-b667480ae1c9/audit.json).

## Fixed experiment

Thirty paired profit batches 61001–61030, two frozen configurations, unchanged pilot model hash, 6/7/8 players, two fields, all seat rotations, two-hand reset-stack matches. Ten independent current-policy common-history panels 62001–62010; both models replayed with their own within-hand beliefs. No fitting, tuning, optional stopping, seed reuse or live change. 100bb, 1/2 blinds, no rake, 50 equity samples/16 river worlds. All raw per-batch matches/panels archived as gzip JSON.

## Findings

Frequency mean 932.54 vs current 919.10 bb/100 against these heuristic fields. Paired difference +13.45 bb/100, seed SE 70.66; primary Student-t(29) 95% interval [-131.07, 157.96]. Neither a positive true gain nor the 5 bb/100 target is established. Existing summary.delta normal interval is supplementary; decision.lower95/upper95 are the predeclared primary interval.

Six matched cell deltas: 6-player learner -56.11, 6-player multiway -218.33, 7-player learner +158.93, 7-player multiway +12.02, 8-player learner +80.42, 8-player multiway +103.75 bb/100. All individual cell intervals span zero. The operational -5 point-estimate veto fails; this does not establish statistically significant cell harm. Worst absolute-profit cell improved, but that is a different quantity from matched cell deterioration.

Common panel: 2330 flop observations. Frequency log loss .69885 vs .80485 current; Brier .47061 vs .54337. Sparse 110:true group had only 63 observations (quota 100): frequency log loss .84436 vs .58002 current, deterioration .26433. Sparse generalization remains unresolved and concerning. Other two groups exceeded 100 observations and passed +.02 deterioration threshold. No top-up was permitted or performed.

## Limits and next step

All combined gates fail. Preserve current live model. Do not simply extend this completed run or tune on its seeds. Thirty batches were explicitly bounded and underpowered for a true 5 bb/100 effect. Observed SD is about 387 bb/100, considerably higher than the four-batch pilot implied; any future powered design needs new precision/runtime planning. Prefer diagnosing the sparse-support structural mismatch from inspected evidence and designing a training-only remedy or a more efficient evaluation design before spending on a larger fresh confirmation. Any changed model needs new independent evidence. Persistent-stack/stronger-opponent robustness remains future work.

## Verification

Before run: 150 tests, lint, TypeScript, diff checks passed. Python independent raw accounting audit recalculated all 2940 matches / 5880 hands, seat rotations, per-seat bb/100, paired seed means/SE/primary interval, model hash, exact batch coverage and final gates; zero fallbacks, all payouts conserved. Separate archived-panel replay audit passed: independently accumulated counts, log loss and Brier scores match every overall/support-group score (panel-audit.json). Final verification also passed all 150 tests, lint, TypeScript and diff checks. One frequency batch recorded 390.9s vs typical ~7s; retained unchanged and no speed claim made.

Implementation/protocol committed and pushed before run as 2f661ba. Completion evidence is committed and pushed with this handoff; inspect git log for the containing commit.

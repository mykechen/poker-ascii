# Step 0011 — support-offset validation complete

Status: fixed training/validation completed; selected offset:0.1. No profit evaluation, live policy replacement or merge. Source commit 81ee2ca; full fingerprint in progress.json. Frozen model SHA256 0e6bf741dacad60f8e221090ad90269c0d948d65dad1ec8a1038e8a2adea442f.

[Run](runs/2026-11-06-support-offset-c41816d9698f/handoff.md) · [Summary](runs/2026-11-06-support-offset-c41816d9698f/summary.json) · [Audit](runs/2026-11-06-support-offset-c41816d9698f/audit.json) · [Freeze](runs/2026-11-06-support-offset-c41816d9698f/freeze.json).

## Implementation and collection

New offline fitter reuses contextual runtime artifacts and objective. Only four support-level scalar offsets are permitted; intercept/other public features are exactly zero. Fit each eligible support separately using frozen current-policy pre-action latent components; validation rebuilds each candidate's own within-hand beliefs. Supports below 200 observations/50 hands/8 batches fall back exactly to current. No runtime defaults, memory, cache or sampling-budget changes.

Fixed training 71001–71020 and validation 72001–72010, current-policy collection, 6/7/8 players, all rotations, four hands per match, 100bb reset stacks, 1/2 blinds, no rake, 50 equity samples/16 river worlds. All three lambdas (.1,1,10) converged for all three supports. Full coefficients/traces saved before validation. No top-ups, seed reuse, adaptive stopping or post-validation fitting.

Training flop counts: 110=3267 (1170 hands,20 batches); 111=3219 (2226 hands,20 batches); 011=7517 (4141 hands,20 batches). All support training quotas met. Sparse validation 110: 563 observations/326 hands/10 batches, exceeding all declared coverage requirements.

## Validation outcome

4344 common-panel flop observations. Current log loss .874853 / Brier .613058. Eligible offset .1: .602776 / .392892, about 31.1% lower log loss and 35.9% lower Brier. Offset 1: .805499 / .556699; offset10: .866721 / .606511. Lowest-loss eligible model offset .1 passed overall >=1% log-loss, no Brier deterioration and each adequately covered support's +.02 log-loss gate.

Selected group log loss versus current: 011 .731466 vs .888412; 110 .207193 vs .580229; 111 .563827 vs .961225. All three improve. Sparse Brier .079725 vs .395170.

The archived frozen frequency diagnostic scored .525657 log loss/.358861 Brier, better than selected offsets overall on this panel, but was explicitly ineligible. This experiment does not show offsets beat frequency in forecast accuracy. Offsets retain latent action discrimination by construction, unlike frequency replacement. Selection proves neither better profit nor calibrated hidden ranges.

Important distribution limitation: sparse validation had only 5 folds/563 observations (0.89%), training 22/3267 (0.67%). Previous inspected confirmation fields had 13/63 (20.63%). Passing this validation does NOT establish that the earlier population-shift problem is solved; validation uses different heuristic field compositions from that confirmation. Do not use prior inspected confirmation as fresh evidence or choose parameters by it.

## Verification

Independent pre-run code/protocol review found no blockers; reviewer-requested finite-difference checks added for all active parameters. Before run: 157 tests, lint, TypeScript/diff checks passed. Python raw audit recalculated 1680 matches/6720 hands, all seat rotations, per-seat bb/100, payouts/fallbacks, batch/hand support coverage, active coefficient masks, optimizer loss monotonicity, selected-artifact identity/hash, full candidate score-panel alignment, log loss/Brier arithmetic and selection. Zero fallbacks; all payouts conserved. Final verification: all 157 tests, lint, TypeScript, diff checks and raw audit passed. Independent results/audit review found no substantive issue; it emphasized that five sparse folds do not establish minority-fold calibration.

Initial audit required strictly later millisecond timestamps and failed: training freeze and first validation start both 2026-11-06T04:51:54.690Z. Runner source synchronously writes training-freeze.json before calling validation collection. Corrected audit allows >= at timestamp precision and verifies training-artifact identity; all checks passed. This is an audit precision correction, not evidence of selection leakage. Raw artifacts/timestamps remain unchanged.

## Next action

Keep selected artifact frozen. Design a separate fresh evaluation covering the shifted opponent fields, with explicit sparse-support quotas and uncertainty, and paired profit confirmation toward the user target 5 bb/100. Use observed confirmation variance for precision/runtime planning; do not promise a small fixed batch run can resolve a 5 bb/100 effect. No new profit run is authorized by this training/validation result alone. Preserve current live model.

Implementation/reservations were committed/pushed before run as 81ee2ca. Completion evidence and updated handoff/index/registry are committed locally as 5c73dfa. Two push attempts failed to connect to github.com:443 after 75-second timeouts; push remains pending. Retry git push origin poker-training-foundation when connectivity returns.

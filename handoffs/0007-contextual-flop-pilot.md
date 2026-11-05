# Step 0007 — contextual response pilot complete

Status: implemented, independently reviewed and bounded experiment completed. No live policy replacement or merge.

[Run artifacts](runs/2026-11-05-contextual-adfb6f523ebe/handoff.md) · [Summary](runs/2026-11-05-contextual-adfb6f523ebe/summary.json) · [Audit](runs/2026-11-05-contextual-adfb6f523ebe/audit.json) · [Selection freeze](runs/2026-11-05-contextual-adfb6f523ebe/freeze.json).

## What changed

Pure versioned response models and a fixed public feature dictionary now support current, legal uniform, support-frequency and contextual logit offsets. Optional pre-update components aggregate modeled strength/draw/style, and observer replay saves public histories plus observer blockers. Each candidate rebuilds its own within-hand beliefs; transforms occur before latent marginalization. Global offline fits use deterministic backtracking and preserve nonconvergence traces. Default policies, card cache, sampling budgets and no-memory behavior remain unchanged.

Independent review identified excessive historical range retention during replay. Fixed with current-hand retention and action-order validation, covered by a failing-then-passing regression test. Reviewer found no other blocking privacy/model/partition issue; requested held-out support-group reporting was added.

## Collection and selection

Source commit 19997c6; exact source fingerprint, models, settings and panels are archived. Two hands per match, 100bb, 1/2 blinds, no rake, 6/7/8 players with all seat rotations, 50 equity samples and 16 river worlds.

Training 51001–51004 yielded 1,422 flop observations across 504 hands. Quota met; 51005–51008 were not used. Validation 52001–52002 yielded 422 flop observations. Fits at lambda .001 and .01 did not converge within 200 iterations and were disqualified; .1 and 1 converged. Failures and all traces remain in raw/summary artifacts.

The smoothed support-frequency model won declared validation selection: mean log loss 0.512016 vs current 0.879384; Brier 0.355334 vs 0.616002. Both validation groups with >=100 observations passed the deterioration gate. The 56-observation fold/passive support group is reported but was too small for that gate. The previous unsuccessful uniform-blend finding remains valid; this is a new predeclared frequency selection, not retroactive promotion.

Freeze and parameter hashes were written before evaluation seeds 53001–53004 began; audit verifies ordering and hashes. All three evaluation configurations were run once on each seed: selected frequency/current river/equity control.

## Held-out interpretation

Exploratory frequency profit: 736.88 bb/100; current: 701.99; equity: 446.53. Paired frequency-minus-current: +34.89 bb/100, seed standard error 91.69; seed deltas -237.57, +90.33, +146.80, +140.00. Against equity: +290.35, standard error 187.59. Four batches do not support conventional confidence intervals under the 30-batch rule.

Worst cell worsened from -100.00 current to -235.94 bb/100 frequency. Small two-hand matches against heuristic populations produce very large, noisy bb/100 values. These results do not establish stronger poker play.

On-policy flop log loss was 0.705368 frequency vs 0.779657 current; Brier 0.474771 vs 0.525663. These are policy-generated trajectories, not another common-panel selection contest. In the sparse held-out fold/passive group (22 observations), frequency loss was 1.838208 vs current 0.740005: a notable generalization concern. No held-out result changed the frozen model.

Matched evaluation workload totals were 27.91s frequency, 27.76s current, 27.65s equity; descriptive wall time, not a controlled speed benchmark. Reliability bins and support counts are archived.

## Verification and next action

146 tests passed; lint, TypeScript and diff checks passed. Raw audit independently recalculated per-seat bb/100, rotation means, seed means and accounting for 840 matches / 1,680 hands: zero fallbacks and all payouts conserved. Audit script is archived beside results. The first audit invocation used an incorrect expected match total (798); the corrected explicit partition calculation is 252 training + 84 validation + 504 evaluation = 840. Raw evidence never failed accounting.

Next: design an independent confirmation of the frozen frequency model before any promotion, with >=30 fresh seed batches if estimating conventional intervals, and explicitly assess sparse legal-support generalization. Do not tune from these inspected evaluation seeds. Persistent stacks and stronger opponents remain later robustness work. No larger experiment is authorized by this completed pilot alone.

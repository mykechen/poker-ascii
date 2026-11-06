# Step 0012 — frozen offset confirmation complete

Status: fixed experiment completed in83.79 minutes, within user-approved2-hour cap. Profit inconclusive; forecast/downside operational gates fail. Preserve current live model. No refitting, optional extension or live promotion.

[Run](runs/2026-11-06-offset-confirmation-279a3593917e/handoff.md) · [Summary](runs/2026-11-06-offset-confirmation-279a3593917e/summary.json) · [Independent audit](runs/2026-11-06-offset-confirmation-279a3593917e/audit.json).

## Frozen execution

User authorized fresh shifted-opponent and profit confirmation, and emphasized that folding is valid and sunk costs must not motivate decisions. Source 18385a7 and protocol were independently reviewed, verified and pushed before starting. Exact fingerprint/settings/timestamps in progress.json. Frozen model SHA256 0e6bf741dacad60f8e221090ad90269c0d948d65dad1ec8a1038e8a2adea442f.

Collected20 current-policy common-history batches82001–82020 first and independently replayed current and frozenoffset.1. Then100 paired profit batches81001–81100 with alternating configuration order. Same deals/fields/seat rotations,6/7/8 players,four hands per match,100bb reset stacks,1/2 blinds,no rake,50 equity samples / 16 river worlds / river penalty 1. Prior confirmation's two evaluation fields used, without refitting to inspected prior results. All planned batches completed; no budget truncation or adaptive top-ups.

## Profit

Paired seed mean offset-current +2.03237bb/100; SE26.31257. Primary Student-t99 95% interval[-50.17756,54.24230]. Mean below5 and interval spans0: no positive-profit or5bb/100 target established. Existing summary.delta normal interval is supplementary; primary is decision.interval95. Do not merge old frequency results or validation scores into this primary comparison.

Matched cell deltas:6learner -14.6875;6multiway -1.3125;7learner -8.5536;7multiway +7.6071;8learner -31.4063;8multiway +60.5469bb/100. Three cells breach operational -5 point-delta veto; all six individual intervals span0. This is a failed descriptive safeguard, not statistically established cell harm or simultaneous noninferiority evidence.

## Shifted-field forecast checks

9,425 paired common-panel flop actions. Overall logloss improves .805504current to .680859offset; Brier .544572 to .447484. Seed-cluster bootstrap10,000 pooled-ratio paired resamples(seed 42) gives offset-current loss95%[-.134732,-.114072] and Brier95%[-.105380,-.088549]. These are forecast results, not profit evidence.

Sparse110:true group:216 actions,108 distinct(batch,match,hand),18 batches;70 actual folds across70 hands and18 batches. All observation and minority-fold quotas pass. Observed folds70/216=32.41%, compared with0.67% in offset training and0.89% in model-selection validation. This directly documents a changed action mix on shifted fields; the folds are valid outcomes, not policy mistakes by definition.

Sparse logloss worsens .675985current to .730668offset (difference+.054683, beyond+.02 guard); Brier .484494 to .499052. Sparse bootstrap loss difference95%[-.014783,.129441] and Brier[-.033769,.064992] include0: deterioration exceeds the operational point threshold but is not conventionally significant under these cluster intervals.

Separate conditional scores explain the average: on146 passive outcomes, loss .570713current vs .191120offset; on70 fold outcomes, .895552current vs1.856011offset. The learned negative fold offset remains overconfident toward calling under this changed population. Conditional-outcome scores are descriptive calibration diagnostics, not an instruction that opponents should call/fold more. Other support group losses improved (011 .709328 to .650097;111 .969703 to .727763).

## Decision and next work

All combined promotion gates fail: profit targetfalse, downsidefalse, sparsecoverage true, forecastfalse. Keep current live model. The candidate preserves latent likelihood discrimination, but that structural repair did not establish improved profit and did not solve shifted-field sparse forecasts.

Do not expand this completed run or fit to its seeds. Recommended next decision: redesign training-population coverage and model validation to represent fold-heavy situations, using inspected results diagnostically and fresh future partitions for selection/confirmation. Merely adding more of the same call-heavy training or brute-force profit batches is not a justified fix. Any new candidate needs a predeclared training-only design; reconsider precision/cost before another5bb/100 profit confirmation.

## Folding and sunk costs

Existing equity policy compares expected eligible-pot payout with only the additional call cost, checking free or folding when incremental call value is negative. River rollout values final stack minus current stack. Already committed chips affect the pot available to win, never a recovery target. Added passing regressions: fold incremental -20 despite 150 committed; call incremental +48 despite expected whole-hand result -102. No runtime action-rule changes. River sampling-SE penalty 1 remains a fixed heuristic, so no claim of exact expected-value optimality; pre-river policy still does not evaluate raises/future bets.

## Verification/provenance

Independent protocol/code/audit review found no blocking issues. Before and after the run, all 162 tests, lint, TypeScript and diff checks passed. Independent results review found no substantive overclaims. Raw independent audit recalculated all 9,240 matches / 36,960 hands,seat rotations,per-seatbb/100,payout conservation,paired seed/cell statistics,model hash/identity,exact partitions/order,full raw-to-score alignment,support/minority coverage,forecast scores,all decision gates and clustered bootstrap. Zero fallbacks; all payouts conserved. Zero-count bootstrap replicates0; bounds use all10,000resamples. RNG seed 42 is sequential across overall then sparse groups; percentile bounds use linear interpolation.

Implementation/protocol18385a7 was committed/pushed before run, also clearing previously pending5c73dfa/0b2fcde. Completion evidence is committed locally with this report; push status will be verified before handoff delivery.

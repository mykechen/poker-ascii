# Step 0015 — balanced population experiment complete

Completed all fixed stages in **97.23 minutes**, within the two-hour cap. Selected a newly fitted offset 0.1 by declared forecast gates. Fresh independent-policy challenge was adverse and inconclusive. No promotion, merge, refitting from challenge or live defaults change.

[Consolidated findings](../docs/experiments/2026-11-06-consolidated-findings.md) · [Run](runs/2026-11-06-population-8be4d1cb56f3/handoff.md) · [Summary](runs/2026-11-06-population-8be4d1cb56f3/summary.json) · [Audit](runs/2026-11-06-population-8be4d1cb56f3/audit.json).

## Changes and provenance

Source `16d6fbc`, full fingerprint in progress.json. Source was committed and verified before computation, but initial GitHub pushes failed; backup was retried independently. Do not claim successful pre-run push. Runtime/settings were fingerprinted and not modified during the experiment.

Balanced five-entry lineups by deterministic cyclic offset across seed batches, so every duplicated identity receives equal representation at 6/7/8 players over complete cycles. Effective compositions are archived and checked for train/validation/challenge collisions. All-seat rotations remain. Historical evidence is unchanged.

Implemented equal-legacy/expanded-population support objectives and gradients, independent hand/batch/minority coverage masks and per-population validation vetoes. Model remains four support-offset parameters, applied per latent hypothesis before marginalization, global offline/no opponent identities as features/no cross-hand candidate memory. Population mixture, weighting and balancing changed together; no causal attribution to only one component.

Added equity-defender and equity-pressure as separate benchmark registry entries, preserving the original eight-style roster/live defaults. Own-view-only uniform-equity decision logic uses 64 samples and shares the tested estimator/evaluator, not candidate adaptive/range/decision logic. Defender checks/calls/folds on incremental showdown value. Pressure adds heuristic value raises at equity >=.65; it does not evaluate full raise EV. Neither is proven stronger, externally trained or GTO.

## Fixed experiment

Training 91001–91030: both populations, three fields each. Validation 92001–92020: both populations, two new fields each. Each operation uses 6/7/8 players, all seat rotations, four reset-stack hands/match, 100bb, 1/2 blinds, no rake, 50 candidate equity samples / 16 river worlds / river penalty 1. No top-ups or outcome-dependent stopping. All three lambdas (.1,1,10) converged and all three supports met training gates in both strata. Fits were frozen before validation.

Training support110: legacy 58 folds/2268 observations,1073 hands,30 batches; expanded 99 folds/1030,552 hands,29 batches. Minority folds span14 and22 batches respectively. Both training minority quotas passed. Selection validation: legacy24 folds/1661,874 hands,20 batches (folds24hands/7batches); expanded55/637,296hands/18batches (folds54hands/15batches). All required quotas passed.

## Forecast selection outcome

New artifact SHA256 `df943f898f0944386c96901b8a40abaac4ec14c6ab154cdbe5177f0c937dfb54` selected at lambda .1. It is not the previous lambda-.1 artifact.

Equal-stratum mean log loss: current .818633 -> selected .615453 (24.82% lower). Macro Brier .565084 -> .400612 (29.11% lower). Macro means give each population half the weight, not each action equal pooled weight. All declared individual-stratum/group gates passed.

Legacy overall loss .873667 -> .601947; expanded .763598 -> .628958. Sparse110 group loss legacy .591875 -> .265722; expanded .595272 -> .356294. Seed-cluster bootstrap sparse loss differences were negative in both strata (legacy95%[-.344474,-.308367],expanded[-.280939,-.179375]). These are model-selection forecast metrics, not independent profit evidence.

Critical caveat: actual-fold conditional loss worsened legacy .797147 ->1.497223 (24 folds), expanded .871499 ->1.611618 (55 folds). Passive gains dominate average sparse scores. This does not invalidate declared selection, but minority-fold forecasting is not established as solved. Conditional outcome scores alone do not define a desired action frequency; forcing folds/calls would corrupt the task.

New validation fold proportions were1.44% legacy/8.63% expanded, different from the earlier32.4% confirmation. Better population coverage does not establish robustness to every unseen mixture.

## Independent-policy challenge

After selection freeze, tested current and selected once on each fresh seed93001–93010, two balanced challenge fields containing both new computational policies plus heuristic styles. Matched seeds/rotations, alternating configuration order. Ten batches are diagnostic; conventional intervals omitted and no5bb/100 claim allowed.

Current mean469.375bb/100; candidate370.992; paired difference **-98.383bb/100**, seed SE **58.100**. Seven of ten seed differences negative. This is an adverse warning signal, not an established regression or a realistic human win rate. Candidate's matched worst cell delta -326.786bb/100. Its absolute worst-cell profit improving versus current is a different quantity and does not cancel the lower matched mean. No new candidate should be promoted from this evidence.

## Verification

All **177 tests**, lint, TypeScript/diff checks passed before run. Tests include weighted gradient finite differences/duplication invariance, exact coverage fallback, per-population veto, lineup cycle balancing/collision detection, opponent own-card isolation/determinism/legality/sunk-cost and controlled side-pot eligibility. Side-pot fixtures correctly value a 3-chip call against12 eligible chips while excluding194 ineligible chips, including folded money.

Independent raw audit recalculated **6,300 matches / 25,200 hands**, all rotations/per-seat bb/100, zero fallbacks/conserved payouts, balanced effective multiplicities, coverage/action diversity, per-support final weighted objectives, coefficient masks, raw-to-score panel alignment, all forecasts, selection/frozen model identity, challenge pairing/means and uncertainty. All checks passed. Per-stratum/group/action bootstrap uses 10,000 paired seed resamples (seed 42) and explicitly records zero-count replicas. Full data/failed earlier studies retained.

Independent review found no substantive results/audit error and explicitly required preserving the conditional-fold-loss caveat and ten-batch strength limitation. Final verification again passed all 177 tests, lint, TypeScript, diff checks and the independent raw audit. Source/report links were independently reviewed. Completion evidence is committed locally with this handoff; actual push status is reported at delivery.

## Findings and next decision

Consolidated report covers all completed stages. No demonstrated 5 bb/100 profit gain yet. Preserve current live policy. Recommended next research decision: inspect posterior-range quality and downstream action value, not assume lower action loss means better play. Pre-river raise/future-bet search, sampling precision, stronger external agents, persistent-stack/long-session evaluation and effective profit-variance reduction remain separate gaps. No automatic next run or reuse of inspected partitions.

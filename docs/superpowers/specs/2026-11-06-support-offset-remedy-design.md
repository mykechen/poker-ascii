# Training-only support-offset remedy

## Intent and scope

Replace the experimental support-frequency approximation with a conservative calibration candidate that retains latent hand/style action likelihood differences. This is an offline response-model experiment, not a change to preflop strategy, raising/search, or live defaults. The diagnosis does not establish a profitable remedy. Preserve all unsuccessful experiments.

The response model forecasts observed opponents, not the candidate's action frequencies. Previous 1.79% fold probability is (5+1)/(333+2) on training flop support 110 only. Preflop folds and other legal supports are excluded. These are clustered action observations, not independent hands. Candidate pre-river decision policy uses estimated showdown payout minus call cost; it checks for free, otherwise calls if nonnegative or folds. It does not model future bets or choose raises before the river. Remedy testing must not conflate that policy limitation with forecast calibration.

## Chosen model (assistant recommendation)

Reuse version-1 contextual artifacts and transformResponse, avoiding a new runtime model family. Each coefficient row has seven support-indicator slots. Activate only four scalar parameters: fold offset for 110, aggression offset for 011, and both offsets for 111. All other slots, the intercept and public-context coefficients remain exactly zero. For support 110 only the fold coefficient is active; aggressive is structurally zero. For 011 only aggression is active; fold is structurally zero. For 111 both offsets are active. Single-action supports use current unchanged. All corrections apply per latent component before marginalization and updating beliefs.

Fit and count all coverage thresholds on FLOP observations only; save and replay earlier streets to rebuild prior beliefs. Training uses frozen current-policy pre-action component probabilities and weights captured at collection time, matching the existing objective; do not recompute candidate-dependent training beliefs during optimization. Validation separately rebuilds each candidate's own beliefs. This is a surrogate offline fitting objective, not full sequential maximum likelihood.

For each eligible support, optimize average negative log marginalized likelihood plus lambda/2 times squared support offsets. Retain current clipping [-3,3] and deterministic backtracking. Initialize at zero. Candidate lambda grid {.1,1,10}; these are assistant design choices rather than user-selected settings. Global offline parameters, no opponent identities, hidden target cards or family labels as prediction inputs. No cross-hand memory, unchanged cache and compute budgets.

Constant offsets preserve finite nonzero odds differences between latent hands; they do not erase them as replacement frequency vectors do. They still impose a shared population correction that may generalize poorly. Do not call them calibrated until tested.

## Coverage and partition rules

New batches must attach explicit batch identity to replay panels; match IDs restart per batch. Coverage keys are (batch,match,hand); repeated opponent actions in one hand do not count as independent hands. To enable a support's offsets require >=200 training observations, >=50 distinct hands and >=8 independent seed batches with that support. Otherwise both support coefficients remain exactly zero, including after optimization. These conservative thresholds are assistant defaults, not empirically proven effective sample sizes. Record counts, contributing batches and actions for all supports. No assumption that passing these counts guarantees calibration.

Collect fixed fresh current-policy training panels: 20 batches, two training fields from the prior pilot plus its third training field, 6/7/8 players, all rotations, four hands per match. Validation: 10 batches, prior validation fields, same settings. Fresh seed ranges proposed 71001–71020 and 72001–72010; check registry/retirements before reservation. This document alone does not reserve or execute them. No quota top-up. Sparse training failure invokes current fallback; sparse validation failure prohibits promotion and makes sparse generalization inconclusive.

Keep validation common histories with each candidate's own within-hand beliefs. Fit each support independently so common supports cannot swamp the regularization strength of sparse supports. Freeze optimizer max 1000 iterations, gradient tolerance 1e-6, step floor 1e-12; disqualify nonconvergence and preserve traces. Check analytical gradients with finite differences. Use observed-action marginalized loss; never fit latent component labels to observed cards.

Compare current, archived frozen frequency baseline and three offset candidates. Frequency is diagnostic, ineligible for new selection. Require overall log-loss improvement >=1%, no Brier deterioration and <=.02 group log-loss deterioration for all supported groups with >=100 validation observations. Explicitly require >=100 validation observations in 110:true, spread over >=5 batches and >=30 distinct hands, before claiming sparse validation passes. If absent, stop as insufficient evidence; do not silently drop the group or enlarge panels. Choose eligible lowest-loss offset, ties favor current then stronger regularization. Current remains eligible. Freeze selected artifact/hash before any profit run.

## Verification and decision boundary

Test exact zero fallback, structural zeros, latent likelihood discrimination, forbidden feature exclusion, per-support objective/gradient/coverage masks, deterministic convergence, own-belief replay and no-memory invariants. Separate solver behavior from any claims of poker strength. Keep source/settings/model fingerprints and failures. Independently review before running any new partitions.

No new profit confirmation is part of this design. If validation supports a frozen candidate, write a separate power/runtime protocol using the observed confirmation variability; retain 5 bb/100 as user target. A 30-batch run did not resolve it. Never reuse inspected confirmation seeds to select offsets or tune coverage/lambda. No live policy replacement or merge.

## Alternatives considered

Stronger frequency pseudocounts reduce overconfidence but preserve the latent-discrimination failure. Full contextual offsets introduce more sparsely supported features and already had convergence/selection limitations. Support-only regularized offsets are the smallest latent-preserving candidate using existing runtime code; whether they improve prediction or profit remains untested.

# Contextual population flop-response experiment

Status: specification for the next bounded research step; not fitted or run. Builder choices below are provisional, predeclared experiment settings rather than claims of optimality.

## Purpose and boundaries

The previous global uniform-blend fit selected zero. Its held-out errors concentrated in unbet aggression and passive stations, while a training-only legal-support frequency baseline looked promising on validation. Test a small global contextual correction rather than retrying a universal uniform shrinkage or remembering individual opponents.

Keep 100bb, fixed 1/2 blinds, no rake, 6/7/8-player seat rotations, 50 equity samples and 16 river worlds. Retain the verified pure card-feature cache. No live-policy change, cross-hand memory, budget increase, earlier-street search or merge. Population parameters are fitted offline and frozen, never updated from an individual opponent's earlier hands.

## Eligible hypotheses (declared before data collection)

1. Current conditional likelihoods, unchanged.
2. Uniform probabilities over legal action classes.
3. Smoothed global action frequencies conditioned only on legal support, learned on training observations with one pseudocount per legal class. Unseen support falls back to current probabilities; do not call the earlier descriptive frequency baseline a previously selected winner.
4. One regularized contextual logit-offset family, with regularization strengths 0.001, 0.01, 0.1 and 1. These are four prespecified fits, not an open-ended search.

All modifications apply only on the flop. Turn/river likelihoods remain current. The common probability helper must serve both inference and simulated responses wherever a modified flop likelihood is used. A uniform/frequency model has no hidden-hand discrimination on that action; represent that honestly rather than inventing target-card evidence.

## Contextual likelihood and objective

For legal action classes fold/passive/aggressive, define:

`q_beta(a | h, style, c) = normalize_legal[p_current(a | h, style, c) * exp(beta_a · x(c))]`.

Passive is the reference logit (coefficients zero); only fold and aggression offsets are learned. Structural zeros remain exactly zero. Features are an intercept and fixed categorical encodings for legal support, size/pot bucket, SPR bucket, button/blind/field position, remaining-player bucket, and paired/three-suited board flags. Use current bucket boundaries. Do not introduce feature interactions in this pilot. Clip combined offsets to [-3, 3] for numerical stability, with a tested derivative convention at the clipping boundary.

For each pre-action range/style component j, model weight w_j is estimated from observer-permitted information, not actual target cards. Forecast:

`P_beta(a | history) = sum_j w_j * q_beta(a | component_j, c)`.

Minimize mean training negative log likelihood plus `lambda * sum(beta^2) / 2`, using deterministic full-batch gradient descent with backtracking, maximum 200 iterations, fixed zero initialization and a saved convergence trace. No new ML dependency is required. Verify analytic gradients against finite differences away from clipping boundaries. Lack of convergence disqualifies the fit rather than silently accepting a partial model.

Only train coefficients whose nonreference category has at least 50 training flop opportunities; otherwise keep its offset zero. Deterministic one-class support requires no fit. Unseen legal support falls back to current likelihoods. The count threshold limits sparse fitting but does not prove sufficiency for a coefficient estimate.

## Required instrumentation and common replay panel

Existing marginal forecast vectors alone are insufficient: applying offsets after marginalization is not equivalent to correcting each latent hand/style likelihood. Extend optional diagnostics to save compact pre-update components (component weight, current legal likelihood vector, modeled strength/draw/style bucket), with weights summing to one and probabilities reproducing the original forecast. Aggregate equivalent components rather than recording thousands of card combinations per action.

Store a compact observer replay stream: run/match/hand key for reset/grouping only, opponent seat for within-hand tracking only, action order, board, observer's own hole cards for blockers only, public response context and observed action. Keep all streets needed to rebuild flop ranges. No target hidden cards, actual future deck or showdown-selected hand labels may enter fitting. Family/name metadata may be stored separately for diagnostics but is excluded from feature encoding, coefficients, lookup keys and likelihood calls. Observer private hand strength is not a target-strength label or learned covariate.

Generate the common panel using the unchanged reference policy. Each eligible model replays the identical observer-permitted action histories with its own within-hand beliefs and fresh hand resets. Score the same next actions before their updates. This avoids selecting from incomparable policy-generated validation trajectories. Offline fitting may use training components from reference trajectories, but validation must replay each fit's changed inference, not merely reweight the old marginal forecasts.

After selection, fresh on-policy held-out matches are still required: altered actions and ranges can affect profit even when common-panel forecast loss improves.

## Population and reserved partitions

First check handoffs/seed-registry.json and all newer handoffs for conflicts. The ranges below are reserved, not used, by this specification:

- Training: 51001–51004; prespecified training-only top-up 51005–51008 if fewer than 500 flop observations exist. Do not inspect validation before deciding whether the fixed quota is met.
- Validation: 52001–52002.
- Evaluation: 53001–53004.

Training lineups:

- [chart, tight, station, position, aggressor]
- [maniac, station, chart, aggressor, tight]
- [station, maniac, position, tight, chart]

Validation lineups:

- [position, station, aggressor, chart, maniac]
- [tight, maniac, station, position, aggressor]

Evaluation lineups:

- [multiway, learner, maniac, station, tight]
- [learner, multiway, aggressor, station, position]

Repeat lineup entries to fill opponents as in the existing runner and reject effective ordered-composition collisions at every table size. Maniac/station behavior is included in training deliberately; learner/multiway remain absent until evaluation. These are still heuristic populations, not coverage of all poker opponents.

Start with two hands per match. This pilot targets global response evidence, not long-session learning. Record exact hand/observation counts. If the training quota fails even after the reserved top-up, stop with an insufficient-data handoff rather than expanding partitions after looking at validation.

## Freeze and decision rules

Before fitting, save source fingerprint, settings, eligible models, lineups, seed roles and quota rule. Fit only on training. Select using common-panel validation mean log loss; fit coefficients on neither validation nor evaluation.

A new model is eligible for experimental selection only if validation log loss is at least 1% below current and Brier score is no worse. For each legal-support/facing group with at least 100 validation observations, require log loss deterioration no larger than 0.02 relative to current. These are declared pilot gates, not statistical guarantees. Report all smaller groups without pretending to validate them. If no candidate passes, select current. Ties within 1e-6 prefer current, then frequency, then uniform, then the more strongly regularized contextual fit.

Write selection freeze.json and its hash before reading evaluation records or starting evaluation matches. Never revise the grid or choose a new model from held-out scores. Preserve failed fits and quota failures.

On fresh evaluation seeds, compare selected/current river and current equity-only controls with all seat rotations and both evaluation fields. If selected equals current, run once and label aliases rather than count duplicate deterministic matches as replication. Use paired differences aggregated by seed across cells, worst-cell scores, action-class reliability bins, support counts, prediction scores and compute cost. Four evaluation seed batches are exploratory; omit conventional confidence intervals under the current 30-batch rule. Good prediction scores alone do not promote a poker policy.

## Implementation boundaries and validation

- Extend range-beliefs/adaptive diagnostics only behind explicit experiment options; default policies remain unchanged.
- Put parameter encoding/likelihood transformation in a focused module, separate from fitting and run orchestration. Keep a serializable versioned artifact with exact feature dictionary and coefficients.
- Test structural zeros, component normalization, zero-coefficient equivalence, sparse/unseen backoff, analytic gradients, deterministic fitting, nonconvergence, observer privacy and family/identity exclusion.
- Test common replay hand resets, pre-action scoring, a toy case where transform-before-marginalization differs from transform-afterward, and selection freeze ordering.
- Re-run tests/lint/typecheck, strict raw accounting and an independent review before recording the bounded experiment. No larger unchanged league run first.

## Required handoff

Archive the common panel and matched results, source/parameter fingerprints, convergence traces, every candidate's train/validation metrics, selection freeze, held-out metrics, accounting, failures and next decision under handoffs/runs/. Update the index, queue and seed registry and commit/push each verified step. A no-change result is useful evidence and must not be discarded.

## Later work

If this pilot improves forecasts and survives on-policy checks, plan a larger independent-batch profit confirmation, persistent-stack robustness and stronger opponents. Do not fold those projects into this bounded fit or assume a poker-strength gain from the computation speedup.

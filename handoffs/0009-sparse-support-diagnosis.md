# Step 0009 — sparse-support diagnosis

Completed descriptive diagnosis on already inspected pilot/confirmation data. No model fitting, new experiments, policy changes or live promotion. Reproduction scripts and JSON outputs: `handoffs/diagnostics/2026-11-06-sparse-support/`.

## Reproduced mechanism

Support 110 means fold/passive supported, aggression unavailable. Training contained 333 observations: 5 fold, 328 passive. Add-one smoothing yields fold 6/335 = 1.791%, exactly the archived artifact. Validation contained 56 passive and zero folds; this group was below the 100-observation deterioration gate. Confirmation contained 13 folds and 50 passive (20.635% observed folds), across 31 distinct hands. Its 13 folds span 13 hands and five of ten batches. They account for 98.301% of the frequency model's group log loss .8443565534, reproducing the archived score.

Thus the immediate numerical cause is a near-zero learned fold probability applied to an action mix with more folds. Training's five fold examples all came from one of four batches. Raw observation count exaggerated diversity; neither add-one smoothing nor the below-quota validation group protected against this shift. These are descriptive clustered samples, not independent Bernoulli trials or proof of a stable population fold rate.

Public-context inspection does not justify a simple bet-size/depth split: all 63 confirmation observations were small bets, short depth and few players; 330/333 training observations were small bets and all were short depth. Confirmation folds occur in blind, button and field positions. Opponent-field/population and trajectory changes remain possible explanations; causal attribution among them is unresolved. No family labels or hidden cards were introduced as prediction features.

## Structural inference issue

`fitFrequency` pools observed actions solely by legal support. `modelResponse` replaces each latent hand/style probability vector with the same support-frequency vector. `RangeBeliefs.observe` then multiplies every latent hypothesis by that same action likelihood. When support is shared, normalization cancels this factor: the observed flop action supplies no hand/style discrimination. Card conditioning and other-street inference still operate. This behavior applies to every covered support, not just 110; it follows the specified baseline implementation, not a newly discovered coding regression.

Executable check: strong versus weak hand on the same public board has current passive likelihoods .875 versus .277778, ratio 3.15. Frequency makes both .982090, ratio 1. This proves loss of action-dependent discrimination in the example; it does not establish that this mechanism caused the measured profit difference, which remains inconclusive.

## Recommended next design

Prefer a training-only calibrated offset or shrinkage model that preserves latent-dependent likelihoods, rather than a support-only replacement. The existing contextual offset family already preserves this structure and is the simplest starting point; its previous nonconvergence and pilot selection outcomes remain valid. First design a support-level regularized offset toward current likelihoods with explicit fallback for inadequate distinct-hand/batch coverage. Compare against current and the frozen frequency baseline on common histories, with quotas based on independent batches/hands as well as counts. Model choice, regularization, coverage rules and stopping rules must be frozen using fresh training/validation before fresh profit confirmation. Do not choose smoothing strength, fold floors or context partitions from confirmation outcomes.

A heavier support-frequency prior alone might soften overconfidence but still discards latent discrimination. More confirmation batches alone cannot repair the model assumption. Retain current live policy. Next authorized work should be a written training-only remedy design, followed by test-first implementation and new reserved partitions; no model is promoted by this diagnosis.

## Verification and provenance

`python3 handoffs/diagnostics/2026-11-06-sparse-support/diagnose.py` reconstructs the smoothed artifact and exact sparse confirmation loss with assertions. `node_modules/.bin/vite-node handoffs/diagnostics/2026-11-06-sparse-support/likelihood-check.ts` verifies the likelihood-ratio collapse with assertions. Both passed. Source at diagnosis start: ed557ac. No runtime files changed. All data are inspected; no seed reservations changed. Commit/push this diagnosis and index updates on the existing feature branch.

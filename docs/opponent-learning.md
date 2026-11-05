# Session opponent learning

Training policies may implement `startSession(joinIds)` and `observe(before, after)`. Fixed-stack matches and persistent sessions initialize unique join identities once per run. Policy factories should create one model per participant. Each observer receives only its own projected views, including every terminal transition. Hand resets preserve tendencies; new sessions clear all personal data. Live room policies are unchanged in this stage.

`OpponentModel` keeps street/faced-bet context counts with explicit denominators. Fold means start at 0.5 when facing a bet; aggression starts at 0.2 facing a bet and 0.3 otherwise. Prior strength defaults to 12 observations; posterior variances expose uncertainty. These are transparent provisional parameters, not empirically optimal weights.

`createAdaptivePolicy` connects observations to the equity check/call baseline. Per-hand ranges update after actions with nonzero likelihood support and public board removal. Hand strength is grouped coarsely into weak/medium/strong. Personal marginal frequencies gradually temper the initial hand-conditioned likelihoods. Showdown cards retrospectively label stored hand/action contexts. These are selected reveal evidence and do not directly fit action frequencies: doing so would introduce showdown-selection bias. A selection-aware fitting method is still required before this evidence changes likelihood parameters. Hidden folded cards are not labelled. A player can always take an unexpected action.

Limitations: no draw classifier, position/sizing/stack-depth conditioning, evidence decay, learned population priors, or response-tree EV yet. Selected showdown data can bias the action model; calibrate on held-out predictive results before relying on it. Folded-card removal and correlation from folded ranges are not modeled. Call values still assume no future betting. Frozen controls continue current-hand Bayesian inference while disabling across-hand parameter updates. The model is an experimental baseline, not a trained equilibrium strategy.

`npm run benchmark:adaptive -- 10 2` compares adaptive and frozen versions using paired seeds and seat rotations at 6/7/8 players. Factories or lifecycle reset prevent personal-history leakage across experiments. A 2-hand, one-batch smoke run completed for all sizes; no strength conclusion follows.

Tests cover prior shrinkage, context separation, session reset, terminal observations, distinct identities, legal multiplayer adaptation, and public reveal processing when the observer makes the final action. Full verification: 80 tests, lint, and TypeScript checks pass.

## Contextual Bayesian extension

The active adaptive policy now uses `RangeBeliefs`: a mixture over provisional tight/balanced/loose response hypotheses, each with its own conditional hand range. Every action updates style probabilities by its marginal likelihood, then conditions that style's hand range. A reveal updates style weights using the conditional probability of the exact revealed combination, rather than fitting selected showdown action counts. Hand ranges reset per hand; learned type weights persist per session. Frozen controls reset type weights each hand but still infer within each hand.

Likelihoods now include bet-size bucket, SPR bucket, button/blind/field position, remaining player-count bucket, and private draw features. These coefficients are provisional hypotheses, not optimized frequencies. Bayesian correctness is conditional on this approximate independent-opponent model; it is not an assertion that real opponents follow these hypotheses. Correlations between opponents and folded-card distributions remain unmodeled.

Step verification: 86 tests, lint, and TypeScript checks pass. Independent review found no important issue. Public view additions expose only current betting state, acted flags, and commitments for upcoming engine-based river reconstruction; no deck or opponent private cards are published.

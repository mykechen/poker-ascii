# Contextual opponent models and river EV

Implements the approved adaptive bot design in the existing TypeScript worktree. Use executing-plans and test-driven-development; commit/push each verified step.

## Step 1: Context and Bayesian reveal evidence

- Create hand-features.ts: classify made strength and draws using only supplied cards; derive position, faced-size/pot, SPR, and player-count contexts from PublicView.
- Create range-beliefs.ts: maintain per-opponent mixture weights over three provisional action models and separate per-type hand ranges. Update both type weights and conditional ranges on every action by Bayesian marginal likelihood. At reveal update type weights by the conditional probability of the exact revealed combination, not by a selected bluff-frequency count. Board/hero blockers condition every type before action/reveal.
- Wire adaptive.ts to this model, retain marginal tendency diagnostics, reset personal beliefs per session and ranges per hand. Frozen controls continue inference but reset type weights each hand and do not retain across-hand evidence.
- Tests: action-weight normalization, draw classification, contextual separation, revealed posterior formula, impossible reveal rejection, reset and observer privacy.
- Verify full tests, lint, TypeScript, review; commit and push.

## Step 2: River response-aware EV

- Expose public betting reconstruction fields in views without deck/private holes. Existing consumers may omit reconstruction metadata; EV requires it and falls back to the baseline only outside river.
- Create river-ev.ts: reconstruct sampled river states from PublicView and compatible joint range draws. Folded players retain public commitments but unknown folded cards are marginalized (not sampled). Generate legal fold/check/call/min/half/pot/all-in candidates; simulate each candidate through apply() to terminal payouts with explicit card-conditioned stochastic response and continuation policies. All actors see only their own simulated private cards. No runtime actual hidden state enters search.
- Estimate mean net chips relative to current hero stack and standard error per candidate. Use common sampled worlds across candidates; do not label rollout estimates exact or equilibrium EV. Clamp computation with samples/action limits and fail explicitly on invalid rollout.
- Wire adaptive river decisions to search, keep earlier-street equity control. Log candidate EVs, counts, and elapsed compute time.
- Tests: legal reconstruction, deterministic nuts/value/zero-equity bluff/fold decisions, side pots/uncalled returns, seeded repeatability and hidden-state independence.
- Run full verification and a small 6/7/8 integration experiment. Record limitations, review, commit and push. Statistical training and held-out selection remain subsequent work.

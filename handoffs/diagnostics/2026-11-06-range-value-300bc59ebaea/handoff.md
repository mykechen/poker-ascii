# Step 0016 — inspected range/value diagnostic complete

Completed in **26.69 minutes**. All ten inspected current challenge seeds reproduced exactly; all160 offline value states completed. No new holdout/profit evidence, fitting, policy changes or live promotion.

[Summary](summary.json) · [Audit](audit.json) · [Consolidated findings](../../../docs/experiments/2026-11-06-consolidated-findings.md).

## Provenance and privacy

Source02ea102 committed before execution and successfully pushed. Compared current with the frozen population offset artifact SHA256df943f898f0944386c96901b8a40abaac4ec14c6ab154cdbe5177f0c937dfb54. All original policy/engine runtime files were verified byte-identical to16d6fbc before starting. Seeds93001–93010 were already inspected challenge data and explicitly recorded as diagnostic reuse in seed registry. No fresh reservations.

Reproduced420matches/1680hands and exact archived per-seat net, rotation, button and fallback reports. Reconstructed every dealt hand through engine/seeded shuffle lifecycle, checking observer cards/current board at every observation/decision. Public-current predictions matched actual policy callbacks. Hidden truth was used only AFTER inference as labels and in a separate privileged scorer; inferred-value calls receive a public view/range object without truth. All original50-sample choices/call values reproduced for the160 selected states. No discarded mismatches.

## Range quality

4807 flop opponent actions scored for both models, including folds without showdown-reveal selection. Primary comparisons below are offset-minus-current means of ten paired seed means; conventional intervals omitted. Lower true-hand log loss is better.

All-action post-update true-hand log-loss difference **-.001522**, seed SE **.002603**: tiny and unresolved. Before-action difference +.000793, SE.000625; update information-gain difference +.002315, SE.002188. Secondary equal-hand aggregation post-loss difference -.003513, SE.002312. These do not establish materially better latent ranges.

Action forecast loss improves overall (paired difference -.011862,SE.004095). But **2665/4807 actions (55.44%) occurred after the observer folded**. In the2142-observation not-folded subset, action loss instead worsens (+.020020,SE.005809), and true-hand post-loss difference is +.000869,SE.002700. The not-folded flag can include an all-in observer; it is not proof of a remaining decision. Thus aggregate prediction improvement is not well aligned with not-folded exposure on these reproduced current trajectories. Post-fold observations remain legitimate population evidence and may help other decisions or policies; this diagnostic does not justify automatically discarding them. This is diagnostic association on inspected histories, not a causal explanation of the full-game profit result.

Support-specific after-loss differences:011 +.000138 (SE.002345),110 -.013516 (SE.015552),111 +.003638 (SE.004373). Action-loss gains in110/111 did not translate into clearly improved true-hand scores. All family/action/observer-active breakdowns retained in audit; no category was selected to promote a model.

## Restricted action-value diagnostic

4163 actual current decisions observed;601 paid flop/turn decisions across424 eligible hands. Selected160 first eligible decisions per hand using predeclared lowest hashes, with a bounded online reservoir. Sample is outcome-independent but not every decision/street. Range order/weights were preserved exactly for deterministic Monte Carlo parity.

At512samples, current and offset choose differently in only **2/160 states (1.25%)**. At the original50sample seed they differ in **14/160 (8.75%)**. Changing50 to512samples flips **12/160 decisions (7.5%) for each model**. Eight50-sample streams disagree with their respective512 choice about8.44% current /8.20% offset on average. Sampling sensitivity appears large relative to the two-model difference at higher budget, but this does not prove larger budgets improve full-game profit.

Distance to privileged call-value reference, pooled across states: current MAE28.84chips/RMSE56.88; offset MAE29.70/RMSE56.61. Equal-seed absolute-error difference +.843chips,SE.683: no useful demonstrated improvement. The reference knows hidden holdings unavailable to the player, so zero error is not a realistic calibration target.

At512samples, paired equal-seed reference payoff difference offset-current is **-.0849chips per sampled decision**,SE.0655; corresponding privileged information gap increases by+.0849. Pooled information gaps4.808current/4.897offsetchips. These are restricted information diagnostics, NOT real-strategy regret, full-game EV or bb/100 profit. At50samples, pooled reference payoff38.786current/39.846offset; at512,39.894/39.805. Higher sampling budget is not uniformly better in these privileged-reference outcomes.

## Reference limits and verification

Reference enumerates all remaining flop/turn runouts excluding all dealt hole cards, including folded dead cards. It assumes no more bets and splits ties fractionally, matching estimateEquity rather than engine whole-chip odd-chip allocation. Near-zero reference thresholds can differ from integer payouts. It does not evaluate preflop actions, raises, river search, opponent counterfactual responses or full-strategy optimality. No attainable oracle or GTO claim.

All187tests/lint/TypeScript/diff checks passed before and after the run. Independent pre-run review corrected the fractional tie-share label. Independent audit verifies archived accounting, paired metrics, equal-hand/seed aggregation, state hashes/privacy, original50-value/action parity, repeated-sample metrics and recorded reference arithmetic. Oracle enumeration is supported by source/helper tests/runtime assertions; the Python audit does NOT independently re-enumerate every runout. Raw reconstructed states, sampled ranges, labels, per-seed records and per-state outputs are retained for reproducibility. Independent final interpretation review found no substantive overclaim and all relative report links resolved. Completion data/report commit and actual push status are recorded at delivery.

## Decision and next action

Do not promote or refit from this inspected diagnostic. Better average action prediction did not establish better ranges or downstream values; much of the action-scoring exposure occurs after folding. Recommended next design: make validation explicitly decision-relevant (distinguish still-able-to-act,all-in,folded histories), and test sampling stability near call thresholds with matched budgets before additional response-model fitting. River search and full-strategy value remain separate unexamined contributors; no causal attribution or fresh profit claim. Keep current live policy and sunk-cost safeguards.

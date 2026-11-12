# Chance-node control variates: design, not implemented

Goal: reduce evaluation variance for a frozen policy matchup. Privileged cards belong only to evaluation. Features cannot import evaluation code or read its output.

At a chance node with pre-deal information I, action/card C drawn from known engine probability p(c|I), and fixed bounded value function V(I,c), use correction E_p[V(I,C)|I] - V(I,C_observed). Add corrections to the realized chip return. Each correction has conditional expectation zero, so sums remain unbiased even when V is inaccurate. Use without-replacement deck probabilities and exactly the same information set in the expectation and observed term. Marginalize private deals under a specified information partition, or condition on all dealt holes consistently. Never condition the expectation on future cards while using an observed term from the earlier filtration. Board flops are unordered sets under this engine (no burn cards), turn and river are individual cards.

Known fixed opponent policies and full-card simulator access help, but do not by themselves supply a cheap value function. Policy branching makes exact continuation expensive. A full conditional expectation at a turn/river node needs up to 40–44 continuation evaluations, flop C(remaining,3), initial private deals much more. Running the passive baseline to terminal for each card is NOT cost-free and may erase all variance gains. A learned surrogate or frozen rollout estimate can be used as V; freeze it on disjoint seeds before evaluation. For randomized V, independent fixed common random streams and identical expectation/observed mappings are required. Fit neither its coefficients nor its value function on confirmatory outcomes. Classic AIVAT also includes known policy-action corrections and imaginary observations; the proposed first increment is a chance-only martingale control variate, not a claim of complete AIVAT implementation.

All-in EV adjustment is a special exact terminal conditional expectation (Rao–Blackwellization) with no future decisions. Do not double count its removed board luck in subsequent chance corrections. Apply chance corrections before the all-in boundary or to disjoint nodes, or derive a single consistent telescoping estimator.

Tests before adoption:
1. Exhaust a small finite deck/game tree: mean correction exactly zero, all leaves weighted by engine probabilities; include folded dead cards and odd-chip side pots.
2. At every node validate expected correction conditional on I, not merely aggregate cancellation.
3. Independent fixed seed pilot: paired adjusted-minus-raw cluster-t CI contains zero; archive variance ratio with uncertainty. This is a diagnostic, never proof of unbiasedness on its own.
4. Future-card/label mutation must leave all feature outputs and policy decisions identical; evaluation dependency boundary enforced.
5. Determinism with one/four workers; frozen surrogate bytes, source hashes, mappings and p in provenance.
6. Measure variance times wall-cost per independent seed cluster versus raw/all-in-only. Require a net power/runtime improvement before confirmation.

Decision: defer implementation. No frozen surrogate exists and exact policy continuations multiply simulation work. Terminal all-in conditioning has a sound exact implementation path; broader chance-node corrections need a separate fixed-work cost/variance pilot. No engine/policy changes required.

Primary reference: Burch et al., [AIVAT: A New Variance Reduction Technique for Agent Evaluation in Imperfect Information Games](https://ojs.aaai.org/index.php/AAAI/article/view/11481). The paper describes unbiased assessment using heuristic state values, known strategies and chance/player-action variance reduction. This note's simpler terminal/chance-only proposal does not implement its full imaginary-observation construction. No paper-reported speedup is assumed for this simulator.

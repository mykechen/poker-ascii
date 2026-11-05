# Bounded historical flop audit

Source: committed runtime/run artifacts at 7bd3d3a, experiment 5a4690bf0ef2. This is a reanalysis of inspected historical seeds, not a fresh experiment or independent evidence. No simulation or policy changes.

Raw checkpoint accounting independently recomputed: 15,120 hands, 630 matches, zero invalid-action fallbacks, zero nonconserving match totals. See results.json for per-seed scores.

For river-search and equity-only separately, all three evaluation seed batches have worse flop Brier and log loss than the supported-action uniform baseline. The weakness is not isolated to one seed batch. These correlated observations do not establish a population-level significance claim or identify a cause.

The raw checkpoint retains calibration sums by street and batch only. It does not retain individual forecasts, outcomes or public decision contexts. Opponent-family, faced-bet, sizing, player-count and hand/draw breakdowns cannot be reconstructed from those sums. Reliability bins and fitted likelihoods also cannot be recovered. Do not infer overconfidence or calibration failure solely from these proper scores.

## Next bounded step

Add test-first observation collection at the pre-action forecast callback. Record supported legal classes, probabilities, observed action, public betting/board context and observer-visible hand/draw features only. Never read target hidden cards. Keep simulator family labels as analysis metadata outside policy inputs. Aggregate reliability separately for each action class, including counts, mean forecast and observed frequency; retain observations for global offline fitting.

Expose explicit seed starts and validate disjoint partitions before collecting new data. Reserve fresh training/validation/evaluation ranges; 20001–20002 and 30001–30003 remain inspected. Freeze fitting/selection before evaluation and preserve current river and equity controls. Profile within-hand computation before increasing budgets. No live app changes or promotion are justified.

This audit completes only the historical-data feasibility check. New observation instrumentation, fitting, reliability reporting, seed configuration and fresh evaluation remain outstanding.

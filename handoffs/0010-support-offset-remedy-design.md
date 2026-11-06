# Step 0010 — support-offset remedy design

Design only; no implementation, fitting, new seed reservation or execution.

Read `docs/superpowers/specs/2026-11-06-support-offset-remedy-design.md`. Proposed remedy reuses contextual artifacts with only support-level regularized logit offsets, preserving per-latent likelihoods. Unsupported training coverage falls back exactly to current. Fixed fresh training/validation panels, independent hand/batch coverage gates, solver/selection rules and stop conditions are specified. A fresh profit protocol remains separate; user target is still 5 bb/100.

Clarification: 1.79% was a smoothed opponent fold prediction on support-110 flop observations, not overall/preflop fold rate. Current evaluated candidate before river checks for free, calls on nonnegative estimated showdown value, otherwise folds. It does not choose raises or model future betting before river. This separate strategy limitation is preserved rather than bundled into response-model fitting.

Builder review complete. Clarified flop-only fitting/coverage, frozen current-policy training components versus candidate-own validation replay, and four active scalar coefficients. No remaining substantive blockers. No runtime files changed.

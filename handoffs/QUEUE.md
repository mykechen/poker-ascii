# Development queue

## Completed — profile and optimize within-hand computation

See [Step 0005](0005-training-computation.md). The valid profile identified repeated pure hand features as a dominant cost. A bounded feature cache reduced median matched workload time about40% with exact action/payout/forecast equivalence, at unchanged budgets. No opponent memory or live-policy change. Initial rejected clock-origin analysis is preserved.

## Next task — contextual population response experiment

Status: specification written and builder-reviewed; implementation/fitting are queued, not scheduled automatically.

Worktree: /private/tmp/poker-training-foundation. Branch: poker-training-foundation. Preserve unrelated changes in the original main workspace.

Read the [detailed experiment specification](../docs/superpowers/specs/2026-11-05-contextual-flop-model-design.md), [seed registry](seed-registry.json), latest handoff and interpretations. Write the task-level implementation plan before changing model code.

The next pilot makes current, uniform, smoothed support-frequency and one regularized global contextual likelihood family eligible in advance. Preserve hand-conditioned likelihoods by transforming before latent marginalization. Validation must replay common observer-permitted histories with each model's own within-hand beliefs; then freeze selection before fresh on-policy evaluation. No opponent identity/family inputs, actual target hidden cards, cross-hand memory, budget increase or live promotion.

The unsuccessful uniform-mixture fit remains valid historical evidence; do not silently discard it or promote the previously descriptive frequency baseline without the new declared selection process. Reserved seed ranges are not yet run. Update the registry and handoffs on execution, including failures.

## Later

Independent profit confirmation, persistent-stack/stack-depth checks and stronger opponents follow only if supported by the pilot. Earlier-street search and heads-up optimization remain later projects. Commit/push each verified step without collaborator/co-author additions; no merge to main.

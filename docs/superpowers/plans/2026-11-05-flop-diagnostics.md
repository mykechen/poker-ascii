# Flop diagnostics implementation plan

Goal: collect public-context forecasts, diagnose reliability and fit one global flop likelihood mixture without cross-hand memory. User approved this workflow in chat.

Architecture: optional adaptive callback emits public observation records; league stores records with family metadata mapped from public opponent names after seat rotations. Offline diagnostic script fits a legal-uniform mixture weight using training and validation only. Actual fitted likelihoods are applied within RangeBeliefs on flop; fresh evaluation compares fitted river, original river and equity-only controls. No live policy defaults change.

- [ ] Test reliability bins, legal support, mixture endpoints and configurable seed partitions before implementation.
- [ ] Add records with street, public decision context, observer hand features, board texture and family metadata. Never expose target cards.
- [ ] Add optional global flop mixture and ensure zero preserves existing behavior.
- [ ] Collect bounded data on seeds 41001–41002 training and 42001 validation, four hands per match, 6/7/8 players and seat rotations. These become inspected immediately.
- [ ] Compare current, uniform, smoothed global frequency baseline and mixture grid 0/.25/.5/.75/1 on fixed original-policy trajectories. Choose training-minimum log loss; validation is a gate, not another selection set. Save freeze before evaluation.
- [ ] Evaluate frozen fitted river against original river and equity-only on 43001–43002, four hands per match. Report uncertainty limitations, raw accounting, reliability and public-context breakdowns. No superiority claim from tiny samples.
- [ ] Run tests/lint/types, save interpretation and next task, commit and push verified steps.

Budget is a diagnostic screen, not a powered win-rate trial. Offline fitting conditions on original-policy ranges; fresh on-policy evaluation checks distribution shift. Profiling is queued before search expansion.

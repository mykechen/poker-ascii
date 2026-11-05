# No-memory calibration — interpretation

Runtime source commit: 0f9d288. Full source fingerprint, exact seed partitions, configurations and metrics are in summary.json. Canonical command: `npm run league -- --hands 24 --tuning-seeds 2 --evaluation-seeds 3 --output data/no-memory-calibration-v1.json`.

## What changed

Candidates now forget opponents between hands while retaining current-hand action/range inference. No candidate in this run collects cross-hand tendencies or reveal histories. Legacy learning code remains opt-in for reproduction. Benchmarked opponents retain their prescribed strategies.

Every tracked run now gets an automatic handoff, machine-readable summary and compressed raw checkpoint. Reports update each completed batch, support resume, mark interruptions at safe boundaries and clear resolved failure messages. A historical handoff and development smoke/interruption checks are also archived.

This source also restricts response probabilities to legal action classes and adds pre-action prediction diagnostics. Historical results therefore are not an isolated paired test of removing memory.

## Experiment and results

15,120 hands across 630 matches; 24 hands per match, 6/7/8 players, 100bb reset stacks, 1/2 blinds, no rake. Zero invalid-action fallbacks and zero nonconserving match totals. Runtime about 1,418 seconds. Equity uses 50 samples; river search uses 16 worlds per candidate, both screening budgets.

Two tuning seeds selected the one-standard-error river sampling penalty. Equal-weight tuning means were 729.51 bb/100 with no penalty, 755.22 with one SE, and 710.65 with two SE. Selection was frozen before three disjoint held-out seed batches.

Held-out equal-weight means:

- No-memory river policy, one-SE ranking penalty: 685.53 bb/100.
- No-memory equity-only control: 710.93 bb/100.
- Chart control: 210.27 bb/100.

Paired differences: river minus equity-only = -25.40 bb/100 (seed-batch SE 16.62); river minus chart = +475.27 (SE 202.53). Only three independent evaluation batches exist. Confidence intervals are omitted, and neither improvement nor inferiority is statistically established. These synthetic fields include weak/maniac strategies; absolute rates do not generalize to competent poker players.

The earlier screen used different seeds, match lengths and code. Do not compare its absolute rates as a paired measure of memory or speed. Disabling history removed bookkeeping but did not remove the main within-hand calculations; no isolated speedup claim is supported.

## Predictive diagnostics

Selected policy forecasts were scored before each observed opponent action changed the range. Lower multiclass Brier score and log loss are better. Reference forecasts are uniform over supported legal action classes on exactly the same observations.

- Preflop, 25,410 observations: Brier 0.636 versus uniform 0.652; log loss 1.059 versus 1.063. Only a small predictive gain.
- Flop, 4,789 observations: Brier 0.659 versus 0.566; log loss 0.932 versus 0.854. The model is worse than this simple reference.
- Turn, 2,983 observations: Brier 0.560 versus 0.562; log loss 0.809 versus 0.844.
- River, 2,329 observations: Brier 0.316 versus 0.502; log loss 0.492 versus 0.699.

These are forecast scores, not proof of calibrated probabilities. They combine discrimination and confidence and do not replace reliability-bin analysis. Observations within sessions are correlated. Different policies generate different action trajectories, so their prediction averages are not a paired forecasting contest. Chart has no forecast model, hence no calibration rows.

## Decision and next handoff

Keep opponent memory off. Do not promote river search over equity-only based on this screen. Retain both as experimental controls; live app behavior remains unchanged.

Next priority: diagnose and fit global flop response likelihoods using separate training data, add reliability/response breakdowns, then reserve fresh validation and held-out seeds. This is offline population calibration, not remembering individual opponents. Profile range/equity computation before expanding search or increasing sample budgets.

Seeds 20001–20002 and 30001–30003 are now inspected historical data. Do not treat them as a fresh holdout in subsequent tuning. Future experiments should expose configurable seed ranges and record them in the next handoff.

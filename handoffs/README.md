# Experiment handoffs

Every canonical `npm run league` experiment writes a folder under `handoffs/runs/DATE-EXPERIMENT_ID/` automatically. Resume updates the same experiment, so a restarted process is not mistaken for independent evidence.

Each folder contains:

- handoff.md: status, source commit/fingerprint, exact settings, progress, results, limitations, and next steps.
- summary.json: machine-readable report and accounting checks.
- raw-results.json.gz: full compressed checkpoint, including all completed match results.

Reports update at initialization and after every completed seed batch. Exceptions mark the run failed and preserve partial results. SIGINT/SIGTERM mark the report interrupted at the next completed batch boundary; SIGKILL or a machine crash may leave the last report marked running. Its checkpoint remains resumable. Keep smoke runs labelled by their tiny hand/batch settings. Invalid invocations rejected before initialization are not experiment runs.

Before each completed stage is handed off: verify the report against raw matches, record interpretation and next steps, then commit and push the run folder. Do not treat different-seed historical runs as paired comparisons or reuse inspected evaluation seeds for new tuning decisions.

Current training defaults reset opponent beliefs each hand. Within-hand inference remains active. Historical opt-in cross-hand learning remains in code for reproducibility, but the current league disables it for all variants. Legacy benchmark scripts remain development utilities; use the league runner for tracked experiments.

## Historical results

The first league screen is recorded in [0001-league-screening.md](0001-league-screening.md). Its original complete artifacts remain under docs/experiments/2026-11-05-league-screening/.

## Current tracked run

`npm run league -- --hands 24 --tuning-seeds 2 --evaluation-seeds 3 --output data/no-memory-calibration-v1.json`

Candidate memory is disabled; benchmark opponents keep their prescribed strategies. The grid varies only river sampling-noise penalties (0, 1, 2). Controls are no-memory equity-only and chart policies. Fresh seed ranges start at 20001 for tuning and 30001 for evaluation.

Calibration reports multiclass Brier score and log loss, with lower scores better, against a uniform forecast over supported legal action classes on the same observations. Scores are measured before each observed action updates the range. Different policies generate different trajectories, so their prediction scores are descriptive and should not be treated as a paired forecasting contest. Measuring calibration does not itself fit or improve the model.

## Completed tracked experiments

- [0001 — original memory/river screen](0001-league-screening.md).
- [0002 — no-memory calibration and 24-hand matches](0002-no-memory-calibration.md).

Folders for the one-hand development smoke checks are retained under runs/ and explicitly labelled in their interpretation files. They are integration tests, not independent strategy evidence.

## Flop diagnostics and queued work

- [0003 — public forecast instrumentation and global fitting workflow](0003-flop-instrumentation.md).
- [0004 — bounded diagnostic screen; unsuccessful uniform-mixture fit](0004-flop-diagnostic-screen.md).
- [Development queue](QUEUE.md): completed experiments and next decision. Repository queue only; not an automatically scheduled job.

Canonical league seed starts are configurable with `--tuning-seed-start` and `--evaluation-seed-start`. The bounded diagnostic workflow is `node_modules/.bin/vite-node scripts/flop-diagnostics.ts`, with `--training-start`, `--validation-start`, `--evaluation-start` and corresponding `--*-count` flags. It preserves progress and failure artifacts but does not resume interrupted runs. It never changes live defaults. Seeds 41001–41002, 42001 and 43001–43002 are now inspected.

- [0005 — computation profiling and pure hand-feature optimization](0005-training-computation.md). Includes the rejected clock-origin analysis, valid CPU profile, untouched external baseline and exact before/after trace checks.
- [0006 — builder-reviewed contextual population-model specification](0006-contextual-model-spec.md). Design and seed reservations only; fitting has not run.

- [0007 — completed contextual response pilot](0007-contextual-flop-pilot.md). Frequency selected; on-policy profit improvement remains unproven.

- [0008 — bounded frozen frequency confirmation](0008-frequency-confirmation.md). Profit inconclusive; downside veto failed and sparse-support quota unmet. No promotion.

- [0009 — sparse-support diagnosis](0009-sparse-support-diagnosis.md). Reproduced fold overconfidence and loss of latent discrimination; no runtime change.

- [0010 — builder-reviewed support-offset remedy design](0010-support-offset-remedy-design.md). Design only; no fresh runs or implementation.

- [0011 — completed support-offset training/validation](0011-support-offset-validation.md). Offset .1 selected; sparse quotas and validation gates pass. No fresh profit/shifted-field confirmation or live promotion.

- [0012 — complete frozen offset confirmation](0012-offset-confirmation.md). +2.03bb/100,95%[-50.18,54.24],inconclusive; sparse coverage passed but forecast/downside gates failed. Folding is valid; no live promotion.

- [0013 — builder-reviewed population coverage redesign](0013-population-coverage-design.md). Equal-stratum training/validation safeguards; design only.

- [0014 — harness/opponent audit](0014-harness-opponent-audit.md). Eight related heuristic styles; asymmetric lineup repetition and limited opponent strength documented. No runtime changes.

- [0015 — balanced population experiment and independent-opponent challenge](0015-balanced-population-experiment.md). Completed; selected forecasts improve but challenge adverse/inconclusive. No promotion.
- [Consolidated findings through Step0015](../docs/experiments/2026-11-06-consolidated-findings.md). Full historical evidence, limitations and current next decision.

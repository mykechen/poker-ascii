# Continue the poker-bot project

## Latest work — harness/opponent audit

Read `handoffs/0014-harness-opponent-audit.md`. Existing opponents are eight related heuristics; no strong external/solver opponent test in tracked confirmations. Five-entry lists repeat their first types at larger tables; all-seat rotation does not balance family counts. Address lineup multiplicity in the pending population design before implementation. No runtime changes.

## Pending work — population coverage design

Read `handoffs/0013-population-coverage-design.md` and its linked specification first. Builder-reviewed redesign complete; no implementation or fresh reservations yet. Equal legacy/expanded population weighting, per-stratum/minority coverage and validation gates, same offset family. Next: concrete design approval then implementation plan. No profit run/live promotion.

## Previous work — two-hour offset confirmation

Read `handoffs/0012-offset-confirmation.md` first. Fixed20panels/100profitpairs completed in83.79minutes. Profit+2.03bb/100,95%[-50.18,54.24],inconclusive. Sparsecoverage passed but forecast gate/downside veto failed. No promotion. Next: training-population coverage/model-validation redesign, no reruns or fitting to inspected confirmation seeds.

## Previous work — support-offset experiment

Training/validation completed; offset:0.1 selected, with improved prediction scores. No profit/shifted-field generalization evidence yet. Read `handoffs/0011-support-offset-validation.md` and newest support-offset run progress first. Source 81ee2ca; fixed fresh train/validation only. No profit test/live promotion. Do not duplicate the completed run or reuse its seeds. Next is a separate fresh shifted-field/sparse-support and profit confirmation design.

## Previous work — support-offset design

Read `handoffs/0010-support-offset-remedy-design.md` and its linked specification. Builder-reviewed design is complete; no implementation or fresh reservations yet. Next: review the concrete design with the user, then write the implementation plan.

## Previous work — sparse-support diagnosis

Read `handoffs/0009-sparse-support-diagnosis.md` first. Diagnosis completed using inspected evidence: sparse fold rate shifted, validation coverage was inadequate, and frequency replacement removes latent action discrimination. No runtime change. Next: design a training-only regularized offset remedy preserving within-hand inference, with fresh training/validation/evaluation partitions.

## Previous work — confirmation

The 5 bb/100 confirmation is complete: +13.45 bb/100, primary 95% interval [-131.07, 157.96]; inconclusive. Downside veto failed and sparse quota was unmet. Both independent audits passed. Fixed 30 paired batches plus 10 common-history panel batches are specified in `docs/superpowers/specs/2026-11-06-frequency-confirmation-design.md`; source commit `2f661ba`. Check `handoffs/0008-frequency-confirmation.md` and run progress before taking any action. This run is deliberately bounded and underpowered for a true 5 bb/100 effect. Never rerun inspected seeds or change the frozen frequency model. No live promotion.


Read this file as instructions to continue the work, not merely summarize it.

## Repository and workspace

- Implementation worktree: `/private/tmp/poker-training-foundation`
- Branch: `poker-training-foundation`
- Repository: https://github.com/mykechen/poker-ascii
- Last implementation/specification commit before this handoff: `842c8e3`. Check for newer changes first.
- Original workspace: `/Users/mykechen/Desktop/APPS/poker-ascii`. Preserve its unrelated changes; do implementation in the worktree above.

Inspect `git status`, recent commits and newer handoffs before editing. Avoid duplicate work if another chat has advanced the branch.

## Read first

Paths are relative to the implementation worktree:

1. `handoffs/0006-contextual-model-spec.md`
2. `docs/superpowers/specs/2026-11-05-contextual-flop-model-design.md`
3. `handoffs/QUEUE.md`
4. `handoffs/seed-registry.json`
5. `handoffs/README.md`

## Latest completed work — read first

The contextual pilot is now completed. Read `handoffs/0007-contextual-flop-pilot.md` and the updated queue/registry before doing anything below. The implementation and pilot instructions below describe completed work; do not rerun or reuse the inspected seeds. Next work is an independent confirmation design, not live promotion.

## Previous task (completed)

Write the task-level implementation plan, then implement and run the reviewed contextual flop-response experiment. Follow its model definitions, common-history validation procedure, selection gates, reserved partitions, quota rules and stopping rules. Continue through verified implementation, the bounded experiment, interpretation and handoff; do not stop at proposing the work.

The eligible models are current likelihoods, legal-support uniform forecasts, training-only smoothed support-frequency forecasts, and the specified regularized contextual logit-offset family. Corrections must apply before latent marginalization. Each model must maintain its own within-hand beliefs during common-history validation. Freeze selection before fresh on-policy held-out evaluation.

## User requirements

- Target 6–8 player cash games: initially 100bb, fixed 1/2 blinds, no rake.
- Maximize expected net chip profit; report bb/100 and appropriate uncertainty.
- **No opponent memory between hands.** Preserve within-hand range inference and EV calculations.
- Fit global population parameters offline. No opponent identities, family labels or actual hidden target cards as model inputs. Diagnostic family metadata is not a prediction feature.
- The engine owns action legality and payouts. Training has no artificial thinking delays.
- Preserve the verified pure card-feature cache and current sampling budgets. No earlier-street search in this experiment.
- Use test-first development for behavior changes and appropriate independent review.
- Save settings, provenance, raw results, failures, interpretation and next steps under `handoffs/` for every experiment.
- **Commit and push every completed, verified step to the existing feature branch. Never add Codex as a collaborator or co-author.**
- No live-bot replacement or merge to main as part of this work.
- Preserve unsuccessful outcomes. Better prediction scores alone do not establish stronger poker play.

## Current findings

- River search has not demonstrated improved profit over equity-only play.
- The previous uniform-blend flop fit selected zero change. Do not discard that result or retroactively promote its descriptive frequency baseline.
- Profiling identified repeated hand-feature calculations. A bounded pure card-feature cache reduced median measured workload time from 20.75 to 12.48 seconds, about 40% less time, with identical actions, payouts and forecast totals. This is computation evidence, not improved poker strength.
- The next contextual-model specification is written and builder-reviewed. Implementation and fitting have **not** started.
- Seed reservations are not evidence that a run occurred. Check the registry and all newer handoffs before using them; never reuse inspected data as a fresh holdout.

## Verification and environment

Last verification: 126 tests passed, plus lint, TypeScript and diff checks.

```bash
cd /private/tmp/poker-training-foundation
npm test -- --config vitest.config.mts
npm run lint
node_modules/.bin/tsc --noEmit
git diff --check
```

The worktree's `node_modules` is symlinked to the original workspace. The explicit `.mts` Vitest configuration avoids an ESM-loading issue encountered here.

The clock-safe CPU profiler uses measured-workload stack markers because V8 profile timestamps and Node hrtime had different origins on this machine. Preserve that measurement correction if profiling again.

## Completion report

State what changed, what ran, exact verification results, what the evidence does and does not support, the next action, and commit/push status. Link the new handoff and update the queue/index/seed registry. A no-change or insufficient-data result is valid and must be recorded honestly.

# Bounded flop diagnostic screen — interpretation

Source: 73a0c4d; runtime fingerprint and exact settings in summary.json. Command: `node_modules/.bin/vite-node scripts/flop-diagnostics.ts`. Progress, unsuccessful fit, frozen selection, observations and full raw matches are preserved here.

## Accounting and validation

1,512 hands / 378 matches; four hands per match; 6/7/8-player tables; all seat rotations; fixed 100bb stacks, 1/2 blinds, no rake. Zero invalid-action fallbacks and zero nonconserving match totals. audit.py independently recomputes raw chip profit, every saved forecast score and total accounting; audit.json records success. This is a bounded diagnostic screen, not a powered performance trial.

119 tests, lint, TypeScript and diff checks passed. Independent read-only code review found no concrete correctness, privacy or evaluation bugs. Forecasts derive from the pre-action observer view and exclude target hole cards and deck order. Opponent family labels are mapped by participant name across rotations, retained only as analysis metadata. No live app changes or cross-hand memory.

## Fit and freeze

Training: 41001–41002, 724 flop observations. Grid weights 0/.25/.5/.75/1 blend global flop response likelihoods with legal-action uniform probabilities. Training log loss increased monotonically from 0.526 at weight zero to 0.744 at weight one. Training selected zero; no new numerical response parameter earned adoption.

Validation: 42001, 379 flop observations. Current/selected Brier 0.353, log loss 0.569; uniform 0.528 / 0.761. A smoothed global frequency baseline conditioned only on legal support scored 0.326 / 0.511. The frequency baseline was descriptive, not an eligible selected policy. Do not retroactively choose it based on these or evaluation results.

freeze.json was written at 2026-11-05T07:28:50.936Z before any evaluation batch. The rule was training-minimum log loss with a validation improvement gate; otherwise retain zero. Offline fitting held original ranges fixed. In general applying a mixture throughout inference changes ranges, so offline scores cannot substitute for fresh on-policy evaluation.

## Fresh evaluation

43001–43002, evaluation-only fields. Fitted/current river: 1125.37 bb/100; equity-only: 1130.54. Paired river-minus-equity difference: -5.16 bb/100, seed-batch SE 7.63. Only two seed batches; no reliable superiority/inferiority claim. Large absolute rates reflect deliberately weak synthetic opponents and four-hand matches, not realistic human win rates.

Selected weight zero means fitted and current are identical policies and produced identical results. Their duplicate runs are an integration check, not independent replication. Do not pool them as additional evidence.

Current river flop scores: 485 observations, Brier 0.667, log loss 0.941. The diagnostic groups show:

- Maniac family: 207 observations, Brier 0.889 versus uniform 0.506; log loss 1.117 versus 0.709. Other sampled families beat uniform, though tight has only ten observations.
- No bet faced: 230 observations, Brier 0.801 versus 0.500; log loss 1.017 versus 0.693. Faced bet: 255 observations, Brier 0.546 versus 0.631; log loss 0.873 versus 1.013.
- In the family-by-facing intersection, all 168 unbet maniac observations were aggressive; mean aggression forecast was 0.293. Stations checked/called on all 177 observations. For the 154 faced-bet station observations the model assigned mean fold/passive/aggressive probabilities 0.386/0.399/0.215. These observations identify model/population mismatch; they do not justify passing family identities to the bot.
- Sizing, live-player count, observer-visible hand/draw context and board texture breakdowns are all saved in summary.json. No large faced-bet or monotone-board observations occurred, so the run offers no evidence for those contexts. Observer hand features are not target hand-strength labels.

Reliability bins are per action class with counts, mean forecast and observed frequency. Examples: aggression forecasts in [0.2,0.3) averaged 0.256 but occurred 0.522 of the time (232 observations); passive forecasts in [0.3,0.4) averaged 0.362 but occurred 0.809 (141). Aggregate bins mix families and legal supports, include structural zeros and correlated actions, and have no independent-observation uncertainty claim. They demonstrate descriptive reliability gaps, not population guarantees.

## Decision and next steps

Keep the existing response likelihoods and both experimental controls. No complexity or policy promotion from this run. Global uniform shrinkage failed to improve the training population; the held-out failure concentrates in a different behavioral mix. This makes train/validation population coverage and context-dependent likelihoods stronger candidates for the next research design than a universal confidence reduction.

The next task is queued in handoffs/QUEUE.md: profile within-hand range/equity computation at unchanged budgets before search expansion. A following research task may fit global context-conditioned likelihoods without identity/family inputs, with fresh training/validation/evaluation partitions and the existing controls. All seeds used here are now inspected; never present them as a fresh holdout. Preserve this unsuccessful fit.

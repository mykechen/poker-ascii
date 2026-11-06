# Population coverage and validation redesign

## Objective and evidence

The user authorized redesigning training coverage after frozen offset confirmation. That completed run remains a failed promotion attempt: profit +2.03 bb/100, primary 95% interval [-50.18,54.24]; sparse forecast deterioration and cell veto failed. Overall forecast improvement did not establish stronger play. Preserve all inspected seeds/results as diagnostic evidence only.

Support-110 fold proportions differed sharply: 22/3267 in offset training, 5/563 in selection validation, 70/216 in fresh shifted-field confirmation. These are conditional opponent action proportions, not the bot's overall fold rate. This establishes a coverage mismatch, not a causal attribution solely to opponent family. Folding is valid; the goal remains incremental expected chip profit, never recovering sunk costs or maximizing calls/folds.

## Chosen change

Hold the four-parameter support-offset family, clipping, solver, lambda grid and decision policy fixed. Change the training population mixture and validation safeguards first. No new feature expansion or hidden-card/identity inputs. This evaluates broader evidence and balanced population weighting as a combined remedy; it does not isolate the contribution of either change individually. Opponent stratum labels are experiment metadata for collection, offline weighting and reporting only; never prediction features or per-opponent memory.

Training strata, each with three explicit ordered fields:

- Legacy: [chart,tight,station,position,aggressor]; [maniac,station,chart,aggressor,tight]; [station,maniac,position,tight,chart].
- Expanded: [multiway,station,learner,tight,maniac]; [learner,position,multiway,aggressor,station]; [tight,multiway,maniac,learner,position].

Validation strata, each with two DIFFERENT ordered fields:

- Legacy: [position,station,aggressor,chart,maniac]; [tight,maniac,station,position,aggressor].
- Expanded: [maniac,multiway,station,learner,tight]; [position,learner,aggressor,multiway,station].

Validate full effective ordered compositions at 6/7/8 players for partition collisions. Repeated strategy families intentionally overlap; no claim of unseen-family generalization. Earlier confirmation lineups are now known diagnostic populations, not permanently fresh holdouts. New validation tests new compositions of familiar heuristics; genuinely stronger opponents remain future work.

## Fitting and coverage

Use fresh current-policy panels only, all seat rotations, 6/7/8 players, four reset-stack hands/match,100bb,1/2 blinds,no rake,50 equity samples/16 river worlds/river penalty1. Preserve no cross-hand memory and pure feature cache. Save earlier streets for own-belief replay; fit only flop using frozen current-policy pre-action components.

For each support and eligible lambda (.1,1,10), minimize HALF the mean marginalized negative log likelihood in each training stratum plus lambda/2 times squared offsets. Thus each stratum has equal total weight irrespective of how often that support occurs. Do not balance by observed fold/call label, oversample folds, or delete calls. Preserve natural action counts and report both raw pooled and equal-stratum objectives. Missing strata cause exact current fallback for that support, not renormalization onto one stratum. Gradients use identical row weights; regularization applied once per support.

Activate a support only if EACH training stratum supplies >=200 observations,>=50 distinct(batch,match,hand),>=8 batches. For support110 additionally require >=20 folds and >=20 passive actions in EACH stratum, each action spread over >=10 hands and >=5 batches. Otherwise support110 offsets remain exactly zero for every candidate. All distinct action-hand keys are (batch,match,hand) within stratum; repeated actions do not create additional independent hands. Thresholds are conservative assistant defaults, not proven effective sample sizes. Other supports retain support-only masks; all other feature coefficients zero. Solver max1000 iterations,gradient tolerance1e-6,step floor1e-12,clipping[-3,3],zero initialization,nonconverged candidates disqualified with traces retained.

## Fixed collection and stopping

Proposed training: 30 seeds91001–91030, each runs all six training fields. Proposed validation: 20 seeds92001–92020, each runs all four validation fields. These ranges are proposals, not reservations or evidence of execution. Check registry before reserving. No retrospective fitting on any prior confirmation, and no reuse of inspected seeds. No quota-dependent top-ups.

Proposed computation cap: two hours measured monotonically at safe batch/replay boundaries, consistent with the recent budget preference; exact execution authorization belongs to the next implementation/run step. Freeze all fits and model hashes before any validation starts. Budget truncation is descriptive/insufficient evidence, not a selection pass. All partial data/failures retained; no automatic rerun/resume. The larger six/four-field panels and candidate replay may exhaust the cap; do not quietly reduce hands/fields/samples or skip candidates to finish.

## Validation selection

Replay each candidate with its own within-hand beliefs on identical current-policy histories. Compare current and the three eligible offset candidates only. Do not replay previous offset or frequency models in this experiment; their archived outcomes remain evidence, but different-panel scores cannot be treated as paired comparisons.

Primary validation loss is the equal-weight mean of the two stratum log losses, not the pooled-action mean. Require >=1% primary loss improvement and no equal-stratum Brier deterioration. Additionally require within EACH stratum: no overall log-loss deterioration >.02, no Brier deterioration >.02, and no legal-support group's log-loss deterioration >.02 when group count>=100.

Sparse110 validation MUST in EACH stratum have >=100 observations,>=30 hands,>=5 batches. At aggregate expanded stratum level require >=20 folds across>=10 hands and>=5 batches. Legacy minority coverage may be insufficient under fixed collection: require >=10 folds across>=5 hands and>=3 batches before claiming minority-fold validation passes. If either stratum misses any mandatory quota, stop as insufficient evidence; do not waive the minority rule because the average looks good. Also report per-action fold/passive log loss and Brier in each stratum, with seed-cluster bootstrap uncertainty: 10,000 paired seed resamples, seed42, pooled score sums/counts within each stratum/group, percentile2.5/97.5 bounds with linear interpolation. One RNG is consumed in sorted stratum/group/action order. Report zero-count replicates; if any occur for a requested group, omit its bounds rather than silently discarding replicates. Do not interpret these conditional scores as desired action frequencies.

Eligible minimum primary-loss candidate wins; ties within1e-6 favor current, then stronger lambda. Current always remains eligible as baseline but missing coverage means insufficient-data rather than a validation success. Freeze selected artifact/hash, scores and gates. A selected current or insufficient-data result is valid. No profit run or live replacement in this redesign.

## Tests and audit

Test weighted analytical gradients against finite differences; duplicating all rows of one stratum must not alter the objective; unequal stratum counts must not change stratum weight. Test exact fallback for missing/insufficient strata, minority coverage masks, forbidden prediction features, independent batch/hand identities, solver convergence/masks, individual-stratum veto despite pooled improvement, incomplete-run refusal and deterministic ties. Existing sunk-cost, legal support, own-belief replay/no-memory tests remain applicable.

Independent pre-run review and full test/lint/TypeScript checks required. Archive source/settings hashes, committed source, per-batch raw matches/panels, strata mapping, coverage/actions/weights, optimizer traces, per-action forecasts, failures and frozen selection. Independent audit recomputes coverage, row weights, forecast arithmetic, validation gates and chip accounting. Commit/push each verified step on feature branch; no merge/live promotion.

## Alternatives and decision boundary

Only adding expanded hands to a pooled fit can still let abundant legacy support110 actions dominate; equal-stratum fitting explicitly addresses that. Forcing a desired fold percentage would corrupt the target and is rejected. Adding contextual features now would mix population and model-capacity changes; defer until this controlled redesign is assessed. A global support correction may still be inadequate across heterogeneous populations. If so, preserve that failure and design a new model rather than tuning from confirmation outcomes.

This is a design deliverable. No new code, seed reservations, fitting, or experiment run occurs at this stage. Next: approve the concrete design, then task-level implementation plan, review, and bounded training/validation. Any later profit test needs fresh partitions and separate precision planning toward5bb/100.

# Frozen frequency confirmation

User approved a 5 bb/100 target and execution. This protocol fixes a bounded 30-batch confirmation, not a study powered to resolve a true 5 bb/100 effect. No live promotion is authorized.

## Frozen comparison

Load the frequency model from the completed pilot freeze.json; require model SHA256 78bd7ff1eacf01b079a95ce4553586de9c900d6eb495658a9f88dec464ea759f and verify the archived freeze.sha256. Compare only frequency and current. No fitting, selection, equity control or pilot reruns. Preserve runtime policies, hand cache, no cross-hand memory, 50 equity samples, 16 river worlds, river penalty 1, 100bb reset stacks, 1/2 blinds, no rake.

Use evaluation fields from the pilot, 6/7/8 players, all seat rotations, two hands per match. Equal-weight six cells within seed; paired frequency-current seed means are the independent analysis units. Thirty fresh seeds 61001–61030; run both configurations for every seed. Fixed N; no optional stopping or enlargement based on results. Reserve before starting and mark every configuration start before computation. Abort on any accounting error; retain all partial evidence. Do not automatically resume.

## Precision and decisions

Pilot paired SE 91.69 over four batches implies SD 183.38. Normal planning approximation for two-sided alpha .05, 80% power at effect 5: ((1.96+.8416)*183.38/5)^2 = approximately 10,558 batches (about 41 hours for paired profit batches at pilot speed, excluding collection/checkpoint costs). Four-batch variance is uncertain. Thirty batches have expected normal half-width 65.6. This bounded run cannot be advertised as adequately powered for 5 bb/100.

Primary interval: mean paired seed difference +/- 2.04523 * sample SE (Student t, 29 degrees of freedom). Report existing league normal intervals only as supplementary. Target signal requires mean >=5 and primary lower bound >0; that demonstrates evidence of positive profit with an estimated gain >=5, NOT evidence that the true gain exceeds 5. Report whether lower bound >5 separately. Otherwise inconclusive if interval spans zero; evidence of regression if upper bound <0.

Assistant-selected downside guard: every matched cell point delta >= -5 bb/100. Report all six cell deltas and their uncertainty. This is a conservative operational veto based on point estimates, NOT simultaneous statistical proof of noninferiority. Even a passing run only supports another robustness decision; no promotion.

## Sparse-support common-history check

Collect a separate fixed panel on seeds 62001–62010 using current policy, same fields/settings. Save all replay observations including earlier streets. Replay both models independently per batch, maintaining each model's own within-hand beliefs; score only flop. No hidden target cards, identities or family labels as prediction inputs. No fitting. For support group 110:true require >=100 observations and frequency log loss <= current +.02; apply same deterioration gate to every group with >=100 observations. Missing sparse quota means insufficient evidence, without top-up. Report Brier and counts too. This gate is descriptive, not a confidence guarantee. Fixed collection regardless of profit results; never tune from either fresh partition.

## Provenance and completion

Archive protocol, source fingerprint (all runtime TS, runner, package/configuration), commit, frozen artifact, timestamps, raw per-batch matches and panels, summary, failures and accounting. Atomic per-batch checkpoints; signals stop at batch boundaries. Verify raw payouts, fallback counts, seat/rotation aggregation, seed pairing and model hash independently. Expected profit: 2520 matches/5040 hands; panel: 420 matches/840 hands. Total 2940 matches/5880 hands. Commit/push verified implementation before running; commit/push interpreted evidence afterward. Update START-HERE, queue, index, seed registry and numbered handoff.

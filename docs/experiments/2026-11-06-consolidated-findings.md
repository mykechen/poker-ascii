# Poker training findings through the range/value diagnostic

The experiments have improved forecast diagnostics and computation, but have not established a profitable policy improvement. Neither the frozen frequency model nor the later support-offset model met the combined promotion requirements. The current live model remains unchanged. This report covers the completed historical studies, harness changes, balanced population experiment, new independent-opponent challenge, and subsequent inspected range/value diagnostic.

## Goal and what is actually tested

The practical target is a reliable improvement of 5 bb/100 in 6–8-player cash-style poker. Tracked experiments use 100bb reset stacks, fixed 1/2 blinds, no rake and short matches, with all tested-seat rotations. They are not persistent-stack cash sessions. Cross-hand opponent memory is disabled for the tested candidate in the current training configuration; within-hand inference still updates opponent ranges from observed actions. Global offline parameters and a pure card-feature cache are different from remembering individual opponents.

Large absolute win rates against these synthetic opponents are not estimates of human win rates. The useful profit comparison is the paired difference between frozen configurations on matched seed batches, with its uncertainty. Forecast log loss and Brier measure action prediction; they cannot by themselves establish profit, calibrated hidden ranges, or poker strength.

## Equity calculation and decision limits

The [equity calculator](../../lib/poker/equity.ts) enumerates compatible opponent holdings and remaining boards when its outcome upper bound fits the exact-enumeration limit. Otherwise it samples compatible weighted joint ranges and board completions using seeded Monte Carlo. It handles ties and eligible side-pot payout. Exact results are exact conditional on the supplied ranges and showdown model; they do not make the ranges or strategy exact.

Tracked candidate experiments use 50 equity samples and 16 river worlds. Fifty samples can produce noisy decisions, especially near a call threshold; the river sampling-standard-error penalty is a fixed heuristic, not proof of optimal action selection. Before river, the evaluated equity policy checks for free, calls when estimated eligible payout minus the additional call cost is nonnegative, and otherwise folds. It does not evaluate raises or future betting on those streets. Better opponent forecasts cannot remove that strategic limitation.

Folding is a valid outcome. Already committed chips affect the available pot, not a target to recover. Regression checks preserve folding with negative incremental call value despite large sunk contributions, and calling with positive incremental value despite a negative expected whole-hand result. See [the offset confirmation and safeguards](../../handoffs/0012-offset-confirmation.md) and [policy clarification](../../handoffs/0010-support-offset-remedy-design.md).

## Early screens: no established benefit from memory or river search

The [original league screen](../../handoffs/0001-league-screening.md) found held-out means of 1,188.76 bb/100 for adaptive river, 1,244.12 for frozen river and 1,202.89 for adaptive equity-only. These exploratory heuristic-field results did not demonstrate a benefit from remembering opponents or river search. They motivated removing cross-hand remembering from subsequent training, rather than promoting the adaptive bot.

With per-hand belief resets, the [no-memory calibration](../../handoffs/0002-no-memory-calibration.md) reported river-search 685.53 versus equity-only 710.93 bb/100, a difference of −25.40. Three held-out batches were insufficient to establish superiority or inferiority. River action forecasts beat uniform, but flop forecasts lost to it, identifying a narrower prediction problem to investigate.

[Flop instrumentation](../../handoffs/0003-flop-instrumentation.md) enabled public-context diagnostics and a global uniform-mixture experiment. The [bounded screen](../../handoffs/0004-flop-diagnostic-screen.md) selected zero uniform blend and retained current. Fresh river-minus-equity profit was −5.16 bb/100 with seed-batch SE 7.63 across only two batches. Flop weaknesses concentrated in maniac-family and unbet decisions. These findings did not justify a policy change.

## Compute improvement: faster, with the same actions

The [computation investigation](../../handoffs/0005-training-computation.md) first rejected a profile with incompatible clock origins, then corrected alignment using stack markers. The valid profile attributed about 60% of inclusive CPU time to repeated hand-feature work.

An 8,192-entry FIFO cache of pure card features reduced the external workload median from 20.748 to 12.476 seconds per 168 hands: about 40% less time, or 1.66× throughput. All 2,381 actions per repetition, payouts and forecast totals matched exactly. This is evidence of a workload-specific speed improvement, not stronger play. No opponent identities or learned tendencies are cached.

## Frequency model: promising forecasts, failed confirmation

The [contextual design](../../handoffs/0006-contextual-model-spec.md) and [pilot](../../handoffs/0007-contextual-flop-pilot.md) compared current, uniform, smoothed support-frequency and contextual offset forecasts. Candidate validation replay rebuilt each candidate's own within-hand beliefs; selection was frozen before evaluation.

Frequency won pilot validation: log loss 0.512016 versus current 0.879384, and Brier 0.355334 versus 0.616002. Some contextual fits failed their declared convergence limit and were disqualified. Four exploratory profit batches gave frequency-minus-current +34.89 bb/100, SE 91.69; that small sample did not establish a gain. Sparse fold/passive forecasts already showed a held-out concern.

The [independent frozen frequency confirmation](../../handoffs/0008-frequency-confirmation.md) completed 30 paired profit batches. Its primary Student-t 95% interval for the +13.45 bb/100 mean difference was **[−131.07, 157.96]**. Neither a positive gain nor the 5 bb/100 target was established. Some matched cells breached the operational downside threshold, without establishing statistically significant cell harm.

On common histories, overall frequency log loss improved from 0.80485 to 0.69885 and Brier from 0.54337 to 0.47061. But sparse fold/passive support had only 63 observations, below its 100-observation quota, and loss worsened from 0.58002 to 0.84436. Combined gates failed; no promotion followed.

## Why the sparse forecasts failed

The [sparse-support diagnosis](../../handoffs/0009-sparse-support-diagnosis.md) reconstructed training support 110: 5 folds and 328 passive actions. Add-one smoothing produced a fold probability of 6/335, or 1.791%. All five folds came from one training batch. Confirmation instead contained 13 folds among 63 actions; those folds contributed 98.301% of frequency's group log loss. Raw action counts had hidden weak hand/batch diversity.

Support 110 means fold and passive are legal, while aggression is unavailable. Its learned fold probability is not an overall or preflop fold rate. The observed mix changed between populations; the diagnosis did not establish a stable population fold rate or isolate its causal source.

Frequency replacement also assigned the same response likelihood to every latent hand/style hypothesis sharing a support. That common factor cancels during range normalization, removing action-dependent latent discrimination. An executable example changed the strong/weak passive-likelihood ratio from 3.15 to 1. This is a structural inference limitation, not proof that it caused the inconclusive profit result.

## Support offsets: stronger validation, another failed confirmation

The [remedy design](../../handoffs/0010-support-offset-remedy-design.md) retained latent-dependent likelihoods and restricted fitting to four support-level logit offsets, regularized toward current. Supports with inadequate independent coverage fall back exactly to current.

The [training/validation run](../../handoffs/0011-support-offset-validation.md) selected offset 0.1. On 4,344 common-panel flop observations, log loss fell from 0.874853 to 0.602776, about 31.1%; Brier fell from 0.613058 to 0.392892, about 35.9%. Every declared support gate passed. The ineligible frequency diagnostic still scored better overall on that panel, so this was not evidence that offsets beat frequency at forecasting.

The central limitation was minority coverage: sparse validation contained only **5 folds among 563 observations**, while training contained 22 among 3,267. Passing aggregate validation did not establish robustness to the earlier fold-heavy fields.

The [fresh frozen offset confirmation](../../handoffs/0012-offset-confirmation.md) completed 100 paired profit batches. Offset-minus-current was **+2.03 bb/100, primary 95% interval [−50.18, 54.24]**. The mean was below 5 and the interval spanned zero. Three cells breached the operational −5 point-difference safeguard; all individual cell intervals spanned zero. No positive-profit or target claim is supported.

Across 9,425 common-panel flop actions, overall log loss improved from 0.805504 to 0.680859 and Brier from 0.544572 to 0.447484. Paired seed-cluster intervals supported overall forecast improvement. Yet the sparse group now contained **70 folds among 216 actions, or 32.4%**, across 70 hands and 18 batches. Minority coverage passed, but sparse loss worsened from 0.675985 to 0.730668, exceeding the +0.02 operational guard. Sparse uncertainty intervals included zero, so the operational failure is not a conventional significance claim.

The offset predicted passive outcomes better but fold outcomes worse: fold loss rose from 0.895552 to 1.856011. Preserving latent discrimination repaired one structural issue but did not solve population shift or establish profit. The completed run was not extended or refitted.

## Harness audit and preparation for broader coverage

The [harness audit](../../handoffs/0014-harness-opponent-audit.md) found eight heuristic policies: chart, tight, station, aggressor, position, maniac, multiway and learner. Most share simple rule logic. “Learner” uses deterministic public-history heuristics; it is not a trained model. There is no completed tracked evidence here against human players, solver/GTO agents, external poker AIs, or strong self-play populations.

Offset training/validation omitted multiway and learner, while confirmation introduced both. Fresh deals therefore tested a changed population. In addition, cycling five listed opponent types into larger tables duplicated the first type at seven players and the first two at eight. Tested-seat rotations did not balance those multiplicities or all opponent permutations. This limited population weighting without invalidating chip accounting.

The [coverage redesign and authorized addendum](../superpowers/specs/2026-11-06-population-coverage-design.md), following [Step 0013](../../handoffs/0013-population-coverage-design.md), keeps the four-parameter family while adding legacy/expanded population strata with equal fitting weight. Coverage and validation gates apply separately to each stratum, including actual minority actions. It changes population mixture and weighting together; any eventual result cannot identify which change caused it. No desired fold rate is forced.

Implemented preparation now rotates each five-entry lineup by a predetermined batch cycle, balancing duplicated identities over complete cycles and recording effective lineups. This corrects future weighting; historical results remain unchanged. It does not enumerate every opponent permutation.

Two standalone [benchmark opponents](../../lib/poker/benchmark-opponents.ts), equity-defender and equity-pressure, use 64-sample uniform-range showdown estimates. They share the equity calculator/evaluator with the candidate but do not reuse its adaptive range-belief or decision logic. Defender uses incremental call value; pressure adds a conservative value-raise heuristic. Their strength is unproven. More computation and implementation independence do not establish that they are strong poker agents.

## Balanced population experiment and new-opponent challenge

The [new experiment](../../handoffs/0015-balanced-population-experiment.md) completed in **97.23 minutes**, within the two-hour cap. It collected 30 training seeds and 20 validation seeds, each covering legacy and expanded opponent populations, then ten fresh challenge seed pairs. The independent audit verified **6,300 matches / 25,200 hands**, zero fallbacks and conserved payouts. Lineup multiplicities balanced exactly over complete five-seed cycles. Current and live defaults were not replaced.

All three regularization candidates converged, and all three modeled supports met training requirements in both populations. Selection chose a newly fitted **offset 0.1**; this is a different artifact from the earlier offset 0.1, not a reuse of its parameters. Equal-population mean validation log loss improved from **0.818633 to 0.615453 (24.82%)**, and Brier from **0.565084 to 0.400612 (29.11%)**. These are macro means giving each population half the weight, not pooled-action averages.

Legacy validation log loss improved from 0.873667 to 0.601947; expanded from 0.763598 to 0.628958. Sparse support110 loss improved in both: legacy 0.591875 to 0.265722, expanded 0.595272 to 0.356294. All predeclared selection gates passed. Legacy sparse coverage included 24 folds among 1,661 actions, across 24 hands and seven batches; expanded included 55 among 637, across 54 hands and 15 batches. Both minority quotas passed.

This is broader validation coverage, not proof that all prior shifts are solved. The new sparse fold proportions were 1.44% legacy and 8.63% expanded; the earlier confirmation population produced 32.4%. The new lineups, balancing and weighting changed the distribution together. Actual-fold conditional log loss worsened from 0.797147 to 1.497223 in legacy (24 folds), and from 0.871499 to 1.611618 in expanded (55 folds), while average group loss improved; that alone is not a reason to force more folds or interpret calls as better actions. Proper forecast evaluation must retain the natural outcome mixture and uncertainty. Model-selection validation is not independent profit confirmation.

The challenge used two new compositions containing equity-defender and equity-pressure alongside heuristic opponents. Both policies have independent decision logic from the adaptive candidate, but share its tested equity evaluator; defender assumes uniform ranges and no future betting, and pressure raises using an equity threshold rather than a full raise-EV calculation. They are additional computational benchmarks, not demonstrated GTO or human-level opponents.

On ten paired seeds, **current averaged 469.38 bb/100 and the selected candidate 370.99**, a paired difference of **−98.38 bb/100**, with seed standard error **58.10**. Seven of ten paired seed differences were negative. Conventional intervals were omitted under the predeclared fewer-than-30-batches rule. This is an adverse diagnostic signal, not an established regression, a real-world win-rate estimate, or a powered test of the 5 bb/100 target. It provides no basis for promotion. Even the candidate's worst absolute cell improving does not cancel its worse matched mean or establish safety.

The combined result is clear about scope: balancing and broader fitting improved action forecasts on both validation populations; the fresh independent-policy challenge did not demonstrate stronger play. No model was refitted from challenge outcomes, no run was extended, and all unsuccessful results remain archived.

## Inspected range and downstream-value diagnostic

The [range/value diagnostic](../../handoffs/0016-range-value-diagnostic.md) reused all ten inspected current challenge seeds, reproducing 420 matches /1,680 hands exactly. This is not fresh performance evidence. Public-only current/offset belief trackers used reconstructed hidden hands only as offline labels; original cards, boards, archived accounting, public predictions and the selected original50-sample decisions were checked. All160 sampled value states completed in a26.69-minute run.

Better action prediction barely changed inferred true-hand quality: paired seed mean post-update log-loss difference was **−0.00152, SE0.00260**. Equal-hand aggregation was likewise small and unresolved. **55.4% of scored flop actions occurred after the observer folded**. On not-folded observations (which can include all-in players), action-prediction loss worsened by +0.02002,SE0.00581, while true-hand range scores showed no clear improvement. This is a decision-exposure alignment concern on current trajectories, not proof that it caused the full-game loss. Post-fold observations remain legitimate population evidence and can help other decisions or policies; these results do not justify automatically discarding them.

On the fixed lowest-hash sample of160 first paid flop/turn decisions, the two models differed on only **2 decisions at512samples**, compared with **14 at the original50sample seed**. Switching50 to512 flipped12decisions for each model. Equal-seed distance-to-privileged-reference absolute error was slightly worse for offset (+0.84chips,SE0.68), without a demonstrated meaningful improvement in restricted action value.

The reference knows all dealt cards, assumes no further betting and splits ties fractionally rather than awarding engine odd chips. Its information gap is not realizable regret, a GTO benchmark or proof that a particular fold was bad. Preflop actions, raises, other paid decisions and river search remain outside this diagnostic. The results justify designing decision-relevant validation and sampling-stability tests; they do not authorize fitting to the inspected seeds or promoting a model. The diagnostic stage passed187tests and recorded arithmetic/accounting audit checks, with the audit's reference-enumeration limit stated explicitly.

## What the evidence supports

Forecasting has improved overall on several fixed panels, while sparse fold-heavy situations repeatedly exposed generalization failure. Profit remains unresolved: neither confirmation established the 5 bb/100 target or passed all safeguards. Computation improved with exact action-trace preservation on the measured workload. These are three separate findings.

Archived audits checked raw accounting, rotations, score arithmetic, frozen model identity and declared gates for the completed runs; their handoffs record exact test and source provenance. Clean accounting does not prove opponent realism or strategic quality. Run totals are deliberately not added into one grand total: designs, diagnostics, replays and distinct comparisons are different units of evidence.

Current policy remains in place. Stronger-opponent performance, longer-session behavior, persistent stacks, sampling sensitivity, pre-river raising/future-bet strategy and human/GTO comparisons remain unvalidated. The new challenge adds computational opponents and an adverse point estimate, but does not close the gap to established playing strength. The inspected posterior-range/value diagnostic is now complete. The next proposed design should make validation decision-relevant and test sampling stability near call thresholds, rather than assuming another action-loss improvement will improve profit. Pre-river raise/future-bet search and evaluation precision remain separate substantive gaps.

Implementation source: `16d6fbc`. Population-stage verification: 177 tests, lint, TypeScript and diff checks passed; raw audit and independent review are linked in the new handoff. Initial GitHub pushes failed before computation, so provenance records the committed source and fingerprint rather than claiming a successful pre-run backup. Completion push status is recorded in the delivery.

Range/value diagnostic provenance: source `02ea102`, 187 tests and lint/TypeScript/diff checks passed. The reused ten-seed histories remain inspected diagnostic evidence, not a new confirmation.

## Decision stability collection: no selection

[Step0018](../../handoffs/0018-decision-stability-coverage.md) adds opt-in public decision snapshots, observer exposure status and stable eligible-payout SE without changing configured actions. The bounded fresh collection completed2520matches/10080hands in32.78minutes with conserved chips and zero fallbacks. Its first-paid-decision-per-hand rule assigned almost all hands to preflop: legacy flop6/turn4 and expanded flop6/turn12 missed53-state quotas despite thousands of paid later-street decisions. This is a sampling-design limitation, not evidence that sampling budgets are equivalent. The coverage gate prevented all budget scoring and selection. Validation and profit testing did not run; current remains. A revised reviewed sampling design is needed before any new reservations.

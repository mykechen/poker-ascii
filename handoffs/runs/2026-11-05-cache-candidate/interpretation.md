# Focused hand-feature optimization

## Decision

Keep one bounded pure hand-feature cache. No poker strategy, probability coefficients, sample budgets, RNG draws, live bot or opponent-memory policy changed.

The marked baseline profile identified handFeatures at about 60.23% inclusive CPU time, overlapping evaluator work. It justified eliminating repeated calculations rather than increasing budgets or expanding search.

## Implementation and reproduction

8192-entry FIFO cache keyed by canonical hole cards and a separately canonical board. Input roles cannot collide. Preflop bypasses caching. Returned objects are copied; input arrays are not mutated. Cache contents are deterministic card features only, never opponent identities, actions or weights. Capacity is bounded and a zero-capacity evaluator supplies the uncached test reference.

External baseline worktree: /private/tmp/poker-profile-baseline at 7998411. Candidate measurement recorded base commit 0455b80 with the only runtime change preserved in candidate-source.patch. Applying that patch to the baseline-equivalent runtime reproduces the candidate source fingerprint recorded in baseline.json. The optimization is committed with this report.

## Matched workload and outcome

Historical seed 20001; two hands per match; both existing fields; equity-only and current river modes; 6/7/8 players with all seat rotations; 50 equity samples/16 river worlds. Each repetition: 168 hands, 2381 decisions. One warm-up followed by three unprofiled repetitions per implementation; a separate candidate profile includes another warm-up and measured repetition.

Before milliseconds: 20315.912,20920.320,20748.358. After: 12475.675,12463.631,12979.480. Median 20.748s ->12.476s, 39.87% less elapsed workload time, 1.663x throughput. These are sequential runs on one machine, not an interleaved or universal performance guarantee. Repeated deals and timings are not independent poker-strength evidence; do not pool them as new strategy trials.

All actual action traces and payout/report hashes match exactly across baseline and candidate repetitions. Aggregate pre-action forecast totals also match exactly. Every match conserves chips and has zero invalid-action fallbacks. No numerical or decision drift was observed in this workload. Focused tests additionally compare varied hands/streets with the uncached evaluator, eviction, reordered inputs, role separation and result/input mutation safety.

Candidate CPU capture: 13.093s, 4.95% overhead relative to candidate baseline median; marker coverage 99.99875%. Exclusive source costs shifted to hand-features 33.9%, range-beliefs 27.1%, evaluator 20.0%. Self and inclusive costs must not be added together. Remaining key/range overhead is a possible future profile target, not a second optimization in this step.

## Artifacts and next work

comparison.json contains exact timings, hashes and accounting assertions. baseline-raw.json.gz and profile-raw.json.gz retain all runs. CPU profile is losslessly compressed as .cpuprofile.gz; decompress before the summarizer. The external baseline run has its own handoff folder; marked pre-change CPU findings are preserved separately, as is the initial rejected clock-alignment attempt.

Next: write/review the global contextual flop-model experiment specification, with fresh training/validation/evaluation partitions and eligible baselines declared before fitting. Keep no opponent memory and current sample budgets. No live promotion or earlier-street search.

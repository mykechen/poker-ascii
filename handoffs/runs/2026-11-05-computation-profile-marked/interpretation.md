# Marked baseline profile

Source 7998411. Historical seed 20001; two hands/match, both modes/fields, all 6/7/8-player seat rotations, 50 equity samples/16 river worlds. Each repetition contains 168 hands; repetitions reuse identical deals and are not independent strategy evidence.

Unprofiled workload times: 19.925, 20.007, 20.053 seconds. Profiled: 21.135 seconds; approximately 5.64% overhead relative to baseline median. Measured marker duration coverage is 100.00006%; V8-clock bounds include intervening GC. Boundary attribution is approximate to a sample interval. All warm-up/measured action and payout hashes match.

Exclusive self costs by source: evaluator 38.31%, hand-features 28.45%, range-beliefs 16.54%, cards 4.30%; GC self about 7.61%. Inclusive handFeatures cost about 60.23%; it overlaps evaluator work and must not be added to evaluator inclusive totals. Observe/range conditioning plus feature work dominates; river search is not the dominant cost.

Next: test one bounded pure hand-feature cache, keyed separately by exact hole cards and board, with copied results and eviction coverage. This caches deterministic calculations only, not opponent identities, actions or weights. Preserve no-memory semantics, RNG draws, action traces and payouts. Compare on an external baseline worktree at identical workload/budgets.

Raw CPU file is losslessly compressed as .cpuprofile.gz; decompress it before rerunning the summarizer. Raw matches, canonical hashes, timing windows and external full-process logs are retained.

# Decision stability execution specification

Status: draft for independent review before collection. No fresh seeds reserved.

Current model, 50-sample collection policy, river 16 worlds/penalty 1, no cross-hand memory, existing balanced legacy/expanded lineups and 6–8 seats remain fixed. No live changes, raises or adaptive stopping.

## Instrumentation

Expected payout standard error uses per-world total eligible fractional chip payout and online central second moment, including covariance across pots. Exact enumeration yields zero; absent pots yields null. Existing equity share SE remains unchanged. Preserve arithmetic order of existing expected payout accumulation, all draws, actions and default settings. Diagnostics receive public views and public ranges only; hidden labels remain isolated. Observer status separates folded, all-in and funded/not-folded, without promising future turns.

## Bounded screen

Proposed collection seeds 101001–101020; separate validation 102001–102010. Check registry and reserve before execution. Collect current-only balanced legacy and expanded fields using existing schedules. Challenge fields excluded from primary screen. At most 320 outcome-independent paid preflop/flop/turn states: per population/street quotas 54,53,53; choose lowest deterministic state hashes, at most one state per hand. Record free checks and river separately. Missing quota means insufficient coverage; no top-ups or revised weights.

Evaluate 50,128,512 samples with eight paired seeded streams per state, identical range order and exact limit. No privileged reference for selection. Report stream flip rates, disagreement with paired 512 estimates, incremental call-value dispersion, absolute call value within 1 big blind of zero, total eligible payout SE, attempts, method and elapsed time. Aggregate paired state metrics by hand/match then seed, with equal population/street weighting and all denominators. Repeated streams are not independent hands; 512 is an estimate.

Total collection and scoring cap 120 minutes, checked at safe state/match boundaries. Persist partial results and failures. Truncation or inadequate coverage prevents selection. No automatic extension.

## Selection boundary

This screen is descriptive; no numeric threshold is claimed as user-approved or statistically guaranteed. Archive training cost/stability tradeoffs first. A simple fixed-budget candidate and justified practical thresholds must be written and independently reviewed before validation is inspected. If no defensible tradeoff exists, retain current. Validation and any profit protocol are separate subsequent stages; no automatic profit run.

## Verification and record

Test-first payout moments, covariance, exact behavior, seeded parity, callback parity, deterministic selection, incomplete coverage rejection and pairing. Full tests/lint/TypeScript/diff before commit and data. Independent review before collection and audit after results. Archive source/settings fingerprints, seeds, raw public states/results, errors, coverage and costs. Commit/push feature branch only; preserve original workspace changes.

## Schedule and exact metric definitions

Use training and validation field templates verbatim from `scripts/population-experiment.ts` at source 75a4557 (the templates originated at 16d6fbc). Collection uses its training templates only: three legacy and three expanded lineups. Four hands per match; 100bb reset stacks, blinds 1/2, no rake; seed order ascending, population legacy then expanded, template order as declared, player sizes 6/7/8, all tested-seat rotations in runBenchmark order. Existing playMatch button/deck lifecycle remains unchanged. Rotate five-entry lineup lists by zero-based seed index modulo five via balanceFields.

Assign each eligible hand to its FIRST paid pre-river decision's street; this prevents one hand occupying multiple quota cells without using outcomes. Hash UTF-8 JSON of [seed,population,field,players,rotation,hand,street,logLength] with SHA256; lexicographic lowest hashes per cell win, tie-break by full identity. Quotas per population are preflop54/flop53/turn53. Archive eligible counts and first-state assignment; this describes first-paid-decision exposure, not every decision. Insufficient street coverage is a legitimate no-selection result.

The eight stream salts are [0,2654435769,2246822507,3266489909,668265263,374761393,3550635116,4251993797]. Base seed is signed int32 (42 XOR imul(hand,31) XOR logLength XOR actorSeat); stream seed is signed int32(base XOR salt), reused across budgets. Within-state instability is disagreeing unordered stream action pairs /28; paired budget disagreement is disagreeing actions /8 against the matching 512 stream. Dispersion is sample SD of eight call values in chips. Near-threshold exposure is fraction of streams with absolute call value <=2 chips. Include exact states in primary metrics with zero Monte Carlo uncertainty and identify them separately. Uncertainty is descriptive seed-cluster SE, not a promoted confidence guarantee. Aggregate states within match then matches within seed for each population/street, then macro-average six cells; reject missing cells rather than silently renormalize. Archive pooled state metrics as secondary. Timing compares repeated scoring only; collection (including snapshot copies) and total wall costs reported separately. Snapshot-copy time is not isolated from collection; record this measurement limitation.

No validation collection starts during the initial screen. Its fresh seed partition and existing validation templates remain proposed pending Stage3's written candidate rule.

Exact enumeration limit is 10000 for all budgets. Global absence of a required cell blocks selection. A seed with no selected state in a cell contributes no fabricated value: report its absence and that cell's available-seed denominator. For each cell compute seed mean from match means, then mean across available seeds and SE = sample SD(seed means)/sqrt(number of represented seeds), null below two. Primary macro mean averages six cell means; report cell SEs separately, with no synthetic combined independence assumption. Sparse seed representation limits inference.

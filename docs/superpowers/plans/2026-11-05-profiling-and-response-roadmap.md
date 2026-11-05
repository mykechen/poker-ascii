# Computation Profiling and Response-Model Roadmap

> **For agentic workers:** Use superpowers:executing-plans task by task. This document plans future work; it does not authorize a live deployment or merge. Use test-first regression coverage for implementation changes.

**Goal:** Reduce measured training cost without changing poker behavior, then improve global flop predictions only if fresh validation and profit tests support adoption.

**Architecture:** Preserve the engine, no-memory within-hand inference, equity control and sampled river control. First measure the current implementation at fixed budgets; optimize one demonstrated hot path. Treat subsequent response fitting as a separate research experiment with independent partitions and an explicit freeze before evaluation.

**Tech stack:** Existing TypeScript, Vitest, Node CPU profiler, current experiment/handoff infrastructure. No new runtime dependency assumed.

**Spec:** ../specs/2026-11-05-poker-bot-design.md, overridden by the user's no-cross-hand-memory requirement and handoffs/QUEUE.md.

## Verified starting state

- Worktree: /private/tmp/poker-training-foundation; branch poker-training-foundation.
- Inspected local and remote head: 0f2eeab, with a clean implementation worktree. Original main workspace has unrelated package-lock.json and docs changes; leave them alone.
- Current verification: 119 tests pass, lint passes, TypeScript passes, diff check passes.
- Latest completed diagnostic: handoffs/0004-flop-diagnostic-screen.md. Global uniform-mixture fit selected weight zero, so current likelihoods remain. Preserve this unsuccessful result.
- Latest evaluation: 1,512 hands/378 matches, current river 1125.37 versus equity-only 1130.54 bb/100; paired difference -5.16, SE 7.63, only two evaluation batches. No promotion.

## Global constraints

- 6/7/8-player no-limit Hold'em; 100bb, fixed 1/2 blinds, no rake; training has no artificial delays.
- No opponent memory between hands. Keep current-hand range inference and legal action support.
- Never expose target hidden cards or actual future deck to policy, forecasts or fitting. Family/identity labels are analysis metadata only.
- Preserve raw data, unsuccessful fits and handoffs for every run. Mark profiling workloads as historical reuse, not fresh strategic evidence.
- Commit and push each verified step to the existing feature branch; no collaborator/co-author additions. Do not change live bot or merge main.
- Do not increase sample budgets or add earlier-street search during this plan.

## Review focus

- Profiling overhead must not be mistaken for a strategy or performance improvement.
- An optimization must preserve deterministic actions, chip payouts and no-memory resets, not merely average chip conservation.
- Cache keys must cover every dependency; bounded pure caches must not retain opponent information between hands.
- Forecast fitting must condition on legal support and exclude opponent identity and hidden strength labels.
- Holdout results must never feed selection; correlated actions are not independent evaluation batches.

## Step 1: Record a bounded baseline profile

**Files:** create scripts/profile-training.ts and a run folder under handoffs/runs/; consume lib/poker/league.ts, adaptive.ts, equity.ts, range-beliefs.ts and river-ev.ts unchanged.

**Interface:** Reuse runLeagueBatch(configuration, seed, fields, tableSizes, hands). The new runner exposes `--phase baseline|profile`, `--output RUN_DIRECTORY`, `--hands 2`, and `--seed 20001`; baseline runs three measured repetitions and profile runs one, each after its own warm-up. It records exact configurations, runtime versions, source hash, measured phase, raw matches, elapsed time, hands/sec and decision counts. Its outputs must use the run handoff convention.

- [ ] Define a fixed workload before timing: equity-only and current river policies, existing 50 equity samples/16 river worlds, both existing field compositions, all 6/7/8-player sizes and seat rotations. Start at two hands per match and seed 20001. Label this inspected seed explicitly as profiling reuse.
- [ ] Implement one untimed warm-up, then three unprofiled measured repetitions and one CPU-profiled repetition. Keep reports per repetition; do not pool repeated deals as independent strategic evidence. If too brief for useful samples, increase workload size only and document it before comparison.
- [ ] Run the CPU-profiled repetition using the installed entry point: `node --cpu-prof --cpu-prof-dir=RUN_DIRECTORY node_modules/vite-node/vite-node.mjs scripts/profile-training.ts` followed by `--phase profile --output RUN_DIRECTORY --hands 2 --seed 20001`. Create RUN_DIRECTORY first and record the full actual command.
- [ ] Separate Vite startup/module loading from measured poker time. Record both end-to-end and measured workload elapsed time; compute profiler overhead against the unprofiled baseline.
- [ ] Inspect sampled self/inclusive costs for range conditioning, combination-key construction, hand-feature/evaluator work, equity sampling and river rollout settlement. Do not sum overlapping inclusive costs as if disjoint.
- [ ] Verify every raw match net sums to zero, fallbacks are zero, seat rotations are complete and deterministic decisions/payouts match across equivalent repetitions. Save raw CPU profiles and an interpretation; commit and push.

**Gate:** Name a dominant cost supported by the profile before choosing an optimization. If there is no clear hot path, end with the measurement handoff rather than guessing.

## Step 2: Optimize one measured hot path

**Files:** modify only the runtime module(s) identified in Step 1 and their focused tests; extend the profile runner only if necessary for comparison.

- [ ] Choose one candidate from evidence, such as avoiding repeated pure hand evaluations or repeated combination-key creation. Specify the exact invariant and the expected cost reduction before coding. Do not assume a cache is the winner.
- [ ] Write a regression that exercises changing boards, card blockers, legal support, different sampled hands and hand reset. For a cache, also test bounded eviction and absence of mutable-result aliasing. Watch a meaningful failing regression before implementation.
- [ ] Implement the smallest change. Keep all probability calculations and random-stream consumption identical wherever possible.
- [ ] Compare before/after on the exact Step 1 workload and machine, with matched repetitions and identical sample budgets. Use an external baseline checkout/worktree rather than rewriting the user's existing workspace. Report timing spread, profiler overhead and any numerical/decision drift.
- [ ] Require matching deterministic action traces (instrument policy outputs without consuming additional random values) and payouts, zero invalid outputs, full tests/lint/typecheck and focused independent review. If behavior drifts, investigate rather than calling it an optimization.
- [ ] Save a new handoff with speed/compute results and limitations. Commit/push only a justified optimization; retaining the original is a valid result.

## Step 3: Design the next global flop-model experiment

This is a separate research plan after profiling; do not start a large unchanged league run.

**Existing files to build on:** lib/poker/forecast-diagnostics.ts, forecast-diagnostics.test.ts, range-beliefs.ts and scripts/flop-diagnostics.ts.

- [ ] Use prior breakdowns as hypotheses: mismatch was strongest for unbet maniac actions; station responses also differed from the provisional model. Never pass these family identities into predictions.
- [ ] Make a small eligible model set in advance: current likelihoods, uniform, smoothed legal-support frequency baseline, and one regularized global contextual response model. Use only actor-visible public context (street, faced bet, size/pot, SPR, position, player count, board texture) plus latent hand/draw features already marginalized through ranges. Observer private cards must not be mistaken for target hand labels.
- [ ] Include diverse behavior in training rather than hiding all pressure styles until evaluation. Hold out parameter variants/lineups as well as deals; preserve genuinely untested opponents where feasible.
- [ ] Fit population parameters offline on training data only. Select with predeclared validation log-loss/Brier and support-count rules; report reliability bins with sample counts. A descriptive baseline is not retroactively eligible because it looked good last time.
- [ ] Reserve disjoint new seed ranges. Previously used: 20001–20002, 30001–30003, 41000, 41001–41002, 42001, 43001–43002. Use configurable starts and a recorded registry before running. Earlier prototype seeds may also be inspected; check historical handoffs first.
- [ ] Freeze model source/parameters and selection before held-out evaluation. Re-run inference with fitted likelihoods; fixed historical range trajectories are insufficient to establish on-policy performance.
- [ ] Evaluate selected/current/equity controls with seat rotations, paired seed-batch differences, worst cells and compute cost. Preserve zero-change outcomes. No promotion based only on prediction loss or two seed batches.

**Gate:** Write and review the detailed model/partition specification before fitting. Only adopt if it improves the predefined validation objective and survives fresh on-policy checks; otherwise retain current controls and record the failure.

## Step 4: Confirmation and later scope

After a meaningful model improvement, design longer-session and stronger-opponent confirmation with a stated detectable profit difference and adequate independent batches. Keep fixed-stack and persistent-stack results separate. Test stack-depth robustness next. Earlier-street response search, broader automated optimization and heads-up training remain later stages, not part of the immediate profiling work.

## Required handoff after each step/run

Record source commit/fingerprint; status and command; exact workload/budgets/seed roles; raw-data pointers; correctness checks; measured results with uncertainty/limitations; unsuccessful alternatives; decision and next action. Update handoffs/QUEUE.md and the handoff index, then commit/push. Do not mark a queued task as automatically scheduled.

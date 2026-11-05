# Development queue

## Next task — profile within-hand computation

Status: queued in this repository; not scheduled for automatic execution.

Worktree: /private/tmp/poker-training-foundation. Branch: poker-training-foundation. Read the latest handoff and run interpretation first. Check both workspace statuses; preserve unrelated original-workspace changes.

Run a bounded CPU profile of no-memory equity-only and current river policies at existing sample budgets. Use a recorded deterministic workload with all 6/7/8-player sizes and seat rotations. Historical inspected seeds may be reused for profiling if labelled as such; profiling is not a fresh strategy evaluation. Record elapsed time, decisions, hands/sec, range conditioning/feature evaluation/equity sampling/river response costs and profiler overhead. Identify the dominant cost before proposing a change. Preserve raw profiles and accounting under handoffs/. Add no artificial delays.

Only implement a focused optimization if profiling supports it. Use test-first behavior/invariant coverage; preserve deterministic legal actions, payout conservation and no-memory inference. Benchmark before/after on the same workload and report uncertainty and any numerical drift. Do not increase budgets, add earlier-street search, change the live app bot, or merge main. Commit and push each verified step without collaborator/co-author additions.

## Following research task — contextual population response model

Use the bounded flop diagnostic context breakdowns and the validation frequency baseline as motivation, not proof of generalization. Fit global legal-support-conditioned response parameters on a new training partition, compare against current, uniform and smoothed frequency baselines, validate reliability and freeze before fresh evaluation with equity/current-river controls. Never fit family labels or individual identities, never read target hidden cards, and never remember opponents across hands. The original uniform-mixture fit failed to earn a nonzero weight; do not silently discard that outcome.

Seeds 20001–20002, 30001–30003, 41000 (test), 41001–41002, 42001, and 43001–43002 are inspected/used and cannot become a fresh holdout.

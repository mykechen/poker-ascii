# Profiling execution ledger

Plan: docs/superpowers/plans/2026-11-05-profiling-and-response-roadmap.md.

Step 1 infrastructure: added an optional public action trace to league batches, deterministic trace/payout hashes, fixed-budget workload runner and measurement-window CPU summarizer. Regression tests failed before tracing/parser implementation. 121 tests pass; lint and TypeScript checks pass after replacing an ES2020-only BigInt literal with compatible BigInt construction.

Ruling: the league interface gains a callback-only tracing option so exact policy actions can be checked, rather than relying solely on equal net chips. It does not alter policies or consume randomness.

Independent review found no important issue. Real-profile clock overlap/sample coverage must be checked before interpreting CPU costs.

Next: baseline warm-up plus three repetitions, then a separate profiled warm-up plus one repetition on historical seed 20001 with two hands/match, 50 equity samples and 16 river worlds. Both modes/fields and every 6/7/8-player seat rotation. No fresh-strategy evidence or policy promotion.

Ruling after real run: V8 CPU timestamps and process.hrtime use different origins on this machine, so the absolute-window analyzer correctly rejected the first profile. Preserve that run and lossless compressed CPU data. Use named measuredWorkload stack samples to bound a V8-clock interval, then include all interior samples (including GC) and require 95–105% duration coverage. New clock-domain/GC regressions pass. This changes measurement only, not poker policy. Re-record baseline/profile under one instrumentation source before interpretation.

Step 1 measured at source7998411: three unprofiled repetitions19.925–20.053s; markedprofile21.135s, overhead5.64%, durationcoverage100.00006%. Deterministic trace/outcome hashesmatch. Inclusive handFeatures60.23% (overlaps evaluator), supporting one bounded pure feature-cache experiment. Exclusive source costs and raw data preserved in markedrun.

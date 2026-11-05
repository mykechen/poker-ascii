# Profiling execution ledger

Plan: docs/superpowers/plans/2026-11-05-profiling-and-response-roadmap.md.

Step 1 infrastructure: added an optional public action trace to league batches, deterministic trace/payout hashes, fixed-budget workload runner and measurement-window CPU summarizer. Regression tests failed before tracing/parser implementation. 121 tests pass; lint and TypeScript checks pass after replacing an ES2020-only BigInt literal with compatible BigInt construction.

Ruling: the league interface gains a callback-only tracing option so exact policy actions can be checked, rather than relying solely on equal net chips. It does not alter policies or consume randomness.

Independent review found no important issue. Real-profile clock overlap/sample coverage must be checked before interpreting CPU costs.

Next: baseline warm-up plus three repetitions, then a separate profiled warm-up plus one repetition on historical seed 20001 with two hands/match, 50 equity samples and 16 river worlds. Both modes/fields and every 6/7/8-player seat rotation. No fresh-strategy evidence or policy promotion.

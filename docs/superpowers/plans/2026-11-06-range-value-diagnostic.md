# Range/value diagnostic implementation plan

Spec: docs/superpowers/specs/2026-11-06-range-value-diagnostic-design.md. User authorized execution. Use systematic-debugging and test-first helpers, independent review; retain inspected-data label.

- [x] Implement/test deterministic deal truth, eligible pots and exact privileged showdown reference in standalone diagnostic helper (no runtime policy changes).
- [x] Implement/test dual public-only belief tracking and true-hand pre/post score extraction; truth never conditions beliefs.
- [x] Add fixed reproduction runner around unchanged current policy/benchmark, verify archived rotation accounting/cards/boards, deterministic160 paid-state sample, fixed512/8x50 budget diagnostics.
- [x] Independent pre-run review; full tests/lint/tsc/diff; commit/push with honest status.
- [x] Run bounded inspected diagnostic, audit raw reproduction and result arithmetic/privacy/denominators.
- [x] Interpret findings/limits, update consolidated report and handoff/queue, commit/push.

# Population experiment implementation plan

Approved specification: docs/superpowers/specs/2026-11-06-population-coverage-design.md including execution addendum. Use inline execution with independent review. Independent opponent and fitting modules delegated to separate workers per dispatching-parallel-agents skill; shared integration stays with parent.

- [ ] Test/implement balanced lineup helper and cyclic partition collision detection.
- [ ] Test/implement independent equity-defender/equity-pressure policies, integrate strategy registry.
- [ ] Test/implement equal-stratum objective, gradients, coverage fallback and stratified selection.
- [ ] Integrate fixed tracked runner30train/20validation/10diagnostic challenge,2h cap,raw provenance/failures; reserve fresh seeds.
- [ ] Independent review; full test/lint/tsc/diff; commit/push before fresh computation.
- [ ] Execute fixed experiment within cap; independently audit accounting/coverage/weights/scores/freeze/challenge pairing.
- [ ] Consolidate findings so far in durable report, update handoff/queue/registry, verify,commit/push.

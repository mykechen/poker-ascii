# Confirmation execution ledger

2026-11-06: user selected 5 bb/100 and authorized run. Protocol and plan written. Ruling: fixed 30 paired batches plus 10 common-history panels, rather than claiming full power for 5 bb/100 — pilot SD implies approximately 10,558 batches for 80% power; bounded run may remain inconclusive. Disclosed to user before running. No live changes.

Ruling: point-estimate -5 bb/100 cell veto and existing +.02 support log-loss gate are assistant-selected operational defaults. These do not prove statistical noninferiority. Sparse group quota >=100, fixed panel size, no adaptive top-up.

TDD: first focused invocation failed because new module did not exist; implementation passed 4 new tests. Full verification: 150 tests, lint, tsc, diff checks passed. Independent protocol/implementation review pending. Seeds reserved but not started.

Independent review found no blockers. Implementation/protocol committed and pushed as 2f661ba before run. Runtime 30-pair/10-panel run started; no adaptive changes. Reviewer also inspected independent Python audit, no blockers; requested independent support-score/gate checks, addressed with archived-panel replay audit and explicit Python decision recomputation. Strengthened test verifies positive estimated gain does not imply true gain above 5. Audit scripts/tests are post-freeze tooling, not runtime changes.

Timing note: profit-61024-frequency reported 390.9 seconds versus approximately seven seconds for neighboring batches. Preserve measurement; no timing-based exclusions or poker-strength inference.

Completed all 70 configuration batches. Primary paired profit +13.4458 bb/100, t95 [-131.0660,157.9575]. All gates fail; no promotion. Python raw accounting/gate audit and independent archived-panel replay score audit passed. Final 150 tests/lint/tsc/diff checks passed. Interpretation independently reviewed without substantive findings.

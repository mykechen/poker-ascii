# Confirmation execution ledger

2026-11-06: user selected 5 bb/100 and authorized run. Protocol and plan written. Ruling: fixed 30 paired batches plus 10 common-history panels, rather than claiming full power for 5 bb/100 — pilot SD implies approximately 10,558 batches for 80% power; bounded run may remain inconclusive. Disclosed to user before running. No live changes.

Ruling: point-estimate -5 bb/100 cell veto and existing +.02 support log-loss gate are assistant-selected operational defaults. These do not prove statistical noninferiority. Sparse group quota >=100, fixed panel size, no adaptive top-up.

TDD: first focused invocation failed because new module did not exist; implementation passed 4 new tests. Full verification: 150 tests, lint, tsc, diff checks passed. Independent protocol/implementation review pending. Seeds reserved but not started.

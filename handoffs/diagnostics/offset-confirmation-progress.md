# Two-hour offset confirmation execution ledger

User authorized fresh shifted-field/profit confirmation and up-to2h cap, stressed folding validity and no sunk-cost bias. Frozen offset from prior validation, no tuning. Design and implementation plan under docs/superpowers/. Fixed20panel4hands then100paired4hands. Runtime cap is monotonic at safe boundaries; finish started pairs. Incomplete primary pass suppressed. Added minority-fold quota. All thresholds fixed before seeds start.

Sunk-cost regression checks pass with unchanged runtime: fold -20 incremental despite150 committed; call +48 incremental despite -102 expected total hand loss. Fold baseline is zero future cost; profit objective is incremental EV, not maximizing fold rate or minimizing realized loss.

TDD: new analysis module first failed missing-module focused invocation, then3tests passed. Full162tests/lint/tsc/diff passed. Independent builder and implementation reviews found no blockers. Reviewer bootstrap clarifications adopted (paired seed resampling, pooled score sums/counts, explicit zero-count replicates). Independent raw audit/bootstrap still required. New seeds81001–81100 and82001–82020 reserved but not started.

Source18385a7 successfully pushed, prior pendingresults included, thenrun started. Complete83.788minutes:20panels100profitpairs. Raw audit passed9240matches36960hands,zero fallback/conserved payouts. Profit+2.032bb/100,SE26.313,t99[-50.178,54.242]. Targetfalse/downsidefalse/sparsecoverage true/forecastfalse. Sparse70folds/216 across70hands18batches; .730668loss vs .675985current, sparsebootstrap spans0. No promotion. Separate actualfold scores worsen while passive scores improve; preserve all evidence. Current runtime unchanged; sunk-cost tests pass.

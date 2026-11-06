# Support-offset execution ledger

User approved reviewed design and execution. Existing isolated worktree /private/tmp/poker-training-foundation; preserve original workspace. Fixed 20 training and 10 validation batches, no profit confirmation. Source design commit 2ab2c1c remained locally ahead after previous push failures; include it in next successful feature push.

Plan: docs/superpowers/plans/2026-11-06-support-offset-remedy.md. New offline support-offset fitter reuses contextual runtime artifacts and objective, fits four allowed support coefficients, checks distinct batch/hand coverage, masks insufficient supports exactly. Current runtime policy unchanged. Training uses fixed current components; validation uses each model's own sequential beliefs.

TDD: focused test invocation first failed for missing module; implemented then six tests passed. Full suite 156 passed, lint/tsc/diff passed. Independent review pending. Seeds reserved 71001–71020/72001–72010; not started yet. No adaptive top-up or tuning from inspected prior confirmation.

Independent review passed; all requested support gradient checks added. Final pre-run 157 tests/lint/tsc/diff passed. Source81ee2ca committed/pushed before run. Completed all30 batches, all three fits converged. Selected offset:.1, all validation gates pass, no profit evaluation. Raw audit first failed strictly-later-ms assertion; freeze and firstvalidation shared .690ms. Changed to >= plus selected training artifact equality checks; source confirms synchronous freeze before collection; all audits passed. Sparse validation fold mix differs sharply from prior confirmation; do not claim shifted-field robustness solved.

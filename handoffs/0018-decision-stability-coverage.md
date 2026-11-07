# Step0018 — decision instrumentation and bounded coverage result

Stage0/1 implemented and reviewed; Stage2 collection finished in32.78minutes. **Insufficient coverage; no sampling-budget scoring, candidate selection, validation or profit run. Current live configuration unchanged.**

## Source and implementation

Worktree /private/tmp/poker-training-foundation, branch poker-training-foundation. Instrumentation/source035ea02; seed reservation and run source ec11da1. [Frozen execution specification](../docs/superpowers/specs/2026-11-07-decision-stability-execution.md). Payout SE now uses stable central moments of each world's TOTAL eligible fractional chip payout, including pot covariance; exact SE0, no pots null. Existing share SE and payout arithmetic preserved. Opt-in cloned public decision snapshots preserve range order; forecast callbacks distinguish folded/all-in/funded exposure. Funded does not guarantee another turn.

Test-first regressions cover covariance, eligibility, exact/no-pot behavior, large-common-payout cancellation/overflow, cloned snapshots and seeded callback parity, snapshot reconstruction, selection/coverage/aggregation and pairing. Twelve external old/new seeded estimator fixtures matched every original field exactly. Last full verification198tests,lint,TypeScript,diff checks; rerun after archive below.

## Collection and decision

[Raw archive](diagnostics/2026-11-07-decision-stability-bf8d88654982/results.json) · [Independent audit](diagnostics/2026-11-07-decision-stability-bf8d88654982/audit.json).

All20seeds101001–101020 completed:2520matches/10080hands, zero fallbacks, conserved chips. Current model50samples, river16worlds/penalty1; six balanced legacy/expanded templates,6/7/8players,4hands and all seat rotations. No cross-hand memory, model fit or hidden-card inputs. Total1966636ms; collection includes snapshot copying. Validation102001–102010 remains unreserved/unused.

First-paid-decision-per-hand eligibility: legacy preflop4945/flop6/turn4; expanded preflop4947/flop6/turn12. Required per-population quotas54/53/53 failed.136states retained; no budget states scored. Do not interpret this as measured equivalence or superiority of50/128/512samples.

The collection had paid flop decisions1486legacy/1537expanded and paid turn841legacy/986expanded. The failure came from assigning almost every hand to its first paid preflop decision, not from a lack of later-street decisions. This is an execution-spec sampling-design limitation. It was flagged as a coverage risk in pre-run review and allowed to yield a no-selection result. No quotas/weights were changed after observation; no top-up or rerun.

Secondary captured opponent-action forecasts retained137363observations:70271folded,2124all-in,64968funded. These natural exposure groups are descriptive, not causal or profit evidence; post-fold observations remain legitimate.

Independent audit passes fingerprint, match accounting,9920manifest hashes/unique hand assignments,136lowest-hash retained states and snapshot opponent-hole privacy. Audit did not replay earliest-state ownership or enumerate equity worlds; no score arithmetic exists to audit. Archive includes manifest, raw public states/ranges, per-match reports, exposure, protocol, settings, source and failure status.

## Next

Retain current; Stage3/4 cannot proceed. Design a new outcome-independent sample that assigns hand ownership across streets before selecting a state (or permits multiple streets and clusters by hand), with independently reviewed coverage/weighting and fresh reservations. Existing collected states are inspected exploratory material only. Do not call a revised screen a continuation with fresh holdout status, rerun these seeds as fresh, or automatically start another experiment.

All GitHub backup attempts during this execution failed connecting to github.com:443; committed local provenance exists. Final commit/push status must be reported honestly. No main merge or promotion.

Final archive verification:198tests/lint/TypeScript/diff checks pass. Independent interpretation review found no blocking correction.

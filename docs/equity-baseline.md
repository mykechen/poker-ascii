# Weighted equity baseline

`lib/poker/equity.ts` accepts own cards, board, and one weighted two-card range per opponent. Impossible known-card combinations are removed. Duplicate combinations and invalid cards/weights are rejected. Exact enumeration is used when the upper outcome bound fits `exactLimit`; otherwise seeded Monte Carlo draws independent weighted hands and rejects the entire incompatible joint draw. This avoids bias from sequential range renormalization.

Results report expected showdown pot share, estimator standard error, method, accepted outcomes, and attempts. Optional pots specify amount and eligible player indices (hero is zero); expected payouts use fractional split-pot shares. Actual integer odd chips remain the engine's responsibility. Sampling uncertainty does not measure opponent-model error. Impossible or excessively constrained sampled ranges fail explicitly within a bounded attempt budget.

`createEquityPolicy` is a check/call control, with injectable opponent ranges and structured decision observations. Default ranges are uniform; this is not yet an adaptive opponent model. Its call value assumes no future betting or additional contributions. It reconstructs contributions from the public current-hand log and caps eligibility by contribution levels. Earlier-street values therefore are showdown estimates, not full action EV. It checks for free, calls nonnegative estimated values, and otherwise folds; it never raises.

Run `npm run benchmark:equity -- 10 2` for 10 hands per rotation over two seed batches at each table size, versus chart controls. The 3-hand, one-batch smoke run completed for all three sizes; this is an integration check and provides no evidence of superiority. No artificial delays run in simulation.

Verification covers weighted exact river outcomes, blockers, multiplayer ties, reproducible sampling, impossible joint ranges, side-pot eligibility, legal six-player play, and short-stack call values with folded dead money. A fresh reviewer found no important correctness issue and requested stronger deterministic policy fixtures; the short-stack fixture was added.

Next: persistent opponent observation lifecycle, probabilistic range updates, and then response-aware action EV. Neural training and equilibrium solving remain later work.

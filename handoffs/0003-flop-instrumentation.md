# Step 0003 — flop forecast instrumentation

Added optional public-context forecast collection to league batches, per-class reliability bins, global offline mixture fitting helpers, and configurable canonical runner seed starts. Default response likelihoods and live app behavior are unchanged. Experimental flop mixture is opt-in and alters within-hand likelihoods only; cross-hand memory stays off.

Verified: 119 tests, lint, TypeScript and diff checks passed. New tests cover legal support, mixture endpoints, reliability probability-one bins, seed overflow, training-only fitting, flop-only likelihood behavior and rotation-safe family metadata. Initial diagnostics/fitting tests failed before their implementations.

Bounded runner: `node_modules/.bin/vite-node scripts/flop-diagnostics.ts`. It saves raw observations, matches, progress, errors and a selection freeze under handoffs/runs/. Four-hand matches; 6/7/8 players; 100bb; fixed 1/2 blinds; zero rake; all seat rotations. Training 41001–41002, validation 42001, evaluation 43001–43002. Source fingerprint includes runtime library files and runner. No delays or sample-budget increase.

The fit is one global flop blend with legal uniform likelihoods, using training minimum log loss then a validation improvement gate. Family identities are not model inputs. Observer hand/draw contexts are observer-visible features, never target hole cards. Offline fitting uses original range trajectories; fresh evaluation applies the fitted likelihoods in actual inference. Reliability diagnostics are descriptive and sparse bins must not be overinterpreted.

Next: run the bounded screen; independently audit raw accounting and freeze ordering, record interpretation including unsuccessful outcomes, commit and push. Then profile within-hand range/equity cost before expanding search.

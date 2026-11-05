# Foundation progress

Implementation workspace: `/private/tmp/poker-training-foundation`, branch `poker-training-foundation`.

Implemented: cumulative short-raise reopening fix; uncontestable-raise rejection; strict simulation option; independent per-seat RNG factories; rotated fixed-stack benchmark API; stack-carrying session API; benchmark CLI; rules conventions and regression tests.

Verification: 69 tests pass using `npm test -- --config vitest.config.mts`; lint and TypeScript checks pass; fixed and persistent CLI smoke runs complete for 6/7/8 players.

Rulings/deviations:
- Keep legacy `playMatch` fallback default for existing callers; new benchmark/session entry points always use strict mode.
- Add a separate benchmark CLI rather than changing historical field-report output.
- Added an explicit ESM Vitest config because the temporary worktree under Node 20 otherwise fails to load Vite through CommonJS. No dependency updates.
- Report approximate normal intervals with explicit caveats; no superiority claim from tiny smoke experiments.
- Moving-button and no-burn virtual-deck conventions are documented; specific casino compatibility is not claimed.

Follow-up coverage implemented: paired challenger/baseline delta API, equal-weight cross-size summary for the six shared participants, source hash and policy definitions, complete rotation assertions, normalized seed uniqueness and interval suppression below 30 batches. Independent review found the aliased-seed issue; a failing regression preceded its fix. Normal intervals remain approximate. Learning final-observation hooks belong to the later learning milestone; no learning is implemented here.

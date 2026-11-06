# Step 0013 — population coverage redesign

Status: builder-reviewed design complete; no implementation, reservations, fitting or run.

Read [the design](../docs/superpowers/specs/2026-11-06-population-coverage-design.md).

Keep the four-parameter support-offset family fixed. Add fresh multiway/learner training compositions alongside legacy populations; weight the two population strata equally within each support, rather than letting abundant legacy observations dominate. This is a combined mixture/weighting remedy, not attribution to either change alone. Never balance by observed action or force a desired fold rate.

Require training coverage and actual minority actions within each stratum, otherwise exact current fallback. Validation gates apply separately to each stratum and its supported groups; overall improvement cannot conceal a stratum failure. Insufficient minority coverage stops as insufficient evidence, without top-up. Proposed fixed 30 training/20 validation seeds, four hands per match, with two-hour safe-boundary cap; no profit test/live change.

Independent builder check found no blockers. Incorporated explicit (batch,match,hand) action coverage keys, paired seed-cluster bootstrap/zero-count handling, and combined-remedy interpretation. Previous failed confirmations preserved; all prior inspected seeds remain diagnostic only. New ranges91001–91030/92001–92020 are proposals, not reservations.

Next: concrete design approval, then implementation plan, test-first weighted fitting/coverage/selection checks, independent review and fresh bounded training/validation. Current live model and incremental-EV/sunk-cost safeguards remain unchanged.

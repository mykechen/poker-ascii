# Support offset remedy implementation plan

> Use superpowers:executing-plans to implement inline, with independent final review.

Goal: implement the approved support-offset specification and complete fixed training/validation only.
Architecture: new offline support-offset fitter reuses contextual objective/artifacts; existing runtime untouched. Fixed tracked runner collects current-policy panels then fits and replays models.
Spec: docs/superpowers/specs/2026-11-06-support-offset-remedy-design.md.

- [x] Write failing tests for flop-only batch/hand coverage, exact fallback, support-only masks, convergence, latent discrimination, gradients and sparse-validation stop.
- [x] Implement lib/poker/support-offset.ts with per-support optimization, coverage and selection; pass tests.
- [x] Implement scripts/support-offset.ts with frozen settings, seed reservation checks, atomic raw checkpoints, provenance, failures, fixed collection and freeze; no profit run.
- [x] Independent review; full tests/lint/tsc/diff checks; commit/push verified implementation and reservations.
- [x] Execute 71001–71020 training and 72001–72010 validation; preserve all traces, failures, panels, scores and freeze.
- [x] Audit raw accounting, coverage, score arithmetic and freeze; interpret evidence; update handoff/index/queue/registry; commit/push.

Constraints: only flop fitting, frozen current-policy training components, candidate-own validation replay. >=200 observations/50 hands/8 batches per trained support; sparse validation >=100 observations/30 hands/5 batches. Lambda .1/1/10; 1000 iterations, 1e-6 gradient tolerance. No live changes, memory, cache/budget changes, adaptive top-ups or profit confirmation.

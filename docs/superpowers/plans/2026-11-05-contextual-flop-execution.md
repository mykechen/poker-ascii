# Contextual Flop Experiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Run the bounded contextual response experiment without changing live defaults.

**Architecture:** A pure likelihood module supplies inference and simulation. Optional observer instrumentation builds compact components and replay histories; offline fitting and orchestration own partition boundaries and artifacts.

**Tech Stack:** TypeScript, Vitest, existing league runner; no new dependency.

**Spec:** ../specs/2026-11-05-contextual-flop-model-design.md

## Global Constraints

100bb, 1/2 blinds, no rake; 6/7/8 players; 50 equity samples, 16 river worlds. No cross-hand memory, identities, family features or actual target cards. Preserve cache and live defaults. Follow all quota, selection and stopping rules in the specification. Commit and push verified steps.

## Review Focus

- Invalid serialized coefficients must fail before collection.
- Impossible actions must retain structural zeros.
- Reset keys must not leak histories across hands.
- Failed optimization must never enter selection.
- Interrupted runs must retain provenance and partial results.

### Task 1: Shared likelihood transformation

Files: create `lib/poker/contextual-response.ts` and `.test.ts`; modify range-beliefs/adaptive only after the pure interface passes.

Interface: `transformResponse(probabilities, offsets)` returns a normalized three-class tuple with offsets clipped to [-3,3], passive fixed to zero, structural zeros preserved. Versioned model artifacts encode current/uniform/frequency/contextual variants and fixed feature dictionary. Features encode existing context buckets and board flags, never identity metadata.

- [x] Write failing tests for structural zeros, normalization, zero equivalence, clipping and malformed inputs.
- [x] Run targeted Vitest and confirm failure.
- [x] Implement transformation and feature encoding with input validation.
- [x] Run targeted tests, lint and typecheck; commit and push.

### Task 2: Observer components and common histories

Files: modify `range-beliefs.ts`, `adaptive.ts`, `forecast-diagnostics.ts`, their tests and league optional diagnostics.

Interface: compact components contain weight, current probabilities, modeled strength/draw/style; replay records contain hand key, seat, order, board, observer blockers, context and action. Add optional model arguments, preserving default behavior.

- [x] Write failing tests for normalized compact components reproducing prediction, privacy, pre-action scoring, resets and transform-before-marginalization counterexample.
- [x] Implement component aggregation and observer event capture before updates; use shared likelihood transformation in inference and simulation.
- [x] Implement replay creating independent beliefs per model and hand, conditioning public blockers and observer cards before each action.
- [x] Run targeted tests plus full checks; commit and push.

### Task 3: Deterministic fitting and selection

Files: create `lib/poker/contextual-fit.ts` and `.test.ts`.

Interface: fit training components with mean negative log likelihood plus lambda L2/2; return artifact and convergence trace or explicit failure. Selection consumes candidate common-history validation forecasts and returns frozen model identity and metrics.

- [x] Write failing tests for finite-difference gradients away from clipping, zero derivative at/beyond clipping, deterministic fitting, nonconvergence, sparse coefficient masking at 50 opportunities, unseen support backoff, pseudocount one and metadata exclusion.
- [x] Implement full-batch gradient descent, backtracking, zero initialization and 200-iteration cap at lambdas .001/.01/.1/1.
- [x] Test selection: 1% log-loss improvement, no Brier regression, <=.02 deterioration in groups with >=100 rows, 1e-6 ties using declared priority.
- [x] Run full checks; commit and push.

### Task 4: Bounded runner and independent review

Files: create `scripts/contextual-flop.ts`, runner tests; reuse league accounting and artifact conventions.

- [x] Test disjoint effective lineups, partition validation, quota stop, freeze-before-evaluation, alias deduplication and durable failure artifacts.
- [x] Save source fingerprint/settings before collection. Use exact lineups and two hands per match from spec. Train on 51001–51004, conditionally 51005–51008 only below 500 flop observations. Stop insufficient-data if still below quota, without validation/evaluation inspection.
- [x] If sufficient, fit then replay validation 52001–52002 with candidate-specific beliefs. Save all candidate metrics/failures and hashed freeze before evaluation 53001–53004.
- [x] Report seed-paired profit, worst cells, reliability, support counts, prediction loss and compute cost. Omit conventional confidence intervals with four batches.
- [x] Run full tests/lint/typecheck/diff checks and independent review before bounded collection; commit and push verified code.

### Task 5: Execute and archive

- [x] Update registry before tracked collection, run bounded experiment and preserve failures and raw accounting.
- [x] Verify raw results against summaries; write interpretation without equating predictive gain with poker strength.
- [x] Update handoff/index/queue/registry; rerun relevant verification, commit and push.

Self-review: tasks cover every specification section; no partition has been consumed by this plan. Independent review remains required before collection.

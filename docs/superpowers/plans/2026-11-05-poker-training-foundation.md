# Poker Training Foundation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task. Steps use checkbox syntax for tracking.

**Goal:** Establish trustworthy, reproducible 100bb multiplayer benchmarks before training stronger bots.

**Architecture:** Preserve the engine as the sole rules authority. Extend the direct simulation harness with strict failures, reproducible experiments, and persistent sessions, leaving UI timing outside training.

**Tech Stack:** TypeScript, Vitest, existing Next.js repository.

**Spec:** ../specs/2026-11-05-poker-bot-design.md

## Global Constraints

- 100bb initial stacks; fixed blinds; no rake.
- Primary table sizes: 6, 7, 8.
- No artificial training delays or private-information leakage.
- Invalid decisions fail training with diagnostics.
- Preserve existing app behavior unless a verified rules defect requires correction.

## Review Focus

- A short all-in must not incorrectly reopen raising for an already-acted player.
- Unequal stacks must produce correct pot eligibility and uncalled returns.
- A player eliminated before their next turn must still receive final observations in later learning integration.
- Policy randomness must not change future deals.
- Failed or eliminated players must not disappear from profit accounting.

### Task 1: Rules audit and regression coverage

**Files:** lib/poker/engine.ts, engine.test.ts, pots.ts, types.ts; create lib/poker/pots.test.ts and docs/poker-rules.md.

**Interfaces:** Preserve apply(), legalActions(), and existing pot interfaces. Document any required public contract changes before introducing them.

- [ ] Read existing engine and pot implementations and tests; map every betting transition and payout rule.
- [ ] Verify rule interpretations against primary published poker rules; document chosen odd-chip and table conventions.
- [ ] Add focused regression tests for full/short all-ins, reopening rights including cumulative short raises, heads-up order, multiple side pots, tied winners, uncalled returns, and elimination transitions. Assert exact chips, legal menus, and chip conservation.
- [ ] Run `npm test -- lib/poker/engine.test.ts lib/poker/pots.test.ts`; reproduce each identified defect before fixing it.
- [ ] Make minimal corrections and rerun the focused suite, then `npm test` and `npm run lint`.

### Task 2: Strict deterministic simulation

**Files:** lib/poker/train.ts, train.test.ts, scripts/train.ts.

**Interfaces:** Extend TrainOptions with optional invalidAction: "throw" | "fallback"; default new experiment entry points to "throw", preserving explicit fallback for compatibility. Extend TrainSeat with an optional policy factory accepting a seeded random callback so independent policy instances can be constructed per run.

- [ ] Add tests proving invalid policy actions throw with seed, hand, seat, and action context in strict mode; explicit fallback remains counted.
- [ ] Add tests proving repeated options reproduce outcomes and consuming additional policy random values leaves dealt cards unchanged.
- [ ] Separate deal and per-seat policy RNG streams; validate all experiment inputs before starting simulation.
- [ ] Confirm the simulation imports no UI timing or artificial wait functionality.
- [ ] Run `npm test -- lib/poker/train.test.ts`, then full tests and lint.

### Task 3: Balanced benchmark experiments

**Files:** create lib/poker/benchmark.ts and benchmark.test.ts; modify scripts/field.ts.

**Interfaces:** Export runBenchmark(options: BenchmarkOptions): BenchmarkReport. Options define table sizes, seeds, hands, policy factories, and rotations. Report preserves per-session raw net chips, hands, big blind, identities, seats, configuration, and version metadata alongside aggregate results.

- [ ] Test all seat assignments rotate across repeated deals and all table sizes receive equal summary weight.
- [ ] Test paired challenger/baseline experiments use identical deals; report paired profit differences without claiming identical action trajectories.
- [ ] Compute per-size bb/100 and uncertainty from independent session batches. Report sample count and omit intervals when fewer than two independent batches exist.
- [ ] Preserve existing field script use while adding explicit reproducible configuration and machine-readable output.
- [ ] Run focused benchmark tests, full tests, lint, and a small CLI smoke experiment; inspect raw totals and summary calculations.

### Task 4: Persistent-stack sessions

**Files:** create lib/poker/session.ts and session.test.ts; integrate optional session mode into scripts/field.ts.

**Interfaces:** Export playSession(options: SessionOptions): SessionReport, using TrainSeat-compatible participants, 100bb defaults, fixed blinds, seeded deals, a maximum-hand limit, and strict invalid actions. Stop below two funded players. Report all initial participants, final stacks, net chips, hands dealt in, and elimination hand.

- [ ] Test stacks carry between hands; broke seats cannot act; six players can shrink to heads-up and a single survivor without invalid transitions.
- [ ] Test every initial participant remains in the result and aggregate net chips sum to zero without rake.
- [ ] Keep fixed-stack and persistent reports distinctly labelled; do not combine their scores.
- [ ] Run session tests, full tests, lint, and a seeded persistent-session smoke run.

## Completion and next plan

Record actual audit findings and benchmark commands. Do not claim strategy improvement from this infrastructure milestone. Next, plan the weighted equity service against the verified pot/view contracts, followed by the learning lifecycle and action EV.

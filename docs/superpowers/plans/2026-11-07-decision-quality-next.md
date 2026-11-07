# Decision-quality and sampling-stability next plan

> For the next agent: use test-first implementation and independent review. The user requested this plan and handoff, not automatic execution of another experiment in this chat.

**Goal:** determine whether more reliable equity/call-value estimation improves decisions at an acceptable compute cost, before spending on another response-model fit or claiming improved poker strength.

**Architecture:** preserve the current response/range model and river settings. Add decision-relevant diagnostics and correct payout uncertainty reporting, then compare fixed sampling budgets on a fresh common-state panel. Only a frozen, justified candidate proceeds to separately designed profit testing.

**Evidence:** handoffs/0016-range-value-diagnostic.md; docs/experiments/2026-11-06-consolidated-findings.md. Existing source:02ea102; diagnostic data/results:1098121. The results commit was locally ahead of origin when this plan was written; verify actual git state.

## Binding constraints

- Target6–8-player cash-style games; initial100bb,1/2 blinds,no rake. Objective is expected incremental future chips, not avoiding folds or recovering sunk commitments. Preserve sunk-cost regression tests.
- No cross-hand opponent memory. Keep within-hand range inference and privacy. Opponent labels and hidden target cards are never prediction inputs.
- Current live policy remains unchanged. No merge/promotion as part of these diagnostics. Commit/push verified stages to poker-training-foundation, no collaborator/co-author additions.
- Hold response model at current, equity-only pre-river decision structure, river16worlds/penalty1, existing card cache and lineups fixed while testing sampling. Do not change model family and action search simultaneously.
- Prior ranges/model candidates failed to establish the5bb/100 profit target. Do not call forecasting/compute improvements strength improvements.
- Honor the recent up-to2h compute preference for a proposed bounded screen, with safe-boundary cap. It is not authorization for unlimited runs or a promise of enough power. A next-chat request to continue should establish exact run scope from this plan before seeds start.
- Never reuse inspected seeds as fresh evidence. Update registry before a tracked run. Proposed partitions below are NOT reservations or evidence of execution.

## Why this is next

Inspected diagnostic:420matches/1680hands reproduced exactly;4807flop opponent actions;55.4% occurred after current observer folded. Those remain legitimate population data and may help other policies, but all-action loss did not align with not-folded exposure. That subset includes all-in observers; never equate it with a guaranteed future decision.

True-hand post-update log-loss improvement was tiny/unresolved (-.001522,SE.002603 across10inspectedseeds). On160sampled paid flop/turn decisions, models differed2times at512samples but14times at50;50->512 flipped12choices/model. These are diagnostic signals, not proof that increasing samples improves profit. Reference was privileged,fractional-share,no future betting—not achievable/GTO regret.

## Stage0 — restore provenance and establish baseline

- [ ] Work only in /private/tmp/poker-training-foundation, branch poker-training-foundation. Preserve unrelated original workspace changes.
- [ ] Inspect status/log/origin and newer handoffs before editing. Retry pending push; if networking fails, record committed local hashes honestly.
- [ ] Read START-HERE,0016,consolidated findings and seed registry. Do not rerun the completed population/diagnostic commands.
- [ ] Verify baseline: npm test -- --config vitest.config.mts; npm run lint; node_modules/.bin/tsc --noEmit; git diff --check. Last verified187tests.
- [ ] Write a short execution specification freezing metrics,budgets,fields,seeds,cap,selection/stop rules before new data. Independently review it.

## Stage1 — instrument decisions and payout uncertainty without changing actions

Files: lib/poker/equity.ts, equity.test.ts; equity-policy.ts/tests; adaptive.ts/tests only if needed for callbacks; new offline decision-diagnostics module/script. Keep instrumentation opt-in.

- [ ] Add tests distinguishing equity-share uncertainty from eligible-chip-payout uncertainty, especially side pots. Existing equity.standardError measures pot share, not arbitrary expected payout variance. Never multiply it by total pot when eligibility differs.
- [ ] Optionally extend EquityResult with expected-payout SE, derived from first/second moments of each world’s TOTAL eligible payout; do not sum per-pot variances while ignoring covariance. This is uncertainty in the Monte Carlo mean, not intrinsic outcome risk; exact enumeration returns0. Preserve all existing sample draws,actions,default fields and budgets. Validate payout units and finite/nonnegative values.
- [ ] Add failing tests for deterministic seeded outcomes and unchanged decisions with callbacks enabled/disabled. Keep pot eligibility/folded-money/odd-chip limitations explicit.
- [ ] Capture actual candidate decision views and public range snapshots in original order. Annotate observer status separately: folded,all-in,still funded/not folded; flag means possible eligibility, not a promise of another turn.
- [ ] Primary metrics come from actual decision states, not an average over all table actions. Continue reporting all-action forecasts as secondary and show status groups separately. Do not delete post-fold observations or force fold/call percentages.
- [ ] Treat true cards only as isolated offline labels. Reuse existing diagnostic helpers/tests for privacy and exact reproduction. No hidden truth to inference, fitting or action selection.
- [ ] Independent review,full checks,commit/push before next data stage.

## Stage2 — fixed-budget stability screen on common states

Implementation files: new scripts/decision-stability.ts plus pure summary/selection helpers and tests; reuse benchmark,balanced lineup and diagnostic snapshot infrastructure.

Recommended initial scope, to freeze in Stage0 spec:
- Current model only; fixed budgets50,128,512, same public state/range order and paired RNG streams. River search unchanged and reported separately; avoid mixing it into pre-river equity-budget treatment.
- Fresh current-policy collection with balanced legacy and expanded fields from population experiment. Consider challenge computational-opponent fields as a separate reporting stratum, not automatically pooled.
- Proposed collection seeds101001–101020; proposed separate validation102001–102010. Check registry first, then reserve only after exact collection/cap settings are approved. No automatic top-ups.
- At most320 deterministic, outcome-independent decision states, stratified in advance by street and population if feasible. Include paid preflop/flop/turn; report free checks separately. If required cells lack data, report insufficient coverage rather than quietly changing weights.
- Eight fixed RNG streams per budget/state. Paired comparisons per state then aggregate by match/hand and seed, with units and denominators explicit. Record true method exact/MonteCarlo,attempts,timing and payout uncertainty.

- [ ] Test deterministic state sampling/stratum weights, incomplete-data rejection, source/reference identity and seed pairing.
- [ ] Report call/fold flip rates across streams and budgets; call-value dispersion; decisions near zero incremental value; cost per decision; inference-model sensitivity kept separate.
- [ ] Reference budget512 is still an estimate, not ground truth. If a bounded higher-budget reference is used, predeclare it and cost before collection. Repeated samples are not independent poker hands.
- [ ] Do not create a statistically advertised confidence guarantee by optional stopping on a noisy interval. No adaptive sample policy in this first screen. Recomputing nested deterministic samples has cost; account for it.
- [ ] Hidden-card fractional showdown reference, if reused, is secondary diagnostic only, not selection on attainable regret or realized profit. It cannot evaluate raises/future betting/river strategy.
- [ ] Preserve every candidate's scores/failures and cap truncation. Missingcoverage or no meaningful stability/cost improvement is a valid no-change result.

## Stage3 — freeze a decision-rule candidate only if supported

- [ ] Review screen results on training partition only. Define any candidate budget/rule and practical stability/cost threshold before separate validation is inspected. The numeric tradeoff is unresolved; do not invent it as user-approved.
- [ ] Prefer simplest fixed-budget change first. An adaptive near-threshold budget may be worthwhile later, but needs its own sequential-estimation/bias/error-handling design and tests. Do not assume2SE is a valid stopping guarantee.
- [ ] Validate with fresh common states and identical opponent/position schedules. State whether higher sampling improves stability only or also a separately justified decision metric. Freeze configuration/model/source hash before profit evaluation.
- [ ] If no justified candidate exists, retain current and write no-change/insufficient-data handoff. Do not proceed automatically to a large profit run.

## Stage4 — separate profit protocol, not another blind2h run

- [ ] Keep the5bb/100 user target. Prior100seed SE26.31 implies very wide profit uncertainty; a2h run did not resolve the target. Estimate runtime and achievable precision from the chosen candidate's actual cost.
- [ ] Write a fixed-N or independently justified sequential protocol before fresh evaluation. Account for seed clustering,paired outcomes,lineup multiplicities and cell downside. Do not pretend30batches ensures enough power.
- [ ] Consider variance-reduction evaluation methods as a distinct design, with independent validation of unbiasedness. Do not introduce unverified off-policy/counterfactual profit estimators to manufacture precision.
- [ ] Retain independent computational opponents as unproven benchmarks; stronger external/self-play opponents,long sessions,persistent stacks and stack-depth robustness remain future gaps. Fresh compositions of familiar heuristics are not unseen-family strength evidence.
- [ ] No promotion or main merge without actual evidence and separate authorization.

## Completion contract

Archive exact settings,source/parameter fingerprints,seeds/status,raw states/results/failures,coverage,compute cost and uncertainty. Independently audit accounting,privacy,metrics and provenance. Update consolidated findings and handoff/index/queue/registry; commit/push,report actual status. Separate observations, hypotheses, decisions and unsupported claims. Avoid accumulating new calibration variants until downstream usefulness is demonstrated.

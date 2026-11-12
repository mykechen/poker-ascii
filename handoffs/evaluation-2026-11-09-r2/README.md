# Evaluation / power work, 2026-11-09 revision 2

Authoritative plan: ../PLAN-2026-11-09-r2.md. Original audit/plan untouched. Engine, browser and policy files unchanged; train.ts only adds isolated optional callbacks. Branch/worktree: poker-training-foundation at /private/tmp/poker-training-foundation.

Evidence:
- STEP-1.md, unit-summary.json and unit-check.json: units, five raw-stack checks and all-in/tail distribution. Original 960-hand pilot is preserved.
- unbiased/ and unbiasedness.json: fixed 20 fresh seeds, 960 simulations, exact all-in EV, paired CI diagnostic and variance ratios.
- preflop-golden.json: exhaustive 1,712,304-board AA/KK result. all-in tests also verify analytic turn/side-pot equities and odd chips.
- smoke-serial/, smoke-four/: per-hand output byte equality, full two-stratum 6/7/8-seat all-rotation protocol.
- parallel-equality.json: all five short scaling configurations byte-identical, including integrity-only source amendments.
- short-*/, sustained-*/, scaling-results.json: per-run frozen protocols, source bytes, provenance, separate timing/resource data, and seed files. calibration-1/ is explicitly aborted and is not used to select workers.
- AIVAT-DESIGN.md: conditions, exact probabilities, costs, tests and deferral rationale.
- review.md, tdd-*.log, final-tests.log, python-tests.log, final-typecheck.log: independent review fixes and verification.
- environment.json, analysis-source-pilot.json, analysis-plan-pilot.json, original-document-hashes.json and baseline-v0-tag.json: environment, analysis/tooling bytes, document immutability and v0 identity.

Every successful evaluation directory contains protocol.json, source.json, provenance.json, timing.json, seed-N.json and hands.jsonl. Partial seed outputs survive technical aborts, and provenance marks failure/incompleteness. Private card traces are evaluation data only, never feature/label input directories. Numeric CPU temperature is unavailable through pmset; warning state is saved verbatim.

Verification commands (engineering fixture reuse, not fresh inferential evidence):

```sh
npm test -- --config vitest.config.mts
node_modules/.bin/tsc --noEmit
python3 -m unittest python.tests.test_evaluation
```

Fresh evaluation workflow (never rerun a completed inferential protocol or overwrite its output): freeze-evaluation.ts performs collision checking and explicit reservation, writes an exact match manifest and freshness sidecar; evaluate-frozen.ts verifies source/pool/config identity and exclusively claims the registry under a controller lock. Specify --workers and a new --out directory. Only explicitly classified engineering/scaling repeats can use --diagnostic-reuse. clone-evaluation-diagnostic.ts records parent hash and inspected reuse when integrity-only source telemetry changes; its output is never fresh confirmation.

Do not delete a controller lock automatically: inspect owner.json and ensure its process/workers are no longer active. Full protocols and all arms/cells must complete before analysis. A technical cap yields an inconclusive run, never a favorable subset. Main exploratory pilot seeds are retired from future confirmation.

Worker-count detail: the mandated two-seed smoke can have at most two active seed workers even when four are requested. The separate fourteen-seed calibration exercises four/eight/ten/fourteen active workers and its full output matches serial byte for byte. Configured count and actual per-process RSS are both distinguishable in timing artifacts.

Identity detail: protocolHash is the immutable full configuration/manifest hash, covering all arm/work settings plus source/pool identity. sourceHash pins exact executable bytes and poolHash pins pool membership. Derived config-only identity sidecars distinguish policy/blind/stack/scoring parameters from seed/work scheduling.


Final deliverables: variance-pilot/ contains all 840 clusters/70,560 simulations; pilot-metrics.json contains all 24 power scenarios, SD/correlation/variance checks and unit counts; confirmatory-budget.json contains each proposed confirmatory hand/run/hour count and the48-hour checks. analysis-source-pilot.json and analysis-plan-pilot.json were frozen before launch. Earlier analysis-smoke*.json files are function checks with illustrative rates, not final evidence.

Verification:214 TypeScript tests across 49 files passed with0 errors;12 Python tests passed; tsc --noEmit exit0. Independent review fixes and the confirmed macOS idle-sleep interruption are documented. Original interrupted14-worker attempt is excluded; its corrected replay completes and matches all 248 overlapping seed outputs. Selected14-worker fixed benchmark lasts540 seconds; the25.45-minute pilot confirms longer sustained operation. Do not describe the benchmark as an exactly600-second completed workload.

Reproduction: preserve immutable outputs and use new output names. The main numerical entrypoint is `python3 -m python.evaluation.analyze --run handoffs/evaluation-2026-11-09-r2/variance-pilot --rate 133068.6969715027 --raw-rate 159044.7505836645 --out NEW.json`. The final report helper uses exclusive output creation and refuses to overwrite results or append the plan twice. It verifies the frozen analysis-source snapshot before reading complete pilot output.

Provenance limitations: initial oversized calibration's exact abort timestamp was not recorded, so budget accounting conservatively charges its full10-minute configuration allowance; partial output is never inference data. Two empty output directories from sandbox-denied CPU reads contain no game output or consumed seeds. First in-process fixtures preceded central reservation bookkeeping and are permanently retired engineering reuse, never fresh confirmation. Historical failed Vitest RPC output is summarized in rpc-timeout-diagnostic.md; no game output was overwritten.

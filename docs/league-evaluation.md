> Historical protocol for the first screen. Current no-memory settings and automatically tracked run reports are documented in handoffs/README.md. The current runner no longer uses the memory-retention grid described below.

# League evaluation and parameter tuning

`npm run league -- --hands 12 --tuning-seeds 2 --evaluation-seeds 3 --output data/league-screening.json` runs a bounded exploratory experiment. Defaults use reduced budgets of 50 equity samples and 16 river worlds per candidate to make screening affordable. These settings themselves affect policy quality and cannot establish performance at larger budgets.

The tuning grid varies response-style retention (1 or 0.8 per hand) and a river sampling-noise penalty (0 or 1 standard error). Default existing behavior remains retention 1 / penalty 0. The penalty is an experimental ranking regularizer, not a guaranteed confidence bound. Marginal diagnostic prior strength is deliberately not tuned because it no longer drives action likelihoods.

Tuning fields contain chart/tight/station/position and aggressor/position/chart lineups. Held-out fields contain multiway/learner/maniac/station/tight and maniac/learner/multiway lineups. The entire effective ordered field composition is checked for overlap, not merely field names. Entirely new opponent families are present in held-out fields, but these opponents remain simple heuristics rather than a comprehensive adversarial league.

For every configuration, seed, field and table size, the candidate visits every chair. Each match starts fresh opponent models, then retains learning for the hands within that match. Deal seeds pair configurations; independent policy factories prevent personal-history leakage. Strict failures reject illegal policy output. Raw reports retain chip totals, seat mappings, fallback counts, and decisions.

Selection uses only equal-weight tuning means over table-size/field cells. The selected configuration is saved before held-out play. Evaluation then runs that frozen configuration, an otherwise identical frozen-learning control, an equity-only control, and the chart baseline. Paired differences aggregate cells within the same seed before calculating standard errors. Intervals are omitted below 30 independent seed batches. Worst cell is reported separately; selection does not silently trade away the mean objective.

Checkpoints are written atomically after each completed seed batch. Resume requires identical source/configuration fingerprints. Source hash includes all poker runtime TypeScript, the runner, and package configuration. The recorded source commit and hash distinguish committed source from any modified runtime. A completed checkpoint can regenerate summary output without rerunning matches. Checkpoint files are trusted local experiment files, not an external data ingestion API.

Initial screening is fixed-stack only: 100bb, 1/2 blinds, no rake. It does not test persistent eliminations or establish long-session learning speed. Later confirmation needs more independent batches, longer sessions, varied stack depths, stronger held-out opponents and persistent-stack evaluation. No live bot promotion is automatic.

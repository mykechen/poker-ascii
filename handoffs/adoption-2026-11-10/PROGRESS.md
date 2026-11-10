# Task1B / Task4.0

Recovered missing tracked files only fromea09955; archived simulator source matches exactly;214tests andtsc pass. Fixed before launch:3955clusters332220physicalhands in2runs2840+1115,14workers,rawscores; seeds130001–133955 passed freshness checks. NO RETURN ANALYSIS BEFORE BOTH COMPLETE. No v1freeze before NI and fresh cost gates. Existing policies/engine unchanged. Heuristic implementation follows v1decision; no labels/model work yet.

Design prepared during fixed adoption runs, outside executable source tree: heuristic-design.md and staged/*.txt. No lib/engine/policy source changes while either adoption run is pending. Current simulator source bytes still match the phase2archive. Full recovered214TS+12Python tests and typecheck pass. Cost-only timing script is outside the source-hash dependency set and will execute only after both fixed runs complete.

Pooled analysis implementation written before outcomes were inspected: scripts/analyze-adoption-study.py. It refuses analysis until controller reports both complete, independently validates every run's immutable source/protocol/cells/decks/accounting/units, rejects cross-run seed overlap, and applies the unrounded95%seed-cluster t lower bound >−5 to RAW outcomes. Cost decision remains pending until fresh fixed-work timing check. No partial-study effect estimates will be generated.

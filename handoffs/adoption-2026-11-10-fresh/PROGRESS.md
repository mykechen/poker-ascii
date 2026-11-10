# Fresh adoption study

Ruling: restart the entire fixed study on fresh seeds after an outcome-independent battery interruption. All old returns remain unopened and excluded; all old seeds retired. Unchanged3955clusters/332220hands,14workers,rawscoring,NI95%lower>-5. Two frozen runs2840+1115,119min caps; source and pool unchanged. All manifests and freshness checks created before launch. Cost-only check after both complete, before v1freeze. Future heuristic tests are draft/red and no policy code installed. Budget-before.json charges interrupted work.

Power safeguard fixed before launch: <=15%anypower, <=20%offAC, or unreadable state => technical stop, no retry. No peeking/top-ups. Owner authorized continue.

## Outcome-independent power stop

The fixed battery safeguard stopped batch1 at05:44:42UTC, reporting14% on its minute check. Adapter reports17W, while battery supplied roughly65W under14worker load. Saved661clusters/55,524physicalhands; batch2neverstarted. No outcomes inspected, no pooled result, no cost or heuristic run, no v1freeze. All150001–153955 reserved seeds conservatively retired and outputs preserved. Workers verified stopped; stale controller lock archived/removed after exit. Partial runner provenance explicitly markedinterrupted-power. Do not launch further long retries with this supply. Hardware must sustain chosen worker load first.

Deferred heuristic redtests moved intact to ../adoption-2026-11-10/staged/value-raise.test.ts.txt until v1gate. Archived cost source renamed.ts.txt to keep immutable source copies outside TypeScript compilation; actual script now writes runner.ts.txt for the same reason. Verification:214TS tests across49files,15Python tests,tsc--noEmit,diff--check all pass. TS suite113.87seconds at maxWorkers1. Post-stop verification charged0.035h; see budget-after.json (about43.75hremain). Originalaudit/planunchanged. No new profit/training results.

# Step 0014 — harness and opponent audit

Read-only runtime audit requested by user while population redesign is pending approval. No experiment, seeds, opponent policy or harness behavior changed.

## Opponents actually available

Eight heuristic policies in lib/poker/strategies.ts, mostly sharing simplePolicy:

- chart: hand-group/price rules, no deliberate bluffs or position logic.
- tight: chart, but folds the playable-hand call category.
- station: checks/calls, including weak hands; never deliberately raises.
- aggressor: when chart continues, attempts pot-size betting/raising.
- position: changes playable-hand behavior by button/early position.
- maniac: attempts pot-size raise whenever available, otherwise continues.
- multiway: chart, but folds the specific one-pair small-call case with at least three live players.
- learner: multiway baseline plus deterministic bluff/thin-value heuristics adjusted using public betting history. Not a trained model, solver, or general-purpose learning opponent.

These are useful behavioral stress cases, not eight independent strong agents. No completed tracked confirmation against human players, solver/GTO agents, external poker AIs, adaptive equity/river-search opponents, or self-play policy populations was identified in these runners. Candidate/control are sophisticated relative to these opponents; current-vs-offset is a comparison of the tested seat, not two strong agents playing against each other.

## Actual most recent confirmation fields

From archived progress.json and runner:

- evaluate-multiway: multiway,learner,maniac,station,tight.
- evaluate-learner: learner,multiway,aggressor,station,position.

Original offset training used chart/tight/station/position/aggressor/maniac compositions, without multiway or learner. Validation used new compositions of those same six types. Confirmation introduced multiway and learner. Thus training/validation did not cover the full confirmation population. Fresh seeds give fresh deals; they do not create new opponent intelligence.

## Lineup construction caveat

runLeagueBatch fills opponent seats by cycling the five listed entries. Six-player games contain each listed type once; seven-player games duplicate the first type; eight-player games duplicate the first two. Latest confirmation therefore overrepresents multiway/learner at larger tables. Training similarly duplicates whichever strategies lead its lists. All-seat rotation moves the tested player through positions, but does not balance these family multiplicities or shuffle all opponent permutations. This is an explicit population weighting limitation, not corrupted payouts or evidence that every seed is independent of lineup composition.

Recommend balancing the extra opponent identities by a predetermined cycle of the five list offsets across seed batches, with exact effective lineup metadata and collision checks. Do not change the completed evidence. Any such change belongs in the pending coverage design and pre-run runtime plan, not retroactive relabeling.

## Mechanics verified

Same rules engine apply() owns action legality and payouts. Each acting policy receives its own projected private view. Tracked benchmarks request strict invalid-action failure. Each configuration gets matched seeded deals/seat rotations; scoring maps physical seats back to participant identity. Aggregate across complete cells within seed before seed uncertainty. Defaults are 100bb reset stacks,1/2 blinds,no rake,6/7/8 players; latest matches only four hands. All opponents are simple heuristics; learner sees public log history, whereas the tested adaptive candidate disables cross-hand learned beliefs. Not persistent-stack cash sessions or broad adversarial validation.

Focused verification passed 17 tests across league,benchmark,strict-training,view reconstruction. Archived latest field definitions matched runner. No broader claim that the entire harness or opponent realism is proven by these tests.

## Recommendation

Keep cheap heuristic checks, but distinguish them from strength evidence. Balance lineup multiplicities before the coverage experiment. Later add independently implemented equity/EV opponents, stronger stochastic styles, and a frozen adversarial/self-play population, with longer-session/stack-depth robustness. Do not promise GTO/human-level performance from existing bb/100 results. Current live model remains unchanged; population redesign still awaits concrete approval and implementation.

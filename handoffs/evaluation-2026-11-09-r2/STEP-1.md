# SD unit check

Verdict: correct. Original audit unchanged; no correction addendum needed.

train.ts accumulates after-stack minus before-stack chip deltas in `net`, and computes bb/100 as chips / bigBlind / hands * 100. Default blinds are 1/2. measure.ts differences cumulative `net` within each match and divides by 2. analyze.py uses these already-normalized `bb` values, and its power effect .05 bb/hand equals 5 bb/100. No second conversion or small-blind denominator occurs.

Diagnostic replay preserved original files and compared all 960 hand values against independently observed terminal hero stack minus the fixed 200-chip starting stack. Every comparison matched exactly. Seeds 104001–104010 are inspected diagnostic reuse, not fresh confirmation.

Five hand checks (50 samples, seed 104001, rotation 0): hand 1: 200−200=0 chips /2=0 bb; hand 2: 200−200=0 /2=0; hand 3: 188−200=−12 /2=−6; hand 4: 200−200=0 /2=0; hand 5: 601−200=401 /2=200.5. These match the original pilot rows.

Observed SD remains 61.88243 bb (50), 66.78614 bb (128). At least one all-in action occurs in 536/960 hands (55.8333%). First all-in street: preflop 5, flop 6, turn 51, river 474. Logs span prior hands, so the distribution is computed only after the most recent preflop `deal` marker. This includes opponents and passive all-in calls, not only hero shoves. Largest hero win +601 chips = +300.5 bb; largest loss −200 chips = −100 bb. Top wins in chips: 601,601,600,430,410,410,409,409,408,408. Top ten losses are all −200. The pot-heavy heuristic field, not a factor-of-two bug, explains the observed scale; this is not a claim about typical real-money 6-max variance.

Evidence: unit-check.json (terminal stacks and logs), unit-summary.json (derived distribution), unit-replay.json (replicated original format), unit-provenance.json and unit-replay.ts. Raw private traces stay under evaluation handoffs and are not feature data.

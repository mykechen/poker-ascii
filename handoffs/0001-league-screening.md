# Run 0001 — original league screen

Status: complete. Runtime source: f675667. Result archive commit: 4fa0bba.

9,072 hands / 756 matches, 6–8 players, fixed 100bb stacks, no rake. Zero invalid-action fallbacks; all match chip totals conserved.

Held-out means: adaptive river 1,188.76 bb/100; frozen river 1,244.12; adaptive equity-only 1,202.89; chart 453.97. Three held-out seed batches, 12 hands per match. These synthetic-opponent results are exploratory, not realistic human win-rate estimates.

Decision: do not promote the adaptive bot. Neither remembering opponents nor river search demonstrated improvement over its simpler control. User subsequently chose to remove cross-hand remembering from current training.

Next: reset personal beliefs per hand, measure action prediction scores, test longer matches, and automatically archive every subsequent run.

[Full interpretation and artifacts](../docs/experiments/2026-11-05-league-screening/README.md).

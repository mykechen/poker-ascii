# First league screening

Source: feature branch commit `f675667`; exact source fingerprint and full parameters are in summary.json. Command: `npm run league -- --hands 12 --tuning-seeds 2 --evaluation-seeds 3 --output data/league-screening-v1.json`.

Completed 9,072 hands across 756 seat-rotated matches at 6, 7 and 8 players. All 756 match chip totals sum to zero, with zero invalid-action fallbacks. Fixed 100bb stacks, 1/2 blinds, no rake. Runtime about 939 seconds, including 1,477 river searches totaling about 29.5 seconds. Most runtime was outside river search; profile range inference and equity calculation before increasing search budgets.

## Selection and held-out results

Tuning-only selection chose full-memory adaptation with no sampling-noise penalty. Tuning means were 629.73 bb/100 for full memory, 490.03 for tempered memory, and 514.30 for tempered memory plus a one-SE river penalty. Full memory had the weakest tuning cell despite the highest overall mean; the selection objective did not hide that tradeoff.

On disjoint held-out seeds and fields, equal-weight means were:

- Selected adaptive river bot: 1,188.76 bb/100.
- Frozen-learning river control: 1,244.12 bb/100.
- Adaptive equity-only control: 1,202.89 bb/100.
- Chart control: 453.97 bb/100.

The selected bot's paired mean differences were -55.36 bb/100 versus frozen learning, -14.13 versus equity-only, and +734.79 versus chart. Seed-batch standard errors of those differences were 196.49, 48.76, and 154.60 bb/100 respectively. Only three independent evaluation seed batches exist; confidence intervals are deliberately omitted. These figures are exploratory measurements, not evidence of universal superiority.

Large positive rates reflect deliberately weak synthetic opponents, including maniacs, and should not be interpreted as realistic win rates against competent poker players. Each session is just 12 hands, limiting learning evidence. Equity uses 50 samples and river search 16 worlds: noisy screening settings, not production budgets.

## Decision

Do not promote the selected bot. This run does not establish that across-hand adaptation or the current river response model improves profit. Do not reselect a winner using these held-out scores: these fields/seeds have now been inspected and must remain historical evaluation data.

Next experiments should calibrate response predictions on separate data, inspect expensive range calculations, and test longer sessions before extending search to earlier streets. Add stronger independent opponent families and fresh held-out partitions. Preserve the equity-only and frozen-learning ablations; they identify where complexity has not yet earned its cost.

summary.json retains all seed and cell summaries and paired comparisons. raw-results.json.gz contains the complete checkpoint with per-seat chip results, mappings, decisions, fallback counts, and timing. Resume with the original checkpoint under data/ only if its source/configuration fingerprint still matches.

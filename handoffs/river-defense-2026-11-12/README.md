# River range defense screen, 2026-11-12

Exploratory paired screen, not a confirmation study. The seeds (990101–990424) are not in `handoffs/seed-registry.json`; treat them as used.

## Why

On the live table, v1 shoved 183 into a pot of 51 with hands that only better hands call. Its river response model (`actionProbabilities` in `range-beliefs.ts`) barely tells a pot-sized bet from a 50x-pot shove, so it predicts that big bets get called by worse hands.

## Change

`riverRangeDefense` (in `lib/poker/river-ev.ts`): facing a river bet, each simulated opponent continues only with the strongest `defense × MDF` share of its own range, where MDF = 1 − toCall / pot (the pot includes the bet).

The first version estimated this with plain sampling. With 16 samples the thin calling range of a big shove was usually missed entirely, so bluff shoves scored as a free pot. In one live hand the bot shoved ten-high for 198 into 4, with an estimate of +4.0 ± 0.0. The current version deals each opponent from a 50/50 mix of its full range and its calling slice on alternating samples, and reweights each hand to its true probability. v1's plain sampling path is unchanged and reproduces its earlier results exactly.

The table bot (`TABLE_BOT_OPTIONS` in `lib/poker/live-bot.ts`) is v1 plus `riverRangeDefense: 1`.

## Setup

- 324 seeds, 12 hands per match, 6 players, every hero seat rotation, stack 200, blinds 1/2.
- Fields:
  - **pot-odds:** equity-defender, equity-pressure, chart, tight, position.
  - **loose:** station, maniac, aggressor, multiway, learner.
  - **size-aware:** five `size-reader` opponents. A size reader is an equity defender that puts a river bettor on the strongest pot / (pot + bet) share of hands, where pot is the size before the bet. That share is an assumption, not fitted to real players.
- Results are paired with v1 on the same deals and clustered by seed.
- Scripts: `scripts/river-defense-screen.ts` and `scripts/analyze-river-defense.py`.

## Results (arm minus v1, bb/100, 95% CI)

| Field | v1 absolute | defense-1.0, plain sampling (superseded) | defense-1.0, stratified (current) |
|---|---|---|---|
| size-aware | −172 | +41 (+16, +67) | **+84 (+59, +109)** |
| loose | +1221 | −57 (−90, −24) | **−25 (−62, +12)** |
| pot-odds | +272 | −843 (−896, −790) | **−599 (−650, −548)** |

defense-0.7 with plain sampling was worse than defense-1.0 in every field and was dropped.

Cost: about 327 ms per hand against v1's 270 ms.

- `./` holds the first screen (pot-odds and loose, with plain sampling).
- `size-aware/` holds the size-aware field with plain sampling.
- `stratified/` holds the current arm, with v1 rows copied from the other two directories.

## Reading

- **pot-odds:** these opponents call any river bet whose price beats a random hand, so v1's overbets get paid by worse hands. Thinking players do not call this way, which is why the field favors v1.
- **size-aware:** this field rewards the fix. It shares the fix's assumption that bigger bets mean stronger ranges, so +84 is an upper bound for real players, not proof.
- **The bigger leak:** v1 loses 172 bb/100 to size readers. River sizing recovers about half of that. The bot only checks, calls or folds before the river, which is the next thing to fix.

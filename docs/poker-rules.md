# Poker rules and training conventions

No-limit Texas Hold’em, integer chips, fixed blinds, no ante and no rake. Training defaults to 1/2 blinds and 200 chips (100bb). The engine is authoritative for action validation and settlement.

- Raises use raise-to totals. The minimum increase is the last full bet/raise, initially one big blind.
- Short all-ins do not reduce the minimum increase. Cumulative short raises reopen action when a previously acting player faces at least a full raise.
- No raise is offered when no other player has chips available to contest it.
- Heads-up: button posts small blind and acts first preflop; big blind acts first postflop.
- A short big blind does not reduce the nominal preflop call price.
- Main and side pots settle separately. Unmatched contributions return to their contributor. Ties split chips with odd chips assigned clockwise starting left of the button.
- Folded hands cannot win contested pots. Hidden folded hands remain hidden from policies.
- Button currently advances to the next eligible player (moving-button convention), rather than implementing a casino dead-button procedure. This is a deliberate simulator convention and must be reconsidered before claiming compatibility with a specific cardroom.
- Cards are dealt from a uniformly shuffled virtual deck without physical burn cards. This preserves the distribution of visible boards but does not reproduce a physical dealer's deck consumption.

Reference for betting and reopening: https://www.pokertda.com/view-poker-tda-rules/ . TDA is a tournament rules source; betting mechanics are used here without tournament payouts or tournament administration rules.

Audit findings: fixed cumulative-short-all-in reopening and uncontestable raise menus. Regression coverage includes existing minimum-raise, short-blind, showdown, odd-chip and side-pot tests plus new cumulative-raise, unmatched-contribution and persistent elimination tests. This is regression coverage, not a proof of every possible game state.

## Running experiments

`npm run benchmark -- --hands 100 --seeds 3` runs seat-rotated fixed-stack reports for 6, 7 and 8 players. Add `--persistent` for stack-carrying sessions. JSON retains raw sessions; modes remain separate. No UI or artificial thinking delay is involved.

Intervals are approximate normal intervals over independent seed batches (all rotations of a seed stay in one batch). Intervals are omitted below 30 seed batches. Small batch counts are smoke checks, not evidence of superiority. Existing field reports retain their historical semantics; use the benchmark command for strict failures and explicit rotation records.

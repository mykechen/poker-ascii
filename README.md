# No Limit

An eight-seat no-limit hold'em table. Open a table, send the link, and each player sits from their own browser. One screen can still be passed around the table.

The rules live in `lib/poker`. `apply()` is the only way chips move. On each turn the engine publishes the legal actions: fold, check, call, raise-to, and all-in. The page only offers those actions.

## Run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:38471](http://127.0.0.1:38471).

[OPEN TABLE] sits you and shows a four-character code. Send that link. The other player opens it, takes an empty seat, and sees only their own hole cards. [START] deals. Action buttons show up only for the seat that is next.

A table is written to `data/rooms.json`, so a restart keeps the seats, the stacks, and the hand. [COPY SEAT KEY] is how a lost tab sits back down. The next hand deals itself after a showdown. Sit out to skip it. The player who opened the table can [CLEAR] a seat between hands. Each street waits three seconds before anyone can act. A turn lasts twenty seconds, then the seat checks, or folds if it owes chips.

[ONE SCREEN] is the pass-and-play table, with a reveal step so the next player can take the device. That table stays on the device.

## Test

```bash
npm test
```

## Rules in this table

- Blinds start at 1/2 and can be changed between hands. Each player types their own stack.
- The first raise must at least double the current bet. A later raise must add at least as many chips as the last full raise. All-in for less is allowed, and a short all-in does not let someone who already acted raise again.
- Side pots pay separately. An odd chip goes to the winner closest to the left of the button.

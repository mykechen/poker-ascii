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

[BOT] seats a portfolio opponent in an empty chair, up to seven. Give it a name and a stack. The felt marks it BOT. It sees only that seat's cards, waits out the street pause, then plays one legal action and writes the reason under its name. It plays the chart in `simplePolicy`, and folds one pair when three or more players are still in the hand. [CLEAR] removes it. [AWAY] and [ADD] work on a bot the same way they do on your own seat. A bot never acts for a person. If its choice is illegal, the turn timer checks or folds it.

[ONE SCREEN] is the pass-and-play table, with a reveal step so the next player can take the device. That table stays on the device.

## Host

`npm run dev` is the server for everyone at that address. On Vercel the same routes run, and the tables move to Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set (Vercel Redis uses `KV_REST_API_URL` and `KV_REST_API_TOKEN`). Without that store, each server keeps its own tables.

## Test

```bash
npm test
```

## Train

`simplePolicy` is the chart the table already plays. The next version goes in `lib/poker/candidate.ts`. `npm run train` deals through the same engine: seat 0 plays the candidate, and the other seats play the chart. Each seat sees only its own cards. Stacks return to the starting amount before every hand, the button moves, and the same seed deals the same cards.

```bash
npm run train
npm run train -- --hands 200 --seats 2 --seed 1
```

Seat 0's bb/100 is the number to beat. The candidate folds one pair in a multiway pot. The other seats still call with the chart. Compare a seed before and after one change in `lib/poker/candidate.ts`. The score wanders away from zero either way. The difference is the result. 1,200 hands shows a gross leak. A few hundred is noise. A policy that returns an illegal action is checked or folded, and that turn counts under fallbacks.

## Rules in this table

- Blinds start at 1/2 and can be changed between hands. Each player types their own stack.
- The first raise must at least double the current bet. A later raise must add at least as many chips as the last full raise. All-in for less is allowed, and a short all-in does not let someone who already acted raise again.
- Side pots pay separately. An odd chip goes to the winner closest to the left of the button.

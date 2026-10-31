# No Limit

A local eight-seat no-limit hold'em table. Players sit with a stack they choose, set the blinds, and pass one screen around the table. There is no network and no bot.

The rules live in `lib/poker`. `apply()` is the only way chips move. On each turn the engine publishes the legal actions: fold, check, call, raise-to, and all-in. The page only offers those actions.

## Run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:38471](http://127.0.0.1:38471).

## Test

```bash
npm test
```

## Rules in this table

- Blinds start at 1/2 and can be changed between hands. Each player types their own stack.
- The first raise must at least double the current bet. A later raise must add at least as many chips as the last full raise. All-in for less is allowed, and a short all-in does not let someone who already acted raise again.
- Side pots pay separately. An odd chip goes to the winner closest to the left of the button.

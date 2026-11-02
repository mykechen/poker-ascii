import { simplePolicy, type Policy } from "./bot";

/**
 * Seat 0 in `npm run train`. The other seats play simplePolicy.
 * This starts as the chart. Change one rule, run the same seed again,
 * and keep the change when seat 0's bb/100 moves.
 */
export const candidate: Policy = (view) => simplePolicy(view);

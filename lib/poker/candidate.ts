import { simplePolicy, type Policy } from "./bot";

/**
 * The chart, with one change that beat it.
 * The chart never bluffs, and it still calls a small bet with one pair
 * when other players are in the hand. Fold those. Heads-up calls stay.
 */
export const candidate: Policy = (view) => {
  const base = simplePolicy(view);
  if (base.reason !== "One pair. Call a small bet.") return base;
  const players = view.seats.filter((seat) => seat.inHand && !seat.folded).length;
  if (players < 3) return base;
  if (!view.validActions.some((item) => item.action === "fold")) return base;
  return { action: "fold", reason: "One pair. Fold with players in the pot." };
};

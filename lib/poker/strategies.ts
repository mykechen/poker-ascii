import { simplePolicy, type Policy, type PolicyAction } from "./bot";
import { candidate } from "./candidate";
import { learner } from "./learner";
import type { PublicView } from "./view";

export type StrategyId = "chart" | "multiway" | "tight" | "station" | "aggressor" | "position" | "maniac" | "learner";

export type Strategy = {
  id: StrategyId;
  name: string;
  /** One sentence the table and the field report can show. */
  rule: string;
  policy: Policy;
};

/** Hand groups and pot odds. The other styles are measured against this. */
export const chart: Policy = simplePolicy;

/** Folds every playable hand that has to put chips in. Premiums and strong hands stay. */
export const tight: Policy = (view) => {
  const base = simplePolicy(view);
  if (!base.reason.startsWith("Playable hand. Call")) return base;
  return fold(view, "Tight. Fold a playable hand.") ?? base;
};

/** Checks or calls. Never raises, and calls with hands the chart would fold. */
export const station: Policy = (view) =>
  check(view, "Station. Check.") ??
  call(view, "Station. Call.") ??
  allIn(view, "Station. Call all-in.") ??
  fold(view, "Station. Fold.") ??
  baseFallback(view);

/** If the chart wants to continue, bet or raise the pot instead of checking or calling. */
export const aggressor: Policy = (view) => {
  const base = simplePolicy(view);
  if (base.action === "fold") return base;
  const line = base.action === "check" ? "Aggressor. Bet the pot." : "Aggressor. Raise pot.";
  return raise(view, "pot", line) ?? base;
};

/**
 * Folds playable hands from an early seat. Min-raises them on the button
 * when nobody has raised yet. The cutoff and the blinds keep the chart.
 */
export const position: Policy = (view) => {
  const base = simplePolicy(view);
  if (!base.reason.startsWith("Playable hand. Call")) return base;
  const seat = hero(view);
  if (!seat) return base;
  if (seat.button && unraised(view)) return raise(view, "min", "Position. Raise the button.") ?? base;
  if (!seat.button && !seat.smallBlind && !seat.bigBlind && behind(view) >= 2) {
    return fold(view, "Position. Fold from an early seat.") ?? base;
  }
  return base;
};

/** Bets or raises the pot whenever the menu allows it. */
export const maniac: Policy = (view) =>
  raise(view, "pot", "Maniac. Raise pot.") ??
  call(view, "Maniac. Call.") ??
  check(view, "Maniac. Check.") ??
  fold(view, "Maniac. Fold.") ??
  baseFallback(view);

export const strategies: readonly Strategy[] = [
  {
    id: "chart",
    name: "Chart",
    rule: "Hand groups and pot odds. No bluffs and no position.",
    policy: chart,
  },
  {
    id: "multiway",
    name: "Multiway fold",
    rule: "The chart, except it folds one pair when three or more players remain.",
    policy: candidate,
  },
  {
    id: "tight",
    name: "Tight",
    rule: "Folds every playable hand that must put chips in. Strong hands and premiums stay.",
    policy: tight,
  },
  {
    id: "station",
    name: "Calling station",
    rule: "Checks or calls. Never raises, including with trash.",
    policy: station,
  },
  {
    id: "aggressor",
    name: "Aggressor",
    rule: "When the chart would continue, it bets or raises the pot instead.",
    policy: aggressor,
  },
  {
    id: "position",
    name: "Position",
    rule: "Folds playable hands early. Min-raises them on the button if nobody has raised.",
    policy: position,
  },
  {
    id: "maniac",
    name: "Maniac",
    rule: "Bets or raises the pot on every turn the menu allows.",
    policy: maniac,
  },
  {
    id: "learner",
    name: "Learner",
    rule: "Bluffs when the table folds, and stops bluffing when the table calls.",
    policy: learner,
  },
];

export function strategyById(id: StrategyId): Strategy {
  const found = strategies.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown strategy ${id}.`);
  return found;
}

function baseFallback(view: PublicView): PolicyAction {
  return simplePolicy(view);
}

function hero(view: PublicView) {
  return view.toAct === null ? undefined : view.seats[view.toAct];
}

/** Live players from the next seat through the button. Zero when this seat is the button. */
function behind(view: PublicView): number {
  const seat = view.toAct;
  if (seat === null || view.seats[seat]?.button) return 0;
  let count = 0;
  for (let step = 1; step < view.seats.length; step++) {
    const next = view.seats[(seat + step) % view.seats.length]!;
    if (next.button) return count + 1;
    if (next.inHand && !next.folded && !next.allIn) count += 1;
  }
  return count;
}

function unraised(view: PublicView): boolean {
  const price = callAmount(view) ?? 0;
  const committed = view.toAct === null ? 0 : (view.seats[view.toAct]?.streetCommitted ?? 0);
  return committed + price <= view.bigBlind;
}

function callAmount(view: PublicView): number | null {
  const offered = view.validActions.find((item) => item.action === "call");
  return offered && offered.action === "call" ? offered.amount : null;
}

function fold(view: PublicView, reason: string): PolicyAction | null {
  if (!view.validActions.some((item) => item.action === "fold")) return null;
  return { action: "fold", reason };
}

function check(view: PublicView, reason: string): PolicyAction | null {
  if (!view.validActions.some((item) => item.action === "check")) return null;
  return { action: "check", reason };
}

function call(view: PublicView, reason: string): PolicyAction | null {
  const offered = view.validActions.find((item) => item.action === "call");
  if (!offered || offered.action !== "call") return null;
  return { action: "call", amount: offered.amount, reason };
}

function allIn(view: PublicView, reason: string): PolicyAction | null {
  const offered = view.validActions.find((item) => item.action === "all_in");
  if (!offered || offered.action !== "all_in") return null;
  return { action: "all_in", amount: offered.amount, reason };
}

function raise(view: PublicView, size: "min" | "half" | "pot", reason: string): PolicyAction | null {
  const offered = view.validActions.find((item) => item.action === "raise");
  if (!offered || offered.action !== "raise" || !view.presets) return null;
  const raw = view.presets[size];
  const amount = Math.min(offered.max, Math.max(offered.min, raw));
  const allInAction = view.validActions.find((item) => item.action === "all_in");
  if (allInAction && allInAction.action === "all_in" && amount === allInAction.amount) {
    return { action: "all_in", amount: allInAction.amount, reason };
  }
  return { action: "raise", amount, reason };
}

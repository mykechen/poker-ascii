import type { Policy, PolicyAction } from "./bot";
import { candidate } from "./candidate";
import type { PublicView } from "./view";

/**
 * The chart, plus the lessons from the field.
 * Fold one pair when three players remain.
 * Bluff some missed hands, not every hand, so a bet is not always strong.
 * If half-pot bets have been called, stop bluffing and go back to the chart.
 * If they have been folded to, bluff more often and bet one pair.
 */
export const learner: Policy = (view) => {
  const base = candidate(view);
  if (base.action === "fold") return base;
  const seen = tableFoldRate(view);
  const urge = bluffUrge(seen.rate, seen.samples);
  if (urge <= 0) return base;

  const seat = view.toAct === null ? undefined : view.seats[view.toAct];
  if (urge >= 0.55 && base.reason.startsWith("Playable hand. Call") && seat?.button && unraised(view)) {
    return bet(view, "pot", "Steal. The table is folding.") ?? base;
  }

  const players = view.seats.filter((item) => item.inHand && !item.folded).length;
  if (players > 2) return base;
  if (!view.validActions.some((item) => item.action === "check")) return base;

  if (base.reason.startsWith("No pair") && bluffSlot(view, urge)) {
    return bet(view, "half", "Bluff. The table is folding.") ?? base;
  }
  if (base.reason.startsWith("Draw.") && bluffSlot(view, Math.min(1, urge + 0.34))) {
    return bet(view, "half", "Semi-bluff. The table is folding.") ?? base;
  }
  if (urge >= 0.55 && base.reason.startsWith("One pair")) {
    return bet(view, "half", "Thin value. The table is folding.") ?? base;
  }
  return base;
};

/** How often to bluff. A short sample still probes. Callers shut it off. */
function bluffUrge(rate: number, samples: number): number {
  if (samples >= 8 && rate <= 0.38) return 0;
  if (samples >= 8 && rate >= 0.55) return 0.67;
  return 0.34;
}

/** Smoothed share of half-pot-or-bigger bets that were folded to. Starts at one half. */
export function tableFoldRate(view: PublicView): { rate: number; samples: number } {
  let folds = 0;
  let faced = 0;
  const log = view.log;
  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    if (!entry || entry.street === "preflop" || entry.street === null || !sizable(entry)) continue;
    let folded = false;
    let continued = false;
    for (let j = i + 1; j < log.length; j++) {
      const next = log[j];
      if (!next || next.action === "deal" || next.action === "win" || next.action === "bet") break;
      if (next.action === "fold") folded = true;
      if (next.action === "call" || next.action === "raise" || next.action === "all_in") {
        continued = true;
        break;
      }
    }
    if (continued) faced += 1;
    else if (folded) {
      folds += 1;
      faced += 1;
    }
  }
  return { rate: (folds + PRIOR_FOLDS) / (faced + PRIOR_FACED), samples: faced };
}

function sizable(entry: PublicView["log"][number]): boolean {
  if (entry.action !== "bet" && entry.action !== "raise" && entry.action !== "all_in") return false;
  if (entry.amount === null || entry.amount <= 0) return false;
  const before = entry.potAfter - entry.amount;
  return before > 0 && entry.amount * 2 >= before;
}

const PRIOR_FOLDS = 4;
const PRIOR_FACED = 8;

function bluffSlot(view: PublicView, urge: number): boolean {
  const hole = view.toAct === null ? undefined : view.seats[view.toAct]?.hole;
  let salt = view.handNumber + view.board.length * 5;
  if (Array.isArray(hole)) salt += hole[0].charCodeAt(0) + hole[1].charCodeAt(0);
  return (salt % 9) / 9 < urge;
}

function unraised(view: PublicView): boolean {
  const offered = view.validActions.find((item) => item.action === "call");
  const price = offered && offered.action === "call" ? offered.amount : 0;
  const committed = view.toAct === null ? 0 : (view.seats[view.toAct]?.streetCommitted ?? 0);
  return committed + price <= view.bigBlind;
}

function bet(view: PublicView, size: "half" | "pot", reason: string): PolicyAction | null {
  const offered = view.validActions.find((item) => item.action === "raise");
  if (!offered || offered.action !== "raise" || !view.presets) return null;
  const amount = Math.min(offered.max, Math.max(offered.min, view.presets[size]));
  const allIn = view.validActions.find((item) => item.action === "all_in");
  if (allIn && allIn.action === "all_in" && amount === allIn.amount) {
    return { action: "all_in", amount: allIn.amount, reason };
  }
  return { action: "raise", amount, reason };
}

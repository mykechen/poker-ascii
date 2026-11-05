import { rankValue } from "./cards";
import { compareScores, evaluate } from "./evaluator";
import type { Card, PlayAction } from "./types";
import type { PublicView } from "./view";

export const REASON_MAX = 80;

export type BotNote = {
  handNumber: number;
  /** Log length after the action this sentence explains. */
  at: number;
  seat: number;
  text: string;
};

export type PolicyAction = {
  action: PlayAction;
  amount?: number;
  reason: string;
};

/** A later bot replaces this function. The seat, the view, and the menu stay. */
export type Policy = ((view: PublicView) => PolicyAction) & {
  startSession?: (joinIds: string[]) => void;
  observe?: (before: PublicView, after: PublicView) => void;
};

/**
 * Pot odds and made-hand groups. Weak on purpose: no bluffs, no position,
 * and the sentence names the group rather than the exact cards.
 */
export function simplePolicy(view: PublicView): PolicyAction {
  const hole = ownHole(view);
  if (!hole || view.validActions.length === 0) throw new Error("The bot has nothing legal to play.");
  if (view.street === "preflop" || view.board.length < 3) return preflop(view, hole);
  return postflop(view, hole);
}

/** Returns the decision only when it is one of the published actions. */
export function readBotAction(view: PublicView, policy: Policy = simplePolicy): PolicyAction | null {
  let decision: PolicyAction;
  try {
    decision = policy(view);
  } catch {
    return null;
  }
  if (!decision || typeof decision.reason !== "string") return null;
  const reason = decision.reason.trim();
  if (reason.length < 1 || reason.length > REASON_MAX || /[\r\n]/.test(reason)) return null;
  const offered = view.validActions.find((item) => item.action === decision.action);
  if (!offered) return null;
  if (offered.action === "fold" || offered.action === "check") {
    if (decision.amount !== undefined) return null;
    return { action: offered.action, reason };
  }
  if (offered.action === "call" || offered.action === "all_in") {
    if (decision.amount !== undefined && decision.amount !== offered.amount) return null;
    return { action: offered.action, amount: offered.amount, reason };
  }
  if (offered.action === "raise") {
    const amount = decision.amount;
    if (typeof amount !== "number" || !Number.isSafeInteger(amount)) return null;
    if (amount < offered.min || amount > offered.max) return null;
    return { action: "raise", amount, reason };
  }
  return null;
}

type Hole = [Card, Card];
type PreflopGroup = "premium" | "strong" | "playable" | "trash";
type MadeGroup = "board" | "made" | "two" | "pair" | "draw" | "air";

function preflop(view: PublicView, hole: Hole): PolicyAction {
  const group = preflopGroup(hole);
  if (group === "premium") return premium(view);
  if (group === "strong") return strong(view);
  if (group === "playable") return playable(view);
  return trash(view);
}

function premium(view: PublicView): PolicyAction {
  return (
    raiseTo(view, "pot", "Premium hand.", "Raise pot.") ??
    justCall(view, "Premium hand. Call.") ??
    justCheck(view, "Premium hand. Check.") ??
    fallback(view, "Premium hand. Call.")
  );
}

function strong(view: PublicView): PolicyAction {
  const checked = justCheck(view, "Strong hand. Check.");
  if (checked) return checked;
  if (unraised(view)) {
    const raised = raiseTo(view, "min", "Strong hand.", "Raise the minimum.");
    if (raised) return raised;
  }
  const price = callAmount(view);
  if (price !== null && price <= 8 * view.bigBlind) {
    const called = justCall(view, "Strong hand. Call.");
    if (called) return called;
  }
  return justFold(view, "Strong hand. Fold.") ?? fallback(view, "Strong hand. Fold.");
}

function playable(view: PublicView): PolicyAction {
  const checked = justCheck(view, "Playable hand. Check.");
  if (checked) return checked;
  const price = callAmount(view);
  if (price !== null && price <= 3 * view.bigBlind) {
    const called = justCall(view, "Playable hand. Call a small price.");
    if (called) return called;
  }
  return justFold(view, "Playable hand. Fold.") ?? fallback(view, "Playable hand. Fold.");
}

function trash(view: PublicView): PolicyAction {
  return justCheck(view, "Trash hand. Check.") ?? justFold(view, "Trash hand. Fold.") ?? fallback(view, "Trash hand. Fold.");
}

function postflop(view: PublicView, hole: Hole): PolicyAction {
  const group = madeGroup(hole, view.board);
  if (group === "board") return shown(view, "Playing the board.", "Fold.");
  if (group === "air") return shown(view, "No pair.", "Fold.");
  if (group === "draw") return priced(view, "Draw.", 3, "Call.", "The price is too high.");
  if (group === "pair") return priced(view, "One pair.", 4, "Call a small bet.", "Fold to the large bet.");
  if (group === "two") {
    return sized(view, "Two pair or three of a kind.", "half", "Bet half the pot.", 2, "Call.", "Fold to the large bet.");
  }
  return sized(view, "Straight or better.", "pot", "Bet the pot.", 0, "Call.", "Fold.");
}

function shown(view: PublicView, label: string, foldLine: string): PolicyAction {
  return justCheck(view, `${label} Check.`) ?? justFold(view, `${label} ${foldLine}`) ?? fallback(view, `${label} Check.`);
}

function priced(view: PublicView, label: string, multiplier: number, callLine: string, foldLine: string): PolicyAction {
  const checked = justCheck(view, `${label} Check.`);
  if (checked) return checked;
  const price = callAmount(view);
  if (price !== null && multiplier * price <= view.pot) {
    const called = justCall(view, `${label} ${callLine}`);
    if (called) return called;
  }
  return justFold(view, `${label} ${foldLine}`) ?? fallback(view, `${label} Fold.`);
}

function sized(
  view: PublicView,
  label: string,
  size: "min" | "half" | "pot",
  betLine: string,
  multiplier: number,
  callLine: string,
  foldLine: string,
): PolicyAction {
  if (has(view, "check")) {
    return raiseTo(view, size, label, betLine) ?? justCheck(view, `${label} Check.`) ?? fallback(view, `${label} Check.`);
  }
  const price = callAmount(view);
  if (price !== null && multiplier * price <= view.pot) {
    const called = justCall(view, `${label} ${callLine}`);
    if (called) return called;
  }
  return justFold(view, `${label} ${foldLine}`) ?? fallback(view, `${label} Fold.`);
}

function preflopGroup(hole: Hole): PreflopGroup {
  const high = Math.max(rankValue(hole[0]), rankValue(hole[1]));
  const low = Math.min(rankValue(hole[0]), rankValue(hole[1]));
  const pair = high === low;
  const suited = hole[0][1] === hole[1][1];
  if ((pair && high >= 11) || (high === 14 && low === 13)) return "premium";
  if ((pair && high >= 7) || (high === 14 && low >= 11) || (high === 13 && low === 12)) return "strong";
  if (pair || suited || low >= 10 || (high - low === 1 && low >= 5)) return "playable";
  return "trash";
}

function madeGroup(hole: Hole, board: Card[]): MadeGroup {
  const hero = evaluate([...hole, ...board]);
  if (board.length === 5 && compareScores(evaluate(board).score, hero.score) >= 0) return "board";
  const category = hero.score[0] ?? 0;
  if (category >= 4) return "made";
  if ((category === 1 || category === 2 || category === 3) && owns(hole, hero.score, category)) {
    return category === 1 ? "pair" : "two";
  }
  if (board.length < 5 && (flushDraw(hole, board) || openEnder(hole, board))) return "draw";
  return "air";
}

function owns(hole: Hole, score: number[], category: number): boolean {
  const left = rankValue(hole[0]);
  const right = rankValue(hole[1]);
  if (left === right) return true;
  if (left === score[1] || right === score[1]) return true;
  if (category === 2 && (left === score[2] || right === score[2])) return true;
  return false;
}

function flushDraw(hole: Hole, board: Card[]): boolean {
  const cards = [...hole, ...board];
  for (const suit of ["c", "d", "h", "s"]) {
    const count = cards.filter((card) => card[1] === suit).length;
    const held = hole.filter((card) => card[1] === suit).length;
    if (count === 4 && held >= 1) return true;
  }
  return false;
}

function openEnder(hole: Hole, board: Card[]): boolean {
  const present = new Set([...hole, ...board].map((card) => rankValue(card)));
  const held = new Set(hole.map((card) => rankValue(card)));
  for (let high = 6; high <= 14; high++) {
    const run = [high, high - 1, high - 2, high - 3];
    if (run.every((rank) => present.has(rank)) && run.some((rank) => held.has(rank))) return true;
  }
  return false;
}

function unraised(view: PublicView): boolean {
  return committed(view) + (callAmount(view) ?? 0) <= view.bigBlind;
}

function committed(view: PublicView): number {
  if (view.toAct === null) return 0;
  return view.seats[view.toAct]?.streetCommitted ?? 0;
}

function callAmount(view: PublicView): number | null {
  const offered = view.validActions.find((item) => item.action === "call");
  return offered && offered.action === "call" ? offered.amount : null;
}

function has(view: PublicView, action: PlayAction): boolean {
  return view.validActions.some((item) => item.action === action);
}

function raiseTo(view: PublicView, size: "min" | "half" | "pot", label: string, line: string): PolicyAction | null {
  const raise = view.validActions.find((item) => item.action === "raise");
  if (!raise || raise.action !== "raise" || !view.presets) return null;
  const amount = view.presets[size];
  const allIn = view.validActions.find((item) => item.action === "all_in");
  if (allIn && allIn.action === "all_in" && amount === allIn.amount) {
    return { action: "all_in", amount: allIn.amount, reason: `${label} All-in.` };
  }
  return { action: "raise", amount, reason: `${label} ${line}` };
}

function justCall(view: PublicView, reason: string): PolicyAction | null {
  const offered = view.validActions.find((item) => item.action === "call");
  if (!offered || offered.action !== "call") return null;
  return { action: "call", amount: offered.amount, reason };
}

function justCheck(view: PublicView, reason: string): PolicyAction | null {
  if (!has(view, "check")) return null;
  return { action: "check", reason };
}

function justFold(view: PublicView, reason: string): PolicyAction | null {
  if (!has(view, "fold")) return null;
  return { action: "fold", reason };
}

function fallback(view: PublicView, reason: string): PolicyAction {
  const checked = justCheck(view, reason);
  if (checked) return checked;
  const folded = justFold(view, reason);
  if (folded) return folded;
  const called = justCall(view, reason);
  if (called) return called;
  const allIn = view.validActions.find((item) => item.action === "all_in");
  if (allIn && allIn.action === "all_in") return { action: "all_in", amount: allIn.amount, reason };
  const raise = view.validActions.find((item) => item.action === "raise");
  if (raise && raise.action === "raise") return { action: "raise", amount: raise.min, reason };
  throw new Error("No legal action.");
}

function ownHole(view: PublicView): Hole | null {
  if (view.toAct === null) return null;
  const hole = view.seats[view.toAct]?.hole;
  if (!hole || hole === "down" || hole.length !== 2) return null;
  return [hole[0], hole[1]];
}

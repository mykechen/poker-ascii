import { describe, expect, it } from "vitest";
import { freshDeck, card } from "./cards";
import { apply, createTable, legalActions } from "./engine";
import { compareScores, evaluate } from "./evaluator";
import { settlePots } from "./pots";
import type { Card, Command, TableState } from "./types";
import { projectView } from "./view";

function deal(commands: Command[]): TableState {
  return commands.reduce(apply, createTable());
}

function sit(
  players: { seat: number; name: string; stack: number }[],
  blinds: { smallBlind: number; bigBlind: number } = { smallBlind: 1, bigBlind: 2 },
): TableState {
  const commands: Command[] = [
    { type: "setBlinds", ...blinds },
    ...players.map((player) => ({ type: "sit" as const, ...player })),
  ];
  return deal(commands);
}

function pad(deck: Card[]): Card[] {
  const used = new Set(deck);
  return [...deck, ...freshDeck().filter((item) => !used.has(item))];
}

describe("evaluator", () => {
  it("ranks a royal flush above a straight flush", () => {
    const royal = evaluate(["Ah", "Kh", "Qh", "Jh", "Th"].map(card));
    const steel = evaluate(["9h", "8h", "7h", "6h", "5h"].map(card));
    expect(royal.description).toBe("Royal flush");
    expect(compareScores(royal.score, steel.score)).toBe(1);
  });

  it("plays the wheel below a six-high straight", () => {
    const wheel = evaluate(["Ah", "2d", "3c", "4s", "5h"].map(card));
    const six = evaluate(["2h", "3d", "4c", "5s", "6h"].map(card));
    expect(wheel.description).toBe("Straight, five high");
    expect(six.score[1]).toBeGreaterThan(wheel.score[1]!);
  });

  it("uses the higher full house and the higher flush kicker", () => {
    const aces = evaluate(["Ah", "Ad", "Ac", "Kd", "Kh"].map(card));
    const kings = evaluate(["Kh", "Kd", "Kc", "Ad", "Ah"].map(card));
    expect(aces.description).toBe("Full house, Aces full of Kings");
    expect(aces.score[1]).toBeGreaterThan(kings.score[1]!);

    const aceFlush = evaluate(["Ah", "9h", "8h", "4h", "2h"].map(card));
    const kingFlush = evaluate(["Kh", "Qh", "Jh", "9h", "8h"].map(card));
    expect(aceFlush.score[1]).toBeGreaterThan(kingFlush.score[1]!);
  });

  it("breaks two pair with the kicker and ignores suits when the ranks match", () => {
    const queen = evaluate(["Ah", "Ad", "Kh", "Kd", "Qc"].map(card));
    const jack = evaluate(["As", "Ac", "Ks", "Kc", "Jc"].map(card));
    expect(queen.score[3]).toBeGreaterThan(jack.score[3]!);
    const same = evaluate(["Ah", "Kd", "Qc", "Js", "9c"].map(card));
    const other = evaluate(["Ad", "Kh", "Qs", "Jc", "9d"].map(card));
    expect(same.score).toEqual(other.score);
  });

  it("picks the best five cards out of seven", () => {
    const hand = evaluate(["Ah", "Kh", "2c", "3d", "4s", "5c", "9h"].map(card));
    expect(hand.description).toBe("Straight, five high");
    const flush = evaluate(["Ah", "Qh", "8h", "4h", "2h", "Kd", "Kc"].map(card));
    expect(flush.description).toBe("Flush, Ace high");
  });
});

describe("pots", () => {
  it("gives the leftover chip to the winner left of the button", () => {
    const paid = settlePots(0, [
      { seat: 0, committed: 2, folded: false, score: [0, 14] },
      { seat: 1, committed: 2, folded: false, score: [0, 14] },
      { seat: 2, committed: 1, folded: true, score: null },
    ]);
    expect(paid.get(1)).toBe(3);
    expect(paid.get(0)).toBe(2);
  });

  it("keeps a short all-in out of the side pot", () => {
    const paid = settlePots(0, [
      { seat: 0, committed: 100, folded: false, score: [8, 14] },
      { seat: 1, committed: 300, folded: false, score: [0, 14] },
      { seat: 2, committed: 300, folded: false, score: [0, 9] },
    ]);
    expect(paid.get(0)).toBe(300);
    expect(paid.get(1)).toBe(400);
    expect(paid.get(2)).toBeUndefined();
  });
});

describe("engine", () => {
  it("deals heads-up with the button as the small blind", () => {
    const state = apply(sit([
      { seat: 0, name: "Ada", stack: 100 },
      { seat: 1, name: "Bo", stack: 100 },
    ]), { type: "startHand" });
    expect(state.button).toBe(0);
    expect(state.smallBlindSeat).toBe(0);
    expect(state.bigBlindSeat).toBe(1);
    expect(state.toAct).toBe(0);
    expect(state.seats[0]!.streetCommitted).toBe(1);
    expect(state.seats[1]!.streetCommitted).toBe(2);
    expect(state.pot).toBe(3);
    expect(state.seats[0]!.hole[0]).toBeDefined();
  });

  it("starts a three-handed hand on the button", () => {
    const state = apply(sit([
      { seat: 0, name: "Ada", stack: 100 },
      { seat: 1, name: "Bo", stack: 100 },
      { seat: 2, name: "Cy", stack: 100 },
    ]), { type: "startHand" });
    expect(state.button).toBe(0);
    expect(state.smallBlindSeat).toBe(1);
    expect(state.bigBlindSeat).toBe(2);
    expect(state.toAct).toBe(0);
  });

  it("moves the button and skips an away player", () => {
    let state = sit([
      { seat: 0, name: "Ada", stack: 100 },
      { seat: 1, name: "Bo", stack: 100 },
      { seat: 2, name: "Cy", stack: 100 },
    ]);
    state = apply(state, { type: "startHand" });
    state = apply(state, { type: "act", seat: 0, action: "fold" });
    state = apply(state, { type: "act", seat: 1, action: "fold" });
    expect(state.phase).toBe("complete");
    expect(state.result?.showed).toBe(false);
    expect(state.result?.winners[0]?.name).toBe("Cy");
    expect(state.result?.winners[0]?.net).toBe(1);
    state = apply(state, { type: "away", seat: 1 });
    state = apply(state, { type: "startHand" });
    expect(state.button).toBe(2);
    expect(state.seats[1]!.inHand).toBe(false);
  });

  it("requires the first raise to double the big blind", () => {
    let state = apply(sit([
      { seat: 0, name: "Ada", stack: 100 },
      { seat: 1, name: "Bo", stack: 100 },
      { seat: 2, name: "Cy", stack: 100 },
    ]), { type: "startHand" });
    const raise = legalActions(state).find((action) => action.action === "raise");
    expect(raise).toEqual({ action: "raise", min: 4, max: 100 });
    const rejected = apply(state, { type: "act", seat: 0, action: "raise", amount: 3 });
    expect(rejected.error).toMatch(/4 to 100/);
    expect(rejected.seats[0]!.stack).toBe(100);
    state = apply(state, { type: "act", seat: 0, action: "raise", amount: 4 });
    expect(state.currentBet).toBe(4);
    expect(state.seats[0]!.stack).toBe(96);
    expect(state.error).toBeNull();
  });

  it("prices a reraise from the last full raise, not double the current bet", () => {
    let state = checkedToFlop();
    expect(state.street).toBe("flop");
    expect(state.toAct).toBe(1);
    state = apply(state, { type: "act", seat: 1, action: "raise", amount: 10 });
    state = apply(state, { type: "act", seat: 2, action: "raise", amount: 25 });
    const raise = legalActions(state).find((action) => action.action === "raise");
    expect(raise).toMatchObject({ action: "raise", min: 40 });
  });

  it("does not let a player who already acted raise a short all-in", () => {
    let state = sit(
      [
        { seat: 0, name: "Ada", stack: 16 },
        { seat: 1, name: "Bo", stack: 200 },
        { seat: 2, name: "Cy", stack: 200 },
      ],
      { smallBlind: 1, bigBlind: 2 },
    );
    state = apply(state, { type: "startHand", deck: threeHandedDeck() });
    state = callAround(state);
    expect(state.street).toBe("flop");
    expect(state.seats[0]!.stack).toBe(14);
    state = apply(state, { type: "act", seat: 1, action: "raise", amount: 10 });
    state = apply(state, { type: "act", seat: 2, action: "call" });
    state = apply(state, { type: "act", seat: 0, action: "all_in" });
    expect(state.currentBet).toBe(14);
    expect(state.toAct).toBe(1);
    const bo = legalActions(state).map((action) => action.action);
    expect(bo).toEqual(["fold", "call"]);
    state = apply(state, { type: "act", seat: 1, action: "fold" });
    expect(legalActions(state).some((action) => action.action === "raise")).toBe(false);
  });

  it("returns an uncalled raise and awards the blinds when everyone folds", () => {
    let state = apply(sit([
      { seat: 0, name: "Ada", stack: 100 },
      { seat: 1, name: "Bo", stack: 100 },
    ]), { type: "startHand" });
    state = apply(state, { type: "act", seat: 0, action: "raise", amount: 20 });
    state = apply(state, { type: "act", seat: 1, action: "fold" });
    expect(state.phase).toBe("complete");
    expect(state.seats[0]!.stack).toBe(102);
    expect(state.seats[1]!.stack).toBe(98);
    expect(state.result?.winners[0]?.net).toBe(2);
    expect(projectView(state, true).seats[0]!.hole).toBe("down");
  });

  it("runs out a side pot when the short stack is all-in", () => {
    const holes = {
      0: ["Ah", "Kh"],
      1: ["Ad", "Kd"],
      2: ["7c", "6c"],
    } as const;
    const board = ["Qh", "Jh", "Th", "2c", "3d"];
    let state = sit([
      { seat: 0, name: "Ada", stack: 100 },
      { seat: 1, name: "Bo", stack: 300 },
      { seat: 2, name: "Cy", stack: 300 },
    ], { smallBlind: 10, bigBlind: 20 });
    state = apply(state, {
      type: "startHand",
      deck: pad(orderedDeck([1, 2, 0], holes, board)),
    });
    expect(state.seats[0]!.hole.map(String)).toEqual(["Ah", "Kh"]);
    state = apply(state, { type: "act", seat: 0, action: "all_in" });
    state = apply(state, { type: "act", seat: 1, action: "all_in" });
    state = apply(state, { type: "act", seat: 2, action: "call" });
    expect(state.phase).toBe("complete");
    expect(state.board.map(String)).toEqual(board);
    expect(state.result?.showed).toBe(true);
    expect(state.seats[0]!.stack).toBe(300);
    expect(state.seats[1]!.stack).toBe(400);
    expect(state.seats[2]!.stack).toBe(0);
    expect(state.result?.text).toContain("Royal flush");
    const view = projectView(state, false);
    expect(view.seats[0]!.hole).toEqual(state.seats[0]!.hole);
    expect(view.seats[2]!.hole).toEqual(state.seats[2]!.hole);
  });

  it("makes a short big blind call for the full blind, then returns the extra chip", () => {
    const holes = {
      0: ["7c", "2d"],
      1: ["Kc", "Qs"],
      2: ["Ah", "Ad"],
    } as const;
    const board = ["9c", "8d", "3s", "4h", "6c"];
    let state = sit([
      { seat: 0, name: "Ada", stack: 100 },
      { seat: 1, name: "Bo", stack: 100 },
      { seat: 2, name: "Cy", stack: 1 },
    ]);
    state = apply(state, {
      type: "startHand",
      deck: pad(orderedDeck([1, 2, 0], holes, board)),
    });
    expect(state.seats[2]!.allIn).toBe(true);
    expect(state.currentBet).toBe(2);
    const call = legalActions(state).find((action) => action.action === "call");
    expect(call).toEqual({ action: "call", amount: 2 });
    state = apply(state, { type: "act", seat: 0, action: "raise", amount: 4 });
    state = apply(state, { type: "act", seat: 1, action: "fold" });
    expect(state.phase).toBe("complete");
    expect(state.seats[2]!.stack).toBe(3);
    expect(state.seats[0]!.stack).toBe(99);
    expect(state.seats[1]!.stack).toBe(99);
  });

  it("hides the actor's cards until they are revealed", () => {
    const state = apply(sit([
      { seat: 0, name: "Ada", stack: 50 },
      { seat: 1, name: "Bo", stack: 50 },
    ]), { type: "startHand" });
    const hidden = projectView(state, false);
    expect(hidden.revealRequired).toBe(true);
    expect(hidden.seats[0]!.hole).toBe("down");
    expect(hidden.validActions).toEqual([]);
    const open = projectView(state, true);
    expect(open.seats[0]!.hole).toEqual(state.seats[0]!.hole);
    expect(open.validActions.map((action) => action.action)).toContain("raise");
    expect(open.presets?.min).toBe(4);
  });
});

function threeHandedDeck(): Card[] {
  return pad([]);
}

function orderedDeck(
  order: number[],
  holes: Record<number, readonly [string, string]>,
  board: string[],
): Card[] {
  const deck: Card[] = [];
  for (let round = 0; round < 2; round++) {
    for (const seat of order) deck.push(card(holes[seat]![round]!));
  }
  return [...deck, ...board.map(card)];
}

function checkedToFlop(): TableState {
  let state = sit([
    { seat: 0, name: "Ada", stack: 200 },
    { seat: 1, name: "Bo", stack: 200 },
    { seat: 2, name: "Cy", stack: 200 },
  ]);
  state = apply(state, { type: "startHand", deck: threeHandedDeck() });
  return callAround(state);
}

function callAround(state: TableState): TableState {
  while (state.phase === "betting" && state.street === "preflop" && state.toAct !== null) {
    const actions = legalActions(state);
    const check = actions.find((action) => action.action === "check");
    const call = actions.find((action) => action.action === "call");
    const choice = check ?? call;
    if (!choice) throw new Error("Expected a check or call.");
    state = apply(state, { type: "act", seat: state.toAct, action: choice.action });
  }
  return state;
}

import { describe, expect, it } from "vitest";
import { learner, tableFoldRate } from "./learner";
import type { LogEntry } from "./types";
import type { PublicView, RaisePresets } from "./view";

const presets: RaisePresets = { min: 2, half: 5, pot: 10, allIn: 200 };

describe("learner", () => {
  it("probes with some air, bluffs more when bets are folded to, and stops when they are called", () => {
    const quiet = spot("check", "No pair", 1);
    expect(tableFoldRate(quiet)).toEqual({ rate: 0.5, samples: 0 });
    expect(learner(quiet).reason).toBe("Bluff. The table is folding.");
    expect(learner(spot("check", "No pair", 5)).reason).toBe("No pair. Check.");

    const folding = spot("check", "No pair", 5, foldedLog(12));
    expect(tableFoldRate(folding).rate).toBeGreaterThan(0.55);
    expect(learner(folding).reason).toBe("Bluff. The table is folding.");

    const calling = spot("check", "No pair", 1, calledLog(12));
    expect(tableFoldRate(calling).rate).toBeLessThan(0.38);
    expect(learner(calling).reason).toBe("No pair. Check.");
  });

  it("semi-bluffs a draw when the table folds, and bets one pair for thin value", () => {
    expect(learner(spot("check", "Draw", 4, foldedLog(12))).reason).toBe("Semi-bluff. The table is folding.");
    expect(learner(spot("check", "One pair", 4, foldedLog(12))).reason).toBe("Thin value. The table is folding.");
    expect(learner(spot("check", "Draw", 4, calledLog(12))).reason).toBe("Draw. Check.");
  });

  it("still folds one pair when three players remain, even if the table has been folding", () => {
    const view = spot("bet", "One pair", 1, foldedLog(12), 3);
    expect(learner(view).reason).toBe("One pair. Fold with players in the pot.");
  });
});

function spot(
  pattern: "check" | "bet",
  group: "No pair" | "Draw" | "One pair",
  handNumber: number,
  log: LogEntry[] = [],
  players = 2,
): PublicView {
  const hole = group === "Draw" ? (["Ah", "5d"] as const) : group === "One pair" ? (["9h", "2c"] as const) : (["Jh", "6c"] as const);
  const board = group === "Draw" ? (["2h", "7h", "9h"] as const) : group === "One pair" ? (["9d", "4c", "8s"] as const) : (["9h", "8d", "2c"] as const);
  const checkLine = pattern === "check";
  return {
    seats: Array.from({ length: 8 }, (_, seat) => ({
      seat,
      occupied: seat < players,
      name: seat < players ? `Seat ${seat + 1}` : null,
      stack: 200,
      away: false,
      inHand: seat < players,
      folded: false,
      allIn: false,
      streetCommitted: 0,
      hole: seat === 0 ? [...hole] : seat < players ? "down" : null,
      button: seat === 0,
      smallBlind: false,
      bigBlind: false,
      toAct: seat === 0,
      lastAction: null,
    })),
    board: [...board],
    pot: checkLine ? 8 : 10,
    pots: [{ name: "POT", amount: checkLine ? 8 : 10 }],
    street: "flop",
    phase: "betting",
    handNumber,
    smallBlind: 1,
    bigBlind: 2,
    toAct: 0,
    actorName: "Seat 1",
    validActions: checkLine
      ? [
          { action: "check" },
          { action: "raise", min: 2, max: 200 },
          { action: "all_in", amount: 200 },
        ]
      : [
          { action: "fold" },
          { action: "call", amount: 2 },
          { action: "raise", min: 4, max: 200 },
          { action: "all_in", amount: 200 },
        ],
    presets,
    log,
    result: null,
    error: null,
    revealRequired: false,
  };
}

function foldedLog(count: number): LogEntry[] {
  return Array.from({ length: count }, (_, index) => [line("bet", index), line("fold", index)]).flat();
}

function calledLog(count: number): LogEntry[] {
  return Array.from({ length: count }, (_, index) => [line("bet", index), line("call", index)]).flat();
}

function line(action: "bet" | "fold" | "call", index: number): LogEntry {
  return {
    seat: action === "bet" ? 1 : 0,
    name: action === "bet" ? "Seat 2" : "Seat 1",
    action,
    amount: action === "fold" ? null : 4,
    raiseTo: action === "bet" ? 4 : null,
    street: "flop",
    stackAfter: 196,
    potAfter: 8,
    text: `${action} ${index}`,
  };
}

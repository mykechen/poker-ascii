import { describe, expect, it } from "vitest";
import { simplePolicy } from "./bot";
import { candidate } from "./candidate";
import type { Card, LegalAction } from "./types";
import type { PublicView } from "./view";

describe("candidate", () => {
  it("folds one pair when three players remain, and calls heads-up", () => {
    const multiway = pairSpot(3, 2);
    expect(simplePolicy(multiway).reason).toBe("One pair. Call a small bet.");
    expect(candidate(multiway)).toEqual({ action: "fold", reason: "One pair. Fold with players in the pot." });

    const headsUp = pairSpot(2, 2);
    expect(candidate(headsUp)).toEqual(simplePolicy(headsUp));
    expect(candidate(headsUp).reason).toBe("One pair. Call a small bet.");
  });

  it("keeps the chart against a large bet and on other hands", () => {
    const expensive = pairSpot(3, 4);
    expect(candidate(expensive)).toEqual(simplePolicy(expensive));
    expect(candidate(expensive).reason).toBe("One pair. Fold to the large bet.");
  });
});

function pairSpot(players: number, call: number): PublicView {
  const hole: [Card, Card] = ["9h", "2c"];
  const board: Card[] = ["9d", "4c", "8s"];
  const actions: LegalAction[] = [
    { action: "fold" },
    { action: "call", amount: call },
    { action: "raise", min: call * 2, max: 200 },
    { action: "all_in", amount: 200 },
  ];
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
      hole: seat === 0 ? hole : seat < players ? "down" : null,
      button: seat === players - 1,
      smallBlind: false,
      bigBlind: false,
      toAct: seat === 0,
      lastAction: null,
    })),
    board,
    pot: 10,
    pots: [{ name: "POT", amount: 10 }],
    street: "flop",
    phase: "betting",
    handNumber: 1,
    smallBlind: 1,
    bigBlind: 2,
    toAct: 0,
    actorName: "Seat 1",
    validActions: actions,
    presets: null,
    log: [],
    result: null,
    error: null,
    revealRequired: false,
  };
}

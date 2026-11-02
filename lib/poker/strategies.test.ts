import { describe, expect, it } from "vitest";
import { simplePolicy } from "./bot";
import { aggressor, maniac, position, station, strategies, tight } from "./strategies";
import type { Card, LegalAction } from "./types";
import type { PublicView, RaisePresets } from "./view";

const presets: RaisePresets = { min: 4, half: 7, pot: 10, allIn: 200 };

describe("strategies", () => {
  it("names seven styles", () => {
    expect(strategies.map((item) => item.id)).toEqual([
      "chart",
      "multiway",
      "tight",
      "station",
      "aggressor",
      "position",
      "maniac",
    ]);
  });

  it("folds playable hands when tight, and from an early seat when playing position", () => {
    const early = playable(3);
    expect(simplePolicy(early).reason).toBe("Playable hand. Call a small price.");
    expect(tight(early).reason).toBe("Tight. Fold a playable hand.");
    expect(position(early).reason).toBe("Position. Fold from an early seat.");
  });

  it("raises the button with a playable hand, and bets when the chart would only continue", () => {
    const button = playable(0);
    expect(position(button).reason).toBe("Position. Raise the button.");
    expect(aggressor(button).action).toBe("raise");
    expect(aggressor(button).reason).toBe("Aggressor. Raise pot.");
  });

  it("calls with trash, and the maniac raises whenever a raise is offered", () => {
    const trash = playable(0, ["7c", "2d"]);
    expect(simplePolicy(trash).action).toBe("fold");
    expect(station(trash)).toEqual({ action: "call", amount: 2, reason: "Station. Call." });
    expect(maniac(trash).reason).toBe("Maniac. Raise pot.");
    expect(aggressor(trash).action).toBe("fold");
  });
});

function playable(buttonSeat: number, hole: [Card, Card] = ["7h", "2h"]): PublicView {
  const actions: LegalAction[] = [
    { action: "fold" },
    { action: "call", amount: 2 },
    { action: "raise", min: 4, max: 200 },
    { action: "all_in", amount: 200 },
  ];
  return {
    seats: Array.from({ length: 8 }, (_, seat) => ({
      seat,
      occupied: seat <= 3,
      name: seat <= 3 ? `Seat ${seat + 1}` : null,
      stack: 198,
      away: false,
      inHand: seat <= 3,
      folded: false,
      allIn: false,
      streetCommitted: 0,
      hole: seat === 0 ? hole : seat <= 3 ? "down" : null,
      button: seat === buttonSeat,
      smallBlind: false,
      bigBlind: false,
      toAct: seat === 0,
      lastAction: null,
    })),
    board: [],
    pot: 3,
    pots: [{ name: "POT", amount: 3 }],
    street: "preflop",
    phase: "betting",
    handNumber: 1,
    smallBlind: 1,
    bigBlind: 2,
    toAct: 0,
    actorName: "Seat 1",
    validActions: actions,
    presets,
    log: [],
    result: null,
    error: null,
    revealRequired: false,
  };
}

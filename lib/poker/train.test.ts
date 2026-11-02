import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { simplePolicy, type Policy } from "./bot";
import { playMatch, type TrainSeat } from "./train";
import type { PublicView } from "./view";

const fold: Policy = (view) => {
  if (view.validActions.some((item) => item.action === "check")) return { action: "check", reason: "Check." };
  return { action: "fold", reason: "Fold." };
};

describe("training match", () => {
  it("deals the same cards from the same seed, and the chips add up", () => {
    const first = playMatch({ seats: chart(2), hands: 20, seed: 4 });
    const second = playMatch({ seats: chart(2), hands: 20, seed: 4 });
    expect(second).toEqual(first);
    expect(first.net.reduce((sum, chips) => sum + chips, 0)).toBe(0);
    expect(first.buttons).toEqual([10, 10]);
    expect(first.fallbacks).toEqual([0, 0]);
    expect(playMatch({ seats: chart(2), hands: 20, seed: 5 }).net).not.toEqual(first.net);
  });

  it("puts the same stack back before the next hand", () => {
    const seen: number[] = [];
    const opened = new Set<string>();
    const watch = (view: PublicView) => {
      const seat = view.toAct;
      if (seat === null) throw new Error("No seat is to act.");
      const key = `${view.handNumber}:${seat}`;
      if (view.street === "preflop" && !opened.has(key)) {
        opened.add(key);
        const mine = view.seats[seat]!;
        seen.push(mine.stack + mine.streetCommitted);
      }
      const allIn = view.validActions.find((item) => item.action === "all_in");
      if (allIn && allIn.action === "all_in") return { action: "all_in" as const, amount: allIn.amount, reason: "All-in." };
      return fold(view);
    };
    playMatch({
      seats: [
        { name: "Ada", policy: watch },
        { name: "Bo", policy: watch },
      ],
      hands: 12,
      stack: 200,
      seed: 3,
    });
    expect(seen.length).toBeGreaterThan(12);
    expect(seen.every((stack) => stack === 200)).toBe(true);
  });

  it("shows a seat only its own cards", () => {
    const peek: Policy = (view) => {
      if (!("toAct" in view) || view.toAct === null) throw new Error("The view has no actor.");
      for (const seat of view.seats) {
        if (seat.seat !== view.toAct && Array.isArray(seat.hole)) throw new Error("Another seat's cards were visible.");
      }
      if ("deck" in view) throw new Error("The deck was on the view.");
      const mine = view.seats[view.toAct]!.hole;
      if (!Array.isArray(mine) || mine.length !== 2) throw new Error("The actor could not see two cards.");
      return simplePolicy(view);
    };
    const report = playMatch({
      seats: [
        { name: "Ada", policy: peek },
        { name: "Bo", policy: peek },
      ],
      hands: 6,
      seed: 2,
    });
    expect(report.fallbacks).toEqual([0, 0]);
  });

  it("checks or folds when the policy returns nothing legal", () => {
    const broken: Policy = () => {
      throw new Error("no decision");
    };
    const report = playMatch({
      seats: [
        { name: "Ada", policy: broken },
        { name: "Bo", policy: simplePolicy },
      ],
      hands: 8,
      seed: 1,
    });
    expect(report.fallbacks[0]).toBeGreaterThan(0);
    expect(report.fallbacks[1]).toBe(0);
    expect(report.net.reduce((sum, chips) => sum + chips, 0)).toBe(0);
  });

  it("loses with a policy that always folds", () => {
    const report = playMatch({
      seats: [
        { name: "Folder", policy: fold },
        { name: "Chart", policy: simplePolicy },
      ],
      hands: 40,
      seed: 9,
    });
    expect(report.net[0]).toBeLessThan(0);
    expect(report.bb100[0]).toBeLessThan(0);
    expect(report.net[0]! + report.net[1]!).toBe(0);
  });

  it("asks for a full table and a stack that can post", () => {
    expect(() => playMatch({ seats: chart(1), hands: 1 })).toThrow(/two to eight/i);
    expect(() => playMatch({ seats: chart(2), hands: 0 })).toThrow(/hands/i);
    expect(() => playMatch({ seats: chart(2), hands: 1, stack: 1, bigBlind: 2 })).toThrow(/big blind/i);
  });

  it("does not read or write a room", () => {
    const source = readFileSync(new URL("./train.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from ["']\.\/rooms["']/);
    expect(source).not.toMatch(/node:fs/);
  });
});

function chart(count: number): TrainSeat[] {
  return Array.from({ length: count }, (_, seat) => ({ name: `Seat ${seat + 1}`, policy: simplePolicy }));
}

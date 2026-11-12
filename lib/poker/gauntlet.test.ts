import { describe, expect, it } from "vitest";
import { runGauntletSeed, summarizeGauntlet, validatePlan, type GauntletPlan, type GauntletRow } from "./gauntlet";
import { TABLE_BOT_OPTIONS, V1_OPTIONS } from "./live-bot";

function plan(overrides: Partial<GauntletPlan> = {}): GauntletPlan {
  return {
    version: 1,
    id: "test",
    candidate: { id: "table", options: { ...TABLE_BOT_OPTIONS, samples: 8, riverSamples: 4 } },
    champion: { id: "v1", options: { ...V1_OPTIONS, samples: 8, riverSamples: 4 } },
    league: [{ id: "v1", options: { ...V1_OPTIONS, samples: 8, riverSamples: 4 } }],
    fields: [
      { id: "loose", role: "primary", opponents: ["maniac", "station"] },
      { id: "league", role: "guardrail", opponents: ["league:v1"] },
    ],
    gates: { primaryLowerBound: 0, guardrailLowerBound: -10, maxMsPerHand: 10_000 },
    seeds: [11, 12],
    hands: 3,
    stack: 200,
    smallBlind: 1,
    bigBlind: 2,
    ...overrides,
  };
}

describe("validatePlan", () => {
  it("accepts a well-formed plan and rejects broken ones", () => {
    expect(() => validatePlan(plan())).not.toThrow();
    expect(() => validatePlan(plan({ candidate: { id: "v1", options: {} } }))).toThrow(/distinct/);
    expect(() => validatePlan(plan({ fields: [{ id: "x", role: "primary", opponents: ["league:nobody"] }] }))).toThrow(/Unknown league bot/);
    expect(() => validatePlan(plan({ fields: [{ id: "x", role: "report", opponents: ["station"] }] }))).toThrow(/primary/);
    expect(() => validatePlan(plan({ seeds: [5, 5] }))).toThrow(/distinct/);
  });
});

describe("runGauntletSeed", () => {
  it("plays every field, rotation and arm on identical deals", () => {
    const rows = runGauntletSeed(plan(), 11);
    expect(rows).toHaveLength(3 * 2 + 2 * 2);
    for (const row of rows) {
      expect(Number.isFinite(row.adjustedBb)).toBe(true);
      expect(row.hands).toBe(3);
    }
  }, 120_000);

  it("scores identical bots as identical, so differences come from decisions", () => {
    const same = plan({ candidate: { id: "copy", options: plan().champion.options } });
    const rows = runGauntletSeed(same, 11);
    for (const field of ["loose", "league"]) {
      const total = (arm: string) => rows.filter((r) => r.field === field && r.arm === arm).reduce((n, r) => n + r.adjustedBb, 0);
      expect(total("candidate")).toBe(total("champion"));
    }
  }, 120_000);

  it("removes all-in luck: adjusted and raw results differ once someone is all in", () => {
    const rows = runGauntletSeed(plan({ fields: [{ id: "loose", role: "primary", opponents: ["maniac", "maniac", "station"] }], hands: 12 }), 12);
    expect(rows.some((r) => r.adjustedBb !== r.rawBb)).toBe(true);
  }, 120_000);
});

describe("summarizeGauntlet", () => {
  const rows = (diffBb: number, noise: number[]): GauntletRow[] =>
    [11, 12].flatMap((seed, s) =>
      ["loose", "league"].flatMap((field) =>
        Array.from({ length: field === "loose" ? 3 : 2 }, (_, rotation) =>
          (["candidate", "champion"] as const).map((arm) => {
            const bb = arm === "candidate" ? diffBb + noise[s]! : 0;
            return { seed, field, rotation, arm, rawBb: bb, adjustedBb: bb, hands: 100, ms: 100 };
          }),
        ).flat(),
      ),
    );

  it("promotes a clear winner and reports why a loser is held back", () => {
    const win = summarizeGauntlet(plan(), rows(5, [0, 1]));
    expect(win.fields.loose!.difference.meanBb100).toBeCloseTo(5.5);
    expect(win.decision.promote).toBe(true);
    const lose = summarizeGauntlet(plan(), rows(-5, [0, 1]));
    expect(lose.decision.promote).toBe(false);
    expect(lose.decision.reasons.join(" ")).toMatch(/loose: lower bound/);
  });

  it("holds back a candidate that is too slow", () => {
    const slow = summarizeGauntlet(plan({ gates: { primaryLowerBound: 0, guardrailLowerBound: -10, maxMsPerHand: 0.5 } }), rows(5, [0, 1]));
    expect(slow.decision.reasons.join(" ")).toMatch(/ms per hand/);
  });

  it("refuses incomplete results", () => {
    expect(() => summarizeGauntlet(plan(), rows(5, [0, 1]).slice(1))).toThrow(/missing/);
  });
});

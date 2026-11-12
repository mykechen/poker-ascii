import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdaptivePolicy } from "./adaptive";
import { readBotAction, type Policy } from "./bot";
import { shuffleDeck } from "./cards";
import { apply, createTable } from "./engine";
import { decideTableBot, HandReplayError, liveBotAction, nextOpening, replayHand, TABLE_BOT_OPTIONS } from "./live-bot";
import { strategyById, type StrategyId } from "./strategies";
import { mulberry32, playMatch } from "./train";
import type { TableState } from "./types";
import { projectForPlayer } from "./view";

const FIELD: StrategyId[] = ["maniac", "aggressor", "station", "chart", "position", "tight"];

function seatedTable(players: number, stack = 200): TableState {
  let table = createTable();
  table = apply(table, { type: "setBlinds", smallBlind: 1, bigBlind: 2 });
  for (let seat = 0; seat < players; seat++) table = apply(table, { type: "sit", seat, name: `P${seat}`, stack });
  return table;
}

/**
 * Plays hands the way the training harness does, with one long-lived table bot in seat 0 that
 * observes every step. Calls `check` at each seat-0 decision with the hand's opening.
 */
function playWithTableBot(
  hands: number,
  seed: number,
  check: (opening: TableState, state: TableState, longLived: Policy) => void,
  everyStep?: (opening: TableState, state: TableState) => void,
) {
  const rng = mulberry32(seed);
  const { policy: bot } = createAdaptivePolicy(TABLE_BOT_OPTIONS);
  const policies: Policy[] = [bot, ...FIELD.map((id) => strategyById(id).policy)];
  bot.startSession?.(policies.map((_, index) => `seat-${index}`));
  let table = seatedTable(policies.length);
  for (let hand = 0; hand < hands; hand++) {
    for (let seat = 0; seat < policies.length; seat++) {
      if (table.seats[seat]!.stack === 0) table = apply(table, { type: "addChips", seat, amount: 200 });
    }
    const opening = apply(table, { type: "startHand", deck: shuffleDeck(rng) });
    expect(opening.error).toBeNull();
    let state = opening;
    while (state.phase === "betting" && state.toAct !== null) {
      everyStep?.(opening, state);
      const seat = state.toAct;
      if (seat === 0) check(opening, state, bot);
      const decision = readBotAction(projectForPlayer(state, seat), policies[seat]!);
      if (!decision) throw new Error(`Seat ${seat} returned no legal action.`);
      const next = apply(state, { type: "act", seat, action: decision.action, amount: decision.amount });
      expect(next.error).toBeNull();
      bot.observe?.(projectForPlayer(state, 0), projectForPlayer(next, 0));
      state = next;
    }
    table = state;
  }
}

describe("replayHand", () => {
  it("rebuilds every step of real hands, including raises, all-ins and a trimmed log", () => {
    let steps = 0;
    playWithTableBot(
      40,
      7,
      () => {},
      (opening, state) => {
        const states = replayHand(opening, state);
        expect(states.at(-1)!.log).toEqual(state.log.slice(-states.at(-1)!.log.length));
        steps++;
      },
    );
    expect(steps).toBeGreaterThan(200);
  }, 120_000);

  it("rejects an opening from another hand", () => {
    const table = apply(seatedTable(3), { type: "startHand" });
    const later = apply(apply(apply(table, { type: "act", seat: table.toAct!, action: "fold" }), { type: "act", seat: 1, action: "fold" }), {
      type: "startHand",
    });
    expect(() => replayHand(table, later)).toThrow(HandReplayError);
  });
});

describe("decideTableBot", () => {
  it("makes the same decision as a long-lived bot fed by the training harness", () => {
    let compared = 0;
    playWithTableBot(30, 11, (opening, state, longLived) => {
      const expected = readBotAction(projectForPlayer(state, 0), longLived);
      expect(decideTableBot(opening, state, 0)).toEqual(expected);
      compared++;
    });
    expect(compared).toBeGreaterThan(20);
  }, 120_000);
});

describe("liveBotAction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("plays the table bot with an opening and the chart without one", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const opening = apply(seatedTable(3), { type: "startHand" });
    const seat = opening.toAct!;
    expect(liveBotAction(opening, opening, seat)!.reason).toMatch(/^Equity /);
    expect(liveBotAction(null, opening, seat)!.reason).not.toMatch(/^Equity /);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("falls back to the chart when the opening does not replay", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const opening = apply(seatedTable(3), { type: "startHand" });
    const seat = opening.toAct!;
    const tampered = structuredClone(opening);
    tampered.toAct = (seat + 1) % 3;
    const decision = liveBotAction(tampered, opening, seat);
    expect(decision!.reason).not.toMatch(/^Equity /);
    expect(console.error).toHaveBeenCalledOnce();
  });
});

describe("nextOpening", () => {
  it("records the deal and keeps it through the hand", () => {
    const table = seatedTable(3);
    const dealt = apply(table, { type: "startHand" });
    expect(nextOpening(null, table, dealt)).toBe(dealt);
    const acted = apply(dealt, { type: "act", seat: dealt.toAct!, action: "fold" });
    expect(nextOpening(dealt, dealt, acted)).toBe(dealt);
  });
});

describe("table bot river search", () => {
  it("survives multiway river shoves whose defending hands collide", () => {
    // Seed 990101 against this field once dealt every opponent's thin calling range from
    // the same few nut combos, which left no collision-free deal and threw.
    const opponents: StrategyId[] = ["equity-defender", "equity-pressure", "chart", "tight", "position"];
    const seats = [
      { name: "hero", policy: createAdaptivePolicy(TABLE_BOT_OPTIONS).policy },
      ...opponents.map((id, i) => ({ name: `opp-${i}`, policy: strategyById(id).policy })),
    ];
    const report = playMatch({ seats, seed: 990101, hands: 3, stack: 200, smallBlind: 1, bigBlind: 2, invalidAction: "throw" });
    expect(report.net.reduce((a, b) => a + b, 0)).toBe(0);
  }, 120_000);
});

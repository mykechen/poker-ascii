import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readBotAction, simplePolicy, type Policy } from "./bot";
import { freshDeck } from "./cards";
import { apply, createTable } from "./engine";
import type { Card, Command, LegalAction, TableState } from "./types";
import { projectForPlayer, type PublicView, type RaisePresets } from "./view";

function deal(commands: Command[]): TableState {
  return commands.reduce(apply, createTable());
}

function pad(deck: Card[]): Card[] {
  const used = new Set(deck);
  return [...deck, ...freshDeck().filter((item) => !used.has(item))];
}

function headsUp(first: Card, second: Card, third: Card, fourth: Card): TableState {
  const seated = deal([
    { type: "setBlinds", smallBlind: 1, bigBlind: 2 },
    { type: "sit", seat: 0, name: "Ada", stack: 200 },
    { type: "sit", seat: 1, name: "Bo", stack: 200 },
    { type: "startHand", deck: pad([first, second, third, fourth]) },
  ]);
  return seated;
}

function spot(input: {
  hole: [Card, Card];
  board?: Card[];
  street: PublicView["street"];
  pot: number;
  bigBlind?: number;
  streetCommitted?: number;
  actions: LegalAction[];
  presets?: RaisePresets | null;
  logText?: string;
}): PublicView {
  const board = input.board ?? [];
  return {
    seats: [
      {
        seat: 0,
        occupied: true,
        name: "Ada",
        stack: 200,
        away: false,
        inHand: true,
        folded: false,
        allIn: false,
        streetCommitted: input.streetCommitted ?? 0,
        hole: input.hole,
        button: true,
        smallBlind: false,
        bigBlind: false,
        toAct: true,
        lastAction: null,
      },
      {
        seat: 1,
        occupied: true,
        name: "Bo",
        stack: 200,
        away: false,
        inHand: true,
        folded: false,
        allIn: false,
        streetCommitted: 0,
        hole: "down",
        button: false,
        smallBlind: false,
        bigBlind: false,
        toAct: false,
        lastAction: null,
      },
    ],
    board,
    pot: input.pot,
    pots: [{ name: "POT", amount: input.pot }],
    street: input.street,
    phase: "betting",
    handNumber: 1,
    smallBlind: 1,
    bigBlind: input.bigBlind ?? 2,
    toAct: 0,
    actorName: "Ada",
    validActions: input.actions,
    presets: input.presets ?? null,
    log: [
      {
        seat: 1,
        name: "Bo",
        action: "bet",
        amount: 2,
        raiseTo: 2,
        street: input.street,
        stackAfter: 198,
        potAfter: input.pot,
        text: input.logText ?? "Bo bets 2",
      },
    ],
    result: null,
    error: null,
    revealRequired: false,
  };
}

const free = [
  { action: "check" as const },
  { action: "raise" as const, min: 2, max: 200 },
  { action: "all_in" as const, amount: 200 },
];
const freePresets: RaisePresets = { min: 2, half: 5, pot: 10, allIn: 200 };

describe("simple policy", () => {
  it("folds trash, raises premiums, and calls a small playable price", () => {
    expect(simplePolicy(projectForPlayer(headsUp("7c", "Ah", "2d", "Kd"), 0)).reason).toBe("Trash hand. Fold.");
    const premium = simplePolicy(projectForPlayer(headsUp("As", "7c", "Ah", "2d"), 0));
    expect(premium).toMatchObject({ action: "raise", reason: "Premium hand. Raise pot." });
    expect(simplePolicy(projectForPlayer(headsUp("9c", "7c", "9d", "2d"), 0)).reason).toBe("Strong hand. Raise the minimum.");
    expect(simplePolicy(projectForPlayer(headsUp("6c", "Ah", "6d", "Kd"), 0)).reason).toBe("Playable hand. Call a small price.");
    expect(simplePolicy(projectForPlayer(headsUp("7h", "Ah", "2h", "Kd"), 0)).reason).toBe("Playable hand. Call a small price.");
  });

  it("raises a premium in the big blind instead of taking a free check", () => {
    let state = headsUp("7c", "As", "2d", "Ah");
    state = apply(state, { type: "act", seat: 0, action: "call" });
    const decision = simplePolicy(projectForPlayer(state, 1));
    expect(decision.reason).toBe("Premium hand. Raise pot.");
    expect(apply(state, { type: "act", seat: 1, action: decision.action, amount: decision.amount }).error).toBeNull();
  });

  it("prices made hands and draws from the pot, and ignores gutshots", () => {
    expect(simplePolicy(spot({ hole: ["9h", "2c"], board: ["9d", "4c", "8s"], street: "flop", pot: 10, actions: facing(2), presets: null })).reason).toBe(
      "One pair. Call a small bet.",
    );
    expect(simplePolicy(spot({ hole: ["9h", "2c"], board: ["9d", "4c", "8s"], street: "flop", pot: 10, actions: facing(4) })).reason).toBe(
      "One pair. Fold to the large bet.",
    );
    expect(simplePolicy(spot({ hole: ["Ah", "5d"], board: ["2h", "7h", "9h"], street: "flop", pot: 30, actions: facing(10) })).reason).toBe("Draw. Call.");
    expect(simplePolicy(spot({ hole: ["Ah", "5d"], board: ["2h", "7h", "9h"], street: "flop", pot: 30, actions: facing(11) })).reason).toBe(
      "Draw. The price is too high.",
    );
    expect(simplePolicy(spot({ hole: ["As", "2d"], board: ["9h", "9d", "2c"], street: "flop", pot: 20, actions: facing(9) })).reason).toBe(
      "Two pair or three of a kind. Call.",
    );
    expect(simplePolicy(spot({ hole: ["6h", "5d"], board: ["4c", "3s", "2d"], street: "flop", pot: 8, actions: free, presets: freePresets })).reason).toBe(
      "Straight or better. Bet the pot.",
    );
    expect(simplePolicy(spot({ hole: ["Jh", "6c"], board: ["9h", "8d", "2c"], street: "flop", pot: 8, actions: facing(4) })).reason).toBe("No pair. Fold.");
    expect(simplePolicy(spot({ hole: ["Th", "7c"], board: ["9h", "8d", "2c"], street: "flop", pot: 8, actions: free, presets: freePresets })).reason).toBe(
      "Draw. Check.",
    );
  });

  it("plays the board and a board pair as nothing of its own", () => {
    const river = ["Ah", "Kh", "Qh", "Jh", "Th"] as Card[];
    expect(simplePolicy(spot({ hole: ["2c", "3d"], board: river, street: "river", pot: 20, actions: facing(10) })).reason).toBe("Playing the board. Fold.");
    expect(simplePolicy(spot({ hole: ["As", "Kd"], board: ["9h", "9d", "2c"], street: "flop", pot: 8, actions: free, presets: freePresets })).reason).toBe(
      "No pair. Check.",
    );
  });

  it("sends all-in when the chosen size is the published all-in", () => {
    const decision = simplePolicy(
      spot({
        hole: ["As", "Ah"],
        street: "preflop",
        pot: 3,
        streetCommitted: 1,
        actions: [
          { action: "fold" },
          { action: "call", amount: 1 },
          { action: "raise", min: 4, max: 50 },
          { action: "all_in", amount: 50 },
        ],
        presets: { min: 4, half: 6, pot: 50, allIn: 50 },
      }),
    );
    expect(decision).toEqual({ action: "all_in", amount: 50, reason: "Premium hand. All-in." });
  });

  it("stays inside the menu, and ignores a size the menu did not publish", () => {
    const view = projectForPlayer(headsUp("As", "7c", "Ah", "2d"), 0);
    const decision = readBotAction(view)!;
    const next = apply(createFrom(view), { type: "act", seat: 0, action: decision.action, amount: decision.amount });
    expect(next.error).toBeNull();
    const illegal: Policy = () => ({ action: "raise", amount: 9_999_999, reason: "Too many." });
    expect(readBotAction(view, illegal)).toBeNull();
    expect(readBotAction(view, () => { throw new Error("boom"); })).toBeNull();
    expect(readBotAction(view, () => ({ action: "fold", reason: "x\ny" }))).toBeNull();
  });

  it("decides from the projected view when the hidden cards change", () => {
    const aces = projectForPlayer(headsUp("7c", "As", "2d", "Ah"), 0);
    const kings = projectForPlayer(headsUp("7c", "Ks", "2d", "Kd"), 0);
    expect(aces.seats[1]!.hole).toBe("down");
    expect(JSON.stringify(aces)).not.toContain("As");
    expect(JSON.stringify(kings)).not.toContain("Ks");
    expect(simplePolicy(aces)).toEqual(simplePolicy(kings));
    const renamed = { ...aces, log: aces.log.map((entry) => ({ ...entry, text: "Someone else bets 9" })), seats: aces.seats.map((seat) => ({ ...seat, name: "Renamed" })) };
    expect(simplePolicy(renamed)).toEqual(simplePolicy(aces));
  });

  it("does not import the engine or the room store", () => {
    const source = readFileSync(new URL("./bot.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from ["']\.\/(engine|rooms)["']/);
  });
});

function facing(amount: number): LegalAction[] {
  return [
    { action: "fold" },
    { action: "call", amount },
    { action: "raise", min: amount * 2, max: 200 },
    { action: "all_in", amount: 200 },
  ];
}

function createFrom(view: PublicView): TableState {
  return headsUp(view.seats[0]!.hole && view.seats[0]!.hole !== "down" ? view.seats[0]!.hole[0]! : "As", "7c", view.seats[0]!.hole && view.seats[0]!.hole !== "down" ? view.seats[0]!.hole[1]! : "Ah", "2d");
}

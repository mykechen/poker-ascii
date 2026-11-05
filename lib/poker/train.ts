import { readBotAction, type Policy } from "./bot";
import { shuffleDeck } from "./cards";
import { apply, createTable, legalActions } from "./engine";
import { SEAT_COUNT, type TableState } from "./types";
import { projectForPlayer } from "./view";

const DEFAULT_STACK = 200;
const DEFAULT_SMALL_BLIND = 1;
const DEFAULT_BIG_BLIND = 2;
const DEFAULT_SEED = 1;
const MAX_HANDS = 100_000;
const MAX_ACTIONS = 400;

export type TrainSeat = {
  /** 1 to 16 characters, the same limit as a seat at the table. */
  name: string;
  policy: Policy;
  policyFactory?: (random: () => number) => Policy;
};

export type TrainOptions = {
  /** Chairs 0, 1, 2, … in order. Two to eight. */
  seats: TrainSeat[];
  hands: number;
  /** Chips in front of every seat at the start of every hand. */
  stack?: number;
  smallBlind?: number;
  bigBlind?: number;
  /** Same seed deals the same cards. */
  seed?: number;
  /** Called after each finished hand with the chips won so far. */
  invalidAction?: "throw" | "fallback";
  onHand?: (finished: number, net: number[]) => void;
};

export type TrainReport = {
  hands: number;
  seats: number;
  stack: number;
  smallBlind: number;
  bigBlind: number;
  seed: number;
  names: string[];
  /** Chips won, summed over every hand. */
  net: number[];
  /** net / bigBlind / hands * 100. */
  bb100: number[];
  /** Hands in which this chair had the button. */
  buttons: number[];
  /** Turns this chair faced. */
  decisions: number[];
  /** Turns where the policy returned nothing legal, so the seat checked or folded. */
  fallbacks: number[];
};

/**
 * Play a batch of hands through apply().
 * Each seat sees only projectForPlayer for its own chair.
 * Stacks return to the starting amount before the next hand, and the button moves.
 */
export function playMatch(options: TrainOptions): TrainReport {
  const hands = options.hands;
  const stack = options.stack ?? DEFAULT_STACK;
  const smallBlind = options.smallBlind ?? DEFAULT_SMALL_BLIND;
  const bigBlind = options.bigBlind ?? DEFAULT_BIG_BLIND;
  const seed = options.seed ?? DEFAULT_SEED;
  const seats = options.seats.map((seat, index) => ({ ...seat, policy: seat.policyFactory?.(mulberry32((options.seed ?? DEFAULT_SEED) ^ Math.imul(index + 1, 0x9e3779b9))) ?? seat.policy }));
  if (!Number.isSafeInteger(hands) || hands < 1 || hands > MAX_HANDS) {
    throw new Error(`Play from 1 to ${MAX_HANDS} hands.`);
  }
  if (seats.length < 2 || seats.length > SEAT_COUNT) throw new Error("Seat two to eight players.");
  if (!Number.isSafeInteger(seed)) throw new Error("The seed must be a whole number.");
  if (!Number.isSafeInteger(stack) || stack < bigBlind) throw new Error("The stack must cover the big blind.");
  if (!Number.isSafeInteger(smallBlind) || !Number.isSafeInteger(bigBlind) || smallBlind < 1 || smallBlind > bigBlind) {
    throw new Error("Blinds must be whole chips, and the small blind cannot exceed the big blind.");
  }
  for (const seat of seats) {
    const name = seat.name.trim();
    if (name.length < 1 || name.length > 16) throw new Error("Use a name of 1 to 16 characters.");
  }

  startPolicySession(seats);
  const count = seats.length;
  const net = Array.from({ length: count }, () => 0);
  const buttons = Array.from({ length: count }, () => 0);
  const decisions = Array.from({ length: count }, () => 0);
  const fallbacks = Array.from({ length: count }, () => 0);
  const rng = mulberry32(seed);

  let table = createTable();
  table = apply(table, { type: "setBlinds", smallBlind, bigBlind });
  if (table.error) throw new Error(table.error);
  for (let seat = 0; seat < count; seat++) {
    table = apply(table, { type: "sit", seat, name: seats[seat]!.name.trim(), stack });
    if (table.error) throw new Error(table.error);
  }

  for (let finished = 1; finished <= hands; finished++) {
    table = restore(table, count, stack);
    const before = stacks(table, count);
    table = apply(table, { type: "startHand", deck: shuffleDeck(rng) });
    if (table.error) throw new Error(table.error);
    const button = table.button;
    if (button !== null && button < count) buttons[button] += 1;
    table = playHand(table, seats, decisions, fallbacks, options.invalidAction ?? "fallback", seed);
    const after = stacks(table, count);
    for (let seat = 0; seat < count; seat++) net[seat] += after[seat]! - before[seat]!;
    options.onHand?.(finished, [...net]);
  }

  return {
    hands,
    seats: count,
    stack,
    smallBlind,
    bigBlind,
    seed,
    names: seats.map((seat) => seat.name.trim()),
    net,
    bb100: net.map((chips) => (chips / bigBlind / hands) * 100),
    buttons,
    decisions,
    fallbacks,
  };
}

export function formatReport(report: TrainReport): string {
  const title = `${report.hands} hands, ${report.seats} seats, blinds ${report.smallBlind}/${report.bigBlind}, stack ${report.stack}, seed ${report.seed}`;
  const head = "seat  name              bb/100     net  buttons  fallbacks";
  const rows = report.names.map((name, seat) => {
    const score = report.bb100[seat] ?? 0;
    const chips = report.net[seat] ?? 0;
    return [
      String(seat).padStart(4),
      name.padEnd(16),
      signed(score, 1).padStart(7),
      signed(chips, 0).padStart(7),
      String(report.buttons[seat] ?? 0).padStart(8),
      String(report.fallbacks[seat] ?? 0).padStart(10),
    ].join("  ");
  });
  return [title, "", head, ...rows].join("\n");
}

export function playHand(table: TableState, seats: TrainSeat[], decisions: number[], fallbacks: number[], invalidAction: "throw" | "fallback" = "throw", seed = 1): TableState {
  let state = table;
  for (let step = 0; step < MAX_ACTIONS && state.phase === "betting" && state.toAct !== null; step++) {
    const seat = state.toAct;
    const policy = seats[seat]?.policy;
    if (!policy) throw new Error("An empty chair was asked to act.");
    decisions[seat] = (decisions[seat] ?? 0) + 1;
    const decision = readBotAction(projectForPlayer(state, seat), policy);
    if (decision) {
      const next = apply(state, { type: "act", seat, action: decision.action, amount: decision.amount });
      if (next.error) throw new Error(next.error);
      observePolicies(seats, state, next);
      state = next;
      continue;
    }
    if (invalidAction === "throw") throw new Error(`Invalid policy action: seed ${seed}, hand ${state.handNumber}, seat ${seat}, street ${state.street}, log ${state.log.length}.`);
    fallbacks[seat] = (fallbacks[seat] ?? 0) + 1;
    const offered = legalActions(state);
    const action = offered.some((item) => item.action === "check")
      ? "check"
      : offered.some((item) => item.action === "fold")
        ? "fold"
        : null;
    if (action === null) throw new Error("The seat had no check or fold.");
    const next = apply(state, { type: "act", seat, action });
    if (next.error) throw new Error(next.error);
    observePolicies(seats, state, next);
    state = next;
  }
  if (state.phase !== "complete") throw new Error("The hand did not finish.");
  return state;
}

/** Winners give chips back and losers are topped up, so the next hand starts even. */
function restore(table: TableState, count: number, stack: number): TableState {
  let state = table;
  for (let seat = 0; seat < count; seat++) {
    const have = state.seats[seat]!.stack;
    if (have === stack) continue;
    const name = state.seats[seat]!.name ?? "Player";
    if (have > stack) {
      state = apply(state, { type: "leave", seat });
      if (state.error) throw new Error(state.error);
      state = apply(state, { type: "sit", seat, name, stack });
    } else {
      state = apply(state, { type: "addChips", seat, amount: stack - have });
    }
    if (state.error) throw new Error(state.error);
  }
  return state;
}

function stacks(table: TableState, count: number): number[] {
  return Array.from({ length: count }, (_, seat) => table.seats[seat]!.stack);
}

function signed(value: number, digits: number): string {
  const text = value.toFixed(digits);
  return value > 0 ? `+${text}` : text;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let sessionSerial = 0;
export function startPolicySession(seats: TrainSeat[]): void {
  const ids=seats.map((_,seat)=>`session-${sessionSerial}:${seat}`);
  sessionSerial++;
  for(const player of seats) player.policy.startSession?.([...ids]);
}

function observePolicies(seats: TrainSeat[], before: TableState, after: TableState): void {
  seats.forEach((player,seat)=>player.policy.observe?.(projectForPlayer(before,seat),projectForPlayer(after,seat)));
}

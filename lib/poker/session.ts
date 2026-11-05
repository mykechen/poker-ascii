import { apply, createTable } from "./engine";
import { shuffleDeck } from "./cards";
import { mulberry32, playHand, startPolicySession, type TrainOptions } from "./train";

export type SessionOptions = Omit<TrainOptions, "onHand" | "invalidAction">;
export type SessionReport = {
  mode: "persistent";
  seed: number;
  hands: number;
  names: string[];
  finalStacks: number[];
  net: number[];
  handsDealt: number[];
  eliminatedAt: (number | null)[];
};

export function playSession(options: SessionOptions): SessionReport {
  const { hands, seats } = options;
  const seed = options.seed ?? 1;
  const bigBlind = options.bigBlind ?? 2;
  const stack = options.stack ?? 100 * bigBlind;
  if (!Number.isSafeInteger(hands) || hands < 1 || hands > 100_000) throw new Error("Hands must be from 1 to 100000.");
  if (seats.length < 2 || seats.length > 8) throw new Error("Seat two to eight players.");
  if (!Number.isSafeInteger(seed)) throw new Error("Seed must be an integer.");
  const policies = seats.map((seat, i) => ({ ...seat, policy: seat.policyFactory?.(mulberry32(seed ^ Math.imul(i + 1, 0x9e3779b9))) ?? seat.policy }));
  let state = apply(createTable(), { type: "setBlinds", smallBlind: options.smallBlind ?? 1, bigBlind });
  if (state.error) throw new Error(state.error);
  if (!Number.isSafeInteger(stack) || stack < bigBlind) throw new Error("Stack must cover the big blind.");
  for (const [seat, player] of seats.entries()) {
    state = apply(state, { type: "sit", seat, name: player.name, stack });
    if (state.error) throw new Error(state.error);
  }
  startPolicySession(policies);
  const random = mulberry32(seed);
  const handsDealt = seats.map(() => 0);
  const eliminatedAt: (number | null)[] = seats.map(() => null);
  const decisions = seats.map(() => 0);
  const fallbacks = seats.map(() => 0);
  let finished = 0;
  while (finished < hands && state.seats.filter(s => s.name !== null && s.stack > 0).length >= 2) {
    state = apply(state, { type: "startHand", deck: shuffleDeck(random) });
    if (state.error) throw new Error(state.error);
    for (let i = 0; i < seats.length; i++) if (state.seats[i]!.inHand) handsDealt[i]++;
    state = playHand(state, policies, decisions, fallbacks, "throw", seed);
    finished++;
    for (let i = 0; i < seats.length; i++) if (state.seats[i]!.stack === 0 && eliminatedAt[i] === null) eliminatedAt[i] = finished;
  }
  const finalStacks = seats.map((_, i) => state.seats[i]!.stack);
  return { mode: "persistent", seed, hands: finished, names: seats.map(s => s.name), finalStacks, net: finalStacks.map(n => n - stack), handsDealt, eliminatedAt };
}

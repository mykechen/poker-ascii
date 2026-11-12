import { createAdaptivePolicy } from "./adaptive";
import type { Policy } from "./bot";
import { adjustedPayout, type AllInPoint } from "./evaluation/all-in";
import { describePots } from "./pots";
import { strategyById, type StrategyId } from "./strategies";
import { playMatch, type EvaluationEvent } from "./train";

/**
 * The gauntlet: a candidate bot and the current champion play the same deals, lineups and
 * seat rotations in several fields, so their difference comes from decisions, not cards.
 * A field's opponents are strategy ids or "league:<bot id>" for a past champion.
 */
export type BotOptions = NonNullable<Parameters<typeof createAdaptivePolicy>[0]>;
export type BotSpec = { id: string; options: BotOptions };
export type FieldRole = "primary" | "guardrail" | "report";
export type GauntletField = { id: string; role: FieldRole; opponents: string[] };
/**
 * A candidate is promoted only if every primary field's 95% CI lower bound (candidate minus
 * champion, all-in adjusted bb/100) exceeds `primaryLowerBound`, every guardrail field's
 * exceeds `guardrailLowerBound`, and its time per hand stays within `maxMsPerHand`.
 */
export type GauntletGates = { primaryLowerBound: number; guardrailLowerBound: number; maxMsPerHand: number };
export type GauntletPlan = {
  version: 1;
  id: string;
  candidate: BotSpec;
  champion: BotSpec;
  league: BotSpec[];
  fields: GauntletField[];
  gates: GauntletGates;
  seeds: number[];
  hands: number;
  stack: number;
  smallBlind: number;
  bigBlind: number;
};
export type Arm = "candidate" | "champion";
export type GauntletRow = { seed: number; field: string; rotation: number; arm: Arm; rawBb: number; adjustedBb: number; hands: number; ms: number };

const LEAGUE = "league:";

export function validatePlan(plan: GauntletPlan): void {
  if (plan.version !== 1 || !plan.id) throw new Error("A gauntlet plan needs version 1 and an id.");
  const bots = [plan.candidate, plan.champion, ...plan.league];
  if (bots.some((bot) => !bot.id) || plan.candidate.id === plan.champion.id) throw new Error("Candidate and champion need distinct ids.");
  if (new Set(plan.league.map((bot) => bot.id)).size !== plan.league.length) throw new Error("League bot ids must be unique.");
  if (!plan.fields.length || new Set(plan.fields.map((field) => field.id)).size !== plan.fields.length) throw new Error("Fields need unique ids.");
  if (!plan.fields.some((field) => field.role === "primary")) throw new Error("At least one field must be primary.");
  for (const field of plan.fields) {
    if (!["primary", "guardrail", "report"].includes(field.role)) throw new Error(`Field ${field.id} has an unknown role.`);
    if (field.opponents.length < 1 || field.opponents.length > 7) throw new Error(`Field ${field.id} needs one to seven opponents.`);
    field.opponents.forEach((id) => opponentPolicy(plan, id));
  }
  const { primaryLowerBound, guardrailLowerBound, maxMsPerHand } = plan.gates;
  if (![primaryLowerBound, guardrailLowerBound].every(Number.isFinite) || !(maxMsPerHand > 0)) throw new Error("Gates need finite bounds and a positive time budget.");
  if (plan.seeds.length < 2 || new Set(plan.seeds).size !== plan.seeds.length || !plan.seeds.every((s) => Number.isSafeInteger(s) && s > 0)) {
    throw new Error("Provide at least two distinct positive integer seeds.");
  }
  if (!Number.isSafeInteger(plan.hands) || plan.hands < 1 || plan.hands > 10000) throw new Error("Hands per match must be 1 to 10000.");
  if (!Number.isSafeInteger(plan.smallBlind) || !Number.isSafeInteger(plan.bigBlind) || plan.smallBlind < 1 || plan.smallBlind > plan.bigBlind) throw new Error("Invalid blinds.");
  if (!Number.isSafeInteger(plan.stack) || plan.stack < plan.bigBlind) throw new Error("The stack must cover the big blind.");
}

function botPolicy(bot: BotSpec): Policy {
  return createAdaptivePolicy(bot.options).policy;
}

function opponentPolicy(plan: GauntletPlan, id: string): Policy {
  if (!id.startsWith(LEAGUE)) return strategyById(id as StrategyId).policy;
  const bot = plan.league.find((item) => item.id === id.slice(LEAGUE.length));
  if (!bot) throw new Error(`Unknown league bot ${id}.`);
  return botPolicy(bot);
}

/** Every (field, rotation, arm) match for one seed. Whole seeds stay in one process. */
export function runGauntletSeed(plan: GauntletPlan, seed: number): GauntletRow[] {
  validatePlan(plan);
  if (!plan.seeds.includes(seed)) throw new Error(`Seed ${seed} is not in plan ${plan.id}.`);
  const rows: GauntletRow[] = [];
  for (const field of plan.fields) {
    const players = field.opponents.length + 1;
    for (let rotation = 0; rotation < players; rotation++) {
      for (const arm of ["candidate", "champion"] as const) {
        rows.push(runMatch(plan, field, seed, rotation, arm));
      }
    }
  }
  return rows;
}

function runMatch(plan: GauntletPlan, field: GauntletField, seed: number, rotation: number, arm: Arm): GauntletRow {
  const players = field.opponents.length + 1;
  const hero = { name: "hero", policy: botPolicy(arm === "candidate" ? plan.candidate : plan.champion) };
  const lineup = [hero, ...field.opponents.map((id, i) => ({ name: `opp-${i}`, policy: opponentPolicy(plan, id) }))];
  const seats = lineup.map((_, seat) => lineup[(seat + rotation) % players]!);
  const heroSeat = seats.indexOf(hero);
  const tracker = allInTracker(heroSeat, plan.bigBlind);
  const started = performance.now();
  const report = playMatch({ seats, seed, hands: plan.hands, stack: plan.stack, smallBlind: plan.smallBlind, bigBlind: plan.bigBlind, invalidAction: "throw", onEvaluation: tracker.observe });
  if (report.fallbacks.some((n) => n !== 0) || report.net.reduce((a, b) => a + b, 0) !== 0) {
    throw new Error(`Legality or chip accounting failed: plan ${plan.id}, seed ${seed}, field ${field.id}, rotation ${rotation}, arm ${arm}.`);
  }
  if (tracker.hands() !== plan.hands) throw new Error(`Tracked ${tracker.hands()} of ${plan.hands} hands.`);
  return { seed, field: field.id, rotation, arm, rawBb: report.net[heroSeat]! / plan.bigBlind, adjustedBb: tracker.adjustedBb(), hands: plan.hands, ms: performance.now() - started };
}

/**
 * Hero's result per hand, with luck removed from all-in runouts: when no more betting is
 * possible before showdown, the hero is paid its exact average over every remaining board
 * instead of the board that came. Mirrors the frozen evaluation protocol's adjustment.
 */
function allInTracker(hero: number, bigBlind: number) {
  let adjusted = 0, hands = 0;
  let terminal: AllInPoint | null = null;
  const observe = (event: EvaluationEvent) => {
    if (event.kind === "deal") {
      terminal = null;
      return;
    }
    if (event.kind === "action") {
      const { before, after } = event;
      const runout = after.phase === "complete" && after.result?.showed === true && before.board.length < 5;
      if (runout) {
        terminal = {
          board: [...before.board],
          button: after.button ?? 0,
          players: after.seats.flatMap((s, seat) => (s.hole.length === 2 ? [{ seat, hole: [...s.hole], committed: s.handCommitted, folded: s.folded || !s.inHand, allIn: s.allIn }] : [])),
          pots: describePots(after.seats.map((s) => ({ committed: s.handCommitted, allIn: s.allIn }))),
          terminalChance: true,
        };
      }
      return;
    }
    const { state, beforeStacks } = event;
    const raw = state.seats[hero]!.stack - beforeStacks[hero]!;
    const point = terminal as AllInPoint | null;
    const contested = point?.players.find((p) => p.seat === hero);
    adjusted += contested && !contested.folded ? adjustedPayout(point!).payouts[hero]! - state.seats[hero]!.handCommitted : raw;
    hands++;
  };
  return { observe, adjustedBb: () => adjusted / bigBlind, hands: () => hands };
}

export type FieldSummary = {
  role: FieldRole;
  seeds: number;
  candidateBb100: number;
  championBb100: number;
  difference: { meanBb100: number; se: number; ci95: [number, number] };
  rawDifferenceBb100: number;
};
export type GauntletSummary = { plan: string; fields: Record<string, FieldSummary>; msPerHand: Record<Arm, number>; decision: { promote: boolean; reasons: string[] } };

/** Candidate minus champion per field, clustered by seed, and the gate decision. */
export function summarizeGauntlet(plan: GauntletPlan, rows: GauntletRow[]): GauntletSummary {
  validatePlan(plan);
  const fields: Record<string, FieldSummary> = {};
  for (const field of plan.fields) fields[field.id] = summarizeField(plan, field, rows.filter((row) => row.field === field.id));
  const msPerHand = { candidate: perHand(rows, "candidate"), champion: perHand(rows, "champion") };
  return { plan: plan.id, fields, msPerHand, decision: decide(plan, fields, msPerHand.candidate) };
}

function summarizeField(plan: GauntletPlan, field: GauntletField, rows: GauntletRow[]): FieldSummary {
  const players = field.opponents.length + 1;
  const bySeed = new Map<number, Record<Arm, { adjusted: number; raw: number; hands: number; matches: number }>>();
  for (const row of rows) {
    const entry = bySeed.get(row.seed) ?? { candidate: { adjusted: 0, raw: 0, hands: 0, matches: 0 }, champion: { adjusted: 0, raw: 0, hands: 0, matches: 0 } };
    const cell = entry[row.arm];
    cell.adjusted += row.adjustedBb; cell.raw += row.rawBb; cell.hands += row.hands; cell.matches++;
    bySeed.set(row.seed, entry);
  }
  const seeds = [...bySeed.keys()].sort((a, b) => a - b);
  if (JSON.stringify(seeds) !== JSON.stringify([...plan.seeds].sort((a, b) => a - b))) throw new Error(`Field ${field.id} is missing seeds.`);
  for (const seed of seeds) {
    const entry = bySeed.get(seed)!;
    if (entry.candidate.matches !== players || entry.champion.matches !== players) throw new Error(`Field ${field.id}, seed ${seed} is missing rotations.`);
  }
  const rate = (seed: number, arm: Arm, key: "adjusted" | "raw") => (bySeed.get(seed)![arm][key] / bySeed.get(seed)![arm].hands) * 100;
  const diffs = seeds.map((seed) => rate(seed, "candidate", "adjusted") - rate(seed, "champion", "adjusted"));
  const mean = average(diffs);
  const se = Math.sqrt(diffs.reduce((n, d) => n + (d - mean) ** 2, 0) / (diffs.length - 1) / diffs.length);
  return {
    role: field.role,
    seeds: seeds.length,
    candidateBb100: average(seeds.map((seed) => rate(seed, "candidate", "adjusted"))),
    championBb100: average(seeds.map((seed) => rate(seed, "champion", "adjusted"))),
    difference: { meanBb100: mean, se, ci95: [mean - 1.96 * se, mean + 1.96 * se] },
    rawDifferenceBb100: average(seeds.map((seed) => rate(seed, "candidate", "raw") - rate(seed, "champion", "raw"))),
  };
}

function decide(plan: GauntletPlan, fields: Record<string, FieldSummary>, candidateMsPerHand: number) {
  const reasons: string[] = [];
  for (const [id, field] of Object.entries(fields)) {
    const lower = field.difference.ci95[0];
    if (field.role === "primary" && !(lower > plan.gates.primaryLowerBound)) reasons.push(`${id}: lower bound ${lower.toFixed(1)} is not above ${plan.gates.primaryLowerBound}.`);
    if (field.role === "guardrail" && !(lower > plan.gates.guardrailLowerBound)) reasons.push(`${id}: lower bound ${lower.toFixed(1)} is not above ${plan.gates.guardrailLowerBound}.`);
  }
  if (candidateMsPerHand > plan.gates.maxMsPerHand) reasons.push(`${candidateMsPerHand.toFixed(0)} ms per hand exceeds ${plan.gates.maxMsPerHand}.`);
  return { promote: reasons.length === 0, reasons };
}

function perHand(rows: GauntletRow[], arm: Arm): number {
  const mine = rows.filter((row) => row.arm === arm);
  return mine.reduce((n, row) => n + row.ms, 0) / mine.reduce((n, row) => n + row.hands, 0);
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

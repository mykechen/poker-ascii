import { readBotAction, type Policy, type PolicyAction } from "./bot";
import { isCard } from "./cards";
import { compareScores, evaluate } from "./evaluator";
import { apply, createTable, legalActions } from "./engine";
import { uniformRange, type WeightedHand } from "./equity";
import { decisionContext } from "./hand-features";
import { actionProbabilities } from "./range-beliefs";
import { mulberry32 } from "./train";
import type { Card, TableState } from "./types";
import { projectForPlayer, type PublicView } from "./view";

export type RiverOptions = {
  samples?: number;
  riskPenalty?: number;
  seed?: number;
  rangeFor?: (seat: number) => WeightedHand[];
  styleFor?: (seat: number, cards: [Card, Card]) => number[];
  response?: Policy;
  /**
   * Facing a river bet, each simulated opponent continues with the strongest
   * rangeDefense x MDF share of its own range, where MDF = 1 - toCall / pot. Undefined keeps
   * baseline v1's response table, which barely tells a pot-sized bet from a 50x-pot shove.
   */
  rangeDefense?: number;
};

/** Each combo's share of its range that it beats on this board, ties counting half. */
export function rangePercentiles(range: WeightedHand[], board: Card[]): Map<string, number> {
  const scored = range
    .filter(h => h.weight > 0)
    .map(h => ({ key: comboKey(h.cards), weight: h.weight, score: evaluate([...board, ...h.cards]).score }))
    .sort((a, b) => compareScores(a.score, b.score));
  const total = scored.reduce((n, h) => n + h.weight, 0);
  if (!(total > 0)) throw new Error("No weighted hands to rank.");
  const percentiles = new Map<string, number>();
  let below = 0;
  for (let start = 0; start < scored.length; ) {
    let end = start, tied = 0;
    while (end < scored.length && compareScores(scored[end]!.score, scored[start]!.score) === 0) tied += scored[end++]!.weight;
    for (let i = start; i < end; i++) percentiles.set(scored[i]!.key, (below + tied / 2) / total);
    below += tied;
    start = end;
  }
  return percentiles;
}

/** Whether a hand at this range percentile keeps playing against the price. */
export function defends(percentile: number, toCall: number, pot: number, defense: number): boolean {
  if (!Number.isFinite(defense) || defense < 0) throw new Error("Range defense must be a nonnegative number.");
  if (toCall <= 0) return true;
  const minimumDefense = Math.max(0, Math.min(1, 1 - toCall / pot));
  return percentile >= 1 - Math.min(1, defense * minimumDefense);
}

const comboKey = (cards: [Card, Card]) => [...cards].sort().join("");

type RangeDefense = { factor: number; percentiles: Map<number, Map<string, number>> };
export type RiverCandidate = { action: PolicyAction; ev: number; standardError: number; samples: number };
export type RiverResult = { best: PolicyAction; candidates: RiverCandidate[]; elapsedMs: number; assumption: "sampled river response-policy EV" };

function candidates(view: PublicView): PolicyAction[] {
  const choices: PolicyAction[] = [];
  for (const legal of view.validActions) {
    if (legal.action === "raise") {
      const sizes = new Set([legal.min, view.presets?.half ?? legal.min, view.presets?.pot ?? legal.min]);
      for (const amount of sizes) choices.push({ action: "raise", amount: Math.max(legal.min, Math.min(legal.max, amount)), reason: "River candidate." });
    } else choices.push({ action: legal.action, ...("amount" in legal ? { amount: legal.amount } : {}), reason: "River candidate." });
  }
  return choices;
}

function reconstruct(view: PublicView, hands: Map<number, [Card, Card]>): TableState {
  if (!view.betting || view.toAct === null || view.seats.length !== 8) throw new Error("Missing public betting reconstruction metadata.");
  const state = createTable();
  state.seats = view.seats.map(s => {
    if (s.handCommitted === undefined || s.acted === undefined) throw new Error("Missing public seat commitments/acted metadata.");
    return { name: s.name, stack: s.stack, away: s.away, hole: hands.get(s.seat) ?? [], inHand: s.inHand, folded: s.folded, allIn: s.allIn, streetCommitted: s.streetCommitted, handCommitted: s.handCommitted, acted: s.acted, lastAction: s.lastAction };
  });
  Object.assign(state, view.betting, { board: [...view.board], pot: view.pot, street: "river", phase: "betting", handNumber: view.handNumber, smallBlind: view.smallBlind, bigBlind: view.bigBlind, toAct: view.toAct, button: view.seats.find(s => s.button)?.seat ?? null, smallBlindSeat: view.seats.find(s => s.smallBlind)?.seat ?? null, bigBlindSeat: view.seats.find(s => s.bigBlind)?.seat ?? null, log: structuredClone(view.log) });
  if (state.seats.reduce((n, s) => n + s.handCommitted, 0) !== view.pot || JSON.stringify(legalActions(state)) !== JSON.stringify(view.validActions)) throw new Error("Inconsistent public betting state.");
  return state;
}

function prepareRange(range: WeightedHand[], known: Card[]) {
  const keys = new Set<string>();
  for (const h of range) {
    const key = [...h.cards].sort().join("");
    if (h.cards.length !== 2 || h.cards.some(c => !isCard(c)) || h.cards[0] === h.cards[1] || !Number.isFinite(h.weight) || h.weight < 0 || keys.has(key)) throw new Error("Invalid river opponent range.");
    keys.add(key);
  }
  const valid = range.filter(h => h.weight > 0 && h.cards.every(c => !known.includes(c)));
  if (!valid.length) throw new Error("No compatible river range.");
  const scale = Math.max(...valid.map(h => h.weight));
  const total = valid.reduce((n, h) => n + h.weight / scale, 0);
  let cumulative = 0;
  return valid.map(hand => ({ hand, cut: cumulative += hand.weight / scale / total }));
}

function responsePolicy(random: () => number, styles: Map<number, number>, defense: RangeDefense | null): Policy {
  return view => {
    const seat = view.toAct!;
    const hole = view.seats[seat]!.hole;
    if (!Array.isArray(hole) || hole.length !== 2) throw new Error("Missing response player's own cards.");
    const context = decisionContext(view, seat);
    const probabilities = actionProbabilities([hole[0]!, hole[1]!], view.board, context, styles.get(seat) ?? 1);
    const draw = random();
    const fold = view.validActions.find(a => a.action === "fold");
    // The hero's own later responses keep the table; only opponents have a modeled range to rank within.
    const percentiles = defense?.percentiles.get(seat);
    let aggressive: boolean;
    if (fold && percentiles && context.price > 0) {
      const percentile = percentiles.get(comboKey([hole[0]!, hole[1]!]));
      if (percentile === undefined) throw new Error("River responder's hand is missing from its range.");
      if (!defends(percentile, context.price, view.pot, defense!.factor)) return { action: "fold", reason: "Response model." };
      const continuing = probabilities[1] + probabilities[2];
      aggressive = continuing > 0 && draw * continuing >= probabilities[1];
    } else {
      if (fold && draw < probabilities[0]) return { action: "fold", reason: "Response model." };
      aggressive = draw >= probabilities[0] + probabilities[1];
    }
    if (aggressive) {
      const raise = view.validActions.find(a => a.action === "raise");
      if (raise?.action === "raise") return { action: "raise", amount: random() < 0.5 ? view.presets!.half : view.presets!.pot, reason: "Response model." };
      const allIn = view.validActions.find(a => a.action === "all_in");
      if (allIn?.action === "all_in") return { action: "all_in", amount: allIn.amount, reason: "Response model." };
    }
    const passive = view.validActions.find(a => a.action === "check") ?? view.validActions.find(a => a.action === "call");
    if (!passive) throw new Error("No passive river response.");
    return { action: passive.action, ...("amount" in passive ? { amount: passive.amount } : {}), reason: "Response model." };
  };
}

export function evaluateRiverActions(view: PublicView, options: RiverOptions = {}): RiverResult {
  const started = performance.now();
  const riskPenalty = options.riskPenalty ?? 0;
  if (!Number.isFinite(riskPenalty) || riskPenalty < 0) throw new Error("River risk penalty must be nonnegative.");
  const samples = options.samples ?? 64;
  if (options.rangeDefense !== undefined && (!Number.isFinite(options.rangeDefense) || options.rangeDefense < 0)) throw new Error("Range defense must be a nonnegative number.");
  const seed = options.seed ?? 1;
  if (view.street !== "river" || view.board.length !== 5 || view.phase !== "betting" || view.toAct === null) throw new Error("River search requires a live river decision.");
  if (!Number.isSafeInteger(samples) || samples < 2 || samples > 10000 || !Number.isSafeInteger(seed)) throw new Error("Invalid river sampling budget or seed.");
  const hero = view.toAct;
  const own = view.seats[hero]!.hole;
  if (!Array.isArray(own) || own.length !== 2) throw new Error("Missing hero cards.");
  const known = [...view.board, ...own];
  if (known.some(c => !isCard(c)) || new Set(known).size !== known.length) throw new Error("Invalid known river cards.");
  const opponents = view.seats.filter(s => s.inHand && !s.folded && s.seat !== hero);
  const uniform = uniformRange();
  const ranges = opponents.map(s => prepareRange(options.rangeFor?.(s.seat) ?? uniform, known));
  const defense: RangeDefense | null = options.rangeDefense === undefined ? null : {
    factor: options.rangeDefense,
    percentiles: new Map(opponents.map((s, i) => [s.seat, rangePercentiles(ranges[i]!.map(entry => entry.hand), view.board)])),
  };
  const actions = candidates(view);
  if (!actions.length) throw new Error("No river candidates.");
  const rollout = (initial: TableState, action: PolicyAction, responseSeed: number, styles: Map<number, number>) => {
    let state = apply(initial, { type: "act", seat: hero, action: action.action, amount: action.amount });
    if (state.error) throw new Error(state.error);
    const response = options.response ?? responsePolicy(mulberry32(responseSeed), styles, defense);
    for (let step = 0; step < 400 && state.phase === "betting"; step++) {
      const actor = state.toAct!;
      const decision = readBotAction(projectForPlayer(state, actor), response);
      if (!decision) throw new Error("Invalid rollout response.");
      state = apply(state, { type: "act", seat: actor, action: decision.action, amount: decision.amount });
      if (state.error) throw new Error(state.error);
    }
    if (state.phase !== "complete") throw new Error("River rollout exceeded action budget.");
    return state.seats[hero]!.stack - initial.seats[hero]!.stack;
  };
  const drawStyles = (hands: Map<number, [Card, Card]>, random: () => number) => {
    const styles = new Map<number, number>();
    for (const opponent of opponents) {
      const probabilities = options.styleFor?.(opponent.seat, hands.get(opponent.seat)!) ?? [1 / 3, 1 / 3, 1 / 3];
      if (probabilities.length !== 3 || probabilities.some(p => !Number.isFinite(p) || p < 0) || Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) > 1e-6) throw new Error("Invalid response-style probabilities.");
      const draw = random(); styles.set(opponent.seat, draw < probabilities[0]! ? 0 : draw < probabilities[0]! + probabilities[1]! ? 1 : 2);
    }
    return styles;
  };
  const estimates = defense
    ? stratifiedEstimates(view, actions, opponents.map(s => s.seat), ranges, defense, known, hero, own as [Card, Card], samples, seed, drawStyles, rollout)
    : plainEstimates(view, actions, opponents.map(s => s.seat), ranges, known, hero, own as [Card, Card], samples, seed, drawStyles, rollout);
  const best = chooseRiverCandidate(estimates, riskPenalty);
  return { best: { ...best.action, reason: `River rollout EV ${best.ev.toFixed(1)} chips. SE ${best.standardError.toFixed(1)}.` }, candidates: estimates, elapsedMs: performance.now() - started, assumption: "sampled river response-policy EV" };
}

export function chooseRiverCandidate(estimates: RiverCandidate[], riskPenalty: number): RiverCandidate {
  if (!estimates.length || !Number.isFinite(riskPenalty) || riskPenalty < 0) throw new Error("Invalid river ranking inputs.");
  return estimates.reduce((a, b) => b.ev - riskPenalty * b.standardError > a.ev - riskPenalty * a.standardError ? b : a);
}

type PreparedRange = { hand: WeightedHand; cut: number }[];
type DrawStyles = (hands: Map<number, [Card, Card]>, random: () => number) => Map<number, number>;
type Rollout = (initial: TableState, action: PolicyAction, responseSeed: number, styles: Map<number, number>) => number;

/** One joint deal of opponent hands without card collisions, by rejection. */
function sampleHands(random: () => number, seats: number[], ranges: PreparedRange[], known: Card[], hero: number, own: [Card, Card]) {
  const hands = tryDeal(random, seats, ranges, known, hero, own);
  if (!hands) throw new Error("Unable to sample compatible river hands.");
  return hands;
}

/** Like sampleHands, but null when these ranges leave no collision-free deal in 1000 tries. */
function tryDeal(random: () => number, seats: number[], ranges: PreparedRange[], known: Card[], hero: number, own: [Card, Card]) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const used = new Set(known);
    const proposed = new Map<number, [Card, Card]>([[hero, own]]);
    for (const [index, seat] of seats.entries()) {
      const range = ranges[index]!;
      const draw = random();
      const h = (range.find(h => draw < h.cut) ?? range[range.length - 1]!).hand;
      if (h.cards.some(c => used.has(c))) break;
      h.cards.forEach(c => used.add(c)); proposed.set(seat, h.cards);
    }
    if (proposed.size === seats.length + 1) return proposed;
  }
  return null;
}

/** Baseline v1: every candidate shares one deal per sample, drawn straight from the ranges. */
function plainEstimates(view: PublicView, actions: PolicyAction[], seats: number[], ranges: PreparedRange[], known: Card[], hero: number, own: [Card, Card], samples: number, seed: number, drawStyles: DrawStyles, rollout: Rollout): RiverCandidate[] {
  const totals = actions.map(() => ({ sum: 0, squares: 0 }));
  const random = mulberry32(seed);
  for (let sample = 0; sample < samples; sample++) {
    const hands = sampleHands(random, seats, ranges, known, hero, own);
    const styles = drawStyles(hands, random);
    const initial = reconstruct(view, hands);
    const responseSeed = Math.floor(random() * 4294967296);
    actions.forEach((action, index) => {
      const value = rollout(initial, action, responseSeed, styles);
      totals[index]!.sum += value; totals[index]!.squares += value * value;
    });
  }
  return actions.map((action, i): RiverCandidate => {
    const { sum, squares } = totals[i]!;
    const ev = sum / samples;
    return { action, ev, standardError: Math.sqrt(Math.max(0, (squares - samples * ev * ev) / (samples - 1)) / samples), samples };
  });
}

/**
 * Against range defense a big bet is called only by a thin slice of each range, which a
 * few plain samples usually miss, making a bluff shove look free. So for each bet we deal
 * every opponent from a 50/50 mix of its full range and the hands that defend that bet,
 * on alternating samples (opponent i switches every 2^i samples), and weight each hand by
 * its true probability over the mix's. Every hand stays possible, so multiway deals
 * never dead-end. If the defending slices of several opponents cannot be dealt together,
 * that sample is dealt from full ranges instead; that rare case is the only source of bias.
 */
function stratifiedEstimates(view: PublicView, actions: PolicyAction[], seats: number[], ranges: PreparedRange[], defense: RangeDefense, known: Card[], hero: number, own: [Card, Card], samples: number, seed: number, drawStyles: DrawStyles, rollout: Rollout): RiverCandidate[] {
  const strata = actions.map(action => seats.map((seat, index) => defenseStrata(view, action, hero, seat, ranges[index]!, defense)));
  const values = actions.map(() => [] as { weight: number; value: number }[]);
  const random = mulberry32(seed);
  for (let sample = 0; sample < samples; sample++) {
    const dealSeed = Math.floor(random() * 4294967296);
    const responseSeed = Math.floor(random() * 4294967296);
    actions.forEach((action, index) => {
      // Shared uniforms keep candidates' deals correlated, as in the plain estimate.
      const dealRandom = mulberry32(dealSeed);
      const splits = strata[index]!;
      const chosen = splits.map((split, i) => split && ((sample >> i) & 1) === 0 ? split.defending : ranges[i]!);
      const hands = tryDeal(dealRandom, seats, chosen, known, hero, own) ?? sampleHands(dealRandom, seats, ranges, known, hero, own);
      const weight = splits.reduce((w, split, i) => {
        if (!split) return w;
        const defending = split.keys.has(comboKey(hands.get(seats[i]!)!));
        return w * (defending ? 2 * split.share / (1 + split.share) : 2);
      }, 1);
      const value = rollout(reconstruct(view, hands), action, responseSeed, drawStyles(hands, dealRandom));
      values[index]!.push({ weight, value });
    });
  }
  return actions.map((action, i): RiverCandidate => {
    const rows = values[i]!;
    const total = rows.reduce((n, r) => n + r.weight, 0);
    const ev = rows.reduce((n, r) => n + r.weight * r.value, 0) / total;
    const variance = rows.reduce((n, r) => n + (r.weight * (r.value - ev)) ** 2, 0) / (total * total);
    return { action, ev, standardError: Math.sqrt(variance * samples / Math.max(1, samples - 1)), samples };
  });
}

/**
 * The hands of one opponent's range that would continue against one hero action as the
 * first responder. Null when the action is not a bet or raise, or when every hand or no
 * hand continues, so the range is dealt unchanged.
 */
function defenseStrata(view: PublicView, action: PolicyAction, hero: number, seat: number, range: PreparedRange, defense: RangeDefense) {
  if (action.action !== "raise" && action.action !== "all_in") return null;
  const heroSeat = view.seats[hero]!, opponent = view.seats[seat]!;
  const raiseTo = action.action === "raise" ? action.amount! : heroSeat.streetCommitted + heroSeat.stack;
  const price = Math.min(opponent.stack, Math.max(0, raiseTo - opponent.streetCommitted));
  const pot = view.pot + raiseTo - heroSeat.streetCommitted;
  const percentiles = defense.percentiles.get(seat)!;
  const weights = range.map((entry, i) => entry.cut - (i ? range[i - 1]!.cut : 0));
  const continues = range.map(entry => defends(percentiles.get(comboKey(entry.hand.cards))!, price, pot, defense.factor));
  const share = weights.reduce((n, w, i) => n + (continues[i] ? w : 0), 0);
  if (!(share > 1e-9 && share < 1 - 1e-9)) return null;
  let cumulative = 0;
  const defending = range.flatMap((entry, i) => continues[i] ? [{ hand: entry.hand, cut: cumulative += weights[i]! / share }] : []);
  return { share, defending, keys: new Set(defending.map(entry => comboKey(entry.hand.cards))) };
}

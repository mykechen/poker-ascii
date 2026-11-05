import { readBotAction, type Policy, type PolicyAction } from "./bot";
import { isCard } from "./cards";
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
};
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

function responsePolicy(random: () => number, styles: Map<number, number>): Policy {
  return view => {
    const seat = view.toAct!;
    const hole = view.seats[seat]!.hole;
    if (!Array.isArray(hole) || hole.length !== 2) throw new Error("Missing response player's own cards.");
    const probabilities = actionProbabilities([hole[0]!, hole[1]!], view.board, decisionContext(view, seat), styles.get(seat) ?? 1);
    const draw = random();
    const fold = view.validActions.find(a => a.action === "fold");
    if (fold && draw < probabilities[0]) return { action: "fold", reason: "Response model." };
    if (draw >= probabilities[0] + probabilities[1]) {
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
  const actions = candidates(view);
  if (!actions.length) throw new Error("No river candidates.");
  const totals = actions.map(() => ({ sum: 0, squares: 0 }));
  const random = mulberry32(seed);
  for (let sample = 0; sample < samples; sample++) {
    let hands: Map<number, [Card, Card]> | null = null;
    for (let attempt = 0; attempt < 1000 && !hands; attempt++) {
      const used = new Set(known);
      const proposed = new Map<number, [Card, Card]>([[hero, [own[0]!, own[1]!]]]);
      for (const [index, opponent] of opponents.entries()) {
        const range = ranges[index]!;
        const draw = random();
        const h = (range.find(h => draw < h.cut) ?? range[range.length - 1]!).hand;
        if (h.cards.some(c => used.has(c))) break;
        h.cards.forEach(c => used.add(c)); proposed.set(opponent.seat, h.cards);
      }
      if (proposed.size === opponents.length + 1) hands = proposed;
    }
    if (!hands) throw new Error("Unable to sample compatible river hands.");
    const styles = new Map<number, number>();
    for (const opponent of opponents) {
      const probabilities = options.styleFor?.(opponent.seat, hands.get(opponent.seat)!) ?? [1 / 3, 1 / 3, 1 / 3];
      if (probabilities.length !== 3 || probabilities.some(p => !Number.isFinite(p) || p < 0) || Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) > 1e-6) throw new Error("Invalid response-style probabilities.");
      const draw = random(); styles.set(opponent.seat, draw < probabilities[0]! ? 0 : draw < probabilities[0]! + probabilities[1]! ? 1 : 2);
    }
    const initial = reconstruct(view, hands);
    const responseSeed = Math.floor(random() * 4294967296);
    actions.forEach((action, index) => {
      let state = apply(initial, { type: "act", seat: hero, action: action.action, amount: action.amount });
      if (state.error) throw new Error(state.error);
      const response = options.response ?? responsePolicy(mulberry32(responseSeed), styles);
      for (let step = 0; step < 400 && state.phase === "betting"; step++) {
        const actor = state.toAct!;
        const decision = readBotAction(projectForPlayer(state, actor), response);
        if (!decision) throw new Error("Invalid rollout response.");
        state = apply(state, { type: "act", seat: actor, action: decision.action, amount: decision.amount });
        if (state.error) throw new Error(state.error);
      }
      if (state.phase !== "complete") throw new Error("River rollout exceeded action budget.");
      const value = state.seats[hero]!.stack - initial.seats[hero]!.stack;
      totals[index]!.sum += value; totals[index]!.squares += value * value;
    });
  }
  const estimates = actions.map((action, i): RiverCandidate => {
    const { sum, squares } = totals[i]!;
    const ev = sum / samples;
    return { action, ev, standardError: Math.sqrt(Math.max(0, (squares - samples * ev * ev) / (samples - 1)) / samples), samples };
  });
  const best = chooseRiverCandidate(estimates, riskPenalty);
  return { best: { ...best.action, reason: `River rollout EV ${best.ev.toFixed(1)} chips. SE ${best.standardError.toFixed(1)}.` }, candidates: estimates, elapsedMs: performance.now() - started, assumption: "sampled river response-policy EV" };
}

export function chooseRiverCandidate(estimates: RiverCandidate[], riskPenalty: number): RiverCandidate {
  if (!estimates.length || !Number.isFinite(riskPenalty) || riskPenalty < 0) throw new Error("Invalid river ranking inputs.");
  return estimates.reduce((a, b) => b.ev - riskPenalty * b.standardError > a.ev - riskPenalty * a.standardError ? b : a);
}

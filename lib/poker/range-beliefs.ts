import { uniformRange, type WeightedHand } from "./equity";
import { handFeatures } from "./hand-features";
import type { ActionClass } from "./opponent";
import type { Card } from "./types";

export type ResponseContext = { facing: boolean; position: string; size: string; depth: string; players: string };

/** Provisional tight/balanced/loose response hypotheses, not labels assigned to players. */
export function actionProbabilities(cards: [Card, Card], board: Card[], context: ResponseContext, style: number): [number, number, number] {
  return probabilitiesForFeatures(handFeatures(cards, board), context, style);
}
function probabilitiesForFeatures(features: ReturnType<typeof handFeatures>, c: ResponseContext, style: number): [number, number, number] {
  const base = features.group === "strong" ? [0.05, 0.35, 0.6] : features.group === "medium" ? [0.25, 0.55, 0.2] : [0.65, 0.25, 0.1];
  let [fold, passive, aggressive] = base as [number, number, number];
  if (style === 0) { fold *= 1.8; aggressive *= 0.6; }
  if (style === 2) { fold *= 0.5; aggressive *= 1.8; }
  if (features.draw) { fold *= 0.5; aggressive *= 1.5; }
  if (c.position === "button") aggressive *= 1.25;
  if (c.size === "large") { fold *= 1.5; aggressive *= 0.7; }
  if (c.depth === "short" && features.group === "strong") aggressive *= 1.3;
  if (c.players === "many" && features.group !== "strong") { fold *= 1.25; aggressive *= 0.7; }
  if (!c.facing) { fold = 0; passive *= 1.5; }
  const total = fold + passive + aggressive;
  return [fold / total, passive / total, aggressive / total];
}
function normalized(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error("No compatible probability mass in range.");
  return values.map(n => n / total);
}
const comboKey = (cards: [Card, Card]) => [...cards].sort().join("");

export class RangeBeliefs {
  private weights = [1 / 3, 1 / 3, 1 / 3];
  private ranges: WeightedHand[][] = [];
  constructor(private readonly initial: WeightedHand[] = uniformRange()) { this.newHand(); }
  newHand(resetTypes = false, retention = 1): void {
    if (!Number.isFinite(retention) || retention < 0 || retention > 1) throw new Error("Style retention must be between zero and one.");
    this.weights = this.weights.map(p => retention * p + (1 - retention) / 3);
    if (resetTypes) this.weights = [1 / 3, 1 / 3, 1 / 3];
    const probabilities = normalized(this.initial.map(h => h.weight));
    this.ranges = this.weights.map(() => this.initial.map((h, i) => ({ cards: [...h.cards], weight: probabilities[i]! })));
  }
  condition(known: Card[]): void {
    const masses = this.ranges.map(range => range.reduce((sum, h) => sum + (h.cards.some(c => known.includes(c)) ? 0 : h.weight), 0));
    const posterior = normalized(this.weights.map((p, i) => p * masses[i]!));
    this.ranges = this.ranges.map((range, i) => range.filter(h => h.cards.every(c => !known.includes(c))).map(h => ({ ...h, weight: h.weight / masses[i]! })));
    this.weights = posterior;
  }
  observe(board: Card[], context: ResponseContext, action: ActionClass): void {
    const index = action === "fold" ? 0 : action === "passive" ? 1 : 2;
    const features = new Map(this.ranges[0]!.map(h => [comboKey(h.cards), handFeatures(h.cards, board)]));
    const weighted = this.ranges.map((range, style) => range.map(h => ({ ...h, weight: h.weight * probabilitiesForFeatures(features.get(comboKey(h.cards))!, context, style)[index]! })));
    const masses = weighted.map(range => range.reduce((sum, h) => sum + h.weight, 0));
    const posterior = normalized(this.weights.map((p, i) => p * masses[i]!));
    this.ranges = weighted.map((range, i) => range.map(h => ({ ...h, weight: h.weight / masses[i]! })));
    this.weights = posterior;
  }
  reveal(cards: [Card, Card]): void {
    const key = comboKey(cards);
    const likelihoods = this.ranges.map(range => range.find(h => comboKey(h.cards) === key)?.weight ?? 0);
    this.weights = normalized(this.weights.map((p, i) => p * likelihoods[i]!));
    // The observed hole cards condition this hand fully; repeating a reveal is idempotent.
    this.ranges = this.ranges.map(() => [{ cards: [...cards], weight: 1 }]);
  }
  typeWeightsGiven(cards: [Card, Card]): number[] {
    const key = comboKey(cards);
    return normalized(this.weights.map((p, style) => p * (this.ranges[style]!.find(h => comboKey(h.cards) === key)?.weight ?? 0)));
  }
  typeWeights(): number[] { return [...this.weights]; }
  mixture(): WeightedHand[] {
    return this.ranges[0]!.map((h, index) => ({ cards: [...h.cards], weight: this.ranges.reduce((sum, range, style) => sum + this.weights[style]! * range[index]!.weight, 0) }));
  }
}

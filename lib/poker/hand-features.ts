import { rankValue } from "./cards";
import { evaluate } from "./evaluator";
import type { Card } from "./types";
import type { PublicView } from "./view";

/** Cache pure card calculations only; no opponent identities, actions or range weights. */
export function createHandFeatureEvaluator(capacity = 8192) {
  if (!Number.isSafeInteger(capacity) || capacity < 0 || capacity > 100000) throw new Error("Invalid hand-feature cache capacity.");
  const cache = new Map<string, ReturnType<typeof computeHandFeatures>>();
  return function cachedHandFeatures(hole: [Card, Card], board: Card[]) {
    if (capacity === 0 || board.length < 3) return computeHandFeatures(hole, board);
    const key = [...hole].sort().join("") + ":" + [...board].sort().join("");
    const hit = cache.get(key);
    if (hit) return { ...hit };
    const result = computeHandFeatures(hole, board);
    if (cache.size >= capacity) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return { ...result };
  };
}
export const handFeatures = createHandFeatureEvaluator();

function computeHandFeatures(hole: [Card, Card], board: Card[]) {
  const ranks = hole.map(rankValue);
  const made = board.length >= 3 ? evaluate([...hole, ...board]).score[0]! : 0;
  const group = board.length < 3
    ? ranks[0] === ranks[1] && ranks[0]! >= 10 || Math.min(...ranks) >= 12 ? "strong" : ranks[0] === ranks[1] || Math.max(...ranks) >= 11 ? "medium" : "weak"
    : made >= 2 ? "strong" : made === 1 ? "medium" : "weak";
  const cards = [...hole, ...board];
  const flushDraw = board.length < 5 && ["c", "d", "h", "s"].some(suit => cards.filter(c => c[1] === suit).length === 4 && hole.some(c => c[1] === suit));
  const unique = new Set(cards.map(rankValue));
  if (unique.has(14)) unique.add(1);
  const holeRanks = new Set(hole.flatMap(c => rankValue(c) === 14 ? [14, 1] : [rankValue(c)]));
  const straightDraw = board.length < 5 && Array.from({ length: 10 }, (_, i) => i + 1).some(low => {
    const window = Array.from({ length: 5 }, (_, i) => low + i);
    return window.filter(r => unique.has(r)).length === 4 && window.some(r => holeRanks.has(r) && !board.some(c => rankValue(c) === r || r === 1 && rankValue(c) === 14));
  });
  return { group, draw: board.length >= 3 && (flushDraw || straightDraw) };
}

export function decisionContext(view: PublicView, seat: number) {
  const player = view.seats[seat];
  if (!player) throw new Error("Missing context seat.");
  const live = view.seats.filter(s => s.inHand && !s.folded);
  const currentBet = view.betting?.currentBet ?? Math.max(...view.seats.map(s => s.streetCommitted));
  const price = Math.max(0, currentBet - player.streetCommitted);
  const opponents = live.filter(s => s.seat !== seat);
  const effective = Math.min(player.stack, Math.max(0, ...opponents.map(s => s.stack)));
  const spr = effective / Math.max(1, view.pot);
  const size = price / Math.max(1, view.pot);
  return {
    facing: price > 0, price, spr,
    canRaise: player.stack>price && live.filter(s=>!s.allIn).length>=2 && (!player.acted || !view.betting || view.betting.raiseOpen || price>=view.betting.minRaise),
    position: player.button ? "button" : player.smallBlind || player.bigBlind ? "blind" : "field",
    size: size === 0 ? "free" : size <= 0.33 ? "small" : size <= 0.75 ? "medium" : "large",
    depth: spr <= 1 ? "short" : spr <= 4 ? "medium" : "deep",
    players: live.length <= 2 ? "heads-up" : live.length <= 4 ? "few" : "many",
  };
}

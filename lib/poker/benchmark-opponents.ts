import type { Policy } from './bot';
import { estimateEquity, uniformRange, type WeightedHand } from './equity';
import { compareScores, evaluate } from './evaluator';
import type { Card } from './types';

export type BenchmarkOpponentKind = 'equity-defender' | 'equity-pressure' | 'size-reader';

/**
 * The strongest `share` of the hands a river bettor could hold, ranked on this board.
 * The whole tie group at the cutoff is kept, so the result is never empty.
 */
export function strongestShare(board: Card[], known: Card[], share: number): WeightedHand[] {
  if (board.length !== 5) throw new Error('Ranking a betting range needs the full board.');
  if (!(share > 0 && share <= 1)) throw new Error('The range share must be above zero and at most one.');
  const dead = new Set(known);
  const ranked = uniformRange()
    .filter(h => !dead.has(h.cards[0]) && !dead.has(h.cards[1]))
    .map(h => ({ hand: h, score: evaluate([...board, ...h.cards]).score }))
    .sort((a, b) => compareScores(b.score, a.score));
  const keep = Math.max(1, Math.ceil(share * ranked.length));
  let end = keep;
  while (end < ranked.length && compareScores(ranked[end]!.score, ranked[keep - 1]!.score) === 0) end++;
  return ranked.slice(0, end).map(r => r.hand);
}

/**
 * Uniform-range showdown estimates; pressure raises are a value heuristic.
 * size-reader plays like equity-defender, except that facing a river bet it puts the
 * bettor on the strongest pot / (pot + bet) share of hands, where pot is before the bet:
 * a half-pot bet means the top two thirds, a pot bet the top half, a 40x-pot shove the top 2.5%.
 * That share is an assumption, not a fitted read of real players.
 */
export function createBenchmarkOpponent(kind: BenchmarkOpponentKind, samples = 64, seed = 1): Policy {
  if (!['equity-defender', 'equity-pressure', 'size-reader'].includes(kind)) throw new Error('Unknown benchmark opponent.');
  if (!Number.isSafeInteger(samples) || samples < 2 || samples > 1_000_000) throw new Error('Samples must be an integer between 2 and 1000000.');
  if (!Number.isSafeInteger(seed)) throw new Error('Seed must be a safe integer.');
  const range = uniformRange();
  return view => {
    const actor = view.toAct;
    if (actor === null) throw new Error('Benchmark requires an acting seat.');
    const hole = view.seats[actor]!.hole;
    if (!Array.isArray(hole) || hole.length !== 2) throw new Error('Benchmark requires own hole cards.');
    const opponents = view.seats.filter(s => s.inHand && !s.folded && s.seat !== actor);
    const call = view.validActions.find(a => a.action === 'call');
    const cost = call?.action === 'call' ? call.amount : 0;
    const contributions = view.seats.map(() => 0);
    let start = view.log.findLastIndex(e => e.action === 'deal' && e.street === 'preflop');
    if (start < 0) throw new Error('Benchmark requires current hand log.');
    while (start > 0 && view.log[start - 1]!.action === 'blind') start--;
    for (const entry of view.log.slice(start)) {
      if (entry.seat !== null && entry.amount !== null && ['blind', 'bet', 'raise', 'call', 'all_in'].includes(entry.action)) contributions[entry.seat] += entry.amount;
    }
    const potWithBet = contributions.reduce((a, b) => a + b, 0);
    contributions[actor] += cost;
    const live = [actor, ...opponents.map(s => s.seat)];
    let previous = 0;
    const pots = [...new Set(contributions.filter(n => n > 0))].sort((a,b) => a-b).map(level => {
      const amount = (level - previous) * contributions.filter(n => n >= level).length;
      previous = level;
      return { amount, eligible: live.flatMap((seat,index) => contributions[seat]! >= level ? [index] : []) };
    }).filter(p => p.eligible.length > 0);
    const bettor = kind === 'size-reader' && view.street === 'river' && cost > 0
      ? opponents.reduce((top, s) => s.streetCommitted > top.streetCommitted ? s : top).seat
      : null;
    const bettorRange = bettor === null ? null : strongestShare(view.board, [hole[0]!, hole[1]!, ...view.board], 1 - cost / potWithBet);
    const ranges = opponents.map(s => s.seat === bettor ? bettorRange! : range);
    const result = estimateEquity({hero:[hole[0]!,hole[1]!],board:view.board,opponents:ranges,pots,samples,seed:seed ^ Math.imul(view.handNumber,31) ^ view.log.length ^ actor});
    const value = (result.expectedPayout ?? 0) - cost;
    const reason = `${bettor === null ? 'Uniform-range' : 'Size-read'} showdown call value ${value.toFixed(1)}.`;
    const raise = view.validActions.find(a => a.action === 'raise');
    if (kind === 'equity-pressure' && result.equity >= .65 && value > 0 && raise?.action === 'raise') {
      return {action:'raise',amount:Math.min(raise.max,Math.max(raise.min,view.presets?.half ?? raise.min)),reason};
    }
    if (view.validActions.some(a => a.action === 'check')) return {action:'check',reason};
    if (call && value >= 0) return {action:'call',amount:cost,reason};
    return {action:'fold',reason};
  };
}

import type { Policy } from './bot';
import { estimateEquity, uniformRange } from './equity';

export type BenchmarkOpponentKind = 'equity-defender' | 'equity-pressure';

/** Uniform-range showdown estimates; pressure raises are a value heuristic. */
export function createBenchmarkOpponent(kind: BenchmarkOpponentKind, samples = 64, seed = 1): Policy {
  if (!['equity-defender', 'equity-pressure'].includes(kind)) throw new Error('Unknown benchmark opponent.');
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
    contributions[actor] += cost;
    const live = [actor, ...opponents.map(s => s.seat)];
    let previous = 0;
    const pots = [...new Set(contributions.filter(n => n > 0))].sort((a,b) => a-b).map(level => {
      const amount = (level - previous) * contributions.filter(n => n >= level).length;
      previous = level;
      return { amount, eligible: live.flatMap((seat,index) => contributions[seat]! >= level ? [index] : []) };
    }).filter(p => p.eligible.length > 0);
    const result = estimateEquity({hero:[hole[0]!,hole[1]!],board:view.board,opponents:opponents.map(() => range),pots,samples,seed:seed ^ Math.imul(view.handNumber,31) ^ view.log.length ^ actor});
    const value = (result.expectedPayout ?? 0) - cost;
    const reason = `Uniform-range showdown call value ${value.toFixed(1)}.`;
    const raise = view.validActions.find(a => a.action === 'raise');
    if (kind === 'equity-pressure' && result.equity >= .65 && value > 0 && raise?.action === 'raise') {
      return {action:'raise',amount:Math.min(raise.max,Math.max(raise.min,view.presets?.half ?? raise.min)),reason};
    }
    if (view.validActions.some(a => a.action === 'check')) return {action:'check',reason};
    if (call && value >= 0) return {action:'call',amount:cost,reason};
    return {action:'fold',reason};
  };
}

import type { Policy } from "./bot";
import { estimateEquity, uniformRange, type EquityResult, type WeightedHand } from "./equity";
import type { PublicView } from "./view";

export type DecisionSnapshot = { view: PublicView; opponentSeats: number[]; ranges: WeightedHand[][]; equity: EquityResult; callCost: number; showdownCallValue: number };

export type EquityPolicyOptions = {
  onDecisionSnapshot?: (snapshot: DecisionSnapshot) => void;
  samples?: number;
  seed?: number;
  rangeFor?: (view: PublicView, opponentSeat: number) => WeightedHand[];
  onDecision?: (decision: { hand: number; seat: number; equity: EquityResult; callCost: number; showdownCallValue: number }) => void;
};

/** Check/call control: assumes no further bets or contributions after this call. */
export function createEquityPolicy(options: EquityPolicyOptions = {}): Policy {
  const uniform = uniformRange();
  return view => {
    const seat=view.toAct;
    if(seat===null) throw new Error("No actor for equity decision.");
    const hole=view.seats[seat]!.hole;
    if(!Array.isArray(hole) || hole.length!==2) throw new Error("Missing own cards.");
    const opponents=view.seats.filter(s=>s.inHand && !s.folded && s.seat!==seat);
    const call=view.validActions.find(a=>a.action==="call");
    const cost=call?.action==="call"?call.amount:0;
    const indices=[seat,...opponents.map(s=>s.seat)];
    const contributions=view.seats.map(()=>0);
    let start=view.log.findLastIndex(e=>e.action==="deal" && e.street==="preflop");
    if(start<0) throw new Error("Missing current hand log.");
    while(start>0 && view.log[start-1]!.action==="blind") start--;
    for(const entry of view.log.slice(start)) if(entry.seat!==null && entry.amount!==null && ["blind","bet","raise","call","all_in"].includes(entry.action)) contributions[entry.seat]+=entry.amount;
    contributions[seat]+=cost;
    const levels=[...new Set(contributions.filter(n=>n>0))].sort((a,b)=>a-b);
    let previous=0;
    const pots=levels.map(level=>{
      const amount=(level-previous)*contributions.filter(n=>n>=level).length;
      previous=level;
      const eligible=indices.flatMap((s,i)=>contributions[s]!>=level?[i]:[]);
      return {amount,eligible};
    }).filter(p=>p.eligible.length>0);
    const ranges=opponents.map(s=>options.rangeFor?.(view,s.seat)??uniform);
    const equity=estimateEquity({hero:[hole[0]!,hole[1]!],board:view.board,opponents:ranges,pots,samples:options.samples??500,seed:(options.seed??1)^Math.imul(view.handNumber,31)^view.log.length^seat});
    const value=(equity.expectedPayout??0)-cost;
    options.onDecision?.({hand:view.handNumber,seat,equity,callCost:cost,showdownCallValue:value});
    options.onDecisionSnapshot?.(structuredClone({view,opponentSeats:opponents.map(s=>s.seat),ranges,equity,callCost:cost,showdownCallValue:value}));
    const detail=`Equity ${(100*equity.equity).toFixed(1)}%. Showdown call value ${value.toFixed(1)}.`;
    if(view.validActions.some(a=>a.action==="check")) return {action:"check",reason:detail};
    if(call && value>=0) return {action:"call",amount:cost,reason:detail};
    return {action:"fold",reason:detail};
  };
}

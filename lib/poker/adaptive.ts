import type { Policy } from "./bot";
import { createEquityPolicy, type EquityPolicyOptions } from "./equity-policy";
import { OpponentModel, type ActionClass } from "./opponent";
import { decisionContext } from "./hand-features";
import { RangeBeliefs } from "./range-beliefs";
import { evaluateRiverActions, type RiverResult } from "./river-ev";
import type { Card, Street } from "./types";
import type { PublicView } from "./view";

type Evidence = { seat: number; street: Street; board: Card[]; facing: boolean; action: ActionClass };
export function createAdaptivePolicy(options: Omit<EquityPolicyOptions,"rangeFor"> & { priorStrength?: number; learn?: boolean; riverSamples?: number | false; onRiverDecision?: (result: RiverResult) => void } = {}) {
  const model=new OpponentModel(options.priorStrength);
  let ids:string[]=[];
  let hand=-1, count=0, reveals=0, inferences=0;
  const beliefs=new Map<number,RangeBeliefs>();
  let evidence:Evidence[]=[];
  const revealedEvidence: {event:Evidence; cards:[Card,Card]}[]=[];
  const knownCards=(view:PublicView)=>[...view.board,...view.seats.flatMap(s=>Array.isArray(s.hole)?s.hole:[])];
  const beliefFor=(seat:number)=>{
    let belief=beliefs.get(seat);
    if(!belief) {belief=new RangeBeliefs();beliefs.set(seat,belief);}
    return belief;
  };
  const ensureHand=(view:PublicView)=>{
    if(hand===view.handNumber)return;
    hand=view.handNumber;for(const belief of beliefs.values())belief.newHand(options.learn===false);evidence=[];
  };
  const control=createEquityPolicy({...options,rangeFor:(view,seat)=>{
    ensureHand(view);const belief=beliefFor(seat);belief.condition(knownCards(view));return belief.mixture();
  }});
  const policy:Policy=Object.assign((view:PublicView)=>{
    ensureHand(view);
    if(view.street==="river" && options.riverSamples!==false) {
      for(const opponent of view.seats.filter(s=>s.inHand&&!s.folded&&s.seat!==view.toAct))beliefFor(opponent.seat).condition(knownCards(view));
      const result=evaluateRiverActions(view,{samples:options.riverSamples??64,seed:(options.seed??1)^Math.imul(view.handNumber,31)^view.log.length,
        rangeFor:seat=>beliefFor(seat).mixture(),styleFor:(seat,cards)=>beliefFor(seat).typeWeightsGiven(cards)});
      options.onRiverDecision?.(result);return result.best;
    }
    return control(view);
  },{
    startSession:(joinIds:string[])=>{
      ids=[...joinIds];model.startSession(ids);hand=-1;count=0;reveals=0;inferences=0;beliefs.clear();evidence=[];revealedEvidence.length=0;
    },
    observe:(before:PublicView,after:PublicView)=>{
      ensureHand(before);
      const seat=before.toAct;
      if(seat===null || before.street===null)return;
      // The observer's own cards are private to it; exclude its actions from opponent learning.
      if(Array.isArray(before.seats[seat]!.hole)) {if(after.phase==="complete")learnReveals(after);return;}
      const currentBet=Math.max(...before.seats.map(s=>s.streetCommitted));
      const facing=currentBet>before.seats[seat]!.streetCommitted;
      const entry=after.log.findLast(e=>e.seat===seat && e.street===before.street && ["fold","check","call","bet","raise","all_in"].includes(e.action));
      if(!entry)throw new Error("Missing action observation.");
      const action:ActionClass=entry.action==="fold"?"fold":entry.raiseTo!==null && entry.raiseTo>currentBet?"aggressive":"passive";
      const event:Evidence={seat,street:before.street,board:[...before.board],facing,action};
      const belief=beliefFor(seat);
      belief.condition(knownCards(before));
      belief.observe(before.board,decisionContext(before,seat),action);
      inferences++;
      if(options.learn!==false) {model.record(ids[seat]!,before.street,facing,action);count++;}
      evidence.push(event);
      if(after.phase==="complete") learnReveals(after);
    }
  });
  function learnReveals(view:PublicView):void {
    if(options.learn===false)return;
    const processed=new Set<number>();
    for(const event of evidence) {
      if(processed.has(event.seat))continue;
      processed.add(event.seat);
      const hole=view.seats[event.seat]!.hole;
      if(!Array.isArray(hole)||hole.length!==2)continue;
      const belief=beliefFor(event.seat);
      // Other revealed hands and the board remove impossible combinations, but not this player's revealed cards.
      const known=[...view.board,...view.seats.flatMap(s=>s.seat!==event.seat && Array.isArray(s.hole)?s.hole:[])];
      belief.condition(known);
      belief.reveal([hole[0]!,hole[1]!]);
    }
    for(const event of evidence) {
      const hole=view.seats[event.seat]!.hole;
      if(!Array.isArray(hole)||hole.length!==2)continue;
      revealedEvidence.push({event:{...event,board:[...event.board]},cards:[hole[0]!,hole[1]!]});
      reveals++;
    }
  }
  return {policy,model,observations:()=>count,revealedActions:()=>reveals,inferences:()=>inferences, revealedEvidence:()=>structuredClone(revealedEvidence),typeWeights:(seat:number)=>beliefFor(seat).typeWeights()};
}

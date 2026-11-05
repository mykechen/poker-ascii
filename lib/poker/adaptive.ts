import type { Policy } from "./bot";
import { rankValue } from "./cards";
import { createEquityPolicy, type EquityPolicyOptions } from "./equity-policy";
import { uniformRange, type WeightedHand } from "./equity";
import { evaluate } from "./evaluator";
import { OpponentModel, type ActionClass } from "./opponent";
import type { Card, Street } from "./types";
import type { PublicView } from "./view";

type Evidence = { seat: number; street: Street; board: Card[]; facing: boolean; action: ActionClass };
const priors: Record<string, [number,number,number]> = { weak:[0.6,0.3,0.1], medium:[0.2,0.6,0.2], strong:[0.05,0.35,0.6] };
function strength(cards: [Card,Card], board: Card[]): string {
  if(board.length>=3) {const rank=evaluate([...cards,...board]).score[0]!;return rank>=2?"strong":rank===1?"medium":"weak";}
  const [a,b]=cards.map(rankValue) as [number,number];
  return a===b && a>=10 || Math.min(a,b)>=12?"strong":a===b || Math.max(a,b)>=11?"medium":"weak";
}

export function createAdaptivePolicy(options: Omit<EquityPolicyOptions,"rangeFor"> & { priorStrength?: number; learn?: boolean } = {}) {
  const model=new OpponentModel(options.priorStrength);
  let ids:string[]=[];
  let hand=-1, count=0, reveals=0, inferences=0;
  let ranges=new Map<number,WeightedHand[]>();
  let evidence:Evidence[]=[];
  const revealedEvidence: {event:Evidence; cards:[Card,Card]}[]=[];
  const uniform=uniformRange();
  const classIndex=(action:ActionClass)=>action==="fold"?0:action==="passive"?1:2;
  const likelihood=(e:Evidence,cards:[Card,Card])=>{
    const group=strength(cards,e.board);
    const prior=priors[group]!;
    const index=classIndex(e.action);
    const personal=model.tendency(ids[e.seat]!,e.street,e.facing);
    const marginal=e.action==="aggressive"?personal.aggressiveMean:e.action==="fold"?personal.foldMean:1-personal.foldMean-personal.aggressiveMean;
    const blend=personal.samples/(personal.samples+model.priorStrength);
    const priorProbability=e.facing?prior[index]!:prior[index]!/(1-prior[0]);
    const conditioned=priorProbability;
    return Math.max(0.001,(1-blend)*conditioned+blend*marginal);
  };
  const ensureHand=(view:PublicView)=>{
    if(hand===view.handNumber)return;
    hand=view.handNumber;ranges=new Map();evidence=[];
  };
  const control=createEquityPolicy({...options,rangeFor:(view,seat)=>{
    ensureHand(view);return ranges.get(seat)??uniform;
  }});
  const policy:Policy=Object.assign((view:PublicView)=>{ensureHand(view);return control(view);},{
    startSession:(joinIds:string[])=>{
      ids=[...joinIds];model.startSession(ids);hand=-1;count=0;reveals=0;inferences=0;ranges.clear();evidence=[];revealedEvidence.length=0;
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
      const range=(ranges.get(seat)??uniform).filter(h=>h.cards.every(c=>!before.board.includes(c)));
      const weighted=range.map(h=>({...h,weight:h.weight*likelihood(event,h.cards)}));
      const total=weighted.reduce((n,h)=>n+h.weight,0);
      if(!total)throw new Error("Opponent range has no remaining mass.");
      ranges.set(seat,weighted.map(h=>({...h,weight:h.weight/total})));
      inferences++;
      if(options.learn!==false) {model.record(ids[seat]!,before.street,facing,action);count++;}
      evidence.push(event);
      if(after.phase==="complete") learnReveals(after);
    }
  });
  function learnReveals(view:PublicView):void {
    if(options.learn===false)return;
    for(const event of evidence) {
      const hole=view.seats[event.seat]!.hole;
      if(!Array.isArray(hole)||hole.length!==2)continue;
      revealedEvidence.push({event:{...event,board:[...event.board]},cards:[hole[0]!,hole[1]!]});
      reveals++;
    }
  }
  return {policy,model,observations:()=>count,revealedActions:()=>reveals,inferences:()=>inferences, revealedEvidence:()=>structuredClone(revealedEvidence)};
}

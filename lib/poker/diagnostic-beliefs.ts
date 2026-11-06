import {isCard} from './cards';
import {validateResponseModel,type ResponseModel} from './contextual-response';
import type {ReplayObservation} from './contextual-replay';
import type {WeightedHand} from './equity';
import {RangeBeliefs} from './range-beliefs';
import type {Card} from './types';
import type {PublicView} from './view';

function validateCards(cards:Card[]){
 if(cards.some(c=>!isCard(c))||new Set(cards).size!==cards.length)throw new Error('Invalid or duplicate diagnostic cards.');
}

/** Public inference only; true cards belong exclusively to the separate scorer. */
export class DiagnosticBeliefs {
 private beliefs=new Map<number,RangeBeliefs>();
 private hand:number|undefined;
 private match:number|undefined;
 private order:number|undefined;
 private readonly model:ResponseModel;
 constructor(model:ResponseModel){validateResponseModel(model);this.model=structuredClone(model);}
 reset():void{this.beliefs.clear();this.hand=undefined;this.match=undefined;this.order=undefined;}
 private ensureHand(hand:number):void{
  if(!Number.isSafeInteger(hand)||hand<0)throw new Error('Invalid diagnostic hand identity.');
  if(this.hand!==hand){this.reset();this.hand=hand;}
 }
 private belief(seat:number):RangeBeliefs{
  if(!Number.isSafeInteger(seat)||seat<0)throw new Error('Invalid diagnostic seat.');
  let belief=this.beliefs.get(seat);
  if(!belief){belief=new RangeBeliefs(undefined,0,this.model);this.beliefs.set(seat,belief);}
  return belief;
 }
 observe(row:ReplayObservation):{prediction:[number,number,number];before:WeightedHand[];after:WeightedHand[]}{
  validateCards(row.known);validateCards(row.board);
  if(row.board.some(c=>!row.known.includes(c)))throw new Error('Diagnostic known cards must include current board.');
  if(!Number.isSafeInteger(row.match)||!Number.isSafeInteger(row.order))throw new Error('Invalid diagnostic replay identity.');
  if(this.match!==undefined&&(row.match<this.match||row.match===this.match&&(row.hand<this.hand!||this.order!==undefined&&row.order<=this.order)))throw new Error('Replay action order is not increasing.');
  if(this.match!==undefined&&this.match!==row.match)this.reset();
  this.ensureHand(row.hand);this.match=row.match;
  const belief=this.belief(row.seat);belief.condition(row.known);
  const before=belief.mixture();
  const prediction=belief.observe(row.board,row.context,row.actual);
  this.order=row.order;
  return {prediction,before,after:belief.mixture()};
 }
 ranges(view:PublicView):Record<number,WeightedHand[]>{
  const actor=view.toAct;
  if(actor===null)throw new Error('Diagnostic ranges require acting hero.');
  const hole=view.seats[actor]?.hole;
  if(!Array.isArray(hole)||hole.length!==2)throw new Error('Diagnostic ranges require hero own two cards.');
  const known=[...view.board,...hole];validateCards(known);
  this.ensureHand(view.handNumber);
  const ranges:Record<number,WeightedHand[]>={};
  for(const seat of view.seats){
   if(seat.seat===actor||!seat.inHand||seat.folded)continue;
   const belief=this.belief(seat.seat);belief.condition(known);ranges[seat.seat]=belief.mixture();
  }
  return ranges;
 }
}

/** Offline label scoring, with no reference to any inference tracker. */
export function trueHandScore(range:WeightedHand[],truth:[Card,Card]):{probability:number;logLoss:number}{
 if(truth.length!==2)throw new Error('Expected two true cards.');validateCards(truth);
 let mass=0,matched=0;const seen=new Set<string>(),key=[...truth].sort().join(',');
 for(const hand of range){
  if(hand.cards.length!==2||!Number.isFinite(hand.weight)||hand.weight<0)throw new Error('Invalid diagnostic range hand or weight.');
  validateCards(hand.cards);const id=[...hand.cards].sort().join(',');
  if(seen.has(id))throw new Error('Duplicate diagnostic range hand.');seen.add(id);
  mass+=hand.weight;if(id===key)matched+=hand.weight;
 }
 if(!Number.isFinite(mass)||mass<=0)throw new Error('Diagnostic range requires positive finite mass.');
 const probability=matched/mass;
 return {probability,logLoss:probability===1?0:-Math.log(Math.max(1e-12,probability))};
}

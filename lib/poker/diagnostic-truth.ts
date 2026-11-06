import { freshDeck, isCard, shuffleDeck } from './cards';
import { apply, createTable } from './engine';
import { compareScores, evaluate } from './evaluator';
import { mulberry32 } from './train';
import type { Card } from './types';
import type { PublicView } from './view';

export function reconstructDeals(seed:number,players:number,hands:number): {holes:Record<number,[Card,Card]>;board:Card[]}[] {
 if(!Number.isSafeInteger(seed)||!Number.isInteger(players)||players<2||players>8||!Number.isInteger(hands)||hands<1||hands>100000)throw new Error('Invalid deal reconstruction settings.');
 const rng=mulberry32(seed);
 return Array.from({length:hands},(_,index)=>{
 let state=createTable();
 state=apply(state,{type:'setBlinds',smallBlind:1,bigBlind:2});
 for(let seat=0;seat<players;seat++)state=apply(state,{type:'sit',seat,name:`P${seat}`,stack:200});
 state.button=index===0?null:(index-1)%players;state.handNumber=index;
 state=apply(state,{type:'startHand',deck:shuffleDeck(rng)});
 if(state.error)throw new Error(state.error);
 const holes:Record<number,[Card,Card]>={};
 for(let seat=0;seat<players;seat++)holes[seat]=[state.seats[seat]!.hole[0]!,state.seats[seat]!.hole[1]!];
 return {holes,board:state.deck.slice(0,5)};
 });
}

export function eligibleCallPots(view:PublicView): {cost:number;opponentSeats:number[];pots:{amount:number;eligible:number[]}[]} {
 const actor=view.toAct;
 if(actor===null)throw new Error('Call accounting requires actor.');
 const call=view.validActions.find(a=>a.action==='call');
 const cost=call?.action==='call'?call.amount:0;
 const opponentSeats=view.seats.filter(s=>s.inHand&&!s.folded&&s.seat!==actor).map(s=>s.seat);
 const contributions=view.seats.map(()=>0);
 let start=view.log.findLastIndex(e=>e.action==='deal'&&e.street==='preflop');
 if(start<0)throw new Error('Missing current hand log.');
 while(start>0&&view.log[start-1]!.action==='blind')start--;
 for(const entry of view.log.slice(start))if(entry.seat!==null&&entry.amount!==null&&['blind','bet','raise','call','all_in'].includes(entry.action))contributions[entry.seat]+=entry.amount;
 contributions[actor]+=cost;
 const live=[actor,...opponentSeats];let previous=0;
 const pots=[...new Set(contributions.filter(n=>n>0))].sort((a,b)=>a-b).map(level=>{
 const amount=(level-previous)*contributions.filter(n=>n>=level).length;previous=level;
 return {amount,eligible:live.flatMap((seat,index)=>contributions[seat]!>=level?[index]:[])};
 }).filter(p=>p.eligible.length>0);
 return {cost,opponentSeats,pots};
}

/** Privileged offline fractional-share reference: actual cards, no further betting; excludes engine odd-chip allocation. */
export function exactPrivilegedCallValue(view:PublicView,holes:Record<number,[Card,Card]>): {expectedPayout:number;callValue:number;outcomes:number} {
 if(view.board.length!==3&&view.board.length!==4)throw new Error('Exact reference requires flop or turn.');
 const {cost,opponentSeats,pots}=eligibleCallPots(view);
 if(cost<=0)throw new Error('Exact reference requires a paid call.');
 const actor=view.toAct!;const own=view.seats[actor]!.hole;
 if(!Array.isArray(own)||own.length!==2||!holes[actor]||[...own].sort().join()!==[...holes[actor]!].sort().join())throw new Error('Reconstructed hero cards mismatch.');
 for(const seat of view.seats.filter(s=>s.inHand))if(!holes[seat.seat])throw new Error('Missing dealt hole cards.');
 const known=[...view.board,...Object.values(holes).flat()];
 if(known.some(c=>!isCard(c))||new Set(known).size!==known.length)throw new Error('Invalid or duplicate known cards.');
 const remaining=freshDeck().filter(c=>!known.includes(c));
 const live=[actor,...opponentSeats];let payout=0,outcomes=0;
 const score=(runout:Card[])=>{
 const scores=live.map(seat=>evaluate([...holes[seat]!,...view.board,...runout]).score);
 for(const pot of pots){
 if(!pot.eligible.includes(0))continue;
 const comparison=pot.eligible.map(index=>compareScores(scores[index]!,scores[0]!));
 if(comparison.every(n=>n<=0))payout+=pot.amount/comparison.filter(n=>n===0).length;
 }outcomes++;
 };
 for(let i=0;i<remaining.length;i++){
 if(view.board.length===4)score([remaining[i]!]);
 else for(let j=i+1;j<remaining.length;j++)score([remaining[i]!,remaining[j]!]);
 }
 if(!outcomes)throw new Error('No remaining runouts.');
 const expectedPayout=payout/outcomes;
 return {expectedPayout,callValue:expectedPayout-cost,outcomes};
}

import {freshDeck,isCard} from '../cards';
import {evaluate} from '../evaluator';
import {settlePots,type LivePot} from '../pots';
import type {Card} from '../types';
export type AllInPoint={board:Card[];button:number;players:{seat:number;hole:Card[];committed:number;folded:boolean;allIn:boolean}[];pots:LivePot[];terminalChance:boolean};
/** Evaluation-only exact conditional payout, using the engine's evaluator and payout authority. */
export function adjustedPayout(point:AllInPoint):{payouts:number[];runouts:number}{
 const known=[...point.board,...point.players.flatMap(p=>p.hole)];
 if(!point.terminalChance||![0,3,4,5].includes(point.board.length)||known.some(c=>!isCard(c))||new Set(known).size!==known.length)throw new Error('Invalid terminal chance state/cards');
 if(point.players.filter(p=>!p.folded&&!p.allIn).length>1)throw new Error('Future betting is possible');
 if(point.players.length<2||point.players.some(p=>p.hole.length!==2||!Number.isInteger(p.seat)||p.seat<0||p.seat>7||!Number.isSafeInteger(p.committed)||p.committed<0)||new Set(point.players.map(p=>p.seat)).size!==point.players.length)throw new Error('Invalid contestants');
 const deck=freshDeck().filter(c=>!known.includes(c)),missing=5-point.board.length;
 const payouts=Array<number>(8).fill(0),board=[...point.board];let runouts=0;
 function visit(start:number,left:number){
  if(left===0){const players=point.players.map(p=>({seat:p.seat,committed:p.committed,folded:p.folded,score:p.folded?null:evaluate([...p.hole,...board]).score}));const paid=settlePots(point.button,players);for(const [seat,chips] of paid)payouts[seat]!+=chips;runouts++;return;}
  for(let i=start;i<=deck.length-left;i++){board.push(deck[i]!);visit(i+1,left-1);board.pop();}
 }
 visit(0,missing);if(!runouts)throw new Error('No legal runouts');return {payouts:payouts.map(x=>x/runouts),runouts};
}

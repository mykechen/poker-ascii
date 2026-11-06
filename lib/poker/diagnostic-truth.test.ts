import { expect,it } from 'vitest';
import { reconstructDeals,eligibleCallPots,exactPrivilegedCallValue } from './diagnostic-truth';
import { playMatch } from './train';
import { simplePolicy } from './bot';
it('reconstructs every observed own hand and board across button rotations',()=>{
 for(const players of [2,6,8]){
 const deals=reconstructDeals(902,players,4);
 playMatch({seed:902,hands:4,seats:Array.from({length:players},(_,seat)=>({name:`P${seat}`,policy:view=>{
 expect(view.seats[seat]!.hole).toEqual(deals[view.handNumber-1]!.holes[seat]);
 expect(view.board).toEqual(deals[view.handNumber-1]!.board.slice(0,view.board.length));return simplePolicy(view);
 }})),invalidAction:'throw'});
 expect(reconstructDeals(902,players,4)).toEqual(deals);
 }
});
it('rejects invalid reconstruction settings',()=>{
 expect(()=>reconstructDeals(1,9,1)).toThrow();expect(()=>reconstructDeals(1,2,0)).toThrow();expect(()=>reconstructDeals(.5,2,1)).toThrow();
});
import {apply,createTable} from './engine';
import {projectForPlayer} from './view';
import type {Card} from './types';
function fixture(){
 let state=createTable();for(let seat=0;seat<4;seat++)state=apply(state,{type:'sit',seat,name:`P${seat}`,stack:200});state=apply(state,{type:'startHand'});
 const view=projectForPlayer(state,state.toAct),actor=view.toAct!,others=view.seats.filter(s=>s.inHand&&s.seat!==actor);
 const holes:Record<number,[Card,Card]>={[actor]:['As','Ks'],[others[0]!.seat]:['2c','2d'],[others[1]!.seat]:['3c','3d'],[others[2]!.seat]:['4c','4d']};
 view.seats[actor]!.hole=holes[actor]!;view.board=['Qs','Js','Ts','9h'];view.street='turn';others[2]!.folded=true;
 view.validActions=[{action:'fold'},{action:'call',amount:3}];
 view.log=[{seat:null,name:null,action:'deal',amount:null,raiseTo:null,street:'preflop',stackAfter:null,potAfter:0,text:'deal'},...others.map((s,i)=>({seat:s.seat,name:s.name,action:'all_in' as const,amount:i===2?3:100,raiseTo:null,street:'turn' as const,stackAfter:0,potAfter:203,text:'chips'}))];
 return {view,holes,actor,others};
}
it('includes folded money, excludes upper pot, excludes all dealt dead cards and does not mutate inputs',()=>{
 const {view,holes}=fixture();const before=JSON.stringify({view,holes});
 expect(eligibleCallPots(view)).toEqual({cost:3,opponentSeats:view.seats.filter(s=>s.inHand&&!s.folded&&s.seat!==view.toAct).map(s=>s.seat),pots:[{amount:12,eligible:[0,1,2]},{amount:194,eligible:[1,2]}]});
 expect(exactPrivilegedCallValue(view,holes)).toEqual({expectedPayout:12,callValue:9,outcomes:40});
 expect(exactPrivilegedCallValue(view,holes)).toEqual(exactPrivilegedCallValue(view,holes));
 expect(JSON.stringify({view,holes})).toBe(before);
});
it('prices a drawing-dead call at minus incremental cost and rejects corrupt truth',()=>{
 const {view,holes,actor,others}=fixture();
 view.board=['Qs','Js','Ts','9s'];holes[actor]=['2h','3h'];view.seats[actor]!.hole=holes[actor]!;holes[others[0]!.seat]=['As','Ks'];
 expect(exactPrivilegedCallValue(view,holes).callValue).toBe(-3);
 holes[others[1]!.seat]=['As','4h'];expect(()=>exactPrivilegedCallValue(view,holes)).toThrow('duplicate');
});
it('enumerates unordered flop runouts with folded dead cards removed',()=>{
 const {view,holes}=fixture();view.board=['Qs','Js','Ts'];view.street='flop';
 expect(exactPrivilegedCallValue(view,holes)).toEqual({expectedPayout:12,callValue:9,outcomes:820});
});

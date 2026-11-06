import { expect, it } from 'vitest';
import { createBenchmarkOpponent } from './benchmark-opponents';
import { playMatch } from './train';
import { apply, createTable } from './engine';
import { projectForPlayer } from './view';
it('validates settings',()=>{
 for(const samples of [0,1,1.5,1_000_001,NaN,Infinity]) expect(()=>createBenchmarkOpponent('equity-defender',samples)).toThrow();
 for(const samples of [2,1_000_000]) expect(()=>createBenchmarkOpponent('equity-defender',samples)).not.toThrow();
});
it('is deterministic and never reads opponent holes',()=>{
 let state=createTable();
 for(let seat=0;seat<6;seat++)state=apply(state,{type:'sit',seat,name:`P${seat}`,stack:200});
 state=apply(state,{type:'startHand'});
 const view=projectForPlayer(state,state.toAct);
 for(const seat of view.seats)if(seat.seat!==view.toAct)Object.defineProperty(seat,'hole',{get(){throw new Error('hidden');}});
 const policy=createBenchmarkOpponent('equity-pressure',16,42);
 expect(policy(view)).toEqual(policy(view));
});
for(const kind of ['equity-defender','equity-pressure'] as const)it(`${kind} completes legal conserving six-player matches`,()=>{
 const report=playMatch({seats:Array.from({length:6},(_,i)=>({name:`P${i}`,policy:createBenchmarkOpponent(kind,8,i)})),hands:3,invalidAction:'throw'});
 expect(report.fallbacks.every(n=>n===0)).toBe(true);
 expect(report.net.reduce((a,b)=>a+b,0)).toBe(0);
});
it('folds a losing incremental call despite sunk commitments',()=>{
 let state=createTable();
 for(let seat=0;seat<2;seat++)state=apply(state,{type:'sit',seat,name:`P${seat}`,stack:500});
 state=apply(state,{type:'startHand'});
 const view=projectForPlayer(state,state.toAct),actor=view.toAct!,other=view.seats.find(s=>s.inHand&&s.seat!==actor)!;
 view.board=['Ac','Kd','Qh','Js','9c'];view.street='river';view.seats[actor]!.hole=['2h','3h'];
 view.validActions=[{action:'fold'},{action:'call',amount:100}];
 view.log=[{seat:null,name:null,action:'deal',amount:null,raiseTo:null,street:'preflop',stackAfter:null,potAfter:0,text:'deal'},...[{seat:actor,amount:150},{seat:other.seat,amount:250}].map(x=>({...x,name:'P',action:'bet' as const,raiseTo:x.amount,street:'river' as const,stackAfter:500-x.amount,potAfter:400,text:'commitment'}))];
 expect(createBenchmarkOpponent('equity-defender',256,1)(view).action).toBe('fold');
});
for(const kind of ['equity-defender','equity-pressure'] as const)it(`${kind} values only eligible layers including folded money`,()=>{
 let state=createTable();
 for(let seat=0;seat<4;seat++)state=apply(state,{type:'sit',seat,name:`P${seat}`,stack:200});
 state=apply(state,{type:'startHand'});
 const view=projectForPlayer(state,state.toAct),actor=view.toAct!;
 const others=view.seats.filter(s=>s.inHand&&s.seat!==actor);
 view.board=['As','Ks','Qs','Js','2d'];view.street='river';
 view.seats[actor]!.hole=['Ts','3c'];view.seats[actor]!.stack=3;
 others[2]!.folded=true;
 view.validActions=[{action:'fold'},{action:'call',amount:3}];
 view.log=[{seat:null,name:null,action:'deal',amount:null,raiseTo:null,street:'preflop',stackAfter:null,potAfter:0,text:'deal'},...others.map((s,i)=>({seat:s.seat,name:s.name,action:'all_in' as const,amount:i===2?3:100,raiseTo:i===2?3:100,street:'river' as const,stackAfter:0,potAfter:203,text:'contribution'}))];
 // Hero's royal flush wins the 12-chip main pot; the 194-chip side pot
 // belongs exclusively to the two deep opponents. Folded chips remain dead money.
 const decision=createBenchmarkOpponent(kind,8,1)(view);
 expect(decision.action).toBe('call');
 expect(decision.reason).toBe('Uniform-range showdown call value 9.0.');
});

import { expect, it } from "vitest";
import {estimateEquity} from "./equity";
import {eligibleCallPots} from "./diagnostic-truth";
import { createEquityPolicy } from "./equity-policy";
import { playMatch } from "./train";
import { simplePolicy } from "./bot";
it("plays legal six-player hands without accessing hidden information",()=>{
 const policy=createEquityPolicy({samples:50,seed:4});
 const report=playMatch({seats:Array.from({length:6},(_,i)=>({name:`P${i}`,policy:i===0?policy:simplePolicy})),hands:3,invalidAction:"throw"});
 expect(report.fallbacks.every(n=>n===0)).toBe(true);
 expect(report.net.reduce((a,b)=>a+b,0)).toBe(0);
});

it("values a short-stack call only against eligible pot layers including folded money", async()=>{
 const {createTable,apply}=await import("./engine");
 const {projectForPlayer}=await import("./view");
 let state=createTable();
 for(let seat=0;seat<4;seat++) state=apply(state,{type:"sit",seat,name:`P${seat}`,stack:200});
 state=apply(state,{type:"startHand"});
 const view=projectForPlayer(state,state.toAct);
 const actor=view.toAct!;
 const others=view.seats.filter(s=>s.inHand&&s.seat!==actor);
 view.board=["2c","3d","7h","9s","Jc"]; view.street="river";
 view.seats[actor]!.hole=["Ah","Ad"];
 others[2]!.folded=true;
 view.validActions=[{action:"fold"},{action:"call",amount:3}];
 view.seats[actor]!.stack=3;
 view.log=[{seat:null,name:null,action:"deal",amount:null,raiseTo:null,street:"preflop",stackAfter:null,potAfter:0,text:"deal"},...others.map((s,i)=>({seat:s.seat,name:s.name,action:"all_in" as const,amount:i===2?3:10,raiseTo:i===2?3:10,street:"river" as const,stackAfter:0,potAfter:23,text:"contribution"}))];
 let value=0;
 const policy=createEquityPolicy({rangeFor:(_v,seat)=>[{cards:seat===others[0]!.seat?["Kh","Kd"]:["Qh","Qd"],weight:1}],onDecision:d=>{value=d.showdownCallValue;}});
 expect(policy(view).action).toBe("call");
 expect(value).toBe(9);
});
it('folds a negative incremental call despite a large sunk commitment',async()=>{
 const {createTable,apply}=await import('./engine');
 const {projectForPlayer}=await import('./view');
 let state=createTable();
 for(let seat=0;seat<2;seat++)state=apply(state,{type:'sit',seat,name:`P${seat}`,stack:500});
 state=apply(state,{type:'startHand'});
 const view=projectForPlayer(state,state.toAct),actor=view.toAct!,opponent=view.seats.find(s=>s.inHand&&s.seat!==actor)!;
 view.board=['2c','3d','7h','9s','Jc'];view.street='river';view.pot=320;
 view.seats[actor]!.hole=['Kh','Kd'];view.seats[actor]!.stack=350;
 opponent.stack=330;
 view.validActions=[{action:'fold'},{action:'call',amount:20}];
 view.log=[{seat:null,name:null,action:'deal',amount:null,raiseTo:null,street:'preflop',stackAfter:null,potAfter:0,text:'deal'},...[{seat:actor,amount:150},{seat:opponent.seat,amount:170}].map(x=>({...x,name:'P',action:'bet' as const,raiseTo:x.amount,street:'river' as const,stackAfter:500-x.amount,potAfter:320,text:'commitment'}))];
 let value=NaN;
 const policy=createEquityPolicy({rangeFor:()=>[{cards:['Ah','Ad'],weight:1}],onDecision:d=>{value=d.showdownCallValue;}});
 expect(policy(view).action).toBe('fold');expect(value).toBe(-20);
});
it('accepts positive incremental value even when the expected total hand result remains a loss',async()=>{
 const {createTable,apply}=await import('./engine');
 const {projectForPlayer}=await import('./view');
 let state=createTable();
 for(let seat=0;seat<2;seat++)state=apply(state,{type:'sit',seat,name:`P${seat}`,stack:500});
 state=apply(state,{type:'startHand'});
 const view=projectForPlayer(state,state.toAct),actor=view.toAct!,opponent=view.seats.find(s=>s.inHand&&s.seat!==actor)!;
 view.board=['2c','3d','7h','9s','Jc'];view.street='river';view.pot=320;
 view.seats[actor]!.hole=['Kh','Kd'];view.seats[actor]!.stack=350;opponent.stack=330;
 view.validActions=[{action:'fold'},{action:'call',amount:20}];
 view.log=[{seat:null,name:null,action:'deal',amount:null,raiseTo:null,street:'preflop',stackAfter:null,potAfter:0,text:'deal'},...[{seat:actor,amount:150},{seat:opponent.seat,amount:170}].map(x=>({...x,name:'P',action:'bet' as const,raiseTo:x.amount,street:'river' as const,stackAfter:500-x.amount,potAfter:320,text:'commitment'}))];
 let value=NaN;
 const policy=createEquityPolicy({rangeFor:()=>[{cards:['Ah','Ad'],weight:4},{cards:['Qh','Qd'],weight:1}],onDecision:d=>{value=d.showdownCallValue;}});
 expect(policy(view).action).toBe('call');expect(value).toBeCloseTo(48);
 expect(value-150).toBeLessThan(0);
});

it("captures public decision snapshots without changing seeded actions",()=>{
 let captured=0;
 const run=(enabled:boolean)=>playMatch({seats:Array.from({length:6},(_,i)=>({name:`P${i}`,policy:i===0?createEquityPolicy({samples:50,seed:4,...(enabled?{onDecisionSnapshot:s=>{
 captured++;
 const {cost,pots}=eligibleCallPots(s.view);
 const own=s.view.seats[s.view.toAct!]!.hole;
 if(!Array.isArray(own))throw new Error("Missing own cards");
 const reproduced=estimateEquity({hero:[own[0]!,own[1]!],board:s.view.board,opponents:s.ranges,pots,samples:50,seed:(4^Math.imul(s.view.handNumber,31)^s.view.log.length^s.view.toAct!)|0});
 expect(reproduced).toEqual(s.equity);
 expect(reproduced.expectedPayout!-cost).toBe(s.showdownCallValue);
 expect(s.view.seats.filter(seat=>Array.isArray(seat.hole))).toHaveLength(1);
 expect(s.opponentSeats.length).toBe(s.ranges.length);
 expect(s.equity.expectedPayoutStandardError).toBeGreaterThanOrEqual(0);
 s.view.board.length=0;
 }}:{})}):simplePolicy})),hands:3,seed:8,invalidAction:"throw"});
 const baseline=run(false),instrumented=run(true);
 expect(captured).toBeGreaterThan(0);
 expect(instrumented).toEqual(baseline);
});

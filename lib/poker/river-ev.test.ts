import {expect,it} from "vitest";
import {apply,createTable,legalActions} from "./engine";
import {projectForPlayer} from "./view";
import {evaluateRiverActions} from "./river-ev";
import type {Policy} from "./bot";
export function riverFixture(){
 let state=createTable();
 for(let seat=0;seat<2;seat++)state=apply(state,{type:"sit",seat,name:`P${seat}`,stack:200});
 state=apply(state,{type:"startHand"});
 while(state.street!=="river"){
  const action=legalActions(state).find(a=>a.action==="check")??legalActions(state).find(a=>a.action==="call")!;
  state=apply(state,{type:"act",seat:state.toAct!,action:action.action});
 }
 state.board=["2c","3d","7h","9s","Jc"];
 state.seats[1]!.hole=["Ah","Ad"];state.seats[0]!.hole=["Kh","Kd"];
 return state;
}
const station:Policy=view=>({action:view.validActions.some(a=>a.action==="check")?"check":"call",reason:"continue"});
it("prices value bets through engine responses and reports sunk-cost-relative EV",()=>{
 const view=projectForPlayer(riverFixture(),1);
 const result=evaluateRiverActions(view,{samples:4,rangeFor:()=>[{cards:["Kh","Kd"],weight:1}],response:station});
 const shove=result.candidates.find(c=>c.action.action==="all_in")!;
 expect(shove.ev).toBe(202);expect(shove.standardError).toBe(0);
 expect(result.best.action).toBe("all_in");
});
it("values a pure bluff by fold responses and returns unmatched bets",()=>{
 const state=riverFixture();state.seats[1]!.hole=["4h","5d"];
 const response:Policy=view=>({action:view.validActions.some(a=>a.action==="fold")?"fold":"check",reason:"fold"});
 const result=evaluateRiverActions(projectForPlayer(state,1),{samples:4,rangeFor:()=>[{cards:["Kh","Kd"],weight:1}],response});
 expect(result.candidates.find(c=>c.action.action==="check")!.ev).toBe(0);
 expect(result.candidates.find(c=>c.action.action==="raise")!.ev).toBe(4);
});
it("is independent of actual hidden holes and unused deck",()=>{
 const state=riverFixture();const view=projectForPlayer(state,1);
 const options={samples:4,seed:7,rangeFor:()=>[{cards:["Kh","Kd"] as ["Kh","Kd"],weight:1}],response:station};
 const first=evaluateRiverActions(view,options);
 state.seats[0]!.hole=["Jh","Jd"];state.deck.reverse();
 const second=evaluateRiverActions(projectForPlayer(state,1),options);
 expect(first.candidates).toEqual(second.candidates);
});
it("limits short-stack value to eligible pots and includes folded dead money",()=>{
 const state=riverFixture();
 state.seats[1]!.stack=8;
 Object.assign(state.seats[2]!,{name:"dead",stack:190,inHand:true,folded:true,handCommitted:10,streetCommitted:0,acted:true});
 state.pot=14;
 const result=evaluateRiverActions(projectForPlayer(state,1),{samples:4,rangeFor:()=>[{cards:["Kh","Kd"],weight:1}],response:station});
 expect(result.candidates.find(c=>c.action.action==="all_in")!.ev).toBe(22);
});
it("folds a zero-equity hand facing a bet against a caller",()=>{
 const state=riverFixture();state.seats[1]!.hole=["4h","5d"];
 Object.assign(state.seats[0]!,{stack:188,streetCommitted:10,handCommitted:12,acted:true});
 state.currentBet=10;state.minRaise=10;state.pot=14;
 const result=evaluateRiverActions(projectForPlayer(state,1),{samples:4,rangeFor:()=>[{cards:["Kh","Kd"],weight:1}],response:station});
 expect(result.candidates.find(c=>c.action.action==="call")!.ev).toBe(-10);
 expect(result.best.action).toBe("fold");
});
it("repeats stochastic response estimates with a fixed seed",()=>{
 const view=projectForPlayer(riverFixture(),1);
 const options={samples:8,seed:42};
 expect(evaluateRiverActions(view,options).candidates).toEqual(evaluateRiverActions(view,options).candidates);
 expect(()=>evaluateRiverActions({...view,betting:undefined},options)).toThrow(/metadata/);
});
it("handles six-way raise/reraise continuations with exact engine payouts",()=>{
 let state=createTable();
 for(let seat=0;seat<6;seat++)state=apply(state,{type:"sit",seat,name:`P${seat}`,stack:200});
 state=apply(state,{type:"startHand"});
 while(state.street!=="river"){
  const action=legalActions(state).find(a=>a.action==="check")??legalActions(state).find(a=>a.action==="call")!;
  state=apply(state,{type:"act",seat:state.toAct!,action:action.action});
 }
 state.board=["2c","3d","7h","9s","Jc"];
 state.seats[1]!.hole=["Ah","Ad"];
 const ranges=new Map<number,["Kh","Kd"]|["Qh","Qd"]|["Th","Td"]|["8h","8d"]|["6h","6d"]>([[0,["Kh","Kd"]],[2,["Qh","Qd"]],[3,["Th","Td"]],[4,["8h","8d"]],[5,["6h","6d"]]]);
 let raises=0;
 const pressure:Policy=view=>{
  const raise=view.validActions.find(a=>a.action==="raise");
  if(view.toAct!==1 && raise?.action==="raise"){raises++;return {action:"raise",amount:view.presets!.pot,reason:"pressure"};}
  return station(view);
 };
 const result=evaluateRiverActions(projectForPlayer(state,1),{samples:2,rangeFor:seat=>[{cards:ranges.get(seat)!,weight:1}],response:pressure});
 expect(raises).toBeGreaterThan(1);
 expect(result.candidates.find(c=>c.action.action==="all_in")!.ev).toBe(1002);
 expect(result.candidates.every(c=>Number.isFinite(c.ev))).toBe(true);
});

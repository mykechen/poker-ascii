import {describe,expect,it} from "vitest";
import {apply,createTable,legalActions} from "./engine";
import {projectForPlayer} from "./view";
import {defends,evaluateRiverActions,rangePercentiles} from "./river-ev";
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
it("rejects invalid river risk penalties",()=>{
 expect(()=>evaluateRiverActions(projectForPlayer(riverFixture(),1),{riskPenalty:-1})).toThrow(/penalty/);
});
it("can prefer a lower but more certain estimate when explicitly configured",async()=>{
 const {chooseRiverCandidate}=await import("./river-ev");
 const risky={action:{action:"raise" as const,amount:10,reason:"risky"},ev:10,standardError:8,samples:4};
 const certain={action:{action:"check" as const,reason:"certain"},ev:5,standardError:0,samples:4};
 expect(chooseRiverCandidate([risky,certain],0)).toBe(risky);
 expect(chooseRiverCandidate([risky,certain],1)).toBe(certain);
});
describe("range defense", () => {
  const board: ["2c","3d","7h","9s","Jc"] = ["2c","3d","7h","9s","Jc"];
  it("ranks hands within their range, ties counting half", () => {
    const percentiles = rangePercentiles([
      { cards: ["Ah","Kd"], weight: 1 },
      { cards: ["Jh","Td"], weight: 2 },
      { cards: ["Js","Th"], weight: 2 },
      { cards: ["9h","9d"], weight: 1 },
    ], board);
    expect(percentiles.get("AhKd")).toBeCloseTo(1 / 12);
    expect(percentiles.get("JhTd")).toBeCloseTo(0.5);
    expect(percentiles.get("9d9h")).toBeCloseTo(11 / 12);
  });
  it("continues with less of the range as the bet grows, and never folds the top", () => {
    const pot = 4;
    const threshold = (bet: number) => [...Array(101).keys()].map(i => i / 100).find(p => defends(p, bet, pot + bet, 1))!;
    expect(threshold(2)).toBeLessThan(threshold(4));
    expect(threshold(4)).toBeLessThan(threshold(198));
    expect(threshold(4)).toBeCloseTo(0.5);
    expect(defends(1, 198, 202, 1)).toBe(true);
    expect(defends(0.5, 0, 4, 1)).toBe(true);
    expect(() => defends(0.5, 2, 6, -1)).toThrow();
  });
  it("stops v1 shoving one pair for 50 times the pot", () => {
    const state = riverFixture();
    state.seats[1]!.hole = ["Jh","Td"];
    const view = projectForPlayer(state, 1);
    const v1 = evaluateRiverActions(view, { samples: 400, seed: 3 });
    const defended = evaluateRiverActions(view, { samples: 400, seed: 3, rangeDefense: 1 });
    expect(v1.best.action).toBe("all_in");
    expect(defended.best.action).not.toBe("all_in");
    const shove = defended.candidates.find(c => c.action.action === "all_in")!;
    expect(shove.ev).toBeLessThan(Math.max(...defended.candidates.map(c => c.ev)));
  });
  it("does not mistake a ten-high shove for a free pot when few samples miss the callers", () => {
    // Live table hand: 7h Td on Kd 2h Jc 8c Qd, pot 4. Sixteen plain samples usually
    // contain none of the ~2% of hands that call a 50x shove, so the shove scored +4 with SE 0.
    const state = riverFixture();
    state.board = ["Kd","2h","Jc","8c","Qd"];
    state.seats[1]!.hole = ["7h","Td"];
    state.seats[0]!.hole = ["2c","3d"];
    const view = projectForPlayer(state, 1);
    let shoves = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const result = evaluateRiverActions(view, { samples: 16, seed, riskPenalty: 1, rangeDefense: 1 });
      const shove = result.candidates.find(c => c.action.action === "all_in")!;
      // Half the samples are dealt a caller, so the shove is never scored as a sure +4.
      expect(shove.standardError).toBeGreaterThan(0);
      expect(shove.ev).toBeLessThan(view.pot);
      if (result.best.action === "all_in") shoves++;
    }
    // Plain sampling shoved on about three seeds in four; the rest is noise among near-zero options.
    expect(shoves).toBeLessThanOrEqual(4);
  });
  it("estimates a bet's value without bias across sample sizes", () => {
    const state = riverFixture();
    state.seats[1]!.hole = ["Jh","Td"];
    const view = projectForPlayer(state, 1);
    const reference = evaluateRiverActions(view, { samples: 4000, seed: 99, rangeDefense: 1 });
    const small = Array.from({ length: 40 }, (_, i) => evaluateRiverActions(view, { samples: 32, seed: i + 1, rangeDefense: 1 }));
    for (const [index, candidate] of reference.candidates.entries()) {
      const mean = small.reduce((n, r) => n + r.candidates[index]!.ev, 0) / small.length;
      expect(Math.abs(mean - candidate.ev)).toBeLessThan(4 * candidate.standardError + 2);
    }
  });
});

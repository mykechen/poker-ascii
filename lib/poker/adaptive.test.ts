import { expect,it } from "vitest";
import { createAdaptivePolicy } from "./adaptive";
import { playMatch } from "./train";
import { simplePolicy } from "./bot";
it("learns observed tendencies across hands and clears them in a new session",()=>{
 const adaptive=createAdaptivePolicy({samples:30,learn:true});
 const options={seats:Array.from({length:6},(_,i)=>({name:`P${i}`,policy:i===0?adaptive.policy:simplePolicy})),hands:3,invalidAction:"throw" as const};
 const result=playMatch(options);
 expect(result.fallbacks.every(n=>n===0)).toBe(true);
 expect(adaptive.observations()).toBeGreaterThan(0);
 adaptive.policy.startSession!(["a","b"]);
 expect(adaptive.observations()).toBe(0);
});
it("processes public reveals even when the observer makes the terminal action",()=>{
 const adaptive=createAdaptivePolicy({samples:30,learn:true});
 const station:typeof simplePolicy=view=>{const a=view.validActions.find(a=>a.action==="check")??view.validActions.find(a=>a.action==="call")!;return {action:a.action,reason:"continue"};};
 const observing=Object.assign(station.bind(null),{startSession:adaptive.policy.startSession,observe:adaptive.policy.observe});
 playMatch({seats:[{name:"observer",policy:observing},{name:"opponent",policy:station}],hands:1,invalidAction:"throw"});
 expect(adaptive.revealedActions()).toBe(4);
});
it("frozen models still condition ranges on current-hand actions",()=>{
 const frozen=createAdaptivePolicy({samples:30,learn:false});
 playMatch({seats:[{name:"frozen",policy:frozen.policy},{name:"other",policy:simplePolicy}],hands:2,invalidAction:"throw"});
 expect(frozen.inferences()).toBeGreaterThan(0);
 expect(frozen.observations()).toBe(0);
});
it("defaults to no cross-hand learning while keeping inference",()=>{
 const bot=createAdaptivePolicy({samples:20,riverSamples:false});
 playMatch({seats:[{name:"bot",policy:bot.policy},{name:"other",policy:simplePolicy}],hands:2,invalidAction:"throw"});
 expect(bot.observations()).toBe(0);expect(bot.revealedActions()).toBe(0);expect(bot.inferences()).toBeGreaterThan(0);
});
it("starts each hand with the same beliefs as a fresh no-memory model",()=>{
 const bot=createAdaptivePolicy({samples:10,riverSamples:false});
 const seen=new Set<number>();
 const policy=Object.assign((view:Parameters<typeof simplePolicy>[0])=>bot.policy(view),{
  startSession:bot.policy.startSession,
  observe:(before:Parameters<typeof simplePolicy>[0],after:Parameters<typeof simplePolicy>[0])=>{
   bot.policy.observe!(before,after);
   if(seen.has(before.handNumber))return;
   seen.add(before.handNumber);
   const fresh=createAdaptivePolicy({samples:10,riverSamples:false});
   fresh.policy.startSession!(["a","b"]);fresh.policy.observe!(before,after);
   bot.typeWeights(1).forEach((p,i)=>expect(p).toBeCloseTo(fresh.typeWeights(1)[i]!));
  }
 });
 playMatch({seats:[{name:"bot",policy},{name:"other",policy:simplePolicy}],hands:2,invalidAction:"throw"});
 expect(seen.size).toBe(2);
});
it('reports observer exposure and snapshots without changing adaptive seeded play',()=>{
 const statuses:string[]=[];
 const run=(capture:boolean)=>{
 const adaptive=createAdaptivePolicy({samples:30,seed:42,riverSamples:16,learn:false,...(capture?{onPrediction:r=>{statuses.push(r.observerStatus);},onDecisionSnapshot:s=>{expect(s.ranges).toHaveLength(s.opponentSeats.length);}}:{})});
 return playMatch({seats:Array.from({length:6},(_,i)=>({name:`P${i}`,policy:i===0?adaptive.policy:simplePolicy})),hands:3,seed:9,invalidAction:'throw'});
 };
 expect(run(true)).toEqual(run(false));
 expect(statuses.length).toBeGreaterThan(0);
 expect(statuses.every(s=>['folded','all-in','funded'].includes(s))).toBe(true);
});

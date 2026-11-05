import { expect,it } from "vitest";
import { createAdaptivePolicy } from "./adaptive";
import { playMatch } from "./train";
import { simplePolicy } from "./bot";
it("learns observed tendencies across hands and clears them in a new session",()=>{
 const adaptive=createAdaptivePolicy({samples:30});
 const options={seats:Array.from({length:6},(_,i)=>({name:`P${i}`,policy:i===0?adaptive.policy:simplePolicy})),hands:3,invalidAction:"throw" as const};
 const result=playMatch(options);
 expect(result.fallbacks.every(n=>n===0)).toBe(true);
 expect(adaptive.observations()).toBeGreaterThan(0);
 adaptive.policy.startSession!(["a","b"]);
 expect(adaptive.observations()).toBe(0);
});
it("processes public reveals even when the observer makes the terminal action",()=>{
 const adaptive=createAdaptivePolicy({samples:30});
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

import {expect,it} from "vitest";
import {validateLeaguePlan,summarizeLeague,selectConfiguration} from "./league";
const plan={tuningSeeds:[1,2],evaluationSeeds:[101,102],tuningFields:[{id:"train",opponents:["chart" as const]}],evaluationFields:[{id:"test",opponents:["station" as const]}],hands:2,tableSizes:[6,7,8]};
it("rejects normalized seed leakage and repeated field identities",()=>{
 expect(()=>validateLeaguePlan({...plan,evaluationSeeds:[4294967297]})).toThrow(/overlap/);
 expect(()=>validateLeaguePlan({...plan,evaluationFields:plan.tuningFields})).toThrow(/field/);
});
it("weights cells equally and groups uncertainty by seed",()=>{
 const rows=[{seed:1,players:6,field:"a",bb100:10},{seed:1,players:8,field:"a",bb100:30},{seed:2,players:6,field:"a",bb100:20},{seed:2,players:8,field:"a",bb100:40}];
 const summary=summarizeLeague(rows);
 expect(summary.meanBb100).toBe(25);expect(summary.seedScores).toEqual([20,30]);expect(summary.interval95).toBeNull();expect(summary.worstCellBb100).toBe(15);
});
it("selects from tuning scores with deterministic ties",()=>{
 expect(selectConfiguration([{id:"b",meanBb100:5},{id:"a",meanBb100:5},{id:"c",meanBb100:4}])).toBe("a");
});
it("preserves paired seed-cell deltas and rejects missing pairs",async()=>{
 const {pairedLeagueDelta}=await import("./league");
 const a=[{seed:1,players:6,field:"x",bb100:10}];
 expect(pairedLeagueDelta(a,[{...a[0]!,bb100:4}]).meanBb100).toBe(6);
 expect(()=>pairedLeagueDelta(a,[])).toThrow(/pair/);
});
it("retains strict raw matches and balances candidate positions",async()=>{
 const {runLeagueBatch}=await import("./league");
 const batch=runLeagueBatch({id:"test",mode:"chart",styleRetention:1,riverRiskPenalty:0,equitySamples:10,riverSamples:2},1,[{id:"field",opponents:["station"]}],[6],1);
 expect(batch.cells[0]!.report.runs).toHaveLength(6);
 expect(batch.cells[0]!.report.runs.every(r=>r.report.fallbacks.every(n=>n===0)&&r.report.net.reduce((a,b)=>a+b,0)===0)).toBe(true);
 expect(batch.rows[0]!.bb100).toBe(batch.cells[0]!.report.meanBb100[0]);
});
it("rejects held-out labels that disguise the same effective opponent field",()=>{
 expect(()=>validateLeaguePlan({...plan,evaluationFields:[{id:"renamed",opponents:["chart"]}]})).toThrow(/composition/);
});
it("rejects empty or invalid standalone batch inputs before simulation",async()=>{
 const {runLeagueBatch}=await import("./league");
 const config={id:"test",mode:"chart" as const,styleRetention:1,riverRiskPenalty:0,equitySamples:10,riverSamples:2};
 expect(()=>runLeagueBatch(config,1,[],[6],1)).toThrow(/field/);
 expect(()=>runLeagueBatch(config,1,[{id:"field",opponents:["chart"]}],[2],1)).toThrow(/table/);
});
it("collects public forecast contexts and maps rotated opponents by participant name",async()=>{
 const {runLeagueBatch}=await import("./league");
 const batch=runLeagueBatch({id:"diagnostic",mode:"equity",styleRetention:1,riverRiskPenalty:1,equitySamples:2,riverSamples:2},41000,[{id:"field",opponents:["station","tight"]}],[6],1,true);
 expect(batch.forecasts!.length).toBeGreaterThan(0);
 for(const row of batch.forecasts!){
  const participant=Number(row.opponentName!.replace("opponent-",""));
  expect(row.family).toBe(participant%2===1?"station":"tight");
  expect(row.probabilities.reduce((a,b)=>a+b,0)).toBeCloseTo(1);
  expect(row).not.toHaveProperty("hole");expect(row).not.toHaveProperty("cards");
  expect(row.observerGroup).not.toBe("unknown");
 }
},30000);

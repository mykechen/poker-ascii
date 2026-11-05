import {expect,it} from "vitest";
import {RangeBeliefs} from "./range-beliefs";
import {replayObservations,type ReplayObservation} from "./contextual-replay";
const context={facing:true,canRaise:true,position:"field",size:"small",depth:"deep",players:"many"};
it("captures compact pre-update components reproducing current forecast",()=>{
 const b=new RangeBeliefs();let components:import('./contextual-replay').ResponseComponent[]=[];
 const p=b.observe(["2c","7h","Jd"],context,"passive",c=>{components=c;});
 expect(components.reduce((s,c)=>s+c.weight,0)).toBeCloseTo(1);
 for(let i=0;i<3;i++)expect(components.reduce((s,c)=>s+c.weight*c.probabilities[i]!,0)).toBeCloseTo(p[i]!);
 expect(components.length).toBeLessThanOrEqual(18);
 expect(JSON.stringify(components)).not.toContain('cards');
});
it("replays pre-action forecasts with candidate-specific beliefs and resets",()=>{
 const row:ReplayObservation={match:0,hand:1,seat:1,order:0,board:["2c","7h","Jd"],known:["Ah","Kd","2c","7h","Jd"],context,actual:"aggressive"};
 const rows=[row,{...row,order:1},{...row,hand:2,order:2}];
 const current=replayObservations(rows,{version:1,kind:"current"});
 const uniform=replayObservations(rows,{version:1,kind:"uniform"});
 expect(current[0]!.probabilities).toEqual(current[2]!.probabilities);
 expect(current[0]!.probabilities).not.toEqual(current[1]!.probabilities);
 expect(uniform[0]!.probabilities[0]).toBeCloseTo(1/3);
 expect(uniform[1]!.probabilities[0]).toBeCloseTo(1/3);
});
it("league capture excludes target cards and reproduces observer forecasts",async()=>{
 const {runLeagueBatch}=await import('./league');
 const events:ReplayObservation[]=[];
 const batch=runLeagueBatch({id:"observer",mode:"equity",styleRetention:1,riverRiskPenalty:1,equitySamples:2,riverSamples:2},61001,[{id:"test",opponents:["chart"]}],[6],1,true,undefined,e=>events.push(e));
 expect(events.length).toBeGreaterThan(0);
 expect(events.every(e=>e.known.length===e.board.length+2)).toBe(true);
 const replay=replayObservations(events,{version:1,kind:"current"});
 replay.forEach((r,i)=>r.probabilities.forEach((p,j)=>expect(p).toBeCloseTo(batch.forecasts![i]!.probabilities[j]!,10)));
});

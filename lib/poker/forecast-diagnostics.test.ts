import {expect,it} from "vitest";
import {blendResponse,reliabilityBins,seedRange} from "./forecast-diagnostics";
it("preserves legal support and has exact mixture endpoints",()=>{
 expect(blendResponse([0,.8,.2],0)).toEqual([0,.8,.2]);
 expect(blendResponse([0,.8,.2],1)).toEqual([0,.5,.5]);
 expect(()=>blendResponse([0,.8,.2],NaN)).toThrow();
});
it("reports per-class reliability including probability one and structural zeros",()=>{
 const bins=reliabilityBins([{probabilities:[0,1,0],actual:"passive"},{probabilities:[.2,.5,.3],actual:"fold"}]);
 expect(bins.find(b=>b.action==="passive"&&b.bin===9)).toMatchObject({count:1,meanPrediction:1,observedFrequency:1});
 expect(bins.filter(b=>b.action==="fold").reduce((n,b)=>n+b.count,0)).toBe(2);
});
it("validates unsigned seed ranges before expansion",()=>{
 expect(seedRange(41001,2)).toEqual([41001,41002]);
 expect(()=>seedRange(4294967295,2)).toThrow();
 expect(()=>seedRange(1,0)).toThrow();
});
it("fits a global mixture on training only and scores a smoothed frequency baseline",async()=>{
 const {fitFlopMixture,forecastScores,frequencyPrediction}=await import("./forecast-diagnostics");
 const rows:Parameters<typeof fitFlopMixture>[0]=Array.from({length:10},(_,i)=>({probabilities:[0,.99,.01],actual:i%2?"passive":"aggressive"}));
 expect(fitFlopMixture(rows).weight).toBe(1);
 expect(frequencyPrediction(rows,[0,.99,.01])[0]).toBe(0);
 expect(forecastScores(rows,1).logLoss).toBeCloseTo(Math.log(2));
 expect(()=>fitFlopMixture([])).toThrow();
});

import {expect,it} from "vitest";
import {fitContextual,objective,fitFrequency} from "./contextual-fit";
import {FEATURES} from "./contextual-response";
import type {ReplayObservation} from "./contextual-replay";
const row:ReplayObservation={match:0,hand:1,seat:1,order:0,board:["2c","7h","Jd"],known:[],context:{facing:true,position:"field",size:"small",depth:"deep",players:"many"},actual:"aggressive",components:[{weight:.4,probabilities:[.1,.3,.6],group:"strong",draw:false,style:1},{weight:.6,probabilities:[.6,.3,.1],group:"weak",draw:false,style:1}]};
it("analytic gradient matches finite differences before marginalization",()=>{
 const beta=Array(FEATURES.length*2).fill(.01);const result=objective([row],beta,.1);
 for(let i=0;i<beta.length;i++){const hi=[...beta],lo=[...beta];hi[i]+=1e-5;lo[i]-=1e-5;expect(result.gradient[i]).toBeCloseTo((objective([row],hi,.1).loss-objective([row],lo,.1).loss)/2e-5,6);}
});
it("clips with zero derivative at and beyond boundary",()=>{
 const beta=Array(FEATURES.length*2).fill(0);beta[0]=3;
 expect(objective([row],beta,0).gradient[0]).toBe(0);beta[0]=4;expect(objective([row],beta,0).gradient[0]).toBe(0);
});
it("fits deterministically, masks sparse features and rejects nonconvergence",()=>{
 const rows=Array.from({length:60},(_,i)=>({...row,actual:i%2?"passive" as const:"aggressive" as const}));
 const fit=fitContextual(rows,.1);expect(fit.converged).toBe(true);expect(fitContextual(rows,.1)).toEqual(fit);
 expect(fit.model.coefficients[0][FEATURES.indexOf("paired")]).toBe(0);
 expect(fitContextual(rows,.1,0).converged).toBe(false);
 expect(fitContextual([row],.1).model.coefficients.flat().every(v=>v===0)).toBe(true);
});
it("frequency fitting uses one pseudocount per supported class",()=>{
 expect(fitFrequency([row]).frequencies['111']).toEqual([.25,.25,.5]);
});

import {FEATURES,encodeContext,supportKey,transformResponse,type ResponseModel,type Probabilities} from "./contextual-response";
import type {ReplayObservation} from "./contextual-replay";
type Contextual=Extract<ResponseModel,{kind:"contextual"}>;
const actionIndex=(a:string)=>a==="fold"?0:a==="passive"?1:2;
function components(row:ReplayObservation){if(!row.components?.length)throw new Error("Training requires pre-action components.");return row.components;}
export function objective(rows:ReplayObservation[],beta:number[],lambda:number){
 if(!rows.length||beta.length!==2*FEATURES.length||beta.some(v=>!Number.isFinite(v))||lambda<0)throw new Error("Invalid fitting inputs.");
 const n=FEATURES.length,gradient=beta.map(v=>lambda*v);let loss=lambda*beta.reduce((s,v)=>s+v*v,0)/2;
 for(const row of rows){
  const cs=components(row),x=encodeContext(row.context,row.board,cs[0]!.probabilities);
  const offsets=[0,1].map(k=>x.reduce((s,v,i)=>s+v*beta[k*n+i]!,0)) as [number,number];
  const qs=cs.map(c=>transformResponse(c.probabilities,offsets));const actual=actionIndex(row.actual);
  const probability=cs.reduce((s,c,j)=>s+c.weight*qs[j]![actual]!,0);
  if(probability<=0)throw new Error("Observed action outside modeled support.");
  loss-=Math.log(probability)/rows.length;
  for(let k=0;k<2;k++){
   if(Math.abs(offsets[k]!)>=3)continue;
   const index=k===0?0:2;
   const derivative=cs.reduce((s,c,j)=>s+c.weight*qs[j]![actual]!*((actual===index?1:0)-qs[j]![index]!),0);
   for(let i=0;i<n;i++)gradient[k*n+i]-=x[i]!*derivative/probability/rows.length;
  }
 }
 return {loss,gradient};
}
export function fitFrequency(rows:ReplayObservation[]):Extract<ResponseModel,{kind:"frequency"}>{
 const frequencies:Record<string,Probabilities>={};
 for(const row of rows){const p=components(row)[0]!.probabilities,key=supportKey(p);const counts=frequencies[key]??p.map(v=>v>0?1:0) as Probabilities;counts[actionIndex(row.actual)]++;frequencies[key]=counts;}
 for(const [key,p] of Object.entries(frequencies)){const total=p.reduce((a,b)=>a+b,0);frequencies[key]=p.map(v=>v/total) as Probabilities;}
 return {version:1,kind:"frequency",frequencies};
}
export function fitContextual(rows:ReplayObservation[],lambda:number,maxIterations=200){
 const counts=FEATURES.map((_,i)=>rows.reduce((s,r)=>s+encodeContext(r.context,r.board,components(r)[0]!.probabilities)[i]!,0));
 const active=counts.map(n=>n>=50);let beta=Array(FEATURES.length*2).fill(0) as number[];
 const trace:{iteration:number;loss:number;gradientNorm:number;step:number}[]=[];let converged=false;
 for(let iteration=0;iteration<=maxIterations;iteration++){
  const value=objective(rows,beta,lambda);const gradient=value.gradient.map((v,i)=>active[i%FEATURES.length]?v:0);
  const norm=Math.sqrt(gradient.reduce((s,v)=>s+v*v,0));
  if(norm<=1e-6){trace.push({iteration,loss:value.loss,gradientNorm:norm,step:0});converged=true;break;}
  if(iteration===maxIterations){trace.push({iteration,loss:value.loss,gradientNorm:norm,step:0});break;}
  let step=1;let next=beta;
  while(step>=1e-12){next=beta.map((v,i)=>v-step*gradient[i]!);if(objective(rows,next,lambda).loss<=value.loss-1e-4*step*norm*norm)break;step/=2;}
  trace.push({iteration,loss:value.loss,gradientNorm:norm,step});if(step<1e-12)break;beta=next;
 }
 const model:Contextual={version:1,kind:"contextual",features:[...FEATURES],coefficients:[beta.slice(0,FEATURES.length),beta.slice(FEATURES.length)],supports:[...new Set(rows.map(r=>supportKey(components(r)[0]!.probabilities)))].sort(),lambda};
 return {converged,model,trace,featureCounts:counts};
}

import {FEATURES,supportKey,type ResponseModel} from './contextual-response';
import {objective} from './contextual-fit';
import type {ReplayObservation} from './contextual-replay';
import type {SelectionScore} from './contextual-selection';
export type OffsetPanel={batch:number;rows:ReplayObservation[]};
type Coverage={observations:number;hands:number;batches:number;actions:Record<string,number>};
function flopSupport(row:ReplayObservation){
 if(!row.components?.length)throw new Error('Flop coverage requires pre-action components.');
 const support=supportKey(row.components[0]!.probabilities);
 if(row.components.some(c=>supportKey(c.probabilities)!==support))throw new Error('Latent components have different legal supports.');
 return support;
}
export function supportCoverage(panels:OffsetPanel[]):Record<string,Coverage>{
 if(panels.some(p=>!Number.isSafeInteger(p.batch))||new Set(panels.map(p=>p.batch)).size!==panels.length)throw new Error('Provide unique integer batch identities.');
 const groups=new Map<string,{observations:number;hands:Set<string>;batches:Set<number>;actions:Record<string,number>}>();
 for(const panel of panels)for(const row of panel.rows.filter(r=>r.board.length===3)){
  const key=flopSupport(row),g=groups.get(key)??{observations:0,hands:new Set<string>(),batches:new Set<number>(),actions:{}};
  g.observations++;g.hands.add(`${panel.batch}:${row.match}:${row.hand}`);g.batches.add(panel.batch);g.actions[row.actual]=(g.actions[row.actual]??0)+1;groups.set(key,g);
 }
 return Object.fromEntries([...groups].sort().map(([key,g])=>[key,{observations:g.observations,hands:g.hands.size,batches:g.batches.size,actions:g.actions}]));
}
export function fitSupportOffsets(panels:OffsetPanel[],lambda:number,maxIterations=1000){
 if(![.1,1,10].includes(lambda)||!Number.isSafeInteger(maxIterations)||maxIterations<0||maxIterations>1000)throw new Error('Invalid support-offset fitting settings.');
 const coverage=supportCoverage(panels),n=FEATURES.length;
 const coefficients:[number[],number[]]=[Array(n).fill(0),Array(n).fill(0)];
 const supports:string[]=[];
 const traces:Record<string,{converged:boolean;trace:{iteration:number;loss:number;gradientNorm:number;step:number}[]}>={};
 for(const support of ['011','110','111']){
  const c=coverage[support];if(!c||c.observations<200||c.hands<50||c.batches<8)continue;
  supports.push(support);
  const rows=panels.flatMap(p=>p.rows.filter(r=>r.board.length===3&&flopSupport(r)===support));
  const feature=FEATURES.indexOf(`support:${support}`);
  const active=[...(support[0]==='1'?[feature]:[]),...(support[2]==='1'?[n+feature]:[])];
  let beta:number[]=Array(2*n).fill(0),converged=false;
  const trace:{iteration:number;loss:number;gradientNorm:number;step:number}[]=[];
  for(let iteration=0;iteration<=maxIterations;iteration++){
   const value=objective(rows,beta,lambda);
   const norm=Math.sqrt(active.reduce((s,i)=>s+value.gradient[i]!**2,0));
   if(norm<=1e-6){trace.push({iteration,loss:value.loss,gradientNorm:norm,step:0});converged=true;break;}
   if(iteration===maxIterations){trace.push({iteration,loss:value.loss,gradientNorm:norm,step:0});break;}
   let step=1,next=beta;
   while(step>=1e-12){next=beta.map((v,i)=>active.includes(i)?v-step*value.gradient[i]!:0);if(objective(rows,next,lambda).loss<=value.loss-1e-4*step*norm*norm)break;step/=2;}
   trace.push({iteration,loss:value.loss,gradientNorm:norm,step});if(step<1e-12)break;beta=next;
  }
  traces[support]={converged,trace};
  for(const i of active)coefficients[i>=n?1:0][i%n]=beta[i]!;
 }
 const model:Extract<ResponseModel,{kind:'contextual'}>={version:1,kind:'contextual',features:[...FEATURES],coefficients,supports,lambda};
 return {model,coverage,traces,converged:Object.values(traces).every(t=>t.converged)};
}
export function selectSupportOffset(scores:SelectionScore[],panels:OffsetPanel[]){
 const sparse=supportCoverage(panels)['110'];
 if(!sparse||sparse.observations<100||sparse.hands<30||sparse.batches<5)return {status:'insufficient-data',selected:'current',sparse};
 const current=scores.find(s=>s.id==='current');if(!current)throw new Error('Current validation baseline required.');
 const eligible=scores.filter(s=>s.id==='current'||s.id.startsWith('offset:')&&s.scores.count===current.scores.count&&s.scores.logLoss<=current.scores.logLoss*.99&&s.scores.brier<=current.scores.brier&&Object.entries(current.groups).every(([key,base])=>base.count<100||!!s.groups[key]&&s.groups[key]!.count===base.count&&s.groups[key]!.logLoss<=base.logLoss+.02));
 const best=Math.min(...eligible.map(s=>s.scores.logLoss));
 const selected=eligible.filter(s=>s.scores.logLoss<=best+1e-6).sort((a,b)=>(a.id==='current'?-1:b.id==='current'?1:Number(b.id.split(':')[1])-Number(a.id.split(':')[1])))[0]!.id;
 return {status:'selected',selected,sparse};
}

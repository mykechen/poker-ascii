import {FEATURES,supportKey,type ResponseModel} from './contextual-response';
import {objective} from './contextual-fit';
import type {ReplayObservation} from './contextual-replay';
import type {SelectionScore} from './contextual-selection';
export type Stratum='legacy'|'expanded';
export type PopulationPanel={batch:number;stratum:Stratum;rows:ReplayObservation[]};
const strata:Stratum[]=['legacy','expanded'];
type Count={observations:number;hands:number;batches:number};
export type PopulationCoverage=Record<Stratum,Record<string,Count&{actions:Record<string,Count>}>>;
function flopSupport(row:ReplayObservation){
 if(!row.components?.length)throw new Error('Flop coverage requires pre-action components.');
 const support=supportKey(row.components[0]!.probabilities);
 if(row.components.some(c=>supportKey(c.probabilities)!==support))throw new Error('Latent components have different legal supports.');
 return support;
}
export function populationCoverage(panels:PopulationPanel[]):PopulationCoverage{
 const seen=new Set<string>();
 for(const p of panels){const key=`${p.stratum}:${p.batch}`;if(!strata.includes(p.stratum)||!Number.isSafeInteger(p.batch)||seen.has(key))throw new Error('Provide unique integer batch/stratum identities.');seen.add(key);}
 const result={legacy:{},expanded:{}} as PopulationCoverage;
 for(const s of strata){
  const groups=new Map<string,{hands:Set<string>;batches:Set<number>;observations:number;actions:Map<string,{hands:Set<string>;batches:Set<number>;observations:number}>}>();
  for(const p of panels.filter(p=>p.stratum===s))for(const r of p.rows.filter(r=>r.board.length===3)){
   const key=flopSupport(r),hand=`${p.batch}:${r.match}:${r.hand}`;
   const g=groups.get(key)??{hands:new Set<string>(),batches:new Set<number>(),observations:0,actions:new Map()};
   const a=g.actions.get(r.actual)??{hands:new Set<string>(),batches:new Set<number>(),observations:0};
   for(const c of [g,a]){c.observations++;c.hands.add(hand);c.batches.add(p.batch);}
   g.actions.set(r.actual,a);groups.set(key,g);
  }
  const count=(c:{observations:number;hands:Set<string>;batches:Set<number>}):Count=>({observations:c.observations,hands:c.hands.size,batches:c.batches.size});
  result[s]=Object.fromEntries([...groups].sort().map(([k,g])=>[k,{...count(g),actions:Object.fromEntries([...g.actions].sort().map(([a,c])=>[a,count(c)]))}]));
 }
 return result;
}
function enough(c:Count|undefined,o:number,h:number,b:number){return !!c&&c.observations>=o&&c.hands>=h&&c.batches>=b;}
function trainingEligible(c:PopulationCoverage[Stratum][string]|undefined,support:string){return enough(c,200,50,8)&&(support!=='110'||['fold','passive'].every(a=>enough(c?.actions[a],20,10,5)));}
export function populationObjective(rows:Record<Stratum,ReplayObservation[]>,beta:number[],lambda:number){
 if(!Number.isFinite(lambda)||lambda<0)throw new Error('Invalid population penalty.');
 const a=objective(rows.legacy,beta,0),b=objective(rows.expanded,beta,0);
 return {loss:(a.loss+b.loss)/2+lambda*beta.reduce((s,v)=>s+v*v,0)/2,gradient:beta.map((v,i)=>(a.gradient[i]!+b.gradient[i]!)/2+lambda*v)};
}
export function fitPopulationOffsets(panels:PopulationPanel[],lambda:number,maxIterations=1000){
 if(![.1,1,10].includes(lambda)||!Number.isSafeInteger(maxIterations)||maxIterations<0||maxIterations>1000)throw new Error('Invalid support-offset fitting settings.');
 const coverage=populationCoverage(panels),n=FEATURES.length;
 const coefficients:[number[],number[]]=[Array(n).fill(0),Array(n).fill(0)];
 const supports:string[]=[];
 const traces:Record<string,{converged:boolean;trace:{iteration:number;loss:number;gradientNorm:number;step:number}[]}>={};
 for(const support of ['011','110','111']){
  if(!strata.every(s=>trainingEligible(coverage[s][support],support)))continue;
  supports.push(support);
  const rows=Object.fromEntries(strata.map(s=>[s,panels.filter(p=>p.stratum===s).flatMap(p=>p.rows.filter(r=>r.board.length===3&&flopSupport(r)===support))])) as Record<Stratum,ReplayObservation[]>;
  const feature=FEATURES.indexOf(`support:${support}`);
  const active=[...(support[0]==='1'?[feature]:[]),...(support[2]==='1'?[n+feature]:[])];
  let beta:number[]=Array(2*n).fill(0),converged=false;
  const trace:{iteration:number;loss:number;gradientNorm:number;step:number}[]=[];
  for(let iteration=0;iteration<=maxIterations;iteration++){
   const value=populationObjective(rows,beta,lambda);
   const norm=Math.sqrt(active.reduce((s,i)=>s+value.gradient[i]!**2,0));
   if(norm<=1e-6){trace.push({iteration,loss:value.loss,gradientNorm:norm,step:0});converged=true;break;}
   if(iteration===maxIterations){trace.push({iteration,loss:value.loss,gradientNorm:norm,step:0});break;}
   let step=1,next=beta;
   while(step>=1e-12){next=beta.map((v,i)=>active.includes(i)?v-step*value.gradient[i]!:0);if(populationObjective(rows,next,lambda).loss<=value.loss-1e-4*step*norm*norm)break;step/=2;}
   trace.push({iteration,loss:value.loss,gradientNorm:norm,step});if(step<1e-12)break;beta=next;
  }
  traces[support]={converged,trace};
  for(const i of active)coefficients[i>=n?1:0][i%n]=beta[i]!;
 }
 const model:Extract<ResponseModel,{kind:'contextual'}>={version:1,kind:'contextual',features:[...FEATURES],coefficients,supports,lambda};
 return {model,coverage,traces,converged:Object.values(traces).every(t=>t.converged)};
}
export function selectPopulationOffset(scores:{id:string;byStratum:Record<Stratum,SelectionScore>}[],panels:PopulationPanel[],complete=true){
 const coverage=populationCoverage(panels);
 if(!complete||!strata.every(s=>enough(coverage[s]['110'],100,30,5)&&enough(coverage[s]['110']?.actions.fold,s==='legacy'?10:20,s==='legacy'?5:10,s==='legacy'?3:5)))return {status:'insufficient-data',selected:'current',coverage};
 const current=scores.find(s=>s.id==='current');if(!current)throw new Error('Current validation baseline required.');
 const macro=(s:typeof current,key:'logLoss'|'brier')=>strata.reduce((sum,k)=>sum+s.byStratum[k].scores[key],0)/2;
 const eligible=scores.filter(s=>s.id==='current'||/^offset:(?:0?\.1|1|10)$/.test(s.id)&&macro(s,'logLoss')<=macro(current,'logLoss')*.99&&macro(s,'brier')<=macro(current,'brier')&&strata.every(k=>{
  const a=s.byStratum[k],b=current.byStratum[k];
  return a.scores.count===b.scores.count&&a.scores.logLoss<=b.scores.logLoss+.02&&a.scores.brier<=b.scores.brier+.02&&Object.entries(b.groups).every(([key,g])=>g.count<100||!!a.groups[key]&&a.groups[key]!.count===g.count&&a.groups[key]!.logLoss<=g.logLoss+.02);
 }));
 const best=Math.min(...eligible.map(s=>macro(s,'logLoss')));
 const selected=eligible.filter(s=>macro(s,'logLoss')<=best+1e-6).sort((a,b)=>a.id==='current'?-1:b.id==='current'?1:Number(b.id.split(':')[1])-Number(a.id.split(':')[1]))[0]!.id;
 return {status:'selected',selected,coverage};
}

import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync,renameSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createAdaptivePolicy} from '../lib/poker/adaptive';
import {type Policy} from '../lib/poker/bot';
import {playMatch} from '../lib/poker/train';
import {strategyById} from '../lib/poker/strategies';
import type {LeagueField} from '../lib/poker/league';
import {balanceFields} from '../lib/poker/population-fields';
import {estimateEquity} from '../lib/poker/equity';
import type {DecisionSnapshot} from '../lib/poker/equity-policy';
import {eligibleCallPots} from '../lib/poker/diagnostic-truth';
import {selectStates,streamMetrics,clusterSummary,claimPaidHand,pairedSeeds,assignedStreet} from '../lib/poker/decision-stability';
import {scorePrediction} from '../lib/poker/calibration';
const fields:Record<'legacy'|'expanded',LeagueField[]>={
 legacy:[{id:'train-balanced',opponents:['chart','tight','station','position','aggressor']},{id:'train-pressure',opponents:['maniac','station','chart','aggressor','tight']},{id:'train-passive',opponents:['station','maniac','position','tight','chart']}],
 expanded:[{id:'train-expanded-a',opponents:['multiway','station','learner','tight','maniac']},{id:'train-expanded-b',opponents:['learner','position','multiway','aggressor','station']},{id:'train-expanded-c',opponents:['tight','multiway','maniac','learner','position']}]
};
const settings={seeds:Array.from({length:20},(_,i)=>103001+i),fields,hands:4,players:[6,7,8],budgets:[50,128,512],exactLimit:10000,salts:[0,2654435769,2246822507,3266489909,668265263,374761393,3550635116,4251993797],budgetMs:7200000,sampling:"hash-assigned-street-v2",quotas:Object.fromEntries(['legacy','expanded'].flatMap(p=>[['preflop',54],['flop',53],['turn',53]].map(([s,n])=>[`${p}:${s}`,n]))) as Record<string,number>};
const protocol='docs/superpowers/specs/2026-11-08-decision-stability-revision.md';
const inheritedProtocol='docs/superpowers/specs/2026-11-07-decision-stability-execution.md';
const registryPath='handoffs/seed-registry.json';
const registry=JSON.parse(readFileSync(registryPath,'utf8'));
for(const seed of settings.seeds){
 if(registry.started_batches.some((r:{seed:number})=>r.seed===seed)||registry.retired_inspected_ranges.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end)||!registry.reserved_not_run.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end))throw new Error(`Seed ${seed} must be fresh and reserved.`);
}
if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw new Error('Commit source and registry before starting.');
const hash=createHash('sha256');
for(const file of [...readdirSync('lib/poker').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).sort().map(f=>`lib/poker/${f}`),'scripts/decision-stability.ts',protocol,inheritedProtocol,'package.json','package-lock.json'])hash.update(file).update(readFileSync(file));
hash.update(JSON.stringify(settings));
const fingerprint=hash.digest('hex'),directory=`handoffs/diagnostics/${new Date().toISOString().slice(0,10)}-decision-stability-${fingerprint.slice(0,12)}`;
if(existsSync(directory))throw new Error('Run already exists; no automatic resume.');
mkdirSync(directory,{recursive:true});
function atomic(file:string,value:unknown){writeFileSync(`${directory}/${file}.tmp`,JSON.stringify(value,null,2)+'\n');renameSync(`${directory}/${file}.tmp`,`${directory}/${file}`);}
writeFileSync(`${directory}/protocol.md`,readFileSync(protocol));
writeFileSync(`${directory}/inherited-protocol.md`,readFileSync(inheritedProtocol));
const started=performance.now();
const progress={status:'running',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fingerprint,settings,completedMatches:0,completedStates:0,elapsedMs:0,error:null as string|null};
let stopped=false;for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{stopped=true;});
class CapReached extends Error{}
function boundary(){if(stopped||performance.now()-started>=settings.budgetMs)throw new CapReached('Stopped at safe boundary.');}
function save(){progress.elapsedMs=performance.now()-started;atomic('progress.json',progress);}
type State=DecisionSnapshot&{id:string;cell:string;seed:number;population:string;field:string;players:number;rotation:number;hand:number};
const assignments:Record<string,unknown>[]= [];
const manifest:Record<string,unknown>[]= [];
let collectionMs=0;
const reservoir:State[]=[],eligible:Record<string,number>={},exposure:Record<string,{count:number;loss:number}>={},counts:Record<string,number>={};
const results:{id:string;cell:string;seed:number;field:string;players:number;rotation:number;hand:number;budgets:Record<string,{streams:ReturnType<typeof score>[];metrics:ReturnType<typeof streamMetrics>}>}[]=[];
function score(state:State,samples:number,seed:number){
 const {view}=state,own=view.seats[view.toAct!]!.hole;
 if(!Array.isArray(own)||own.length!==2)throw new Error('Missing own cards.');
 const {cost,pots,opponentSeats}=eligibleCallPots(view);
 if(JSON.stringify(opponentSeats)!==JSON.stringify(state.opponentSeats))throw new Error('Range order mismatch.');
 const start=performance.now();
 const equity=estimateEquity({hero:[own[0]!,own[1]!],board:view.board,opponents:state.ranges,pots,samples,seed,exactLimit:settings.exactLimit});
 return {...equity,callValue:equity.expectedPayout!-cost,elapsedMs:performance.now()-start,seed};
}
function archiveStates(){atomic('assignments.json',assignments);writeFileSync(`${directory}/states.json.gz`,gzipSync(JSON.stringify(reservoir)));}
save();
try{
 for(const [index,seed] of settings.seeds.entries())for(const population of ['legacy','expanded'] as const)for(const field of balanceFields(fields[population],index))for(const players of settings.players)for(let rotation=0;rotation<players;rotation++){
  boundary();
  const batchId=`${seed}:${population}:${field.id}:${players}:${rotation}`;
  registry.started_batches.push({seed,phase:'decision-stability',id:'current',stratum:population,directory,match:batchId,startedAt:new Date().toISOString()});
  writeFileSync(`${registryPath}.tmp`,JSON.stringify(registry,null,2)+'\n');renameSync(`${registryPath}.tmp`,registryPath);
  const seen=new Set<number>();
  for(let hand=1;hand<=settings.hands;hand++)assignments.push({seed,population,field:field.id,players,rotation,hand,street:assignedStreet(JSON.stringify([seed,population,field.id,players,rotation,hand]))});
  const adaptive=createAdaptivePolicy({samples:50,seed:42,riverSamples:16,riverRiskPenalty:1,learn:false,styleRetention:1,responseModel:{version:1,kind:'current'},onRiverDecision:()=>{counts.river=(counts.river??0)+1;},onPrediction:r=>{
   const key=`${population}:${r.street}:${r.observerStatus}`;
   const row=exposure[key]??={count:0,loss:0};row.count++;row.loss+=scorePrediction(r.probabilities,r.actual).logLoss;
  },onDecisionSnapshot:s=>{
   const street=s.view.street;
   const key=`${population}:${street}:${s.callCost>0?'paid':'free'}`;counts[key]=(counts[key]??0)+1;
   if(street!==assignedStreet(JSON.stringify([seed,population,field.id,players,rotation,s.view.handNumber])))return;
   if(!claimPaidHand(seen,s.view.handNumber,street,s.callCost))return;
   const cell=`${population}:${street}`;eligible[cell]=(eligible[cell]??0)+1;
   const id=createHash('sha256').update(JSON.stringify([seed,population,field.id,players,rotation,s.view.handNumber,street,s.view.log.length])).digest('hex');
   manifest.push({id,cell,seed,population,field:field.id,players,rotation,hand:s.view.handNumber,logLength:s.view.log.length});
   const state:State={...s,id,cell,seed,population,field:field.id,players,rotation,hand:s.view.handNumber};
   reservoir.push(state);
   const same=reservoir.filter(r=>r.cell===cell).sort((a,b)=>a.id.localeCompare(b.id));
   if(same.length>settings.quotas[cell]!){const discard=same[same.length-1]!;reservoir.splice(reservoir.indexOf(discard),1);}
  }});
  const candidate:Policy=adaptive.policy;
  const participants=Array.from({length:players},(_,i)=>i===0?{name:'current',policy:candidate}:{name:`opponent-${i}`,policy:strategyById(field.opponents[(i-1)%field.opponents.length]!).policy});
  const report=playMatch({seats:participants.map((_,seat)=>participants[(seat+rotation)%players]!),seed,hands:4,invalidAction:'throw'});
  if(report.net.reduce((a,b)=>a+b,0)!==0||report.fallbacks.some(n=>n!==0))throw new Error('Invalid accounting or fallback.');
  atomic(`match-${batchId.replaceAll(':','-')}.json`,report);
  progress.completedMatches++;archiveStates();atomic('exposure.json',{exposure,counts,eligible});save();
  await new Promise<void>(r=>setImmediate(r));
 }
 collectionMs=performance.now()-started;atomic('eligible-manifest.json',manifest);
 const selected=selectStates(reservoir,settings.quotas);
 for(const state of selected){
  boundary();
  const base=(42^Math.imul(state.hand,31)^state.view.log.length^state.view.toAct!)|0;
  const baseline=score(state,50,base);
  if(Math.abs(baseline.callValue-state.showdownCallValue)>1e-8)throw new Error('Original decision value mismatch.');
  const streams=Object.fromEntries(settings.budgets.map(b=>[b,pairedSeeds(state.hand,state.view.log.length,state.view.toAct!).map(seed=>score(state,b,seed))]));
  const reference=streams[512]!.map(r=>r.callValue);
  const row={id:state.id,cell:state.cell,seed:state.seed,field:state.field,players:state.players,rotation:state.rotation,hand:state.hand,budgets:Object.fromEntries(settings.budgets.map(b=>[b,{streams:streams[b]!,metrics:streamMetrics(streams[b]!.map(r=>r.callValue),reference)}]))};
  results.push(row);atomic(`state-${state.id}.json`,row);progress.completedStates++;save();
  await new Promise<void>(r=>setImmediate(r));
 }
 progress.status='scored';
}catch(error){if(collectionMs===0)collectionMs=performance.now()-started;progress.status=error instanceof CapReached?'capped':error instanceof Error&&error.message.startsWith('Insufficient coverage')?'insufficient-coverage':'failed';progress.error=error instanceof Error?error.stack??error.message:String(error);}
archiveStates();atomic('eligible-manifest.json',manifest);save();atomic('results.json',{progress,collectionMs,eligible,exposure,counts,results});
console.log(directory);if(progress.status==='failed')process.exitCode=1;

if(progress.status==='scored'){
 try{
 const metrics=['flipFraction','referenceDisagreement','callValueSD','nearZeroFraction'] as const;
 const summary=Object.fromEntries(settings.budgets.map(b=>[b,Object.fromEntries(metrics.map(metric=>{
 const cells=clusterSummary(results.map(r=>({cell:r.cell,seed:r.seed,match:`${r.field}:${r.players}:${r.rotation}`,value:r.budgets[b]!.metrics[metric]})),Object.keys(settings.quotas),settings.seeds);
 return [metric,{cells,macroMean:Object.values(cells).reduce((sum,r)=>sum+r.mean,0)/6}];
 }))]));
 const timing=Object.fromEntries(settings.budgets.map(b=>[b,{totalMs:results.reduce((sum,r)=>sum+r.budgets[b]!.streams.reduce((n,s)=>n+s.elapsedMs,0),0),decisions:results.length*8,exact:results.reduce((sum,r)=>sum+r.budgets[b]!.streams.filter(s=>s.method==='exact').length,0)}]));
 atomic('summary.json',{summary,timing,collectionMs,elapsedMs:progress.elapsedMs,exposure,eligible,counts,limitations:['Current-policy first paid decision per hand only.','512 is an estimate; stability is not profit.','Absent seed cells reported without imputing values.','No validation or promotion.']});
 progress.status='complete';save();
 }catch(error){progress.status='failed';progress.error=String(error);save();process.exitCode=1;}
 atomic('results.json',{progress,collectionMs,eligible,exposure,counts,results});
}

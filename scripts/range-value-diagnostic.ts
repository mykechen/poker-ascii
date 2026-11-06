import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {runBenchmark,type BenchmarkReport} from '../lib/poker/benchmark';
import {createAdaptivePolicy} from '../lib/poker/adaptive';
import {simplePolicy,type Policy,type PolicyAction} from '../lib/poker/bot';
import {strategyById} from '../lib/poker/strategies';
import {estimateEquity,type WeightedHand} from '../lib/poker/equity';
import {DiagnosticBeliefs,trueHandScore} from '../lib/poker/diagnostic-beliefs';
import {reconstructDeals,eligibleCallPots,exactPrivilegedCallValue} from '../lib/poker/diagnostic-truth';
import {supportKey,type ResponseModel} from '../lib/poker/contextual-response';
import {scorePrediction} from '../lib/poker/calibration';
import type {ReplayObservation} from '../lib/poker/contextual-replay';
import type {PublicView} from '../lib/poker/view';
const sourceRun='handoffs/runs/2026-11-06-population-8be4d1cb56f3';
const freezeBytes=readFileSync(`${sourceRun}/freeze.json`),freeze=JSON.parse(freezeBytes.toString()) as {model:ResponseModel;modelHash:string};
const expectedHash='df943f898f0944386c96901b8a40abaac4ec14c6ab154cdbe5177f0c937dfb54';
if(freeze.modelHash!==expectedHash||createHash('sha256').update(JSON.stringify(freeze.model)).digest('hex')!==expectedHash)throw new Error('Selected population model hash mismatch.');
const registryPath='handoffs/seed-registry.json',registry=JSON.parse(readFileSync(registryPath,'utf8'));
const originalFiles=execFileSync('git',['ls-tree','-r','--name-only','16d6fbc','lib/poker'],{encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts'));
for(const file of originalFiles)if(!readFileSync(file).equals(execFileSync('git',['show',`16d6fbc:${file}`])))throw new Error(`Reference policy/engine source changed: ${file}`);
const settings={seeds:Array.from({length:10},(_,i)=>93001+i),hands:4,tableSizes:[6,7,8],maxValueStates:160,referenceSamples:512,replicateSamples:50,salts:[0,0x9e3779b9,0x85ebca6b,0xc2b2ae35,0x27d4eb2f,0x165667b1,0xd3a2646c,0xfd7046c5],modelHash:expectedHash,sourceRun,referenceCommit:'16d6fbc',budgetMs:7200000,classification:'Inspected-data diagnostic reuse; not fresh confirmation.'};
for(const seed of settings.seeds)if(!registry.retired_inspected_ranges.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end)||!registry.started_batches.some((r:{seed:number;directory:string;id:string})=>r.seed===seed&&r.directory===sourceRun&&r.id==='current'))throw new Error(`Diagnostic seed${seed} lacks inspected reference provenance.`);
const hash=createHash('sha256');for(const file of [...readdirSync('lib/poker').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).sort().map(f=>`lib/poker/${f}`),'scripts/range-value-diagnostic.ts','docs/superpowers/specs/2026-11-06-range-value-diagnostic-design.md','package.json','package-lock.json'])hash.update(file).update(readFileSync(file));hash.update(JSON.stringify(settings));
const fingerprint=hash.digest('hex'),directory=`handoffs/diagnostics/${new Date().toISOString().slice(0,10)}-range-value-${fingerprint.slice(0,12)}`;
if(existsSync(directory))throw new Error('Preserve prior diagnostic; no automatic resume.');mkdirSync(directory,{recursive:true});
function atomic(path:string,value:string|Buffer){writeFileSync(`${directory}/${path}.tmp`,value);renameSync(`${directory}/${path}.tmp`,`${directory}/${path}`);}
atomic('protocol.md',readFileSync('docs/superpowers/specs/2026-11-06-range-value-diagnostic-design.md'));atomic('freeze.json',freezeBytes);
const started=performance.now();
const progress={status:'running',phase:'reproduction',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fingerprint,settings,startedAt:new Date().toISOString(),elapsedMs:0,completedSeeds:[] as number[],completedStates:[] as string[],decisions:0,paidFlopTurnDecisions:0,eligibleHands:0,observations:0,error:null as string|null};
registry.diagnostic_uses??=[];registry.diagnostic_uses.push({directory,fingerprint,seeds:settings.seeds,referenceRun:sourceRun,classification:settings.classification,startedAt:progress.startedAt});writeFileSync(`${registryPath}.tmp`,JSON.stringify(registry,null,2)+'\n');renameSync(`${registryPath}.tmp`,registryPath);
function save(){progress.elapsedMs=performance.now()-started;atomic('progress.json',JSON.stringify(progress,null,2)+'\n');}
class BudgetLimit extends Error{}
let stopped=false;for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{stopped=true;});
function boundary(){if(stopped)throw new Error('Interrupted at safe boundary.');if(performance.now()-started>=settings.budgetMs)throw new BudgetLimit('Two-hour diagnostic cap reached.');}
type Identity={seed:number;field:string;players:number;rotation:number;match:number;hand:number};
type RangeRecord=Identity&{seat:number;family:string;actual:string;support:string;observerActive:boolean;model:string;beforeProbability:number;afterProbability:number;beforeLoss:number;afterLoss:number;informationGain:number;actionLoss:number};
type ValueState={id:string;identity:Identity;view:PublicView;ranges:Record<string,Record<number,WeightedHand[]>>;baselineCallValue:number;actualAction:string;holes:ReturnType<typeof reconstructDeals>[number]['holes']};
const reservoir:ValueState[]=[];
const rangeRecords:RangeRecord[]=[];
const valueResults:Record<string,unknown>[]=[];
function consider(state:ValueState){reservoir.push(state);reservoir.sort((a,b)=>a.id.localeCompare(b.id));if(reservoir.length>settings.maxValueStates)reservoir.pop();}
function validateTruth(deal:ReturnType<typeof reconstructDeals>[number],board:PublicView['board'],hole:unknown,hero:number){
 if(JSON.stringify(deal.board.slice(0,board.length))!==JSON.stringify(board)||JSON.stringify(deal.holes[hero])!==JSON.stringify(hole))throw new Error('Reconstructed observer cards or public board mismatch.');
}
function predictedValue(state:Pick<ValueState,'view'|'ranges'>,model:string,samples:number,seed:number){
 const {cost,opponentSeats,pots}=eligibleCallPots(state.view);const own=state.view.seats[state.view.toAct!]!.hole;
 if(!Array.isArray(own)||own.length!==2)throw new Error('Public decision lacks own cards.');
 const result=estimateEquity({hero:[own[0]!,own[1]!],board:state.view.board,opponents:opponentSeats.map(s=>state.ranges[model]![s]!),pots,samples,seed});
 const callValue=result.expectedPayout!-cost;return {callValue,action:callValue>=0?'call':'fold',equity:result.equity,method:result.method};
}
function mean(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;}
function summarize(){
 const group=(rows:RangeRecord[],model:string)=>{const r=rows.filter(x=>x.model===model);return {count:r.length,beforeLoss:mean(r.map(x=>x.beforeLoss)),afterLoss:mean(r.map(x=>x.afterLoss)),informationGain:mean(r.map(x=>x.informationGain)),actionLoss:mean(r.map(x=>x.actionLoss))};};
 const perSeed=progress.completedSeeds.map(seed=>{const rows=rangeRecords.filter(r=>r.seed===seed);return {seed,current:group(rows,'current'),offset:group(rows,'offset')};});
 atomic('summary.json',JSON.stringify({settings,status:progress.status,completedSeeds:progress.completedSeeds.length,range:{all:{current:group(rangeRecords,'current'),offset:group(rangeRecords,'offset')},observerActive:{current:group(rangeRecords.filter(r=>r.observerActive),'current'),offset:group(rangeRecords.filter(r=>r.observerActive),'offset')},byAction:Object.fromEntries(['fold','passive','aggressive'].map(a=>[a,{current:group(rangeRecords.filter(r=>r.actual===a),'current'),offset:group(rangeRecords.filter(r=>r.actual===a),'offset')}])),perSeed},sampling:{allDecisions:progress.decisions,paidFlopTurnDecisions:progress.paidFlopTurnDecisions,eligibleHands:progress.eligibleHands,selectedStates:reservoir.length,completedStates:valueResults.length,selectedIdentities:reservoir.map(s=>({id:s.id,...s.identity}))},valueResults,limitations:['All ten seeds inspected and reused diagnostically; no fitting or fresh profit evidence.','Exact fractional-share reference knows dealt hidden cards, splits ties fractionally (no engine odd-chip allocation), and assumes no future betting: not actionable regret or GTO.','Restricted paid flop/turn call/fold diagnostic excludes preflop, raises and river search.','All actions also reported separately for observer-active states; sampled value states are first paid eligible per hand, lowest fixed hashes.']},null,2)+'\n');
}
save();
try{
 for(const seed of settings.seeds){
  boundary();const archived=JSON.parse(gunzipSync(readFileSync(`${sourceRun}/challenge-independent-${seed}-current.json.gz`)).toString());
  const records:RangeRecord[]=[],reproduced:{players:number;field:string;report:BenchmarkReport}[]=[];
  let match=0;
  for(const field of archived.effectiveFields)for(const players of settings.tableSizes){
   const deals=reconstructDeals(seed,players,4);let rotation=0;
   const seats=Array.from({length:players},(_,participant)=>participant===0?{name:'current',policy:simplePolicy,policyFactory:()=>{
    const currentMatch=match++,currentRotation=rotation++,hero=(players-currentRotation)%players;
    const trackers={current:new DiagnosticBeliefs({version:1,kind:'current'}),offset:new DiagnosticBeliefs(freeze.model)};
    let observerActive=true,latestValue:number|undefined,pendingPrediction:number[]|undefined;
    const seenHands=new Set<number>();
    const actual=createAdaptivePolicy({samples:50,riverSamples:16,learn:false,styleRetention:1,riverRiskPenalty:1,seed:42,responseModel:{version:1,kind:'current'},onDecision:r=>{latestValue=r.showdownCallValue;},onReplay:event=>{
     const row:ReplayObservation={...event,match:currentMatch};const deal=deals[row.hand-1];if(!deal)throw new Error('Unknown hand during diagnostic replay.');
     validateTruth(deal,row.board,row.known.slice(row.board.length),hero);progress.observations++;
     for(const id of ['current','offset'] as const){
      const result=trackers[id].observe(row);if(id==='current')pendingPrediction=result.prediction;
      if(row.board.length!==3)continue;
      const truth=deal.holes[row.seat]!;
      const before=trueHandScore(result.before,truth),after=trueHandScore(result.after,truth);
      const participantId=(row.seat+currentRotation)%players;
      const record:RangeRecord={seed,field:field.id,players,rotation:currentRotation,match:currentMatch,hand:row.hand,seat:row.seat,family:field.opponents[(participantId-1)%field.opponents.length],actual:row.actual,support:supportKey(result.prediction),observerActive,model:id,beforeProbability:before.probability,afterProbability:after.probability,beforeLoss:before.logLoss,afterLoss:after.logLoss,informationGain:before.logLoss-after.logLoss,actionLoss:scorePrediction(result.prediction,row.actual).logLoss};
      records.push(record);
     }
    },onPrediction:r=>{if(!pendingPrediction||r.probabilities.some((p,i)=>Math.abs(p-pendingPrediction![i]!)>1e-10))throw new Error('Public diagnostic/current prediction mismatch.');}});
    const wrapped:Policy=Object.assign((view:PublicView):PolicyAction=>{
     const deal=deals[view.handNumber-1];if(!deal)throw new Error('Unknown decision hand.');validateTruth(deal,view.board,view.seats[hero]!.hole,hero);progress.decisions++;
     // Match every public conditioning step, including unsampled/free decisions.
     const ranges={current:trackers.current.ranges(view),offset:trackers.offset.ranges(view)};
     latestValue=undefined;const action=actual.policy(view);
     const paid=view.validActions.find(a=>a.action==='call');
     if((view.street==='flop'||view.street==='turn')&&paid?.action==='call'&&paid.amount>0){
      progress.paidFlopTurnDecisions++;
      if(!seenHands.has(view.handNumber)){
       seenHands.add(view.handNumber);progress.eligibleHands++;
       const identity={seed,field:field.id,players,rotation:currentRotation,match:currentMatch,hand:view.handNumber};
       const id=createHash('sha256').update(JSON.stringify([seed,field.id,players,currentRotation,view.handNumber,view.street,view.log.length])).digest('hex');
       if(reservoir.length<settings.maxValueStates||id<reservoir[reservoir.length-1]!.id){
        if(!Number.isFinite(latestValue))throw new Error('Missing current incremental call value.');
        consider({id,identity,view:structuredClone(view),ranges,baselineCallValue:latestValue!,actualAction:action.action,holes:structuredClone(deal.holes)});
       }
      }
     }
     return action;
    },{startSession:(ids:string[])=>{trackers.current.reset();trackers.offset.reset();seenHands.clear();actual.policy.startSession?.(ids);},observe:(before:PublicView,after:PublicView)=>{observerActive=before.seats[hero]!.inHand&&!before.seats[hero]!.folded;actual.policy.observe?.(before,after);}});
    return wrapped;
   }}:{name:`opponent-${participant}`,policy:strategyById(field.opponents[(participant-1)%field.opponents.length]).policy});
   const report=runBenchmark({seats,seeds:[seed],hands:4});
   const original=archived.batch.cells.find((c:{players:number;field:string})=>c.players===players&&c.field===field.id)?.report;
   if(!original||JSON.stringify(report.runs)!==JSON.stringify(original.runs)||JSON.stringify(report.meanBb100)!==JSON.stringify(original.meanBb100))throw new Error(`Archived rotation accounting mismatch ${seed}/${field.id}/${players}`);
   reproduced.push({players,field:field.id,report});
  }
  atomic(`reproduction-${seed}.json.gz`,gzipSync(JSON.stringify({seed,reproduced,rangeRecords:records})));
  rangeRecords.push(...records);progress.completedSeeds.push(seed);atomic('selected-state-reservoir.json.gz',gzipSync(JSON.stringify(reservoir)));save();console.error(`Reproduced inspected seed${seed}: ${records.length/2} flop actions, exact archived accounting.`);await new Promise<void>(r=>setImmediate(r));
 }
 progress.phase='value-scoring';save();atomic('selected-states.json.gz',gzipSync(JSON.stringify(reservoir)));
 for(const state of reservoir){
  boundary();const baseSeed=(42^Math.imul(state.view.handNumber,31)^state.view.log.length^state.view.toAct!)|0;
  const publicState={view:state.view,ranges:state.ranges};
  const current50=predictedValue(publicState,'current',50,baseSeed);
  if(current50.action!==state.actualAction||Math.abs(current50.callValue-state.baselineCallValue)>1e-8)throw new Error(`Seeded50 decision reproduction mismatch ${state.id}`);
  const oracle=exactPrivilegedCallValue(state.view,state.holes);
  const models=Object.fromEntries(['current','offset'].map(id=>{
   const reference=predictedValue(publicState,id,settings.referenceSamples,baseSeed);
   const replicates=settings.salts.map(salt=>predictedValue(publicState,id,50,(baseSeed^salt)|0));
   const payoff=reference.action==='call'?oracle.callValue:0;
   return [id,{reference,replicates,referencePayoff:payoff,privilegedInformationGap:Math.max(0,oracle.callValue)-payoff,valueError:reference.callValue-oracle.callValue,absoluteValueError:Math.abs(reference.callValue-oracle.callValue),samplingFlipFraction:replicates.filter(r=>r.action!==reference.action).length/replicates.length}];
  }));
  const result={id:state.id,identity:state.identity,street:state.view.street,baselineCallValue:state.baselineCallValue,actualAction:state.actualAction,current50,oracle,models};
  valueResults.push(result);atomic(`value-${state.id.slice(0,20)}.json`,JSON.stringify(result,null,2)+'\n');progress.completedStates.push(state.id);save();await new Promise<void>(r=>setImmediate(r));
 }
 progress.status='complete';progress.phase='complete';save();summarize();console.log(directory);
}catch(error){progress.status=error instanceof BudgetLimit?'budget-limited':stopped?'interrupted':'failed';progress.error=error instanceof Error?error.stack??error.message:String(error);save();summarize();if(!(error instanceof BudgetLimit))throw error;console.log(directory);}

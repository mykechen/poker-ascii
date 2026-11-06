import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {runLeagueBatch,pairedLeagueDelta,summarizeLeague,type LeagueField,type LeagueConfiguration,type LeagueBatch} from '../lib/poker/league';
import {replayObservations,type ReplayObservation} from '../lib/poker/contextual-replay';
import {panelScores,type SelectionScore} from '../lib/poker/contextual-selection';
import {fitPopulationOffsets,selectPopulationOffset,populationCoverage,type PopulationPanel,type Stratum} from '../lib/poker/population-fit';
import {balanceFields,validatePopulationFields} from '../lib/poker/population-fields';
import type {ResponseModel} from '../lib/poker/contextual-response';
const fields:Record<'training'|'validation',Record<Stratum,LeagueField[]>>={
 training:{legacy:[{id:'train-balanced',opponents:['chart','tight','station','position','aggressor']},{id:'train-pressure',opponents:['maniac','station','chart','aggressor','tight']},{id:'train-passive',opponents:['station','maniac','position','tight','chart']}],expanded:[{id:'train-expanded-a',opponents:['multiway','station','learner','tight','maniac']},{id:'train-expanded-b',opponents:['learner','position','multiway','aggressor','station']},{id:'train-expanded-c',opponents:['tight','multiway','maniac','learner','position']}]},
 validation:{legacy:[{id:'validate-position',opponents:['position','station','aggressor','chart','maniac']},{id:'validate-tight',opponents:['tight','maniac','station','position','aggressor']}],expanded:[{id:'validate-expanded-a',opponents:['station','multiway','learner','maniac','tight']},{id:'validate-expanded-b',opponents:['position','learner','aggressor','multiway','station']}]}
};
const challengeFields:LeagueField[]=[{id:'challenge-equity-a',opponents:['equity-defender','equity-pressure','multiway','learner','position']},{id:'challenge-equity-b',opponents:['equity-pressure','aggressor','equity-defender','tight','maniac']}];
validatePopulationFields(Object.values(fields.training).flat(),Object.values(fields.validation).flat());
validatePopulationFields([...Object.values(fields.training).flat(),...Object.values(fields.validation).flat()],challengeFields);
const settings={trainingSeeds:Array.from({length:30},(_,i)=>91001+i),validationSeeds:Array.from({length:20},(_,i)=>92001+i),challengeSeeds:Array.from({length:10},(_,i)=>93001+i),fields,challengeFields,hands:4,tableSizes:[6,7,8],equitySamples:50,riverSamples:16,opponentEquitySamples:64,lambdas:[.1,1,10],maxIterations:1000,budgetMs:7200000,lineupCycle:5};
const hash=createHash('sha256');for(const file of [...readdirSync('lib/poker').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).sort().map(f=>`lib/poker/${f}`),'scripts/population-experiment.ts','package.json','package-lock.json','vitest.config.mts','docs/superpowers/specs/2026-11-06-population-coverage-design.md'])hash.update(file).update(readFileSync(file));
hash.update(JSON.stringify(settings));const fingerprint=hash.digest('hex');
const directory=`handoffs/runs/${new Date().toISOString().slice(0,10)}-population-${fingerprint.slice(0,12)}`;
if(existsSync(directory))throw new Error('Preserve existing run; no automatic resume.');
const registryPath='handoffs/seed-registry.json',registry=JSON.parse(readFileSync(registryPath,'utf8'));
for(const seed of [...settings.trainingSeeds,...settings.validationSeeds,...settings.challengeSeeds])if(registry.started_batches.some((r:{seed:number})=>r.seed===seed)||registry.retired_inspected_ranges.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end)||!registry.reserved_not_run.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end))throw new Error(`Seed ${seed} not reserved and fresh.`);
mkdirSync(directory,{recursive:true});
function atomic(path:string,value:string|Buffer){writeFileSync(`${directory}/${path}.tmp`,value);renameSync(`${directory}/${path}.tmp`,`${directory}/${path}`);}
atomic('protocol.md',readFileSync('docs/superpowers/specs/2026-11-06-population-coverage-design.md'));
const started=performance.now();
const state={status:'running',phase:'training',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fingerprint,settings,startedAt:new Date().toISOString(),elapsedMs:0,completed:[] as string[],fits:[] as ReturnType<typeof fitPopulationOffsets>[],models:{current:{version:1,kind:'current'}} as Record<string,ResponseModel>,selection:null as ReturnType<typeof selectPopulationOffset>|null,error:null as string|null};
const panels:Record<'training'|'validation',PopulationPanel[]>={training:[],validation:[]};
const scored:Record<string,Record<Stratum,ReturnType<typeof replayObservations>>>={};
const scoreResults:{id:string;byStratum:Record<Stratum,SelectionScore>}[]=[];
const challenge:LeagueBatch[]=[];
function save(){state.elapsedMs=performance.now()-started;atomic('progress.json',JSON.stringify(state,null,2)+'\n');}
class BudgetLimit extends Error{}
let stopped=false;for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{stopped=true;});
function boundary(){if(stopped)throw new Error('Interrupted at safe boundary.');if(performance.now()-started>=settings.budgetMs)throw new BudgetLimit('Two-hour budget reached.');}
const base:LeagueConfiguration={id:'current',mode:'frozen',styleRetention:1,riverRiskPenalty:1,equitySamples:50,riverSamples:16};
async function batch(phase:'training'|'validation'|'challenge',seed:number,id:string,effective:LeagueField[],stratum?:Stratum){
 const key=`${phase}-${stratum??'independent'}-${seed}-${id.replace(':','-')}`;
 registry.started_batches.push({seed,phase,id,stratum:stratum??'independent',directory,startedAt:new Date().toISOString()});
 writeFileSync(`${registryPath}.tmp`,JSON.stringify(registry,null,2)+'\n');renameSync(`${registryPath}.tmp`,registryPath);
 const observations:ReplayObservation[]=[];
 const result=runLeagueBatch({...base,id,responseModel:state.models[id]},seed,effective,settings.tableSizes,4,phase!=='challenge',undefined,phase!=='challenge'?e=>observations.push(e):undefined);
 atomic(`${key}.json.gz`,gzipSync(JSON.stringify({batch:result,observations,effectiveFields:effective,stratum})));
 const reports=result.cells.flatMap(c=>c.report.runs.map(r=>r.report));
 if(reports.length!==effective.length*21||reports.some(r=>r.hands!==4||r.net.reduce((a,b)=>a+b,0)!==0||r.fallbacks.some(n=>n!==0)))throw new Error('Accounting/coverage failure.');
 if(phase==='challenge')challenge.push(result);else panels[phase].push({batch:seed,stratum:stratum!,rows:observations});
 state.completed.push(key);save();console.error(`${key}: ${(result.elapsedMs/1000).toFixed(1)}s`);await new Promise<void>(r=>setImmediate(r));
}
function summarize(){
 const ids=[...new Set(challenge.map(b=>b.configuration.id))];
 const rows=(id:string)=>challenge.filter(b=>b.configuration.id===id).flatMap(b=>b.rows);
 const delta=ids.length===2&&ids.every(id=>challenge.filter(b=>b.configuration.id===id).length===10)?pairedLeagueDelta(rows(ids.find(id=>id!=='current')!),rows('current')):null;
 atomic('summary.json',JSON.stringify({settings,status:state.status,coverage:{training:populationCoverage(panels.training),validation:populationCoverage(panels.validation)},fits:state.fits,scores:scoreResults,selection:state.selection,challenge:{summaries:ids.map(id=>({id,...summarizeLeague(rows(id))})),delta,limitations:['Ten fresh seed batches: descriptive, no conventional interval/5bb target claim.','Independent decision logic shares evaluator/equity calculator; strength unproven.']},limitations:['No live promotion.','Mixture/weighting/lineup balancing are a combined remedy, not causal attribution.','Fresh validation is model selection, not independent profit evidence.']},null,2)+'\n');
}
save();
try{
 for(const phase of ['training','validation'] as const){
  if(phase==='validation'){
   state.phase='fitting';save();
   for(const lambda of settings.lambdas){boundary();const fit=fitPopulationOffsets(panels.training,lambda);state.fits.push(fit);if(fit.converged)state.models[`offset:${lambda}`]=fit.model;save();console.error(`fit ${lambda}: converged=${fit.converged}`);await new Promise<void>(r=>setImmediate(r));}
   atomic('training-freeze.json',JSON.stringify({models:state.models,fits:state.fits,frozenAt:new Date().toISOString()},null,2)+'\n');
  }
  state.phase=phase;save();const seeds=phase==='training'?settings.trainingSeeds:settings.validationSeeds;
  for(const [index,seed] of seeds.entries())for(const stratum of ['legacy','expanded'] as const){boundary();await batch(phase,seed,'current',balanceFields(fields[phase][stratum],index),stratum);}
 }
 state.phase='scoring';save();
 for(const [id,model] of Object.entries(state.models)){
  scored[id]={legacy:[],expanded:[]};
  for(const panel of panels.validation){
   boundary();const rows=replayObservations(panel.rows,model);scored[id]![panel.stratum].push(...rows);
   atomic(`scores-${id.replace(':','-')}-${panel.stratum}-${panel.batch}.json.gz`,gzipSync(JSON.stringify(rows.filter(r=>r.board.length===3).map(r=>({match:r.match,hand:r.hand,order:r.order,actual:r.actual,context:r.context,probabilities:r.probabilities})))));
   save();await new Promise<void>(r=>setImmediate(r));
  }
  scoreResults.push({id,byStratum:{legacy:panelScores(id,scored[id]!.legacy),expanded:panelScores(id,scored[id]!.expanded)}});console.error(`scored ${id}`);
 }
 state.selection=selectPopulationOffset(scoreResults,panels.validation,true);
 const model=state.models[state.selection.selected]!;
 atomic('freeze.json',JSON.stringify({selection:state.selection,model,modelHash:createHash('sha256').update(JSON.stringify(model)).digest('hex'),frozenAt:new Date().toISOString(),fingerprint},null,2)+'\n');
 state.phase='challenge';save();
 for(const [index,seed] of settings.challengeSeeds.entries()){
  boundary();const ids=state.selection.status==='selected'&&state.selection.selected!=='current'?['current',state.selection.selected]:['current'];
  if(index%2)ids.reverse();for(const id of ids)await batch('challenge',seed,id,balanceFields(challengeFields,index));
 }
 state.status='complete';state.phase='complete';save();summarize();console.log(directory);
}catch(error){state.status=error instanceof BudgetLimit?'budget-limited':stopped?'interrupted':'failed';state.error=error instanceof Error?error.stack??error.message:String(error);save();summarize();if(!(error instanceof BudgetLimit))throw error;console.log(directory);}

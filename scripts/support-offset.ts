import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {runLeagueBatch,type LeagueField,type LeagueConfiguration} from '../lib/poker/league';
import {replayObservations,type ReplayObservation} from '../lib/poker/contextual-replay';
import {panelScores} from '../lib/poker/contextual-selection';
import {fitSupportOffsets,selectSupportOffset,supportCoverage,type OffsetPanel} from '../lib/poker/support-offset';
import {verifyFrozenModel} from '../lib/poker/frequency-confirmation';
import type {ResponseModel} from '../lib/poker/contextual-response';
const fields:Record<string,LeagueField[]>={training:[{id:'train-balanced',opponents:['chart','tight','station','position','aggressor']},{id:'train-pressure',opponents:['maniac','station','chart','aggressor','tight']},{id:'train-passive',opponents:['station','maniac','position','tight','chart']}],validation:[{id:'validate-position',opponents:['position','station','aggressor','chart','maniac']},{id:'validate-tight',opponents:['tight','maniac','station','position','aggressor']}]};
const settings={training:Array.from({length:20},(_,i)=>71001+i),validation:Array.from({length:10},(_,i)=>72001+i),hands:4,tableSizes:[6,7,8],fields,lambdas:[.1,1,10],maxIterations:1000,gradientTolerance:1e-6,trainingQuota:{observations:200,hands:50,batches:8},sparseValidationQuota:{observations:100,hands:30,batches:5},equitySamples:50,riverSamples:16};
const pilot='handoffs/runs/2026-11-05-contextual-adfb6f523ebe';
const frozenBytes=readFileSync(`${pilot}/freeze.json`);
if(createHash('sha256').update(frozenBytes).digest('hex')!==readFileSync(`${pilot}/freeze.sha256`,'utf8').trim())throw new Error('Archived freeze checksum mismatch.');
const frequency=JSON.parse(frozenBytes.toString()).model as ResponseModel;
verifyFrozenModel(frequency,'78bd7ff1eacf01b079a95ce4553586de9c900d6eb495658a9f88dec464ea759f');
const hash=createHash('sha256');
for(const file of [...readdirSync('lib/poker').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).sort().map(f=>`lib/poker/${f}`),'scripts/support-offset.ts','package.json','package-lock.json','vitest.config.mts','docs/superpowers/specs/2026-11-06-support-offset-remedy-design.md'])hash.update(file).update(readFileSync(file));
hash.update(JSON.stringify(settings));const fingerprint=hash.digest('hex');
const directory=`handoffs/runs/${new Date().toISOString().slice(0,10)}-support-offset-${fingerprint.slice(0,12)}`;
if(existsSync(directory))throw new Error('Preserve existing run; no automatic resume.');
const registryPath='handoffs/seed-registry.json',registry=JSON.parse(readFileSync(registryPath,'utf8'));
for(const seed of [...settings.training,...settings.validation])if(registry.started_batches.some((r:{seed:number})=>r.seed===seed)||registry.retired_inspected_ranges.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end)||!registry.reserved_not_run.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end))throw new Error(`Seed ${seed} not reserved and fresh.`);
mkdirSync(directory,{recursive:true});
function atomic(path:string,value:string|Buffer){writeFileSync(`${directory}/${path}.tmp`,value);renameSync(`${directory}/${path}.tmp`,`${directory}/${path}`);}
atomic('protocol.md',readFileSync('docs/superpowers/specs/2026-11-06-support-offset-remedy-design.md'));atomic('diagnostic-frequency-freeze.json',frozenBytes);
const state={status:'running',phase:'training',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fingerprint,settings,startedAt:new Date().toISOString(),completed:[] as string[],fits:[] as ReturnType<typeof fitSupportOffsets>[],models:{current:{version:1,kind:'current'},frequency} as Record<string,ResponseModel>,error:null as string|null};
const panels:Record<string,OffsetPanel[]>={training:[],validation:[]};
function save(){atomic('progress.json',JSON.stringify(state,null,2)+'\n');}
let stopped=false;for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{stopped=true;});
function interrupt(){if(stopped)throw new Error('Interrupted at safe boundary.');}
const base:LeagueConfiguration={id:'current',mode:'frozen',styleRetention:1,riverRiskPenalty:1,equitySamples:50,riverSamples:16,responseModel:state.models.current};
async function collect(phase:'training'|'validation',seed:number){
 interrupt();state.phase=phase;save();
 registry.started_batches.push({seed,phase,id:'current',directory,startedAt:new Date().toISOString()});
 writeFileSync(`${registryPath}.tmp`,JSON.stringify(registry,null,2)+'\n');renameSync(`${registryPath}.tmp`,registryPath);
 const rows:ReplayObservation[]=[];
 const batch=runLeagueBatch(base,seed,fields[phase]!,settings.tableSizes,4,true,undefined,e=>rows.push(e));
 const key=`${phase}-${seed}`;atomic(`${key}.json.gz`,gzipSync(JSON.stringify({batch,observations:rows})));
 const reports=batch.cells.flatMap(c=>c.report.runs.map(r=>r.report));
 if(reports.length!==(phase==='training'?63:42)||reports.some(r=>r.hands!==4||r.net.reduce((a,b)=>a+b,0)!==0||r.fallbacks.some(n=>n!==0)))throw new Error('Accounting/coverage failure.');
 panels[phase]!.push({batch:seed,rows});state.completed.push(key);save();console.error(`${key}: ${(batch.elapsedMs/1000).toFixed(1)}s`);await new Promise<void>(r=>setImmediate(r));
}
save();
try{
 for(const seed of settings.training)await collect('training',seed);
 state.phase='fitting';save();
 for(const lambda of settings.lambdas){interrupt();const fit=fitSupportOffsets(panels.training!,lambda);state.fits.push(fit);if(fit.converged)state.models[`offset:${lambda}`]=fit.model;save();console.error(`fit ${lambda}: converged=${fit.converged}`);}
 atomic('training-freeze.json',JSON.stringify({models:state.models,fits:state.fits,frozenAt:new Date().toISOString()},null,2)+'\n');
 for(const seed of settings.validation)await collect('validation',seed);
 state.phase='scoring';save();
 const scores=[];
 for(const [id,model] of Object.entries(state.models)){
  const scored=[];
  for(const panel of panels.validation!){interrupt();const rows=replayObservations(panel.rows,model);scored.push(...rows);atomic(`scores-${id.replace(':','-')}-${panel.batch}.json.gz`,gzipSync(JSON.stringify(rows.filter(r=>r.board.length===3).map(r=>({match:r.match,hand:r.hand,order:r.order,actual:r.actual,context:r.context,probabilities:r.probabilities})))));await new Promise<void>(r=>setImmediate(r));}
  scores.push(panelScores(id,scored));console.error(`scored ${id}`);
 }
 const decision=selectSupportOffset(scores,panels.validation!),model=state.models[decision.selected]!;
 const freeze={decision,model,modelHash:createHash('sha256').update(JSON.stringify(model)).digest('hex'),frozenAt:new Date().toISOString(),fingerprint};
 atomic('freeze.json',JSON.stringify(freeze,null,2)+'\n');
 atomic('summary.json',JSON.stringify({settings,fits:state.fits,coverage:{training:supportCoverage(panels.training!),validation:supportCoverage(panels.validation!)},scores,decision,limitations:['Forecast validation only; no fresh profit run or live promotion.','Frozen-current-component training objective is a surrogate; validation uses own beliefs.','Heuristic populations and fixed reset-stack hands.']},null,2)+'\n');
 state.status='complete';state.phase='complete';save();console.log(directory);
}catch(error){state.status=stopped?'interrupted':'failed';state.error=error instanceof Error?error.stack??error.message:String(error);save();throw error;}

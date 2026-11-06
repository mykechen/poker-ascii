import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {runLeagueBatch,pairedLeagueDelta,summarizeLeague,type LeagueConfiguration,type LeagueBatch,type LeagueField} from '../lib/poker/league';
import {replayObservations,type ReplayObservation} from '../lib/poker/contextual-replay';
import {panelScores,type SelectionScore} from '../lib/poker/contextual-selection';
import {verifyFrozenModel,confirmDecision} from '../lib/poker/frequency-confirmation';
import type {ResponseModel} from '../lib/poker/contextual-response';
const pilot='handoffs/runs/2026-11-05-contextual-adfb6f523ebe';
const frozenBytes=readFileSync(`${pilot}/freeze.json`);
if(createHash('sha256').update(frozenBytes).digest('hex')!==readFileSync(`${pilot}/freeze.sha256`,'utf8').trim())throw new Error('Pilot freeze file checksum mismatch.');
const frozen=JSON.parse(frozenBytes.toString()) as {model:ResponseModel;modelHash:string};
const expected='78bd7ff1eacf01b079a95ce4553586de9c900d6eb495658a9f88dec464ea759f';
verifyFrozenModel(frozen.model,expected);
const fields:LeagueField[]=[{id:'evaluate-multiway',opponents:['multiway','learner','maniac','station','tight']},{id:'evaluate-learner',opponents:['learner','multiway','aggressor','station','position']}];
const settings={profitSeeds:Array.from({length:30},(_,i)=>61001+i),panelSeeds:Array.from({length:10},(_,i)=>62001+i),hands:2,tableSizes:[6,7,8],fields,equitySamples:50,riverSamples:16,modelHash:expected,targetBb100:5};
const files=[...readdirSync('lib/poker').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).sort().map(f=>`lib/poker/${f}`),'scripts/frequency-confirmation.ts','package.json','package-lock.json','vitest.config.mts','docs/superpowers/specs/2026-11-06-frequency-confirmation-design.md'];
const hash=createHash('sha256');for(const file of files)hash.update(file).update(readFileSync(file));hash.update(JSON.stringify(settings));
const fingerprint=hash.digest('hex');
const directory=`handoffs/runs/${new Date().toISOString().slice(0,10)}-confirmation-${fingerprint.slice(0,12)}`;
if(existsSync(directory))throw new Error('Existing run cannot be overwritten or automatically resumed.');
const registryPath='handoffs/seed-registry.json';
const registry=JSON.parse(readFileSync(registryPath,'utf8'));
for(const seed of [...settings.profitSeeds,...settings.panelSeeds]){
 if(registry.started_batches.some((r:{seed:number})=>r.seed===seed)||registry.retired_inspected_ranges.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end)||!registry.reserved_not_run.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end))throw new Error(`Seed ${seed} is not fresh and reserved.`);
}
mkdirSync(directory,{recursive:true});
function atomic(path:string,value:string|Buffer){writeFileSync(`${directory}/${path}.tmp`,value);renameSync(`${directory}/${path}.tmp`,`${directory}/${path}`);}
atomic('freeze.json',frozenBytes);atomic('protocol.md',readFileSync('docs/superpowers/specs/2026-11-06-frequency-confirmation-design.md'));
const batches:LeagueBatch[]=[];
const scored:Record<string,ReturnType<typeof replayObservations>>={frequency:[],current:[]};
const progress={status:'running',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fingerprint,settings,startedAt:new Date().toISOString(),completed:[] as string[],error:null as string|null};
function save(){atomic('progress.json',JSON.stringify(progress,null,2)+'\n');}
let stopped=false;for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{stopped=true;});
const base:LeagueConfiguration={id:'current',mode:'frozen',styleRetention:1,riverRiskPenalty:1,equitySamples:50,riverSamples:16};
function checkAccounting(batch:LeagueBatch){
 const reports=batch.cells.flatMap(c=>c.report.runs.map(r=>r.report));
 if(reports.length!==42||reports.some(r=>r.hands!==2||r.net.reduce((a,b)=>a+b,0)!==0||r.fallbacks.some(n=>n!==0)))throw new Error('Batch accounting/coverage failure.');
}
save();
async function run(seed:number,id:'current'|'frequency',panel:boolean){
 if(stopped)throw new Error('Interrupted at batch boundary.');
 const phase=panel?'panel':'profit',key=`${phase}-${seed}-${id}`;
 registry.started_batches.push({seed,phase,id,directory,startedAt:new Date().toISOString()});
 const temp=`${registryPath}.tmp`;writeFileSync(temp,JSON.stringify(registry,null,2)+'\n');renameSync(temp,registryPath);
 const observations:ReplayObservation[]=[];
 const batch=runLeagueBatch({...base,id,responseModel:id==='frequency'?frozen.model:{version:1,kind:'current'}},seed,fields,settings.tableSizes,2,true,undefined,panel?e=>observations.push(e):undefined);
 atomic(`${key}.json.gz`,gzipSync(JSON.stringify({batch,observations})));
 checkAccounting(batch);
 if(panel){for(const modelId of ['frequency','current'])scored[modelId]!.push(...replayObservations(observations,modelId==='frequency'?frozen.model:{version:1,kind:'current'}));}
 else batches.push(batch);
 progress.completed.push(key);save();console.error(`${key}: ${(batch.elapsedMs/1000).toFixed(1)}s`);
 await new Promise<void>(r=>setImmediate(r));
}
try{
 for(const seed of settings.profitSeeds)for(const id of ['frequency','current'] as const)await run(seed,id,false);
 for(const seed of settings.panelSeeds)await run(seed,'current',true);
 const rows=(id:string)=>batches.filter(b=>b.configuration.id===id).flatMap(b=>b.rows);
 const delta=pairedLeagueDelta(rows('frequency'),rows('current'));
 const scores:Record<string,SelectionScore>=Object.fromEntries(Object.entries(scored).map(([id,rows])=>[id,panelScores(id,rows)]));
 const cellDeltas=delta.cellScores.map(c=>c.meanBb100);
 const cellIntervals=delta.cellScores.map(c=>{const keys=c.cell.split(':');const d=pairedLeagueDelta(rows('frequency').filter(r=>r.players===Number(keys[0])&&r.field===keys[1]),rows('current').filter(r=>r.players===Number(keys[0])&&r.field===keys[1]));return {cell:c.cell,mean:d.meanBb100,lower95:d.meanBb100-2.04523*d.standardError!,upper95:d.meanBb100+2.04523*d.standardError!};});
 atomic('summary.json',JSON.stringify({settings,delta,cellIntervals,profits:['frequency','current'].map(id=>({id,...summarizeLeague(rows(id))})),scores,decision:confirmDecision(delta.seedScores,cellDeltas,scores.frequency!,scores.current!),limitations:['Fixed 30-batch run is not powered for a true 5 bb/100 effect.','Cell and forecast gates are descriptive, not simultaneous noninferiority guarantees.','Heuristic opponents, two-hand reset-stack matches; no live promotion.']},null,2)+'\n');
 progress.status='complete';save();console.log(directory);
}catch(error){progress.status=stopped?'interrupted':'failed';progress.error=error instanceof Error?error.stack??error.message:String(error);save();throw error;}

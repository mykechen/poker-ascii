import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {runLeagueBatch,pairedLeagueDelta,type LeagueBatch,type LeagueConfiguration,type LeagueField} from '../lib/poker/league';
import {replayObservations,type ReplayObservation} from '../lib/poker/contextual-replay';
import {panelScores} from '../lib/poker/contextual-selection';
import {validateResponseModel,type ResponseModel} from '../lib/poker/contextual-response';
import {offsetConfirmationDecision,sparseFoldCoverage} from '../lib/poker/offset-confirmation';
import type {OffsetPanel} from '../lib/poker/support-offset';
const freezePath='handoffs/runs/2026-11-06-support-offset-c41816d9698f/freeze.json';
const frozenBytes=readFileSync(freezePath),frozen=JSON.parse(frozenBytes.toString()) as {model:ResponseModel;modelHash:string;decision:{selected:string}};
const expected='0e6bf741dacad60f8e221090ad90269c0d948d65dad1ec8a1038e8a2adea442f';
validateResponseModel(frozen.model);
if(frozen.decision.selected!=='offset:0.1'||frozen.model.kind!=='contextual'||frozen.model.lambda!==.1||frozen.modelHash!==expected||createHash('sha256').update(JSON.stringify(frozen.model)).digest('hex')!==expected)throw new Error('Frozen selected offset identity/hash mismatch.');
const fields:LeagueField[]=[{id:'evaluate-multiway',opponents:['multiway','learner','maniac','station','tight']},{id:'evaluate-learner',opponents:['learner','multiway','aggressor','station','position']}];
const settings={panelSeeds:Array.from({length:20},(_,i)=>82001+i),profitSeeds:Array.from({length:100},(_,i)=>81001+i),hands:4,tableSizes:[6,7,8],fields,equitySamples:50,riverSamples:16,targetBb100:5,budgetMs:7200000,modelHash:expected};
const hash=createHash('sha256');
for(const file of [...readdirSync('lib/poker').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).sort().map(f=>`lib/poker/${f}`),'scripts/offset-confirmation.ts','package.json','package-lock.json','vitest.config.mts','docs/superpowers/specs/2026-11-06-offset-confirmation-design.md'])hash.update(file).update(readFileSync(file));
hash.update(JSON.stringify(settings));const fingerprint=hash.digest('hex');
const directory=`handoffs/runs/${new Date().toISOString().slice(0,10)}-offset-confirmation-${fingerprint.slice(0,12)}`;
if(existsSync(directory))throw new Error('Existing run must be preserved; no automatic resume.');
const registryPath='handoffs/seed-registry.json',registry=JSON.parse(readFileSync(registryPath,'utf8'));
for(const seed of [...settings.panelSeeds,...settings.profitSeeds])if(registry.started_batches.some((r:{seed:number})=>r.seed===seed)||registry.retired_inspected_ranges.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end)||!registry.reserved_not_run.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end))throw new Error(`Seed ${seed} not fresh and reserved.`);
mkdirSync(directory,{recursive:true});
function atomic(path:string,value:string|Buffer){writeFileSync(`${directory}/${path}.tmp`,value);renameSync(`${directory}/${path}.tmp`,`${directory}/${path}`);}
atomic('freeze.json',frozenBytes);atomic('protocol.md',readFileSync('docs/superpowers/specs/2026-11-06-offset-confirmation-design.md'));
const started=performance.now();
const progress={status:'running',phase:'panel',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fingerprint,settings,startedAt:new Date().toISOString(),elapsedMs:0,completed:[] as string[],completedPairs:[] as number[],error:null as string|null};
const panels:OffsetPanel[]=[],batches:LeagueBatch[]=[];
const scores:Record<string,ReturnType<typeof replayObservations>>={offset:[],current:[]};
function save(){progress.elapsedMs=performance.now()-started;atomic('progress.json',JSON.stringify(progress,null,2)+'\n');}
class BudgetLimit extends Error{}
let stopped=false;for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{stopped=true;});
function boundary(){if(stopped)throw new Error('Interrupted at safe boundary.');if(performance.now()-started>=settings.budgetMs)throw new BudgetLimit('Two-hour runtime budget reached.');}
const base:LeagueConfiguration={id:'current',mode:'frozen',styleRetention:1,riverRiskPenalty:1,equitySamples:50,riverSamples:16};
const model=(id:string):ResponseModel=>id==='offset'?frozen.model:{version:1,kind:'current'};
async function collect(seed:number,id:'offset'|'current',panel:boolean){
 const phase=panel?'panel':'profit',key=`${phase}-${seed}-${id}`;
 registry.started_batches.push({seed,phase,id,directory,startedAt:new Date().toISOString()});
 writeFileSync(`${registryPath}.tmp`,JSON.stringify(registry,null,2)+'\n');renameSync(`${registryPath}.tmp`,registryPath);
 const observations:ReplayObservation[]=[];
 const batch=runLeagueBatch({...base,id,responseModel:model(id)},seed,fields,settings.tableSizes,4,panel,undefined,panel?e=>observations.push(e):undefined);
 atomic(`${key}.json.gz`,gzipSync(JSON.stringify({batch,observations})));
 const reports=batch.cells.flatMap(c=>c.report.runs.map(r=>r.report));
 if(reports.length!==42||reports.some(r=>r.hands!==4||r.net.reduce((a,b)=>a+b,0)!==0||r.fallbacks.some(n=>n!==0)))throw new Error('Raw accounting failure.');
 progress.completed.push(key);save();console.error(`${key}: ${(batch.elapsedMs/1000).toFixed(1)}s`);await new Promise<void>(r=>setImmediate(r));
 return {batch,observations};
}
function summarize(complete:boolean){
 const paired=new Set(progress.completedPairs);
 const rows=(id:string)=>batches.filter(b=>b.configuration.id===id&&paired.has(b.seed)).flatMap(b=>b.rows);
 const delta=paired.size?pairedLeagueDelta(rows('offset'),rows('current')):null;
 const forecast=Object.fromEntries(Object.entries(scores).filter(([,r])=>r.length>0).map(([id,r])=>[id,panelScores(id,r)]));
 const coverage=sparseFoldCoverage(panels);
 const cells=delta?.cellScores??[];
 const decision=cells.length===6&&forecast.offset&&forecast.current?offsetConfirmationDecision(delta!.seedScores,cells.map(c=>c.meanBb100),forecast.offset!,forecast.current!,coverage,complete):null;
 const cellIntervals=complete?cells.map(c=>{const [players,field]=c.cell.split(':');const d=pairedLeagueDelta(rows('offset').filter(r=>r.players===Number(players)&&r.field===field),rows('current').filter(r=>r.players===Number(players)&&r.field===field));return {cell:c.cell,mean:d.meanBb100,lower95:d.meanBb100-1.98422*d.standardError!,upper95:d.meanBb100+1.98422*d.standardError!};}):null;
 atomic('summary.json',JSON.stringify({complete,settings,delta,cellIntervals,forecast,coverage,decision,limitations:['No power guarantee at5bb/100; heuristic fields and four-hand reset stacks.','No live promotion; incomplete fixed run cannot pass confirmation.','Primary intervals are in decision.interval95, supplementary normal league intervals in delta.']},null,2)+'\n');
}
save();
try{
 for(const seed of settings.panelSeeds){
  boundary();const raw=await collect(seed,'current',true);
  const temporary:Record<string,ReturnType<typeof replayObservations>>={};
  for(const id of ['current','offset']){
   boundary();const rows=replayObservations(raw.observations,model(id));temporary[id]=rows;
   atomic(`scores-${seed}-${id}.json.gz`,gzipSync(JSON.stringify(rows.filter(r=>r.board.length===3).map(r=>({match:r.match,hand:r.hand,order:r.order,actual:r.actual,context:r.context,probabilities:r.probabilities})))));
   save();await new Promise<void>(r=>setImmediate(r));
  }
  panels.push({batch:seed,rows:raw.observations});for(const id of ['current','offset'])scores[id]!.push(...temporary[id]!);
 }
 progress.phase='profit';save();
 for(const [index,seed] of settings.profitSeeds.entries()){
  boundary();for(const id of (index%2?['current','offset']:['offset','current']) as ('offset'|'current')[])batches.push((await collect(seed,id,false)).batch);
  progress.completedPairs.push(seed);save();
 }
 summarize(true);progress.status='complete';save();console.log(directory);
}catch(error){
 progress.status=error instanceof BudgetLimit?'budget-limited':stopped?'interrupted':'failed';progress.error=error instanceof Error?error.stack??error.message:String(error);save();summarize(false);
 if(!(error instanceof BudgetLimit))throw error;console.log(directory);
}

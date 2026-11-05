import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from "node:fs";
import {gzipSync} from "node:zlib";
import {runLeagueBatch,summarizeLeague,pairedLeagueDelta,type LeagueBatch,type LeagueConfiguration,type LeagueField} from "../lib/poker/league";
import {replayObservations,type ReplayObservation} from "../lib/poker/contextual-replay";
import {fitContextual,fitFrequency} from "../lib/poker/contextual-fit";
import {panelScores,selectResponse} from "../lib/poker/contextual-selection";
import {FEATURES,supportKey,type ResponseModel} from "../lib/poker/contextual-response";
import {trainingDecision,evaluationConfigurations,validateExperimentFields} from "../lib/poker/contextual-experiment";
import {forecastScores,reliabilityBins} from "../lib/poker/forecast-diagnostics";
const fields:Record<string,LeagueField[]>={
 training:[{id:"train-balanced",opponents:["chart","tight","station","position","aggressor"]},{id:"train-pressure",opponents:["maniac","station","chart","aggressor","tight"]},{id:"train-passive",opponents:["station","maniac","position","tight","chart"]}],
 validation:[{id:"validate-position",opponents:["position","station","aggressor","chart","maniac"]},{id:"validate-tight",opponents:["tight","maniac","station","position","aggressor"]}],
 evaluation:[{id:"evaluate-multiway",opponents:["multiway","learner","maniac","station","tight"]},{id:"evaluate-learner",opponents:["learner","multiway","aggressor","station","position"]}]
};
validateExperimentFields(Object.values(fields));
const settings={hands:2,tableSizes:[6,7,8],equitySamples:50,riverSamples:16,quota:500,seeds:{training:[51001,51002,51003,51004],topUp:[51005,51006,51007,51008],validation:[52001,52002],evaluation:[53001,53002,53003,53004]},fields,features:FEATURES,lambdas:[.001,.01,.1,1],maxIterations:200,gradientTolerance:1e-6,eligible:["current","uniform","frequency","contextual:.001","contextual:.01","contextual:.1","contextual:1"]};
const sourceCommit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const hash=createHash("sha256");for(const file of [...readdirSync("lib/poker").filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).sort().map(f=>`lib/poker/${f}`),"scripts/contextual-flop.ts","package.json"]){hash.update(file).update(readFileSync(file));}
const sourceFingerprint=hash.digest("hex");
const directory=`handoffs/runs/${new Date().toISOString().slice(0,10)}-contextual-${sourceFingerprint.slice(0,12)}`;
if(existsSync(directory))throw new Error("Preserve existing run; this runner cannot resume.");
const registry=JSON.parse(readFileSync('handoffs/seed-registry.json','utf8'));
for(const seed of Object.values(settings.seeds).flat())if(registry.started_batches?.some((r:{seed:number})=>r.seed===seed)||!registry.reserved_not_run.some((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end))throw new Error(`Seed ${seed} is not reserved and fresh.`);
mkdirSync(directory,{recursive:true});
const state={settings,sourceCommit,sourceFingerprint,status:"running",phase:"training",training:[] as LeagueBatch[],validation:[] as LeagueBatch[],evaluation:[] as LeagueBatch[],panels:{training:[] as ReplayObservation[][],validation:[] as ReplayObservation[][]},fits:[] as ReturnType<typeof fitContextual>[],models:{current:{version:1,kind:"current"},uniform:{version:1,kind:"uniform"}} as Record<string,ResponseModel>,metrics:{} as Record<string,unknown>,freeze:null as object|null,results:null as object|null,error:null as string|null};
function atomic(path:string,value:string|Buffer){writeFileSync(`${directory}/${path}.tmp`,value);renameSync(`${directory}/${path}.tmp`,`${directory}/${path}`);}
function accounting(){const reports=[...state.training,...state.validation,...state.evaluation].flatMap(b=>b.cells.flatMap(c=>c.report.runs.map(r=>r.report)));return {hands:reports.reduce((s,r)=>s+r.hands,0),matches:reports.length,fallbacks:reports.reduce((s,r)=>s+r.fallbacks.reduce((a,b)=>a+b,0),0),nonconserving:reports.filter(r=>r.net.reduce((a,b)=>a+b,0)!==0).length};}
function save(){atomic("raw-results.json.gz",gzipSync(JSON.stringify(state)));atomic("summary.json",JSON.stringify({...state,training:state.training.length,validation:state.validation.length,evaluation:state.evaluation.length,panels:{training:state.panels.training.map(p=>p.length),validation:state.panels.validation.map(p=>p.length)},accounting:accounting()},null,2)+'\n');atomic("handoff.md",`# Contextual flop pilot\n\nStatus: ${state.status}; phase: ${state.phase}.\n\nSource: ${sourceCommit}; fingerprint ${sourceFingerprint}.\n\nExact settings, fits, scores and accounting: summary.json. Raw matches and observer panels: raw-results.json.gz. No live promotion. Failures retained; no automatic resume.\n`);}
let stopped=false;for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>{stopped=true;});
const base:LeagueConfiguration={id:"current",mode:"frozen",styleRetention:1,riverRiskPenalty:1,equitySamples:50,riverSamples:16};
async function batch(phase:"training"|"validation"|"evaluation",seed:number,id="current"){
 if(stopped)throw new Error("Interrupted at batch boundary.");state.phase=phase;save();
 const used=registry.reserved_not_run.find((r:{start:number;end:number})=>seed>=r.start&&seed<=r.end);
 registry.started_batches??=[];registry.started_batches.push({seed,phase,id,directory,startedAt:new Date().toISOString(),reservation:used});
 writeFileSync('handoffs/seed-registry.json',JSON.stringify(registry,null,2)+'\n');
 const panel:ReplayObservation[]=[];
 const result=runLeagueBatch({...base,id,mode:id==="equity"?"equity":"frozen",responseModel:state.models[id]},seed,fields[phase]!,settings.tableSizes,settings.hands,true,undefined,phase!=="evaluation"?e=>panel.push(e):undefined);
 state[phase].push(result);if(phase!=="evaluation")state.panels[phase].push(panel);
 const audit=accounting();if(audit.fallbacks||audit.nonconserving)throw new Error("Raw accounting failure.");save();console.error(`${phase} ${id} ${seed}: ${(result.elapsedMs/1000).toFixed(1)}s; flop=${panel.filter(r=>r.board.length===3).length}`);await new Promise<void>(r=>setImmediate(r));
}
function trainingRows(){return state.panels.training.flatMap(p=>p.filter(r=>r.board.length===3));}
function scorePanel(id:string,panels:ReplayObservation[][]){return panelScores(id,panels.flatMap(p=>replayObservations(p,state.models[id]!)));}
save();
try{
 for(const seed of settings.seeds.training)await batch("training",seed);
 if(trainingDecision(trainingRows().length,false)==="top-up")for(const seed of settings.seeds.topUp)await batch("training",seed);
 if(trainingDecision(trainingRows().length,true)==="insufficient-data"){state.status="insufficient-data";state.results={flopObservations:trainingRows().length,decision:"Stop before validation: fixed training quota unmet."};save();}
 else{
  state.phase="fitting";save();state.models.frequency=fitFrequency(trainingRows());
  for(const lambda of settings.lambdas){const fit=fitContextual(trainingRows(),lambda);state.fits.push(fit);if(fit.converged)state.models[`contextual:${lambda}`]=fit.model;save();}
  for(const seed of settings.seeds.validation)await batch("validation",seed);
  const scores=Object.keys(state.models).map(id=>{const training=scorePanel(id,state.panels.training),validation=scorePanel(id,state.panels.validation);state.metrics[id]={training,validation};return validation;});
  const selected=selectResponse(scores);const freeze={selected,model:state.models[selected],modelHash:createHash('sha256').update(JSON.stringify(state.models[selected])).digest('hex'),scores,frozenAt:new Date().toISOString(),sourceFingerprint};
  const serialized=JSON.stringify(freeze,null,2)+'\n';atomic('freeze.json',serialized);atomic('freeze.sha256',createHash('sha256').update(serialized).digest('hex')+'\n');state.freeze=freeze;save();
  for(const id of evaluationConfigurations(selected,existsSync(`${directory}/freeze.json`)))for(const seed of settings.seeds.evaluation)await batch('evaluation',seed,id);
  const ids=evaluationConfigurations(selected,true);const summaries=ids.map(id=>{const batches=state.evaluation.filter(b=>b.configuration.id===id),rows=batches.flatMap(b=>b.forecasts??[]).filter(r=>r.street==='flop');return {id,profit:summarizeLeague(batches.flatMap(b=>b.rows)),scores:forecastScores(rows),supportGroups:Object.fromEntries([...new Set(rows.map(r=>`${supportKey(r.probabilities)}:${r.context.facing}`))].sort().map(key=>[key,forecastScores(rows.filter(r=>`${supportKey(r.probabilities)}:${r.context.facing}`===key))])),reliability:reliabilityBins(rows),computeMs:batches.reduce((s,b)=>s+b.elapsedMs,0)};});
  const selectedRows=state.evaluation.filter(b=>b.configuration.id===selected).flatMap(b=>b.rows);
  state.results={selected,aliases:selected==='current'?{'selected':'current'}:{},summaries,deltas:['current','equity'].map(id=>({versus:id,...pairedLeagueDelta(selectedRows,state.evaluation.filter(b=>b.configuration.id===id).flatMap(b=>b.rows))})),limitations:['Four seed batches: exploratory; conventional intervals omitted.','Heuristic opponents only; prediction improvement is not poker strength.']};state.status="complete";save();
 }
 console.log(directory);
}catch(error){state.status=stopped?'interrupted':'failed';state.error=error instanceof Error?error.stack??error.message:String(error);save();throw error;}

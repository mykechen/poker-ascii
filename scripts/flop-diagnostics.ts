import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from "node:fs";
import {gzipSync} from "node:zlib";
import {blendResponse,fitFlopMixture,forecastScores,frequencyPrediction,reliabilityBins,seedRange,type Forecast} from "../lib/poker/forecast-diagnostics";
import {pairedLeagueDelta,runLeagueBatch,summarizeLeague,type LeagueBatch,type LeagueConfiguration,type LeagueField} from "../lib/poker/league";
function flag(name:string,fallback:number) {
 const index=process.argv.indexOf(`--${name}`);
 const value=index<0?fallback:Number(process.argv[index+1]);
 if(!Number.isSafeInteger(value)||value<1)throw new Error(`--${name} requires a positive integer.`);
 return value;
}
const hands=flag("hands",4);
const seeds={training:seedRange(flag("training-start",41001),flag("training-count",2)),validation:seedRange(flag("validation-start",42001),flag("validation-count",1)),evaluation:seedRange(flag("evaluation-start",43001),flag("evaluation-count",2))};
const all=Object.values(seeds).flat();
if(new Set(all).size!==all.length||all.some(n=>[20001,20002,30001,30002,30003].includes(n)))throw new Error("Use disjoint fresh seed partitions.");
const sourceFiles=[...readdirSync("lib/poker").filter(f=>f.endsWith(".ts")&&!f.endsWith(".test.ts")).sort().map(f=>`lib/poker/${f}`),"scripts/flop-diagnostics.ts","package.json"];
const sourceHash=createHash("sha256");for(const file of sourceFiles)sourceHash.update(file).update(readFileSync(file));
const sourceFingerprint=sourceHash.digest("hex");
const settings={hands,seeds,sourceFingerprint,equitySamples:50,riverSamples:16};
const id=createHash("sha256").update(JSON.stringify(settings)).digest("hex").slice(0,12);
const directory=`handoffs/runs/${new Date().toISOString().slice(0,10)}-flop-${id}`;
if(existsSync(directory))throw new Error(`Run already exists at ${directory}; preserve it and choose new settings for another run.`);
mkdirSync(directory,{recursive:true});
const base:LeagueConfiguration={id:"current-river",mode:"frozen",styleRetention:1,riverRiskPenalty:1,equitySamples:50,riverSamples:16};
const trainingFields:LeagueField[]=[{id:"balanced-train",opponents:["chart","tight","station","position"]},{id:"pressure-train",opponents:["aggressor","position","chart"]}];
const evaluationFields:LeagueField[]=[{id:"unseen-mix",opponents:["multiway","learner","maniac","station","tight"]},{id:"unseen-pressure",opponents:["maniac","learner","multiway"]}];
type Rows=NonNullable<LeagueBatch["forecasts"]>;
const state:{settings:typeof settings;sourceCommit:string;status:string;phase:string;training:LeagueBatch[];validation:LeagueBatch[];evaluation:LeagueBatch[];error?:string;freeze?:object;results?:object}={settings,sourceCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),status:"running",phase:"training",training:[],validation:[],evaluation:[]};
function accounting() {
 const reports=[...state.training,...state.validation,...state.evaluation].flatMap(b=>b.cells.flatMap(c=>c.report.runs.map(r=>r.report)));
 return {hands:reports.reduce((n,r)=>n+r.hands,0),matches:reports.length,illegalFallbacks:reports.reduce((n,r)=>n+r.fallbacks.reduce((a,b)=>a+b,0),0),nonconservingMatches:reports.filter(r=>r.net.reduce((a,b)=>a+b,0)!==0).length};
}
function atomic(path:string,data:string|Buffer){writeFileSync(`${directory}/${path}.tmp`,data);renameSync(`${directory}/${path}.tmp`,`${directory}/${path}`);}
function save(){
 atomic("raw-results.json.gz",gzipSync(JSON.stringify(state)));
 atomic("summary.json",JSON.stringify({...state,training:state.training.length,validation:state.validation.length,evaluation:state.evaluation.length,accounting:accounting()},null,2)+"\n");
 atomic("handoff.md",`# Bounded flop diagnostics\n\nStatus: ${state.status}; phase: ${state.phase}.\n\nSource commit: ${state.sourceCommit}; fingerprint: ${sourceFingerprint}.\n\nSettings and scores: summary.json. Full observations and matches: raw-results.json.gz. Selection is frozen in freeze.json before evaluation. No memory, no live policy promotion. Interrupted/failed runs are retained; this runner does not resume.\n`);
}
let stop=false;for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>{stop=true;});
async function batch(phase:"training"|"validation"|"evaluation",config:LeagueConfiguration,seed:number,fields:LeagueField[]) {
 if(stop){state.status="interrupted";save();process.exit(130);}
 state.phase=phase;
 const result=runLeagueBatch(config,seed,fields,[6,7,8],hands,true);
 state[phase].push(result);save();
 console.error(`${phase} ${config.id} seed ${seed}: ${(result.elapsedMs/1000).toFixed(1)}s`);
 await new Promise<void>(resolve=>setImmediate(resolve));
}
function flop(batches:LeagueBatch[]):Rows{return batches.flatMap(b=>b.forecasts??[]).filter(r=>r.street==="flop");}
function comparisons(rows:Forecast[],training:Forecast[],weight:number) {
 return {current:forecastScores(rows),fitted:forecastScores(rows,weight),uniform:forecastScores(rows,1),frequency:forecastScores(rows.map(r=>({...r,probabilities:frequencyPrediction(training,r.probabilities)})))};
}
function diagnostics(rows:Rows) {
 const dimensions=["family","facing","size","livePlayers","observerGroup","observerDraw","boardTexture"] as const;
 const groups=dimensions.flatMap(dimension=>{
  const value=(r:Rows[number])=>String(dimension==="facing"?r.context.facing:dimension==="size"?r.context.size:r[dimension]);
  return [...new Set(rows.map(value))].sort().map(key=>{const subset=rows.filter(r=>value(r)===key);return {dimension,key,current:forecastScores(subset),uniform:forecastScores(subset,1),reliability:reliabilityBins(subset)};});
 });
 return {scores:forecastScores(rows),reliability:reliabilityBins(rows),groups};
}
save();
try {
 for(const seed of seeds.training)await batch("training",base,seed,trainingFields);
 const training=flop(state.training);
 const fit=fitFlopMixture(training);
 for(const seed of seeds.validation)await batch("validation",base,seed,trainingFields);
 const validation=flop(state.validation);
 const validationScores=comparisons(validation,training,fit.weight);
 const accepted=validationScores.fitted.logLoss<validationScores.current.logLoss;
 const weight=accepted?fit.weight:0;
 state.freeze={weight,trainingFit:fit,validationScores,rule:"Training minimum log loss on fixed 0/.25/.5/.75/1 grid; validation must improve log loss, otherwise weight zero. No held-out selection.",frozenAt:new Date().toISOString()};
 atomic("freeze.json",JSON.stringify(state.freeze,null,2)+"\n");save();
 for(const config of [{...base,id:"fitted-river",flopUniformWeight:weight},base,{...base,id:"equity-control",mode:"equity" as const}])for(const seed of seeds.evaluation)await batch("evaluation",config,seed,evaluationFields);
 const configurations=["fitted-river","current-river","equity-control"];
 const summaries=configurations.map(id=>{const batches=state.evaluation.filter(b=>b.configuration.id===id);return {id,profit:summarizeLeague(batches.flatMap(b=>b.rows)),flop:diagnostics(flop(batches))};});
 const fittedRows=state.evaluation.filter(b=>b.configuration.id==="fitted-river").flatMap(b=>b.rows);
 state.results={training:diagnostics(training),validation:diagnostics(validation),validationComparisons:validationScores,summaries,deltas:["current-river","equity-control"].map(id=>({versus:id,...pairedLeagueDelta(fittedRows,state.evaluation.filter(b=>b.configuration.id===id).flatMap(b=>b.rows))})),offlineFittedReliability:reliabilityBins(validation.map(r=>({...r,probabilities:blendResponse(r.probabilities,weight)}))),limitations:["Small diagnostic screen; observations correlated within matches; seed batches are uncertainty units.","Offline fit conditions on original ranges; fresh evaluation applies mixture to within-hand likelihoods and may change trajectories.","Observer features describe the forecasting player's own visible hand, never target hidden cards.","Family labels are external diagnostic metadata only; no opponent identities are fitted.","Proper scores and reliability bins do not establish profit gains."]};
 const audit=accounting();if(audit.illegalFallbacks||audit.nonconservingMatches)throw new Error("Raw accounting failed.");
 state.status="complete";save();console.log(directory);
} catch(error){state.status="failed";state.error=error instanceof Error?error.message:String(error);save();throw error;}

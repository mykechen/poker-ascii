import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from "node:fs";
import {gzipSync} from "node:zlib";
import {runLeagueBatch,type LeagueBatch,type LeagueConfiguration,type LeagueField} from "../lib/poker/league";
function arg(name:string,fallback:string){const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1]??"";}
const phase=arg("phase","baseline"),directory=arg("output",""),hands=Number(arg("hands","2")),seed=Number(arg("seed","20001"));
if(!["baseline","profile"].includes(phase)||!directory||!Number.isSafeInteger(hands)||hands<1||hands>100||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error("Use --phase baseline|profile --output DIRECTORY --hands 1..100 --seed UINT32.");
if(existsSync(`${directory}/${phase}.json`))throw new Error("Preserve existing profile results; choose a fresh output directory.");
mkdirSync(directory,{recursive:true});
const sourceHash=createHash("sha256");
for(const file of [...readdirSync("lib/poker").filter(f=>f.endsWith(".ts")&&!f.endsWith(".test.ts")).sort().map(f=>`lib/poker/${f}`),"scripts/profile-training.ts","package.json"])sourceHash.update(file).update(readFileSync(file));
const settings={phase,hands,seed,seedRole:"inspected historical profiling reuse; not fresh poker evidence",sourceFingerprint:sourceHash.digest("hex"),sourceCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),node:process.version,v8:process.versions.v8,equitySamples:50,riverSamples:16,tableSizes:[6,7,8],repetitions:phase==="baseline"?3:1,command:[process.execPath,...process.execArgv,...process.argv.slice(1)]};
const fields:LeagueField[]=[{id:"balanced-train",opponents:["chart","tight","station","position"]},{id:"pressure-train",opponents:["aggressor","position","chart"]}];
const base={styleRetention:1,riverRiskPenalty:1,equitySamples:50,riverSamples:16};
const configurations:LeagueConfiguration[]=[{...base,id:"equity-profile",mode:"equity"},{...base,id:"river-profile",mode:"frozen"}];
type Repetition={elapsedMs:number;traceHash:string;outcomeHash:string;hands:number;decisions:number;batches:LeagueBatch[];window:{start:number;end:number}};
const state:{settings:typeof settings;status:string;stage:string;warmup:Repetition|null;repetitions:Repetition[];error?:string;endToEndSnapshotMs?:number}={settings,status:"running",stage:"warmup",warmup:null,repetitions:[]};
function atomic(path:string,data:string|Buffer){writeFileSync(`${directory}/${path}.tmp`,data);renameSync(`${directory}/${path}.tmp`,`${directory}/${path}`);}
function save(){
 atomic(`${phase}.json`,JSON.stringify({...state,warmup:state.warmup?{...state.warmup,batches:undefined}:null,repetitions:state.repetitions.map(r=>({...r,batches:undefined}))},null,2)+"\n");
 atomic(`${phase}-raw.json.gz`,gzipSync(JSON.stringify(state)));
 atomic(`${phase}-handoff.md`,`# Training computation profile — ${phase}\n\nStatus: ${state.status}; stage: ${state.stage}. Source: ${settings.sourceCommit}; fingerprint: ${settings.sourceFingerprint}.\n\nHistorical seed ${seed}, ${hands} hands per match, 50 equity samples/16 river worlds, no cross-hand memory. Both fields and 6/7/8-player seat rotations. Completed measured repetitions: ${state.repetitions.length}/${settings.repetitions}.\n\nSettings, timing windows and deterministic hashes: ${phase}.json. Full warm-up/matches: ${phase}-raw.json.gz. This is profiling reuse, not independent poker-performance evidence. Startup and warm-up are excluded from workload windows. End-to-end snapshot excludes final serialization/profile flush; external time log records the full process.\n${state.error?`\nFailure: ${state.error}\n`:""}`);
}
const micros=()=>Number(process.hrtime.bigint()/BigInt(1000));
function workload():Repetition {
 const start=micros();const trace=createHash("sha256");
 const batches=configurations.map(config=>runLeagueBatch(config,seed,fields,settings.tableSizes,hands,false,event=>trace.update(JSON.stringify(event)+"\n")));
 const end=micros();
 const reports=batches.flatMap(b=>b.cells.flatMap(c=>c.report.runs.map(r=>({players:c.players,field:c.field,rotation:r.rotation,mapping:r.participantAtSeat,report:r.report}))));
 for(const {report}of reports)if(report.fallbacks.some(n=>n!==0)||report.net.reduce((a,b)=>a+b,0)!==0)throw new Error("Profile workload failed action/accounting checks.");
 return {elapsedMs:(end-start)/1000,traceHash:trace.digest("hex"),outcomeHash:createHash("sha256").update(JSON.stringify(reports)).digest("hex"),hands:reports.reduce((n,r)=>n+r.report.hands,0),decisions:reports.reduce((n,r)=>n+r.report.decisions.reduce((a,b)=>a+b,0),0),batches,window:{start,end}};
}
let stop=false;for(const signal of ["SIGINT","SIGTERM"]as const)process.once(signal,()=>{stop=true;});
async function checkpoint(){save();await new Promise<void>(resolve=>setImmediate(resolve));if(stop){state.status="interrupted";save();process.exit(130);}}
save();
try{
 state.warmup=workload();await checkpoint();
 for(let i=0;i<settings.repetitions;i++){
  state.stage=`measured-${i+1}`;const result=workload();
  if(result.traceHash!==state.warmup.traceHash||result.outcomeHash!==state.warmup.outcomeHash)throw new Error("Identical workload produced different deterministic actions or outcomes.");
  state.repetitions.push(result);console.error(`${phase} repetition ${i+1}: ${result.elapsedMs.toFixed(1)}ms, ${(result.hands/(result.elapsedMs/1000)).toFixed(2)} hands/sec`);await checkpoint();
 }
 state.status="complete";state.stage="complete";state.endToEndSnapshotMs=process.uptime()*1000;save();
}catch(error){state.status="failed";state.error=error instanceof Error?error.message:String(error);save();throw error;}

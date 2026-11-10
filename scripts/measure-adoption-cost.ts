import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createAdaptivePolicy} from '../lib/poker/adaptive';
import {strategyById,type StrategyId} from '../lib/poker/strategies';
import {playMatch} from '../lib/poker/train';
import type {Policy} from '../lib/poker/bot';
import {hashObject} from '../lib/poker/evaluation/protocol';
import {acquireControllerLock,sourceSnapshot,reserveSeeds,atomicJSON} from '../lib/poker/evaluation/provenance';
const directory='handoffs/adoption-2026-11-10/cost';
const release=acquireControllerLock();let sleep:ReturnType<typeof spawn>|undefined;
try{
 const pool=JSON.parse(readFileSync('handoffs/protocols/pool-v1.json','utf8')).pool;
 const study=JSON.parse(readFileSync('handoffs/adoption-2026-11-10/study.json','utf8'));
 const controller=JSON.parse(readFileSync('handoffs/adoption-2026-11-10/controller.json','utf8'));
 if(controller.status!=='all-runs-complete-awaiting-pooled-analysis')throw new Error('Both adoption runs must finish before the serial cost check');
 const reference=JSON.parse(readFileSync(study.runs[0].protocol,'utf8'));
 if(sourceSnapshot().hash!==study.sourceHash||hashObject(pool)!==reference.poolHash)throw new Error('Cost check must use the frozen adoption source and pool');
 const seeds=Array.from({length:20},(_,i)=>140001+i);
 const protocol={id:'adoption-cost-v1',classification:'engineering-cost-not-profit',seeds,pool,players:[6,7,8],hands:1,arms:[50,128],stack:200,blinds:[1,2],order:'50/128 on even seed index, reversed on odd',maxSeconds:7140,sourceHash:sourceSnapshot().hash,scriptHash:hashObject(readFileSync('scripts/measure-adoption-cost.ts','utf8')),gate:'mean hero policy-call ratio128/50<=3 and mean total hero lifecycle milliseconds/hand ratio<=3; zero fallbacks/illegal actions; finite outputs. Absolute p95/p99 reported for later latency gate.'};
 const registryPath='handoffs/seed-registry.json',registry=JSON.parse(readFileSync(registryPath,'utf8'));
 const updated=reserveSeeds(registry,seeds,protocol.id,hashObject(protocol),protocol.classification);
 mkdirSync(directory);
 atomicJSON(`${directory}/freshness.json`,{registryHashBefore:hashObject(registry),checkedNamespaces:['retired_inspected_ranges','reserved_not_run','started_batches','evaluation_reservations'],fresh:true,seeds,checkedAt:new Date().toISOString()});
 atomicJSON(`${directory}/protocol.json`,protocol);writeFileSync(`${directory}/runner.ts`,readFileSync('scripts/measure-adoption-cost.ts'),{flag:'wx'});atomicJSON(`${directory}/source.json`,sourceSnapshot());
 sleep=spawn('/usr/bin/caffeinate',['-is','-w',String(process.pid)],{stdio:'ignore'});
 const start=Date.now(),started=performance.now();
 updated.evaluation_reservations!.at(-1)!.status='started';
 updated.started_batches.push(...seeds.map(seed=>({seed,phase:'adoption-cost',protocolHash:hashObject(protocol),directory,startedAt:new Date(start).toISOString()})));atomicJSON(registryPath,updated);
 const measurements:Record<string,{decisions:{ms:number;street:string|null}[];observeMs:number;sessionMs:number;hands:number}>={};
 for(const samples of [50,128])measurements[samples]={decisions:[],observeMs:0,sessionMs:0,hands:0};
 function timed(base:Policy,samples:number):Policy{
  const m=measurements[samples]!;
  return Object.assign((view:Parameters<Policy>[0])=>{const t=performance.now();const result=base(view);m.decisions.push({ms:performance.now()-t,street:view.street});return result;},{startSession:(ids:string[])=>{const t=performance.now();base.startSession?.(ids);m.sessionMs+=performance.now()-t;},observe:(before:Parameters<NonNullable<Policy['observe']>>[0],after:Parameters<NonNullable<Policy['observe']>>[1])=>{const t=performance.now();base.observe?.(before,after);m.observeMs+=performance.now()-t;}});
 }
 const progress={status:'running',startedAt:new Date(start).toISOString(),protocolHash:hashObject(protocol),completedMatches:0};atomicJSON(`${directory}/progress.json`,progress);
 try{
  for(const [index,seed] of seeds.entries())for(const cell of pool as {id:string;opponents:string[]}[])for(const players of protocol.players)for(let rotation=0;rotation<players;rotation++)for(const samples of index%2?[128,50]:[50,128]){
   if(Date.now()-start>protocol.maxSeconds*1000||performance.now()-started>protocol.maxSeconds*1000)throw new Error('Cost benchmark runtime cap');
   const participants=Array.from({length:players},(_,i)=>{const id=i?cell.opponents[(i-1+index)%cell.opponents.length]!:'hero';return {name:i?`opponent-${i}`:'hero',policy:i===0?timed(createAdaptivePolicy({samples,seed:42,riverSamples:16,riverRiskPenalty:1,learn:false,styleRetention:1,responseModel:{version:1,kind:'current'}}).policy,samples):id==='baseline-v0'?createAdaptivePolicy({samples:50,seed:42,riverSamples:16,riverRiskPenalty:1,learn:false,styleRetention:1,responseModel:{version:1,kind:'current'}}).policy:strategyById(id as StrategyId).policy};});
   const result=playMatch({seats:participants.map((_,seat)=>participants[(seat+rotation)%players]!),seed,hands:1,stack:protocol.stack,smallBlind:1,bigBlind:2,invalidAction:'throw'});
   if(result.fallbacks.some(n=>n!==0)||result.net.reduce((a,b)=>a+b,0)!==0)throw new Error('Cost trace accounting/legality failed');
   measurements[samples]!.hands++;progress.completedMatches++;if(progress.completedMatches%84===0)atomicJSON(`${directory}/progress.json`,progress);
  }
  if(Date.now()-start>protocol.maxSeconds*1000||performance.now()-started>protocol.maxSeconds*1000)throw new Error('Cost benchmark exceeded final runtime cap');
  const summary=Object.fromEntries(Object.entries(measurements).map(([arm,m])=>{const values=m.decisions.map(d=>d.ms).sort((a,b)=>a-b);if(!values.length||values.some(v=>!Number.isFinite(v)))throw new Error('Invalid latency samples');const total=values.reduce((a,b)=>a+b,0);return [arm,{hands:m.hands,decisions:values.length,meanMs:total/values.length,p95Ms:values[Math.ceil(.95*values.length)-1],p99Ms:values[Math.ceil(.99*values.length)-1],lifecycleMsPerHand:(total+m.observeMs+m.sessionMs)/m.hands}];}));
  const ratio=summary['128']!.meanMs/summary['50']!.meanMs,lifecycleRatio=summary['128']!.lifecycleMsPerHand/summary['50']!.lifecycleMsPerHand;
  atomicJSON(`${directory}/measurements.json`,measurements);atomicJSON(`${directory}/result.json`,{summary,meanDecisionRatio:ratio,lifecycleRatio,passed:ratio<=3&&lifecycleRatio<=3,elapsedMs:Date.now()-start,hardware:execFileSync('sysctl',['-n','hw.perflevel0.physicalcpu','hw.perflevel1.physicalcpu'],{encoding:'utf8'}).trim(),thermal:execFileSync('pmset',['-g','therm'],{encoding:'utf8'}).trim()});
  atomicJSON(`${directory}/progress.json`,{...progress,status:'complete',endedAt:new Date().toISOString()});
 }catch(error){atomicJSON(`${directory}/progress.json`,{...progress,status:'failed',endedAt:new Date().toISOString(),error:String(error)});throw error;}
}finally{sleep?.kill();release();}

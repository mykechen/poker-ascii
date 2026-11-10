import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync,spawn,type ChildProcess} from 'node:child_process';
import {resolve} from 'node:path';
import {hashObject,validateProtocol,type Protocol} from '../lib/poker/evaluation/protocol';
import {sourceSnapshot,atomicJSON,acquireControllerLock} from '../lib/poker/evaluation/provenance';
import {runPool} from '../lib/poker/evaluation/pool';
async function main(){
const releaseController=acquireControllerLock();
let sleepAssertion:ChildProcess|undefined;
try{
if(process.platform==='darwin'){
 sleepAssertion=spawn('/usr/bin/caffeinate',['-is','-w',String(process.pid)],{stdio:'ignore'});
 await new Promise<void>((ok,fail)=>{sleepAssertion!.once('spawn',ok);sleepAssertion!.once('error',fail);});
 await new Promise<void>(ok=>setTimeout(ok,100));
 const assertions=execFileSync('pmset',['-g','assertions'],{encoding:'utf8'});
 if(!assertions.includes(`pid ${sleepAssertion.pid}(caffeinate)`))throw new Error('Idle-sleep prevention assertion was not established');
}

const args=process.argv.slice(2);function arg(name:string){const i=args.indexOf(name);if(i<0||!args[i+1])throw new Error(`Missing ${name}`);return args[i+1]!;}
const protocol=JSON.parse(readFileSync(arg('--protocol'),'utf8')) as Protocol;validateProtocol(protocol);
const workers=Number(arg('--workers')),directory=resolve(arg('--out')),snapshot=sourceSnapshot();
if(snapshot.hash!==protocol.sourceHash)throw new Error('Source hash changed since protocol freeze');
const registryPath='handoffs/seed-registry.json',registry=JSON.parse(readFileSync(registryPath,'utf8'));
const reservation=registry.evaluation_reservations?.find((r:{protocolHash:string})=>r.protocolHash===hashObject(protocol));
if(!reservation||JSON.stringify(reservation.seeds)!==JSON.stringify(protocol.seeds))throw new Error('No matching immutable seed reservation');
const reuse=args.includes('--diagnostic-reuse');
if(reservation.status!=='reserved'&&!reuse)throw new Error('Seeds already started; diagnostic reuse requires explicit flag');
if(reuse&&!['engineering-smoke','scaling-diagnostic'].includes(protocol.classification))throw new Error('Reuse permitted only for frozen engineering/scaling diagnostics');
mkdirSync(directory,{recursive:false});
const hardware={model:'Apple M4 Pro',ramGB:48,cores:execFileSync('sysctl',['-n','hw.perflevel0.physicalcpu','hw.perflevel1.physicalcpu'],{encoding:'utf8'}).trim().split(/\s+/).map(Number)};
atomicJSON(`${directory}/protocol.json`,protocol);atomicJSON(`${directory}/source.json`,snapshot);
const provenance={startedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),protocolHash:hashObject(protocol),sourceHash:snapshot.hash,workers,hardware,node:process.version,platform:process.platform,arch:process.arch,diagnosticReuse:reuse,command:process.argv,sleepPrevention:process.platform==='darwin'?'caffeinate -is -w runnerPID (process-scoped, AC system-sleep assertion)':'not applicable',thermalStart:thermal(),status:'running',maxSeconds:protocol.maxSeconds};
function thermal(){try{return execFileSync('pmset',['-g','therm'],{encoding:'utf8',timeout:2000}).trim();}catch{return 'unavailable';}}
atomicJSON(`${directory}/provenance.json`,provenance);
reservation.status='started';registry.started_batches.push(...protocol.seeds.map(seed=>({seed,phase:'evaluation-r2',directory,startedAt:provenance.startedAt,protocolHash:provenance.protocolHash,reuse})));atomicJSON(registryPath,registry);
try{
 const result=await runPool(protocol,workers,(seed,rows)=>writeFileSync(`${directory}/seed-${seed}.json`,JSON.stringify(rows)+'\n',{flag:'wx'}));
 writeFileSync(`${directory}/hands.jsonl`,result.rows.map(r=>JSON.stringify(r)).join('\n')+'\n',{flag:'wx'});
 atomicJSON(`${directory}/timing.json`,{...result.timing,physicalHands:result.rows.length,handsPerHour:result.rows.length/result.timing.elapsedMs*3600000,thermalEnd:thermal()});
 atomicJSON(`${directory}/provenance.json`,{...provenance,status:'complete',endedAt:new Date().toISOString()});
}catch(error){atomicJSON(`${directory}/provenance.json`,{...provenance,status:'failed',error:error instanceof Error?error.stack:String(error),endedAt:new Date().toISOString()});throw error;}

}finally{sleepAssertion?.kill('SIGTERM');releaseController();}
}
await main();

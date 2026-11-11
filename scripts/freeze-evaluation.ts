import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {sourceSnapshot,reserveSeeds,atomicJSON,acquireControllerLock} from '../lib/poker/evaluation/provenance';
import {hashObject,validateProtocol,type Protocol} from '../lib/poker/evaluation/protocol';
async function main(){
const releaseController=acquireControllerLock();
try{
const args=process.argv.slice(2);const get=(name:string,fallback?:string)=>{const i=args.indexOf(name);if(i<0){if(fallback!==undefined)return fallback;throw new Error(`Missing ${name}`);}return args[i+1]!;};
const id=get('--id'),seedStart=Number(get('--seed-start')),clusters=Number(get('--clusters')),hands=Number(get('--hands'));
if(!Number.isSafeInteger(clusters)||clusters<2)throw new Error('At least two seed clusters');
const pool=[{id:'heuristic',opponents:['chart','tight','station','position','aggressor']},{id:'baseline-opponent',opponents:['baseline-v0','tight','station','position','aggressor']}];
const p:Protocol={version:1,id,classification:get('--classification'),sourceHash:sourceSnapshot().hash,poolHash:hashObject(pool),pool,arms:JSON.parse(get('--arms','[{"id":"50","samples":50},{"id":"128","samples":128}]')),seeds:Array.from({length:clusters},(_,i)=>seedStart+i),hands,players:JSON.parse(get('--players','[6,7,8]')),stack:200,smallBlind:1,bigBlind:2,adjustAllIn:get('--adjust','true')==='true',maxSeconds:Number(get('--max-seconds',get('--classification')==='scaling-diagnostic'?'600':'7200'))};validateProtocol(p);
p.workerIdleMs=Number(get('--worker-idle-ms','0'));validateProtocol(p);
const registryPath='handoffs/seed-registry.json',registry=JSON.parse(readFileSync(registryPath,'utf8'));
const updated=reserveSeeds(registry,p.seeds,id,hashObject(p),p.classification);
mkdirSync('handoffs/protocols',{recursive:true});
const manifest=p.seeds.flatMap(seed=>pool.flatMap(cell=>p.players.flatMap(players=>Array.from({length:players},(_,rotation)=>p.arms.map(arm=>({seed,cell:cell.id,players,rotation,arm:arm.id,hands:p.hands,outputIdentity:`${seed}:${cell.id}:${players}:${rotation}`,effectiveParticipants:Array.from({length:players},(_,seat)=>{const i=(seat+rotation)%players;return i===0?`hero-${arm.id}`:cell.opponents[(i-1+p.seeds.indexOf(seed))%cell.opponents.length]!;})}))))));
writeFileSync(`handoffs/protocols/${id}-freshness.json`,JSON.stringify({registryHashBefore:hashObject(registry),checkedNamespaces:['retired_inspected_ranges','reserved_not_run','started_batches','evaluation_reservations'],fresh:true,seeds:p.seeds,protocolHash:hashObject(p),classification:p.classification,checkedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
writeFileSync(`handoffs/protocols/${id}.json`,JSON.stringify(p,null,2)+'\n',{flag:'wx'});
writeFileSync(`handoffs/protocols/${id}-manifest.json`,JSON.stringify({protocolHash:hashObject(p),weighting:'equal pool cells, equal table sizes, equal rotations, equal seeds; hands within match equal',matches:manifest,physicalHands:manifest.length*hands},null,2)+'\n',{flag:'wx'});
atomicJSON(registryPath,updated);console.log(`handoffs/protocols/${id}.json`);

}finally{releaseController();}
}
await main();

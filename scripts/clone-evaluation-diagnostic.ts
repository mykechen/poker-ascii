import {readFileSync,writeFileSync} from 'node:fs';
import {sourceSnapshot,atomicJSON,acquireControllerLock} from '../lib/poker/evaluation/provenance';
import {hashObject,validateProtocol,type Protocol} from '../lib/poker/evaluation/protocol';
const [input,id]=process.argv.slice(2);if(!input||!id)throw new Error('Usage: clone-evaluation-diagnostic.ts INPUT NEW_ID');
const release=acquireControllerLock();try{
 const old=JSON.parse(readFileSync(input,'utf8')) as Protocol;
 if(!['engineering-smoke','scaling-diagnostic'].includes(old.classification))throw new Error('Only diagnostic protocols may be re-frozen');
 const registry=JSON.parse(readFileSync('handoffs/seed-registry.json','utf8'));
 const parent=registry.evaluation_reservations.find((r:{protocolHash:string})=>r.protocolHash===hashObject(old));
 if(!parent||JSON.stringify(parent.seeds)!==JSON.stringify(old.seeds))throw new Error('Missing parent reservation');
 const rawOnly=process.argv.includes('--raw-only');
 const p={...old,id,sourceHash:sourceSnapshot().hash,...(rawOnly?{adjustAllIn:false}:{})};validateProtocol(p);
 registry.evaluation_reservations.push({id,protocolHash:hashObject(p),seeds:p.seeds,classification:p.classification,status:'started',diagnosticParentHash:hashObject(old),reason:rawOnly?'Matched raw-only scoring cost diagnostic; identical seeds/policies/work, no inferential reuse':'Explicit inspected diagnostic reuse after integrity-only source change; not independent data'});
 writeFileSync(`handoffs/protocols/${id}.json`,JSON.stringify(p,null,2)+'\n',{flag:'wx'});
 const manifest=JSON.parse(readFileSync(input.replace(/\.json$/,'-manifest.json'),'utf8'));manifest.protocolHash=hashObject(p);manifest.diagnosticParentHash=hashObject(old);
 writeFileSync(`handoffs/protocols/${id}-manifest.json`,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});atomicJSON('handoffs/seed-registry.json',registry);
}finally{release();}

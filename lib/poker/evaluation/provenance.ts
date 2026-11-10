import {readFileSync,readdirSync,writeFileSync,renameSync,mkdirSync,unlinkSync,rmdirSync} from 'node:fs';
import {hashObject} from './protocol';
export function sourceSnapshot():{hash:string;files:Record<string,string>}{
 const files:Record<string,string>={};
 function walk(dir:string){for(const e of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const name=`${dir}/${e.name}`;if(e.isDirectory())walk(name);else if(name.endsWith('.ts')&&!name.endsWith('.test.ts'))files[name]=readFileSync(name,'utf8');}}
 walk('lib/poker');for(const file of ['scripts/evaluate-frozen.ts','scripts/evaluate-worker.ts','package.json','package-lock.json'])files[file]=readFileSync(file,'utf8');
 return {hash:hashObject(files),files};
}
type Registry={retired_inspected_ranges:{start:number;end:number;reason:string}[];reserved_not_run:{start:number;end:number;purpose?:string;role?:string}[];started_batches:{seed:number;[key:string]:unknown}[];evaluation_reservations?:{id:string;protocolHash:string;seeds:number[];classification:string;status:string}[]};
export function reserveSeeds(registry:Registry,seeds:number[],id:string,protocolHash:string,classification:string):Registry{
 if(new Set(seeds).size!==seeds.length||!seeds.length)throw new Error('Invalid seed list');
 for(const s of seeds)if(registry.retired_inspected_ranges.some(r=>s>=r.start&&s<=r.end)||registry.reserved_not_run.some(r=>s>=r.start&&s<=r.end)||registry.started_batches.some(r=>r.seed===s)||(registry.evaluation_reservations??[]).some(r=>r.seeds.includes(s)))throw new Error(`Seed collision ${s}`);
 return {...registry,evaluation_reservations:[...(registry.evaluation_reservations??[]),{id,protocolHash,seeds,classification,status:'reserved'}]};
}
export function atomicJSON(file:string,value:unknown){writeFileSync(`${file}.tmp`,JSON.stringify(value,null,2)+'\n');renameSync(`${file}.tmp`,file);}

/** One controller owns protocol reservation/launch bookkeeping; workers never touch the registry. */
export function acquireControllerLock(directory='handoffs/.evaluation-controller.lock'):()=>void{
 try{mkdirSync(directory);}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw new Error(`Another evaluation controller holds ${directory}; inspect owner.json before removing a stale lock`);throw error;}
 try{writeFileSync(`${directory}/owner.json`,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}),{flag:'wx'});}catch(error){rmdirSync(directory);throw error;}
 return ()=>{unlinkSync(`${directory}/owner.json`);rmdirSync(directory);};
}

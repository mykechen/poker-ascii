import {readFileSync} from 'node:fs';
import {acquireControllerLock,atomicJSON} from '../lib/poker/evaluation/provenance';
const release=acquireControllerLock();try{
 const path='handoffs/seed-registry.json',r=JSON.parse(readFileSync(path,'utf8'));
 for(const reservation of r.evaluation_reservations??[]){
  const batches=r.started_batches.filter((b:{protocolHash?:string})=>b.protocolHash===reservation.protocolHash);
  if(!batches.length)continue;
  reservation.status='retired-inspected';
  reservation.directories=[...new Set(batches.map((b:{directory:string})=>b.directory))];
  const start=Math.min(...reservation.seeds),end=Math.max(...reservation.seeds);
  if(!r.retired_inspected_ranges.some((x:{start:number;end:number})=>x.start<=start&&x.end>=end))r.retired_inspected_ranges.push({start,end,reason:`${reservation.id}: engineering/exploratory evaluation complete or partial; entire reservation conservatively retired from confirmation.`});
 }
 atomicJSON(path,r);
}finally{release();}

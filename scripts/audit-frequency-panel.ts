// Independent replay of archived common histories, with a separate score accumulator.
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {replayObservations,type ReplayObservation} from '../lib/poker/contextual-replay';
import {supportKey,type ResponseModel} from '../lib/poker/contextual-response';
const dir=process.argv[2];
if(!dir)throw new Error('Pass a completed confirmation directory.');
const summary=JSON.parse(readFileSync(`${dir}/summary.json`,'utf8'));
const freeze=JSON.parse(readFileSync(`${dir}/freeze.json`,'utf8'));
const metrics:Record<string,Record<string,{count:number;logLoss:number;brier:number}>>={};
for(const id of ['frequency','current']){
 const model:ResponseModel=id==='frequency'?freeze.model:{version:1,kind:'current'};
 const groups:typeof metrics[string]={};
 for(let seed=62001;seed<=62010;seed++){
  const raw=JSON.parse(gunzipSync(readFileSync(`${dir}/panel-${seed}-current.json.gz`)).toString()) as {observations:ReplayObservation[]};
  const rows=replayObservations(raw.observations,model);
  for(const row of rows.filter(r=>r.board.length===3)){
   const index=['fold','passive','aggressive'].indexOf(row.actual);
   if(index<0)throw new Error(`Unknown action class ${row.actual}`);
   for(const key of ['all',`${supportKey(row.probabilities)}:${row.context.facing}`]){
    const group=groups[key]??={count:0,logLoss:0,brier:0};
    group.count++;group.logLoss-=Math.log(Math.max(1e-12,row.probabilities[index]!));
    group.brier+=row.probabilities.reduce((s,p,i)=>s+(p-(i===index?1:0))**2,0);
   }
  }
 }
 for(const [key,g] of Object.entries(groups)){
  g.logLoss/=g.count;g.brier/=g.count;
  const expected=key==='all'?summary.scores[id].scores:summary.scores[id].groups[key];
  if(!expected||expected.count!==g.count||Math.abs(expected.logLoss-g.logLoss)>1e-9||Math.abs(expected.brier-g.brier)>1e-9)throw new Error(`Replay score mismatch ${id} ${key}`);
 }
 metrics[id]=groups;
}
writeFileSync(`${dir}/panel-audit.json`,JSON.stringify({independentAccumulation:true,metrics},null,2)+'\n');
console.log('Archived panel replay and independently accumulated scores match.');

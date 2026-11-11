import {spawn,type ChildProcess} from 'node:child_process';
import {resolve} from 'node:path';
import {budgetState} from './budget';
import {validateProtocol,validateRows,type Protocol,type HandRecord} from './protocol';
export async function runPool(p:Protocol,workers:number,onSeed?:(seed:number,rows:HandRecord[])=>void):Promise<{rows:HandRecord[];timing:{elapsedMs:number;activeElapsedMs:number;clockGapMs:number;workers:number;workerIdleMs:number;peakWorkerRssBytes:number[];workerMemory:{pid:number;peakRssBytes:number}[];seedTimings:{seed:number;elapsedMs:number;allInMs:number}[]}}>{
 validateProtocol(p);if(!Number.isSafeInteger(workers)||workers<1||workers>64)throw new Error('Workers must be 1–64');
 const wallStarted=Date.now(),started=performance.now(),children=new Set<ChildProcess>(),results=new Map<number,HandRecord[]>(),rss:number[]=[],seedTimings:{seed:number;elapsedMs:number;allInMs:number}[]=[];
 const workerMemory=new Map<number,number>();
 const pendingPauses=new Set<ReturnType<typeof setTimeout>>();
 let next=0;
 const cancel=()=>{for(const child of children)child.kill('SIGTERM');};
 process.once('SIGTERM',cancel);process.once('SIGINT',cancel);
 const timeout=setTimeout(cancel,p.maxSeconds*1000);
 const watchdog=setInterval(()=>{if(budgetState(wallStarted,started,Date.now(),performance.now(),p.maxSeconds*1000).exceeded)cancel();},250);
 try{
  await Promise.all(Array.from({length:Math.min(workers,p.seeds.length)},async()=>{
   // Whole seed clusters stay in one process; scheduling never changes RNG or aggregation order.
   const child=spawn(process.execPath,[resolve('node_modules/vite-node/vite-node.mjs'),resolve('scripts/evaluate-worker.ts')],{stdio:['ignore','pipe','pipe','ipc']});children.add(child);
   let stderr='';child.stderr!.on('data',x=>{stderr+=String(x);if(stderr.length>16000)stderr=stderr.slice(-16000);});
   await new Promise<void>((done,fail)=>{
    let finished=false;
    const send=()=>{if(!child.connected){fail(new Error('Worker IPC disconnected'));return;}const seed=p.seeds[next++];if(seed===undefined){finished=true;child.disconnect();return;}child.send({protocol:p,seed});};
    const schedule=()=>{
     if(!p.workerIdleMs||next>=p.seeds.length){send();return;}
     // Fixed outcome-independent idle time limits average CPU draw; all assigned work still runs.
     const timer=setTimeout(()=>{pendingPauses.delete(timer);send();},p.workerIdleMs);pendingPauses.add(timer);
    };
    child.on('message',(message:unknown)=>{const m=message as {seed:number;rows:HandRecord[];rss:number;elapsedMs:number;allInMs:number;error?:string};try{if(m.error)throw new Error(m.error);validateRows(p,m.seed,m.rows);if(results.has(m.seed))throw new Error('Duplicate seed output');results.set(m.seed,m.rows);onSeed?.(m.seed,m.rows);rss.push(m.rss);workerMemory.set(child.pid!,Math.max(workerMemory.get(child.pid!)??0,m.rss));seedTimings.push({seed:m.seed,elapsedMs:m.elapsedMs,allInMs:m.allInMs});schedule();}catch(e){fail(e);child.kill('SIGTERM');}});
    child.on('error',fail);child.on('exit',(code,signal)=>{children.delete(child);if(finished&&code===0)done();else fail(new Error(`Worker failed (${code}/${signal}): ${stderr}`));});send();
   });
  }));
  if(results.size!==p.seeds.length)throw new Error('Incomplete manifest');
  const budget=budgetState(wallStarted,started,Date.now(),performance.now(),p.maxSeconds*1000);
  if(budget.exceeded)throw new Error('Wall-clock/monotonic budget cap reached');
  return {rows:p.seeds.flatMap(seed=>results.get(seed)!),timing:{elapsedMs:budget.elapsedMs,activeElapsedMs:performance.now()-started,clockGapMs:budget.clockGapMs,workers,workerIdleMs:p.workerIdleMs??0,peakWorkerRssBytes:rss,workerMemory:[...workerMemory].map(([pid,peakRssBytes])=>({pid,peakRssBytes})),seedTimings:seedTimings.sort((a,b)=>a.seed-b.seed)}};
 }finally{clearTimeout(timeout);clearInterval(watchdog);for(const timer of pendingPauses)clearTimeout(timer);process.removeListener('SIGTERM',cancel);process.removeListener('SIGINT',cancel);for(const child of children)child.kill('SIGTERM');}
}

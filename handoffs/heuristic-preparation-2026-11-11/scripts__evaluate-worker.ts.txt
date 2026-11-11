import {runSeed,type Protocol,type EvaluationTiming} from '../lib/poker/evaluation/protocol';
process.on('message',(m:{protocol:Protocol;seed:number})=>{
 try{const started=performance.now();let timing:EvaluationTiming={allInMs:0,controlStats:{}};const rows=runSeed(m.protocol,m.seed,t=>{timing=t;});process.send?.({seed:m.seed,rows,elapsedMs:performance.now()-started,...timing,rss:process.resourceUsage().maxRSS*1024});}
 catch(error){process.send?.({seed:m.seed,error:error instanceof Error?error.stack:String(error)});}
});

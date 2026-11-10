import {runSeed,type Protocol} from '../lib/poker/evaluation/protocol';
process.on('message',(m:{protocol:Protocol;seed:number})=>{
 try{const started=performance.now();let allInMs=0;const rows=runSeed(m.protocol,m.seed,t=>{allInMs=t.allInMs;});process.send?.({seed:m.seed,rows,elapsedMs:performance.now()-started,allInMs,rss:process.resourceUsage().maxRSS*1024});}
 catch(error){process.send?.({seed:m.seed,error:error instanceof Error?error.stack:String(error)});}
});

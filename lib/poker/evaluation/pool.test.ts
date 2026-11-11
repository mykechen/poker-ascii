import {it,expect} from 'vitest';
import {runPool} from './pool';
import {hashObject,type Protocol} from './protocol';
it('1 and 4 child workers produce byte-identical non-timing records',async()=>{
 const pool=[{id:'heuristic',opponents:['chart','tight','station','position','aggressor']}];
 const p:Protocol={version:1,id:'parallel-smoke',classification:'engineering-smoke',sourceHash:'a'.repeat(64),poolHash:hashObject(pool),pool,arms:[{id:'a',samples:50},{id:'b',samples:50}],seeds:[105001,105002],hands:2,players:[6,7,8],stack:200,smallBlind:1,bigBlind:2,adjustAllIn:false,maxSeconds:600};
 const a=await runPool(p,1),b=await runPool(p,4);
 expect(JSON.stringify(a.rows)).toBe(JSON.stringify(b.rows));expect(a.rows).toHaveLength(168);
},120000);
it('fixed pauses preserve serial and parallel records and are validated in the manifest',async()=>{
 const pool=[{id:'heuristic',opponents:['chart','tight','station','position','aggressor']}];
 const p:Protocol={version:1,id:'pause-smoke',classification:'engineering-smoke',sourceHash:'a'.repeat(64),poolHash:hashObject(pool),pool,arms:[{id:'a',samples:5},{id:'b',samples:5}],seeds:[105001,105002,105003],hands:1,players:[6],stack:200,smallBlind:1,bigBlind:2,adjustAllIn:false,maxSeconds:600,workerIdleMs:20};
 const paused=await runPool(p,1),parallel=await runPool(p,4),plain=await runPool({...p,workerIdleMs:0},1);
 expect(JSON.stringify(paused.rows)).toBe(JSON.stringify(plain.rows));expect(JSON.stringify(parallel.rows)).toBe(JSON.stringify(plain.rows));
 await expect(runPool({...p,workerIdleMs:-1},1)).rejects.toThrow(/pause/);
 await expect(runPool({...p,workerIdleMs:60001},1)).rejects.toThrow(/pause/);
},120000);

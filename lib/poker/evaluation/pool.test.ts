import {it,expect} from 'vitest';
import {runPool} from './pool';
import {hashObject,type Protocol} from './protocol';
it('1 and 4 child workers produce byte-identical non-timing records',async()=>{
 const pool=[{id:'heuristic',opponents:['chart','tight','station','position','aggressor']}];
 const p:Protocol={version:1,id:'parallel-smoke',classification:'engineering-smoke',sourceHash:'a'.repeat(64),poolHash:hashObject(pool),pool,arms:[{id:'a',samples:50},{id:'b',samples:50}],seeds:[105001,105002],hands:2,players:[6,7,8],stack:200,smallBlind:1,bigBlind:2,adjustAllIn:false,maxSeconds:600};
 const a=await runPool(p,1),b=await runPool(p,4);
 expect(JSON.stringify(a.rows)).toBe(JSON.stringify(b.rows));expect(a.rows).toHaveLength(168);
},120000);

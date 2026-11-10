import {it,expect} from 'vitest';
import {validateRows,hashObject,type Protocol,type HandRecord} from './protocol';
it('rejects a missing manifest cell replaced with a foreign cell even if row count and IDs are unique',()=>{
 const pool=[{id:'c',opponents:['chart']}];const p:Protocol={version:1,id:'x',classification:'test',pool,poolHash:hashObject(pool),sourceHash:'a'.repeat(64),arms:[{id:'a',samples:50}],seeds:[1],hands:1,players:[6],stack:200,smallBlind:1,bigBlind:2,adjustAllIn:false,maxSeconds:60};
 const rows=Array.from({length:6},(_,rotation)=>({schema:'evaluation-private-v1',id:`1:c:6:${rotation}:1:a`,seed:1,cell:'c',players:6,rotation,hand:1,arm:'a',hero:(6-rotation)%6,deckHash:'h',rawChips:[0,0,0,0,0,0],rawBb:0,adjustedBb:0,allInPoints:[],terminalBoard:[]} as HandRecord));
 rows[0]!.cell='foreign';expect(()=>validateRows(p,1,rows)).toThrow();
});

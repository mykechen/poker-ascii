import {expect,it} from 'vitest';
import {selectStates,streamMetrics} from './decision-stability';
it('selects lowest hashes in each declared cell without silently filling missing coverage',()=>{
 const rows=[{id:'z',cell:'a'},{id:'b',cell:'a'},{id:'a',cell:'a'},{id:'c',cell:'b'}];
 expect(selectStates(rows,{a:2,b:1}).map(s=>s.id)).toEqual(['a','b','c']);
 expect(selectStates([...rows].reverse(),{a:2,b:1})).toEqual(selectStates(rows,{a:2,b:1}));
 expect(()=>selectStates(rows,{a:2,b:2})).toThrow(/coverage/);
});
it('counts unordered stream pairs and paired reference disagreements',()=>{
 const result=streamMetrics([-1,-1,1,1,1,1,1,1],Array(8).fill(1));
 expect(result.flipFraction).toBeCloseTo(12/28);
 expect(result.referenceDisagreement).toBe(.25);
 expect(result.nearZeroFraction).toBe(1);
 expect(()=>streamMetrics([1],[1])).toThrow(/eight/);
});
it('aggregates matches within seeds and reports absent seed cells explicitly',async()=>{
 const {clusterSummary}=await import('./decision-stability');
 const rows=[{cell:'a',seed:1,match:'x',value:0},{cell:'a',seed:1,match:'x',value:2},{cell:'a',seed:1,match:'y',value:5},{cell:'a',seed:2,match:'z',value:7}];
 const summary=clusterSummary(rows,['a'],[1,2,3]);
 expect(summary.a!.mean).toBe(5);
 expect(summary.a!.standardError).toBe(2);
 expect(summary.a!.missingSeeds).toEqual([3]);
 expect(()=>clusterSummary(rows,['a','b'],[1,2,3])).toThrow(/coverage/);
});

it('bounded per-cell reservoirs match full offline lowest-hash selection',()=>{
 const rows=Array.from({length:100},(_,i)=>({id:String((i*37)%101).padStart(3,'0'),cell:i%2?'a':'b'}));
 const retained:typeof rows=[];
 for(const row of rows){retained.push(row);const same=retained.filter(r=>r.cell===row.cell).sort((a,b)=>a.id.localeCompare(b.id));if(same.length>3)retained.splice(retained.indexOf(same.at(-1)!),1);}
 expect(selectStates(retained,{a:3,b:3})).toEqual(selectStates(rows,{a:3,b:3}));
});
it('assigns each hand to its first paid pre-river state and pairs budget seeds',async()=>{
 const {claimPaidHand,pairedSeeds}=await import('./decision-stability');
 const seen=new Set<number>();
 expect(claimPaidHand(seen,1,'preflop',0)).toBe(false);
 expect(claimPaidHand(seen,1,'flop',2)).toBe(true);
 expect(claimPaidHand(seen,1,'turn',2)).toBe(false);
 expect(claimPaidHand(seen,2,'river',2)).toBe(false);
 expect(pairedSeeds(1,3,0)).toEqual(pairedSeeds(1,3,0));
 expect(pairedSeeds(1,3,0)).toHaveLength(8);
 expect(pairedSeeds(1,3,0)[0]).toBe(54);
});
it('assigns hand streets before play without preflop claiming later-street hands',async()=>{
 const {assignedStreet}=await import('./decision-stability');
 const assignments=Array.from({length:300},(_,i)=>assignedStreet(`hand-${i}`));
 const later=assignments.findIndex(s=>s==='turn');
 const seen=new Set<number>();
 const {claimPaidHand}=await import('./decision-stability');
 const capture=(street:string)=>street===assignedStreet(`hand-${later}`)&&claimPaidHand(seen,later,street,2);
 expect(capture('preflop')).toBe(false);
 expect(capture('flop')).toBe(false);
 expect(capture('turn')).toBe(true);
 expect(capture('turn')).toBe(false);
 expect(new Set(assignments)).toEqual(new Set(['preflop','flop','turn']));
 expect(assignments).toEqual(Array.from({length:300},(_,i)=>assignedStreet(`hand-${i}`)));
});

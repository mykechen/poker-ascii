import {expect,it} from 'vitest';
import {balanceFields,validatePopulationFields} from './population-fields';
import type {LeagueField} from './league';
const field:LeagueField={id:'x',opponents:['chart','tight','station','position','aggressor']};
it('balances every opponent multiplicity across each five batch cycle at all sizes',()=>{
 for(const n of [6,7,8]){
  const counts=new Map<string,number>();
  for(let batch=0;batch<5;batch++){
   const list=balanceFields([field],batch)[0]!.opponents;
   for(let i=0;i<n-1;i++){const id=list[i%list.length]!;counts.set(id,(counts.get(id)??0)+1);}
  }
  expect(new Set(counts.values()).size).toBe(1);
 }
 expect(field.opponents[0]).toBe('chart');
});
it('rejects rotated partition collisions and invalid batch offsets',()=>{
 expect(()=>validatePopulationFields([field],[{id:'other',opponents:['tight','station','position','aggressor','chart']}])).toThrow();
 expect(()=>balanceFields([field],-.5)).toThrow();
 expect(()=>balanceFields([{id:'empty',opponents:[]}],0)).toThrow();
});

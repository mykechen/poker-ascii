import {it,expect} from 'vitest';
import {reserveSeeds} from './provenance';
it('rejects fresh reservations against every legacy and new registry namespace',()=>{
 const r={retired_inspected_ranges:[{start:1,end:10,reason:'used'}],reserved_not_run:[{start:20,end:30}],started_batches:[{seed:40}],evaluation_reservations:[{id:'old',protocolHash:'x',seeds:[50],classification:'pilot',status:'reserved'}]};
 for(const s of [1,10,20,30,40,50])expect(()=>reserveSeeds(r,[s],'new','h','pilot')).toThrow(/collision/);
 expect(reserveSeeds(r,[60,61],'new','h','pilot').evaluation_reservations?.at(-1)?.seeds).toEqual([60,61]);expect(r.evaluation_reservations).toHaveLength(1);
});

import {it,expect} from 'vitest';
import {budgetState} from './budget';
it('charges suspended wall time even when the monotonic clock paused',()=>{
 expect(budgetState(1000,10,62000,11,60000)).toEqual({elapsedMs:61000,exceeded:true,clockGapMs:60999});
});
it('still enforces the cap after a backward wall-clock adjustment',()=>{
 expect(budgetState(1000,10,500,60010,60000).exceeded).toBe(true);
});

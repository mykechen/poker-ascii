import {expect,it} from 'vitest';
import {observerStatus} from './decision-diagnostics';
it('separates folded and all-in exposure from possible future decisions',()=>{
 expect(observerStatus({inHand:true,folded:true,allIn:false,stack:50})).toBe('folded');
 expect(observerStatus({inHand:true,folded:false,allIn:true,stack:0})).toBe('all-in');
 expect(observerStatus({inHand:true,folded:false,allIn:false,stack:0})).toBe('all-in');
 expect(observerStatus({inHand:true,folded:false,allIn:false,stack:50})).toBe('funded');
 expect(()=>observerStatus({inHand:false,folded:false,allIn:false,stack:50})).toThrow(/participating/);
});

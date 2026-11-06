import {expect,it} from 'vitest';
import {offsetConfirmationDecision,sparseFoldCoverage} from './offset-confirmation';
import type {ReplayObservation} from './contextual-replay';
const score=(loss:number)=>({id:'x',scores:{count:200,brier:.3,logLoss:loss},groups:{'110:true':{count:200,brier:.3,logLoss:loss}}});
const coverage={observations:200,hands:100,batches:10,folds:25,foldHands:25,foldBatches:5};
it('requires100 paired batches, six cells and fixed complete run',()=>{
 const result=offsetConfirmationDecision(Array(30).fill(10),Array(6).fill(0),score(1),score(1),coverage,false);
 expect(result.allGatesPass).toBe(false);expect(result.interval95).toBe(null);
 expect(()=>offsetConfirmationDecision(Array(100).fill(10),[0],score(1),score(1),coverage,true)).toThrow();
});
it('treats folds as valid observations and requires minority coverage',()=>{
 expect(offsetConfirmationDecision(Array(100).fill(10),Array(6).fill(0),score(1),score(1),coverage,true).allGatesPass).toBe(true);
 expect(offsetConfirmationDecision(Array(100).fill(10),Array(6).fill(0),score(1),score(1),{...coverage,folds:5},true).allGatesPass).toBe(false);
 expect(offsetConfirmationDecision(Array(100).fill(10),Array(6).fill(-6),score(1),score(1),coverage,true).allGatesPass).toBe(false);
 expect(offsetConfirmationDecision(Array(100).fill(10),Array(6).fill(0),score(1.03),score(1),coverage,true).allGatesPass).toBe(false);
});
it('counts fold diversity across batches and hands without treating repeated actions as new hands',()=>{
 const row:ReplayObservation={match:0,hand:1,seat:1,order:0,board:['2c','3d','4h'],known:[],context:{facing:true,canRaise:false,position:'field',size:'small',depth:'short',players:'few'},actual:'fold',components:[{weight:1,probabilities:[.2,.8,0],group:'weak',draw:false,style:1}]};
 expect(sparseFoldCoverage([{batch:1,rows:[row,{...row,order:1}]},{batch:2,rows:[row]}])).toEqual({observations:3,hands:2,batches:2,folds:3,foldHands:2,foldBatches:2});
});

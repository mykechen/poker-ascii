import {describe,it,expect} from 'vitest';
import {confirmDecision,verifyFrozenModel} from './frequency-confirmation';
import type {SelectionScore} from './contextual-selection';
const score=(loss:number,count=100):SelectionScore=>({id:'x',scores:{count,brier:.2,logLoss:loss},groups:{'110:true':{count,brier:.2,logLoss:loss}}});
describe('confirmation gates',()=>{
 it('requires fixed sample count and finite inputs',()=>{
  expect(()=>confirmDecision([5], [0],score(1),score(1))).toThrow();
  expect(()=>confirmDecision(Array(30).fill(NaN),[0],score(1),score(1))).toThrow();
 });
 it('distinguishes target estimate from a guaranteed five-point gain',()=>{
  const result=confirmDecision(Array.from({length:30},(_,i)=>i%2?8:4),[0,1],score(1),score(1));
  expect(result.targetSignal).toBe(true);expect(result.lower95).toBeLessThan(6);
  expect(result.allGatesPass).toBe(true);
 });
 it('vetoes sparse missing coverage and cell deterioration',()=>{
  expect(confirmDecision(Array(30).fill(6),[-6],score(1),score(1)).allGatesPass).toBe(false);
  expect(confirmDecision(Array(30).fill(6),[0],score(1,99),score(1,99)).allGatesPass).toBe(false);
  expect(confirmDecision(Array(30).fill(6),[0],score(1.03),score(1)).allGatesPass).toBe(false);
  const missing=score(1);missing.groups={};
  expect(confirmDecision(Array(30).fill(6),[0],missing,score(1)).allGatesPass).toBe(false);
 });
 it('rejects changed frozen artifacts',()=>{
  expect(()=>verifyFrozenModel({version:1,kind:'current'},'wrong')).toThrow();
 });
});

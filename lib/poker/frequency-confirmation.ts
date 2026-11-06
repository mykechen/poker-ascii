import {createHash} from 'node:crypto';
import {validateResponseModel,type ResponseModel} from './contextual-response';
import type {SelectionScore} from './contextual-selection';
export function verifyFrozenModel(model:ResponseModel,expectedHash:string){
 validateResponseModel(model);
 if(model.kind!=='frequency'||createHash('sha256').update(JSON.stringify(model)).digest('hex')!==expectedHash)throw new Error('Frozen frequency model hash mismatch.');
}
export function confirmDecision(deltas:number[],cellDeltas:number[],frequency:SelectionScore,current:SelectionScore){
 if(deltas.length!==30||!cellDeltas.length||[...deltas,...cellDeltas].some(n=>!Number.isFinite(n)))throw new Error('Confirmation requires 30 finite paired batches and finite cell deltas.');
 const mean=deltas.reduce((a,b)=>a+b,0)/30;
 const se=Math.sqrt(deltas.reduce((s,x)=>s+(x-mean)**2,0)/29/30);
 const lower95=mean-2.04523*se,upper95=mean+2.04523*se;
 const targetSignal=mean>=5&&lower95>0;
 const downsidePass=cellDeltas.every(x=>x>=-5);
 const sparse=current.groups['110:true'];
 const sparseCovered=!!sparse&&sparse.count>=100&&!!frequency.groups['110:true']&&frequency.groups['110:true']!.count===sparse.count;
 const supportPass=sparseCovered&&Object.entries(current.groups).every(([key,base])=>base.count<100||!!frequency.groups[key]&&frequency.groups[key]!.count===base.count&&Number.isFinite(base.logLoss)&&Number.isFinite(frequency.groups[key]!.logLoss)&&frequency.groups[key]!.logLoss<=base.logLoss+.02);
 return {mean,standardError:se,lower95,upper95,targetSignal,trueGainAboveFive:lower95>5,downsidePass,sparseCovered,supportPass,allGatesPass:targetSignal&&downsidePass&&supportPass,profitInterpretation:upper95<0?'regression':targetSignal?'positive-target-estimate':'inconclusive'};
}

import {supportCoverage,type OffsetPanel} from './support-offset';
import {supportKey} from './contextual-response';
import type {SelectionScore} from './contextual-selection';
export function sparseFoldCoverage(panels:OffsetPanel[]){
 const base=supportCoverage(panels)['110'];
 const folds=panels.flatMap(p=>p.rows.filter(r=>r.board.length===3&&r.context.facing&&r.actual==='fold'&&r.components?.length&&supportKey(r.components[0]!.probabilities)==='110').map(r=>({batch:p.batch,match:r.match,hand:r.hand})));
 return {observations:base?.observations??0,hands:base?.hands??0,batches:base?.batches??0,folds:folds.length,foldHands:new Set(folds.map(r=>`${r.batch}:${r.match}:${r.hand}`)).size,foldBatches:new Set(folds.map(r=>r.batch)).size};
}
export function offsetConfirmationDecision(deltas:number[],cells:number[],offset:SelectionScore,current:SelectionScore,coverage:ReturnType<typeof sparseFoldCoverage>,complete:boolean){
 if(cells.length!==6||[...deltas,...cells].some(n=>!Number.isFinite(n))||deltas.length>100)throw new Error('Require finite paired scores and six cell deltas.');
 const fixedComplete=complete&&deltas.length===100;
 const mean=deltas.length?deltas.reduce((a,b)=>a+b,0)/deltas.length:null;
 const standardError=deltas.length>1?Math.sqrt(deltas.reduce((s,x)=>s+(x-mean!)**2,0)/(deltas.length-1)/deltas.length):null;
 const interval95=fixedComplete&&standardError!==null?[mean!-1.98422*standardError,mean!+1.98422*standardError]:null;
 const targetSignal=!!interval95&&mean!>=5&&interval95[0]!>0;
 const downsidePass=cells.every(x=>x>=-5);
 const sparseCovered=coverage.observations>=100&&coverage.hands>=30&&coverage.batches>=5&&coverage.folds>=20&&coverage.foldHands>=10&&coverage.foldBatches>=5;
 const forecastPass=sparseCovered&&offset.scores.count===current.scores.count&&offset.scores.brier<=current.scores.brier&&Object.entries(current.groups).every(([key,base])=>base.count<100||!!offset.groups[key]&&offset.groups[key]!.count===base.count&&offset.groups[key]!.logLoss<=base.logLoss+.02);
 return {fixedComplete,mean,standardError,interval95,targetSignal,trueGainAboveFive:!!interval95&&interval95[0]!>5,downsidePass,sparseCovered,forecastPass,allGatesPass:fixedComplete&&targetSignal&&downsidePass&&forecastPass};
}

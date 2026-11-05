import type {ActionClass} from "./opponent";
export function scorePrediction(probabilities: [number,number,number], actual: ActionClass) {
  if(probabilities.some(p=>!Number.isFinite(p)||p<0||p>1)||Math.abs(probabilities.reduce((a,b)=>a+b,0)-1)>1e-6)throw new Error("Invalid prediction probabilities.");
  const index=actual==="fold"?0:actual==="passive"?1:2;
  const support=probabilities.filter(p=>p>0).length;
  const uniform=probabilities.map(p=>p>0?1/support:0);
  return {uniformBrier:uniform.reduce((sum,p,i)=>sum+(p-(i===index?1:0))**2,0),uniformLogLoss:-Math.log(Math.max(1e-12,uniform[index]!)),brier:probabilities.reduce((sum,p,i)=>sum+(p-(i===index?1:0))**2,0),logLoss:-Math.log(Math.max(1e-12,probabilities[index]!))};
}

export type CalibrationTotals={count:number;brierSum:number;logLossSum:number;uniformBrierSum:number;uniformLogLossSum:number};
export function summarizeCalibration(batches:Record<string,CalibrationTotals>[]) {
  const totals:Record<string,CalibrationTotals>={};
  for(const batch of batches)for(const [street,score]of Object.entries(batch)){
    const total=totals[street]??{count:0,brierSum:0,logLossSum:0,uniformBrierSum:0,uniformLogLossSum:0};
    total.count+=score.count;total.brierSum+=score.brierSum;total.logLossSum+=score.logLossSum;
    total.uniformBrierSum+=score.uniformBrierSum;total.uniformLogLossSum+=score.uniformLogLossSum;
    totals[street]=total;
  }
  return Object.entries(totals).filter(([,total])=>total.count>0).map(([street,total])=>({street,count:total.count,brier:total.brierSum/total.count,logLoss:total.logLossSum/total.count,uniformBrier:total.uniformBrierSum/total.count,uniformLogLoss:total.uniformLogLossSum/total.count}));
}

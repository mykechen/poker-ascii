import {scorePrediction} from "./calibration";
import type {ActionClass} from "./opponent";
import type {ResponseContext} from "./range-beliefs";
import type {Street} from "./types";
export type Forecast = {probabilities:[number,number,number];actual:ActionClass};
export type ForecastRecord = Forecast & {street:Street;seat:number;opponentName:string|null;hand:number;context:ResponseContext;observerGroup:string;observerDraw:boolean;boardTexture:string;livePlayers:number};
export function blendResponse(p:[number,number,number],weight:number):[number,number,number] {
  scorePrediction(p,"passive");
  if(!Number.isFinite(weight)||weight<0||weight>1)throw new Error("Response mixture must be between zero and one.");
  const support=p.filter(n=>n>0).length;
  return p.map(n=>n===0?0:(1-weight)*n+weight/support) as [number,number,number];
}
export function seedRange(start:number,count:number):number[] {
  if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(count)||count<1||count>100||start+count-1>0xffffffff)throw new Error("Invalid unsigned seed range.");
  return Array.from({length:count},(_,i)=>start+i);
}
export function reliabilityBins(records:Forecast[]) {
  const actions:ActionClass[]=["fold","passive","aggressive"];
  return actions.flatMap((action,i)=>Array.from({length:10},(_,bin)=>{
    const rows=records.filter(r=>Math.min(9,Math.floor(r.probabilities[i]!*10))===bin);
    return {action,bin,count:rows.length,meanPrediction:rows.length?rows.reduce((n,r)=>n+r.probabilities[i]!,0)/rows.length:null,observedFrequency:rows.length?rows.filter(r=>r.actual===action).length/rows.length:null};
  }));
}
export function forecastScores(records:Forecast[],weight=0) {
  if(!records.length)throw new Error("Forecast scoring requires observations.");
  const scores=records.map(r=>scorePrediction(blendResponse(r.probabilities,weight),r.actual));
  return {count:records.length,brier:scores.reduce((n,s)=>n+s.brier,0)/scores.length,logLoss:scores.reduce((n,s)=>n+s.logLoss,0)/scores.length};
}
export function fitFlopMixture(records:Forecast[]) {
  const grid=[0,.25,.5,.75,1].map(weight=>({weight,...forecastScores(records,weight)}));
  const selected=[...grid].sort((a,b)=>a.logLoss-b.logLoss||a.weight-b.weight)[0]!;
  return {weight:selected.weight,grid};
}
export function frequencyPrediction(training:Forecast[],support:[number,number,number]):[number,number,number] {
  const actions:ActionClass[]=["fold","passive","aggressive"];
  const key=(p:number[])=>p.map(n=>n>0?1:0).join("");
  const rows=training.filter(r=>key(r.probabilities)===key(support));
  const counts=actions.map((action,i)=>support[i]!>0?1+rows.filter(r=>r.actual===action).length:0);
  const total=counts.reduce((a,b)=>a+b,0);
  if(!total)throw new Error("Frequency baseline requires legal support.");
  return counts.map(n=>n/total) as [number,number,number];
}

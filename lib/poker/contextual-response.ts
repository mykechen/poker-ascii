import {scorePrediction} from "./calibration";
import type {ResponseContext} from "./range-beliefs";
import type {Card} from "./types";
export type Probabilities=[number,number,number];
export const FEATURES=["intercept",...Array.from({length:7},(_,i)=>`support:${(i+1).toString(2).padStart(3,"0")}`),...['free','small','medium','large'].map(v=>`size:${v}`),...['short','medium','deep'].map(v=>`depth:${v}`),...['button','blind','field'].map(v=>`position:${v}`),...['heads-up','few','many'].map(v=>`players:${v}`),"paired","three-suited"];
export type ResponseModel={version:1}&({kind:"current"}|{kind:"uniform"}|{kind:"frequency";frequencies:Record<string,Probabilities>}|{kind:"contextual";features:string[];coefficients:[number[],number[]];supports:string[];lambda:number});
export const supportKey=(p:Probabilities)=>p.map(v=>v>0?"1":"0").join("");
export function transformResponse(p:Probabilities,offsets:[number,number]):Probabilities {
 scorePrediction(p,"passive");
 if(offsets.length!==2||offsets.some(v=>!Number.isFinite(v)))throw new Error("Expected two finite logit offsets.");
 if(offsets.every(v=>v===0))return [...p];
 const shifts=[offsets[0],0,offsets[1]];
 const values=p.map((v,i)=>v*Math.exp(Math.max(-3,Math.min(3,shifts[i]!))));
 const total=values.reduce((a,b)=>a+b,0);return values.map(v=>v/total) as Probabilities;
}
export function encodeContext(c:ResponseContext,board:Card[],p:Probabilities):number[] {
 const active=new Set(["intercept",`support:${supportKey(p)}`,`size:${c.size}`,`depth:${c.depth}`,`position:${c.position}`,`players:${c.players}`]);
 if(new Set(board.map(c=>c[0])).size<board.length)active.add("paired");
 if(["c","d","h","s"].some(s=>board.filter(c=>c[1]===s).length>=3))active.add("three-suited");
 return FEATURES.map(f=>active.has(f)?1:0);
}
export function validateResponseModel(model:ResponseModel):void {
 if(model.version!==1)throw new Error("Unsupported response model version.");
 if(model.kind==="current"||model.kind==="uniform")return;
 if(model.kind==="frequency") {for(const [key,p] of Object.entries(model.frequencies)){scorePrediction(p,"passive");if(!/^[01]{3}$/.test(key)||supportKey(p)!==key)throw new Error("Frequency support mismatch.");}return;}
 if(model.kind!=="contextual"||JSON.stringify(model.features)!==JSON.stringify(FEATURES)||model.coefficients.length!==2||model.coefficients.some(row=>row.length!==FEATURES.length||row.some(v=>!Number.isFinite(v)))||!Number.isFinite(model.lambda)||model.lambda<=0||model.supports.some(s=>!/^([01]{3})$/.test(s)||s==="000"))throw new Error("Invalid contextual response artifact.");
}
export function modelResponse(p:Probabilities,c:ResponseContext,board:Card[],model:ResponseModel):Probabilities {
 if(model.kind==="current")return p;
 if(model.kind==="uniform"){const n=p.filter(v=>v>0).length;return p.map(v=>v>0?1/n:0) as Probabilities;}
 if(model.kind==="frequency")return model.frequencies[supportKey(p)]??p;
 if(!model.supports.includes(supportKey(p)))return p;
 const x=encodeContext(c,board,p);
 return transformResponse(p,model.coefficients.map(row=>row.reduce((sum,v,i)=>sum+v*x[i]!,0)) as [number,number]);
}

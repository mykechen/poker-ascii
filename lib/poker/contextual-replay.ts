import {RangeBeliefs,type ResponseContext} from "./range-beliefs";
import {validateResponseModel,type Probabilities,type ResponseModel} from "./contextual-response";
import type {Card} from "./types";
import type {ActionClass} from "./opponent";
export type ResponseComponent={weight:number;probabilities:Probabilities;group:string;draw:boolean;style:number};
export type ReplayObservation={match:number;hand:number;seat:number;order:number;board:Card[];known:Card[];context:ResponseContext;actual:ActionClass;components?:ResponseComponent[]};
export function replayObservations(rows:ReplayObservation[],model:ResponseModel){
 validateResponseModel(model);
 const beliefs=new Map<string,RangeBeliefs>();
 return rows.map(row=>{
  const key=`${row.match}:${row.hand}:${row.seat}`;
  let belief=beliefs.get(key);if(!belief){belief=new RangeBeliefs(undefined,0,model);beliefs.set(key,belief);}
  belief.condition(row.known);
  return {...row,probabilities:belief.observe(row.board,row.context,row.actual)};
 });
}

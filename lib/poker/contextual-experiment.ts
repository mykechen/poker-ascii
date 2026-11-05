import type {LeagueField} from "./league";
export function trainingDecision(count:number,toppedUp:boolean){return count>=500?"fit":toppedUp?"insufficient-data":"top-up";}
export function evaluationConfigurations(selected:string,freezePersisted:boolean){if(!freezePersisted)throw new Error("Persist freeze before evaluation.");return selected==="current"?["current","equity"]:[selected,"current","equity"];}
export function validateExperimentFields(partitions:LeagueField[][]){
 for(const players of [6,7,8]){const seen=new Set<string>();for(const fields of partitions)for(const field of fields){if(!field.opponents.length)throw new Error("Empty field.");const key=Array.from({length:players-1},(_,i)=>field.opponents[i%field.opponents.length]).join(':');if(seen.has(key))throw new Error("Effective ordered field collision.");seen.add(key);}}
}

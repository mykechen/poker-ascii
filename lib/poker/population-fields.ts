import type {LeagueField} from './league';
/** Counterbalance duplicated entries over complete cycles; preserve template identity. */
export function balanceFields(fields:LeagueField[],batchIndex:number):LeagueField[]{
 if(!Number.isSafeInteger(batchIndex)||batchIndex<0||!fields.length||fields.some(f=>!f.opponents.length))throw new Error('Provide nonempty field templates and a nonnegative integer batch index.');
 return fields.map(f=>{const offset=batchIndex%f.opponents.length;return {...f,opponents:[...f.opponents.slice(offset),...f.opponents.slice(0,offset)]};});
}
export function validatePopulationFields(training:LeagueField[],validation:LeagueField[]){
 const all=[...training,...validation];
 if(new Set(all.map(f=>f.id)).size!==all.length)throw new Error('Partition field IDs must be unique.');
 function compositions(fields:LeagueField[],players:number){
  return new Set(fields.flatMap(f=>Array.from({length:f.opponents.length},(_,i)=>{
   const balanced=balanceFields([f],i)[0]!;
   return Array.from({length:players-1},(_,j)=>balanced.opponents[j%balanced.opponents.length]).join(':');
  })));
 }
 for(const players of [6,7,8]){
  const train=compositions(training,players),valid=compositions(validation,players);
  if([...valid].some(key=>train.has(key)))throw new Error('Effective balanced field compositions overlap partitions.');
 }
}

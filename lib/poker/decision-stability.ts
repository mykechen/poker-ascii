import {createHash} from 'node:crypto';
export function selectStates<T extends {id:string;cell:string}>(rows:T[],quotas:Record<string,number>):T[]{
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('Duplicate state identity.');
 return Object.entries(quotas).flatMap(([cell,quota])=>{
  if(!Number.isSafeInteger(quota)||quota<1)throw new Error('Invalid state quota.');
  const available=rows.filter(r=>r.cell===cell).sort((a,b)=>a.id.localeCompare(b.id));
  if(available.length<quota)throw new Error(`Insufficient coverage for ${cell}: ${available.length}/${quota}.`);
  return available.slice(0,quota);
 });
}
export function streamMetrics(values:number[],reference:number[]){
 if(values.length!==8||reference.length!==8||[...values,...reference].some(v=>!Number.isFinite(v)))throw new Error('Provide eight finite paired streams.');
 let flips=0;
 for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)if((values[i]!>=0)!==(values[j]!>=0))flips++;
 const mean=values.reduce((a,b)=>a+b,0)/8;
 return {flipFraction:flips/28,referenceDisagreement:values.filter((v,i)=>(v>=0)!==(reference[i]!>=0)).length/8,callValueSD:Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/7),nearZeroFraction:values.filter(v=>Math.abs(v)<=2).length/8};
}
export function clusterSummary(rows:{cell:string;seed:number;match:string;value:number}[],cells:string[],seeds:number[]){
 if(rows.some(r=>!Number.isFinite(r.value)||!seeds.includes(r.seed)||!cells.includes(r.cell)))throw new Error('Invalid clustered metric row.');
 const average=(values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
 return Object.fromEntries(cells.map(cell=>{
  const perSeed=seeds.flatMap(seed=>{
   const matching=rows.filter(r=>r.cell===cell&&r.seed===seed);
   if(!matching.length)return [];
   const matches=[...new Set(matching.map(r=>r.match))];
   return [{seed,mean:average(matches.map(match=>average(matching.filter(r=>r.match===match).map(r=>r.value))))}];
  });
  if(!perSeed.length)throw new Error(`Insufficient coverage for ${cell}.`);
  const mean=average(perSeed.map(r=>r.mean));
  const standardError=perSeed.length<2?null:Math.sqrt(perSeed.reduce((sum,r)=>sum+(r.mean-mean)**2,0)/(perSeed.length-1)/perSeed.length);
  return [cell,{mean,standardError,states:rows.filter(r=>r.cell===cell).length,perSeed,missingSeeds:seeds.filter(seed=>!perSeed.some(r=>r.seed===seed))}];
 }));
}
export function claimPaidHand(seen:Set<number>,hand:number,street:string|null,cost:number):boolean{
 if(cost<=0||!street||!['preflop','flop','turn'].includes(street)||seen.has(hand))return false;
 seen.add(hand);return true;
}
export function pairedSeeds(hand:number,logLength:number,actor:number):number[]{
 const base=(42^Math.imul(hand,31)^logLength^actor)|0;
 return [0,2654435769,2246822507,3266489909,668265263,374761393,3550635116,4251993797].map(salt=>(base^salt)|0);
}

export function assignedStreet(identity:string):'preflop'|'flop'|'turn'{
 return (['preflop','flop','turn'] as const)[createHash('sha256').update(identity).digest().readUInt32BE(0)%3]!;
}

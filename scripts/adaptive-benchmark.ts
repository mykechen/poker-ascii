import { comparePolicies } from "../lib/poker/benchmark";
import { createAdaptivePolicy } from "../lib/poker/adaptive";
import { simplePolicy } from "../lib/poker/bot";
const hands=Number(process.argv[2]??10);
const batches=Number(process.argv[3]??2);
if(!Number.isSafeInteger(batches)||batches<1||batches>10000)throw new Error("Provide 1 to 10000 batches.");
const results=[6,7,8].map(players=>{
 const candidate=createAdaptivePolicy({samples:100});
 const frozen=createAdaptivePolicy({samples:100,learn:false});
 const options={hands,seeds:Array.from({length:batches},(_,i)=>i+1),seats:Array.from({length:players},(_,i)=>({name:`P${i}`,policy:simplePolicy}))};
 return {players,result:comparePolicies(options,candidate.policy,frozen.policy)};
});
console.log(JSON.stringify({label:"Adaptive versus frozen action-range model; smoke runs cannot establish strength",results},null,2));

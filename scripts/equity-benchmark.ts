import { runBenchmark } from "../lib/poker/benchmark";
import { createEquityPolicy } from "../lib/poker/equity-policy";
import { simplePolicy } from "../lib/poker/bot";

const hands=Number(process.argv[2]??10);
const batches=Number(process.argv[3]??2);
if(!Number.isSafeInteger(batches)||batches<1||batches>10000) throw new Error("Batch count must be 1 to 10000.");
const results=[6,7,8].map(count=>({players:count,report:runBenchmark({hands,seeds:Array.from({length:batches},(_,i)=>i+1),seats:Array.from({length:count},(_,i)=>({name:i===0?"Equity":"Chart "+i,policy:simplePolicy,...(i===0?{policyFactory:()=>createEquityPolicy({samples:200,seed:42})}:{})}))})}));
console.log(JSON.stringify({label:"Equity check/call control versus chart; no strength claim",samples:200,results},null,2));

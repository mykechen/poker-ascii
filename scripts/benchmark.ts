import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { equalWeightScores, runBenchmark } from "../lib/poker/benchmark";
import { playSession } from "../lib/poker/session";
import { strategies } from "../lib/poker/strategies";

function integerFlag(name: string, fallback: number): number {
 const index = process.argv.indexOf(`--${name}`);
 if(index < 0) return fallback;
 const value = Number(process.argv[index+1]);
 if(!Number.isSafeInteger(value) || value < 1) throw new Error(`--${name} requires a positive integer.`);
 return value;
}
const hands = integerFlag("hands", 100);
const seeds = integerFlag("seeds", 3);
if(seeds > 10000) throw new Error("Use at most 10000 seeds.");
const persistent = process.argv.includes("--persistent");
const results = [6,7,8].map(count => {
 const seats = strategies.slice(0,count).map(s=>({name:s.name,policy:s.policy}));
 const reports = Array.from({length:seeds},(_,i)=>i+1);
 return {players:count,result:persistent ? reports.map(seed=>playSession({seats,hands,seed})) : runBenchmark({seats,hands,seeds:reports})};
});
const sourceFiles = ["engine", "train", "session", "benchmark", "bot", "candidate", "learner", "strategies", "cards", "evaluator", "pots", "view", "types"];
const sourceHash = createHash("sha256");
for (const file of sourceFiles) sourceHash.update(file).update(readFileSync(`lib/poker/${file}.ts`));
const sharedParticipantCount = 6;
const equalWeightSummary = persistent ? null : {names: strategies.slice(0,sharedParticipantCount).map(s=>s.name), bb100: equalWeightScores(results.map(entry => { const report = entry.result; if (Array.isArray(report)) throw new Error("Expected fixed benchmark"); return report.meanBb100.slice(0,sharedParticipantCount); }))};
console.log(JSON.stringify({schemaVersion:1,sourceHash:sourceHash.digest("hex"),policyDefinitions:strategies.map(({id,name,rule})=>({id,name,rule})),equalWeightSummary,mode:persistent?"persistent":"fixed",buyInBb:100,smallBlind:1,bigBlind:2,rake:0,hands,seeds,results},null,2));

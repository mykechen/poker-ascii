import { expect, it } from "vitest";
import { runBenchmark } from "./benchmark";
import { simplePolicy } from "./bot";
it("rotates each participant through every chair and preserves raw runs", () => {
 const result = runBenchmark({ seats: Array.from({length: 6}, (_,i)=>({name:`P${i}`,policy:simplePolicy})), seeds:[1,2], hands:2 });
 expect(result.runs).toHaveLength(12);
 expect(result.meanBb100.reduce((a,b)=>a+b,0)).toBeCloseTo(0);
 expect(result.intervals).toHaveLength(6);
});
it("preserves complete seat rotations and omits intervals for one seed", () => {
 const result = runBenchmark({seats:Array.from({length:7},(_,i)=>({name:`P${i}`,policy:simplePolicy})),seeds:[1],hands:1});
 for(let participant=0;participant<7;participant++) expect(new Set(result.runs.map(run=>run.participantAtSeat.indexOf(participant))).size).toBe(7);
 expect(result.intervals.every(interval=>interval===null)).toBe(true);
});
it("reports paired challenger deltas for identical policies as zero", async () => {
 const { comparePolicies } = await import("./benchmark");
 const seats=Array.from({length:6},(_,i)=>({name:`P${i}`,policy:simplePolicy}));
 const result=comparePolicies({seats,seeds:[1,2],hands:2},simplePolicy,simplePolicy);
 expect(result.deltas).toEqual([0,0]);
});
it("rejects distinct numbers that alias to the same random seed", () => {
 expect(()=>runBenchmark({seats:Array.from({length:6},(_,i)=>({name:`P${i}`,policy:simplePolicy})),seeds:[1,4294967297],hands:1})).toThrow(/seeds/);
});
it("weights table sizes equally when summarizing shared participants", async () => {
 const { equalWeightScores } = await import("./benchmark");
 expect(equalWeightScores([[1,2],[3,4],[5,6]])).toEqual([3,4]);
});

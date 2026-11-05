import { expect, it } from "vitest";
import { playMatch } from "./train";
import { simplePolicy } from "./bot";
it("fails invalid decisions with reproducible context", () => {
  expect(() => playMatch({ seats: [{ name: "bad", policy: () => ({ action: "raise", amount: -1, reason: "bad" }) }, { name: "ok", policy: simplePolicy }], hands: 1, seed: 42, invalidAction: "throw" })).toThrow(/seed 42.*hand 1.*seat 0/);
});
it("policy RNG consumption cannot change deals", () => {
 const run = (extra: number) => {
  const cards: string[] = [];
  const seats = [0,1].map(i=>({name:`P${i}`,policy:simplePolicy,policyFactory:(random:()=>number)=> (view: Parameters<typeof simplePolicy>[0])=>{
   for(let j=0;j<extra;j++) random();
   cards.push(JSON.stringify([view.handNumber,view.board,view.seats[i]!.hole]));
   return simplePolicy(view);
  }}));
  const report = playMatch({seats,hands:10,seed:4,invalidAction:"throw"});
  return {cards,report};
 };
 expect(run(0)).toEqual(run(100));
});

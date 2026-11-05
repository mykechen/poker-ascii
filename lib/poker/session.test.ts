import { expect, it } from "vitest";
import { playSession } from "./session";
import { simplePolicy } from "./bot";
it("retains every participant and conserves chips in persistent sessions", () => {
 const options = { seats: Array.from({length: 6}, (_, i) => ({name: `P${i}`, policy: simplePolicy})), hands: 50, seed: 7 };
 const result = playSession(options);
 expect(result.net.reduce((a,b)=>a+b,0)).toBe(0);
 expect(result.finalStacks).toHaveLength(6);
 expect(result.finalStacks.reduce((a,b)=>a+b,0)).toBe(1200);
 expect(playSession(options)).toEqual(result);
});
it("eliminates players without dropping them from accounting", () => {
 const shove: typeof simplePolicy = view => {
 const offered = view.validActions.find(a=>a.action === "all_in") ?? view.validActions.find(a=>a.action === "call") ?? view.validActions[0]!;
 return {action:offered.action, ...("amount" in offered ? {amount:offered.amount}:{}), reason:"Shove"};
 };
 const result = playSession({seats:Array.from({length:8},(_,i)=>({name:`P${i}`,policy:shove})),hands:100,seed:3});
 expect(result.finalStacks.filter(n=>n>0)).toHaveLength(1);
 expect(result.eliminatedAt.filter(n=>n!==null)).toHaveLength(7);
 expect(result.net.reduce((a,b)=>a+b,0)).toBe(0);
});

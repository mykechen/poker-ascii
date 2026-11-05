import { expect, it } from "vitest";
import { settlePots } from "./pots";
it("settles multiple side pots and returns the unmatched contribution", () => {
 const result = settlePots(0, [100,200,300,400].map((committed,seat)=>({seat,committed,folded:false,score:[8-seat,14]})));
 expect([...result.entries()]).toEqual([[0,400],[1,300],[2,200],[3,100]]);
 expect([...result.values()].reduce((a,b)=>a+b,0)).toBe(1000);
});
it("splits each side pot separately with odd chips clockwise from the button", () => {
 const result = settlePots(0, [
 {seat:0,committed:3,folded:false,score:[1,14]},
 {seat:1,committed:3,folded:false,score:[1,14]},
 {seat:2,committed:1,folded:true,score:null}]);
 expect(result.get(0)).toBe(3);
 expect(result.get(1)).toBe(4);
});

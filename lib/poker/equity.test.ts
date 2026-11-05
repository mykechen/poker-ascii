import { expect, it } from "vitest";
import { estimateEquity } from "./equity";
it("enumerates weighted river ranges exactly and removes blockers", () => {
 const result = estimateEquity({hero:["Ah","Ad"],board:["2c","3d","7h","9s","Jc"],opponents:[[{cards:["Kh","Kd"],weight:3},{cards:["Jh","Jd"],weight:1},{cards:["Ah","Ks"],weight:100}]]});
 expect(result.equity).toBeCloseTo(0.75);
 expect(result.method).toBe("exact");
 expect(result.standardError).toBe(0);
});
it("splits a board tie among every remaining player", () => {
 const result=estimateEquity({hero:["2h","3h"],board:["As","Ks","Qs","Js","Ts"],opponents:[[{cards:["4h","5h"],weight:1}],[{cards:["6h","7h"],weight:1}]]});
 expect(result.equity).toBeCloseTo(1/3);
});
it("samples reproducibly and rejects impossible joint ranges", () => {
 const input={hero:["Ah","Ad"] as ["Ah","Ad"],board:[],opponents:[[{cards:["Kh","Kd"] as ["Kh","Kd"],weight:1}]],samples:100,seed:4};
 expect(estimateEquity(input)).toEqual(estimateEquity(input));
 expect(()=>estimateEquity({...input,opponents:[...input.opponents,...input.opponents]})).toThrow(/compatible/);
});
it("respects side-pot eligibility when estimating payouts",()=>{
 const result=estimateEquity({hero:["Ah","Ad"],board:["2c","3d","7h","9s","Jc"],opponents:[[{cards:["Kh","Kd"],weight:1}]],pots:[{amount:30,eligible:[0,1]},{amount:50,eligible:[1]}]});
 expect(result.expectedPayout).toBe(30);
});

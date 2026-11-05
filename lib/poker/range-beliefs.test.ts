import { expect,it } from "vitest";
import { RangeBeliefs, actionProbabilities } from "./range-beliefs";
import type { WeightedHand } from "./equity";
const range:WeightedHand[]=[{cards:["Ah","Ad"],weight:1},{cards:["7c","2d"],weight:1}];
const context={facing:true,price:10,spr:5,position:"field",size:"medium",depth:"deep",players:"many"};
it("uses conditional reveal probabilities rather than selected action counts",()=>{
 const beliefs=new RangeBeliefs(range);
 const before=beliefs.typeWeights();
 const likelihoods=before.map((_,i)=>actionProbabilities(range[1]!.cards,[],context,i)[2]);
 beliefs.observe([],context,"aggressive");
 beliefs.reveal(range[1]!.cards);
 const expected=likelihoods.map((p,i)=>p*before[i]!);
 const total=expected.reduce((a,b)=>a+b,0);
 beliefs.typeWeights().forEach((p,i)=>expect(p).toBeCloseTo(expected[i]!/total));
 expect(()=>beliefs.reveal(["Kh","Kd"])).toThrow(/range/);
});
it("normalizes action probabilities and preserves nonzero unexpected actions",()=>{
 for(let style=0;style<3;style++){
 const p=actionProbabilities(["7c","2d"],[],context,style);
 expect(p.reduce((a,b)=>a+b,0)).toBeCloseTo(1);expect(p.every(n=>n>0)).toBe(true);
 }
});
it("retains learned type weights across hands and resets frozen controls",()=>{
 const beliefs=new RangeBeliefs(range);
 beliefs.observe([],context,"aggressive");beliefs.reveal(range[1]!.cards);
 const posterior=beliefs.typeWeights();beliefs.newHand();
 expect(beliefs.typeWeights()).toEqual(posterior);
 beliefs.newHand(true);expect(beliefs.typeWeights()).toEqual([1/3,1/3,1/3]);
});
it("conditions blockers and separates context-dependent likelihoods",()=>{
 const beliefs=new RangeBeliefs(range);beliefs.condition(["Ah"]);
 expect(beliefs.mixture()).toHaveLength(1);
 const small=actionProbabilities(["7c","2d"],[],{...context,size:"small"},1);
 const large=actionProbabilities(["7c","2d"],[],{...context,size:"large"},1);
 expect(large[0]).toBeGreaterThan(small[0]);
});
it("conditions response style on the sampled hand",()=>{
 const beliefs=new RangeBeliefs(range);beliefs.observe([],context,"aggressive");
 const conditional=beliefs.typeWeightsGiven(range[1]!.cards);
 beliefs.reveal(range[1]!.cards);
 expect(conditional).toEqual(beliefs.typeWeights());
});
it("tempers learned hypotheses between hands with configurable retention",()=>{
 const beliefs=new RangeBeliefs(range);beliefs.observe([],context,"aggressive");
 const before=beliefs.typeWeights();beliefs.newHand(false,0.5);
 beliefs.typeWeights().forEach((p,i)=>expect(p).toBeCloseTo(0.5*before[i]!+0.5/3));
 expect(()=>beliefs.newHand(false,-1)).toThrow(/retention/);
});
it("returns pre-action predictive probabilities before conditioning",()=>{
 const beliefs=new RangeBeliefs(range);
 const expected=[0,0,0];
 for(let style=0;style<3;style++)for(const hand of range){
 const p=actionProbabilities(hand.cards,[],context,style);p.forEach((n,i)=>{expected[i]+=n/6;});
 }
 const prediction=beliefs.observe([],context,"aggressive");
 prediction.forEach((p,i)=>expect(p).toBeCloseTo(expected[i]!));
});
it("assigns no aggression probability when public rules close raising",()=>{
 expect(actionProbabilities(["Ah","Ad"],[],{...context,canRaise:false},1)[2]).toBe(0);
});

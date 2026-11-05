import { expect,it } from "vitest";
import { handFeatures } from "./hand-features";
it("recognizes private draws without calling a board-only flush draw private",()=>{
 expect(handFeatures(["Ah","Kh"],["Qh","Jh","2c"]).draw).toBe(true);
 expect(handFeatures(["Ac","Kd"],["2h","5h","8h","Jh"]).draw).toBe(false);
 expect(handFeatures(["Ac","Kd"],["2h","5h","8h","Jh","9s"]).draw).toBe(false);
});

it("memoizes reordered equivalent inputs with bounded eviction and copied results",async()=>{
 const {createHandFeatureEvaluator}=await import("./hand-features");
 const evaluator=await import("./evaluator");
 const {vi}=await import("vitest");
 const spy=vi.spyOn(evaluator,"evaluate");
 try{
  const cached=createHandFeatureEvaluator(2);
  const first=cached(["Ah","Kh"],["Qh","Jh","2c"]);
  first.draw=false;
  expect(cached(["Kh","Ah"],["2c","Jh","Qh"]).draw).toBe(true);
  expect(spy).toHaveBeenCalledTimes(1);
  cached(["Ah","Kh"],["Qh","Jh","3c"]);cached(["Ah","Kh"],["Qh","Jh","4c"]);
  cached(["Ah","Kh"],["Qh","Jh","2c"]);
  expect(spy).toHaveBeenCalledTimes(4);
 }finally{spy.mockRestore();}
});
it("keeps hole/board roles distinct and agrees with an uncached evaluator",async()=>{
 const {createHandFeatureEvaluator}=await import("./hand-features");
 const cached=createHandFeatureEvaluator(2),reference=createHandFeatureEvaluator(0);
 expect(cached(["Ah","Kd"],["2h","5h","8h","Jc"]).draw).toBe(true);
 expect(cached(["Jc","Kd"],["Ah","2h","5h","8h"]).draw).toBe(false);
 for(const board of [[],["2h","5h","8h"],["2h","5h","8h","Jc"],["2h","5h","8h","Jc","9s"]] as import("./types").Card[][])expect(cached(["Ah","Kd"],board)).toEqual(reference(["Ah","Kd"],board));
 expect(()=>createHandFeatureEvaluator(-1)).toThrow(/capacity/);
});
it("preserves uncached features across varied hands, streets and input arrays",async()=>{
 const {createHandFeatureEvaluator}=await import("./hand-features");
 const {shuffleDeck}=await import("./cards");const {mulberry32}=await import("./train");
 const random=mulberry32(4242),cached=createHandFeatureEvaluator(4),reference=createHandFeatureEvaluator(0);
 for(let i=0;i<50;i++){
  const deck=shuffleDeck(random);const hole:[import("./types").Card,import("./types").Card]=[deck[0]!,deck[1]!];
  for(const size of [0,3,4,5]){
   const board=deck.slice(2,2+size),before=JSON.stringify([hole,board]);
   expect(cached(hole,board)).toEqual(reference(hole,board));expect(JSON.stringify([hole,board])).toBe(before);
  }
 }
});

import { expect,it } from "vitest";
import { OpponentModel } from "./opponent";
it("shrinks observations toward priors and resets identities",()=>{
 const model=new OpponentModel();model.startSession(["a","b"]);
 expect(model.tendency("b","river",true).foldMean).toBe(0.5);
 model.record("b","river",true,"fold");
 const estimate=model.tendency("b","river",true);
 expect(estimate.foldMean).toBeGreaterThan(0.5);
 expect(estimate.foldMean).toBeLessThan(0.6);
 expect(model.tendency("b","preflop",true).foldMean).toBe(0.5);
 model.startSession(["a","new"]);
 expect(model.tendency("new","river",true).samples).toBe(0);
});

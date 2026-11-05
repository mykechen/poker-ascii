import { expect,it } from "vitest";
import { handFeatures } from "./hand-features";
it("recognizes private draws without calling a board-only flush draw private",()=>{
 expect(handFeatures(["Ah","Kh"],["Qh","Jh","2c"]).draw).toBe(true);
 expect(handFeatures(["Ac","Kd"],["2h","5h","8h","Jh"]).draw).toBe(false);
 expect(handFeatures(["Ac","Kd"],["2h","5h","8h","Jh","9s"]).draw).toBe(false);
});

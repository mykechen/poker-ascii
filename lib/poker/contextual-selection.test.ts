import {expect,it} from "vitest";
import {selectResponse} from "./contextual-selection";
const score={count:200,logLoss:1,brier:.5};
it("requires both improvement gates and prefers current on failure",()=>{
 const base={id:"current",scores:score,groups:{}};
 expect(selectResponse([base,{id:"uniform",scores:{...score,logLoss:.995},groups:{}}])).toBe("current");
 expect(selectResponse([base,{id:"uniform",scores:{...score,logLoss:.98,brier:.51},groups:{}}])).toBe("current");
 expect(selectResponse([base,{id:"uniform",scores:{...score,logLoss:.98},groups:{}}])).toBe("uniform");
});
it("enforces large-group guard and deterministic tie priority",()=>{
 const base={id:"current",scores:score,groups:{g:score}};
 const candidate={scores:{...score,logLoss:.95},groups:{g:{...score,logLoss:1.021}}};
 expect(selectResponse([base,{...candidate,id:"frequency"}])).toBe("current");
 const accepted={scores:{...score,logLoss:.95},groups:{g:score}};
 expect(selectResponse([base,{...accepted,id:"uniform"},{...accepted,id:"frequency"}])).toBe("frequency");
});

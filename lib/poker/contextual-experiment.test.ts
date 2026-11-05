import {expect,it} from "vitest";
import {trainingDecision,evaluationConfigurations,validateExperimentFields} from "./contextual-experiment";
it("stops insufficient quota after the fixed top-up",()=>{expect(trainingDecision(499,false)).toBe("top-up");expect(trainingDecision(499,true)).toBe("insufficient-data");expect(trainingDecision(500,false)).toBe("fit");});
it("requires a persisted freeze and deduplicates current aliases",()=>{expect(()=>evaluationConfigurations("current",false)).toThrow();expect(evaluationConfigurations("current",true)).toEqual(["current","equity"]);expect(evaluationConfigurations("uniform",true)).toEqual(["uniform","current","equity"]);});
it("rejects effective ordered field collisions across every partition",()=>{expect(()=>validateExperimentFields([[{id:'a',opponents:['chart']}],[{id:'b',opponents:['chart','chart']}]] )).toThrow();});

import {expect,it} from "vitest";
import {scorePrediction} from "./calibration";
it("scores a pre-action multiclass forecast with Brier and log loss",()=>{
 const result=scorePrediction([0.2,0.5,0.3],"aggressive");
 expect(result.brier).toBeCloseTo(0.78);expect(result.logLoss).toBeCloseTo(-Math.log(0.3));
 expect(()=>scorePrediction([1,1,1],"fold")).toThrow(/probabil/);
});
it("compares forecasts with uniform predictions over supported legal actions",()=>{
 const result=scorePrediction([0.2,0.5,0.3],"aggressive");
 expect(result.uniformBrier).toBeCloseTo(2/3);expect(result.uniformLogLoss).toBeCloseTo(Math.log(3));
 expect(scorePrediction([0,1,0],"passive").uniformBrier).toBe(0);
});
it("aggregates forecast and uniform-baseline scores across batches",async()=>{
 const {summarizeCalibration}=await import("./calibration");
 const row={count:2,brierSum:1,logLossSum:2,uniformBrierSum:2,uniformLogLossSum:4};
 const summary=summarizeCalibration([{river:row},{river:row}]);
 expect(summary).toEqual([{street:"river",count:4,brier:0.5,logLoss:1,uniformBrier:1,uniformLogLoss:2}]);
});

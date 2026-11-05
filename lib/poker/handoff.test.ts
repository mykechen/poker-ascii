import {expect,it} from "vitest";
import {renderHandoff} from "./handoff";
it("includes status, provenance, progress, results and next steps for every run",()=>{
 const text=renderHandoff({id:"run-1",status:"complete",sourceCommit:"abc",sourceHash:"hash",updatedAt:"2026-11-05",completedBatches:3,scheduledBatches:3,plan:{hands:24},configurations:[],selected:"no-memory",results:{summaries:[{id:"bot",meanBb100:10}]},nextSteps:["Calibrate predictions"]});
 for(const value of ["complete","abc","3/3","no-memory","10","Calibrate predictions"])expect(text).toContain(value);
});
it("clears a stale failure on resume and preserves completion on late interruption",async()=>{
 const {restartHandoff,interruptHandoff}=await import("./handoff");
 const failed={complete:false,status:"failed" as "failed"|"running"|"complete"|"interrupted",error:"old failure"};
 restartHandoff(failed);expect(failed.status).toBe("running");expect(failed).not.toHaveProperty("error");
 interruptHandoff(failed);expect(failed.status).toBe("interrupted");
 failed.complete=true;restartHandoff(failed);interruptHandoff(failed);expect(failed.status).toBe("complete");
});

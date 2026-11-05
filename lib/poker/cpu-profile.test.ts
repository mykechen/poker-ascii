import {expect,it} from "vitest";
import {summarizeCpuProfile} from "./cpu-profile";
it("separates self and inclusive cost and clips to the poker timing window",()=>{
 const profile={startTime:1000,endTime:1100,nodes:[{id:1,callFrame:{functionName:"root",url:"",lineNumber:0},children:[2]},{id:2,callFrame:{functionName:"observe",url:"/lib/poker/range-beliefs.ts",lineNumber:1},children:[3]},{id:3,callFrame:{functionName:"evaluate",url:"/lib/poker/evaluator.ts",lineNumber:2}}],samples:[3,2,3],timeDeltas:[10,20,30]};
 const result=summarizeCpuProfile(profile,{start:1020,end:1050});
 expect(result.sampledMicros).toBe(30);
 expect(result.frames.find(f=>f.functionName==="observe")).toMatchObject({selfMicros:10,inclusiveMicros:30});
 expect(result.frames.find(f=>f.functionName==="evaluate")).toMatchObject({selfMicros:20,inclusiveMicros:20});
 expect(result.sourceSelf.reduce((n,f)=>n+f.selfMicros,0)).toBe(30);
 expect(()=>summarizeCpuProfile({...profile,timeDeltas:[]},{start:1020,end:1050})).toThrow(/sample/);
});

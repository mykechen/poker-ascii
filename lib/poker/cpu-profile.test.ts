import {expect,it} from "vitest";
import {summarizeCpuProfile,findCpuMarkerWindow} from "./cpu-profile";
it("separates self and inclusive cost and clips to the poker timing window",()=>{
 const profile={startTime:1000,endTime:1100,nodes:[{id:1,callFrame:{functionName:"root",url:"",lineNumber:0},children:[2]},{id:2,callFrame:{functionName:"observe",url:"/lib/poker/range-beliefs.ts",lineNumber:1},children:[3]},{id:3,callFrame:{functionName:"evaluate",url:"/lib/poker/evaluator.ts",lineNumber:2}}],samples:[3,2,3],timeDeltas:[10,20,30]};
 const result=summarizeCpuProfile(profile,{start:1020,end:1050});
 expect(result.sampledMicros).toBe(30);
 expect(result.frames.find(f=>f.functionName==="observe")).toMatchObject({selfMicros:10,inclusiveMicros:30});
 expect(result.frames.find(f=>f.functionName==="evaluate")).toMatchObject({selfMicros:20,inclusiveMicros:20});
 expect(result.sourceSelf.reduce((n,f)=>n+f.selfMicros,0)).toBe(30);
 expect(()=>summarizeCpuProfile({...profile,timeDeltas:[]},{start:1020,end:1050})).toThrow(/sample/);
});
it("filters a measured stack marker when profiler clocks have different origins",()=>{
 const profile={startTime:1000,endTime:1100,nodes:[{id:1,callFrame:{functionName:"root",url:"",lineNumber:0},children:[2,4]},{id:2,callFrame:{functionName:"measuredWorkload",url:"runner.ts",lineNumber:1},children:[3]},{id:3,callFrame:{functionName:"evaluate",url:"evaluator.ts",lineNumber:2}},{id:4,callFrame:{functionName:"startup",url:"loader.ts",lineNumber:3}}],samples:[4,3],timeDeltas:[10,20]};
 const window=findCpuMarkerWindow(profile,"measuredWorkload");
 const result=summarizeCpuProfile(profile,window);
 expect(result.sampledMicros).toBe(20);expect(result.frames.find(f=>f.functionName==="startup")!.selfMicros).toBe(0);
});
it("includes garbage collection between marked samples while excluding warmup",()=>{
 const profile={startTime:1000,endTime:1100,nodes:[{id:1,callFrame:{functionName:"root",url:"",lineNumber:0},children:[2,4,5]},{id:2,callFrame:{functionName:"measuredWorkload",url:"runner.ts",lineNumber:1},children:[3]},{id:3,callFrame:{functionName:"evaluate",url:"evaluator.ts",lineNumber:2}},{id:4,callFrame:{functionName:"warmup",url:"runner.ts",lineNumber:3}},{id:5,callFrame:{functionName:"(garbage collector)",url:"",lineNumber:0}}],samples:[4,3,5,3,4],timeDeltas:[10,20,5,20,10]};
 const result=summarizeCpuProfile(profile,findCpuMarkerWindow(profile,"measuredWorkload"));
 expect(result.sampledMicros).toBe(45);expect(result.frames.find(f=>f.functionName==="(garbage collector)")!.selfMicros).toBe(5);
 expect(result.frames.find(f=>f.functionName==="warmup")!.selfMicros).toBe(0);
});

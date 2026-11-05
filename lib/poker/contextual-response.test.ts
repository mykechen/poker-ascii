import {expect,it} from "vitest";
import {transformResponse,encodeContext,FEATURES,modelResponse,type ResponseModel} from "./contextual-response";
const context={facing:true,canRaise:true,position:"button",size:"large",depth:"short",players:"many"};
it("preserves structural zeros and normalizes clipped offsets",()=>{
 expect(transformResponse([0,.4,.6],[100,-100])).toEqual(transformResponse([0,.4,.6],[3,-3]));
 const p=transformResponse([0,.4,.6],[1,2]);expect(p[0]).toBe(0);expect(p.reduce((a,b)=>a+b,0)).toBeCloseTo(1);
});
it("zero offsets preserve the exact original vector",()=>{expect(transformResponse([.1,.3,.6],[0,0])).toEqual([.1,.3,.6]);});
it("rejects malformed probabilities and offsets",()=>{
 expect(()=>transformResponse([0,0,0],[0,0])).toThrow();expect(()=>transformResponse([.1,.3,.6],[NaN,0])).toThrow();
});
it("encodes public categories and board flags without identity metadata",()=>{
 const x=encodeContext(context,["Ah","Ad","2h"],[.2,.5,.3]);
 expect(x[FEATURES.indexOf("paired")]).toBe(1);expect(x[FEATURES.indexOf("three-suited")]).toBe(0);
 const metadata={...context,family:"maniac",seat:7};
 expect(encodeContext(metadata,["Ah","Ad","2h"],[.2,.5,.3])).toEqual(x);
});
it("uniform and frequency models respect support and unseen-support backoff",()=>{
 expect(modelResponse([0,.2,.8],context,[],{version:1,kind:"uniform"})).toEqual([0,.5,.5]);
 const m:ResponseModel={version:1,kind:"frequency",frequencies:{"011":[0,.7,.3]}};
 expect(modelResponse([0,.2,.8],context,[],m)).toEqual([0,.7,.3]);
 expect(modelResponse([.2,.3,.5],context,[],m)).toEqual([.2,.3,.5]);
});
it("rejects incompatible contextual artifacts before use",async()=>{
 const {validateResponseModel}=await import("./contextual-response");
 expect(()=>validateResponseModel({version:1,kind:"contextual",features:[],coefficients:[[],[]],supports:[],lambda:1})).toThrow();
 expect(()=>validateResponseModel({version:1,kind:"frequency",frequencies:{"011":[.2,.4,.4]}})).toThrow();
});
it("transform before marginalization differs from transforming the marginal",()=>{
 const first=transformResponse([.1,.3,.6],[1,-1]);const second=transformResponse([.6,.3,.1],[1,-1]);
 const marginal=transformResponse([.35,.3,.35],[1,-1]);
 expect(Math.abs((first[0]+second[0])/2-marginal[0])).toBeGreaterThan(.01);
});

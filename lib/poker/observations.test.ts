import { expect,it } from "vitest";
import type { Policy } from "./bot";
import { simplePolicy } from "./bot";
import { playMatch } from "./train";
it("delivers terminal observations and initializes fresh join identities",()=>{
 let starts=0,terminals=0;
 const ids:string[][]=[];
 const policy:Policy=Object.assign(simplePolicy.bind(null),{startSession:(players:string[])=>{starts++;ids.push(players);},observe:(_before:unknown,after:{phase:string})=>{if(after.phase==="complete") terminals++;}});
 const options={seats:[{name:"same",policy},{name:"same",policy:simplePolicy}],hands:3};
 playMatch(options);playMatch(options);
 expect(starts).toBe(2);expect(terminals).toBe(6);
 expect(ids[0]).not.toEqual(ids[1]);
});

import {readFileSync} from 'node:fs';
import {acquireControllerLock,atomicJSON} from '../lib/poker/evaluation/provenance';
const release=acquireControllerLock();try{
 const path='handoffs/seed-registry.json',r=JSON.parse(readFileSync(path,'utf8'));
 const ranges=[{start:103001,end:103020,reason:'Completed inspected decision-stability screen; not fresh confirmation.'},{start:104001,end:104010,reason:'Accepted descriptive audit pilot and explicit unit diagnostic replay; never confirmation.'},{start:105001,end:105002,reason:'Fixed engineering smoke fixtures and registered diagnostic repetitions; never confirmation.'},{start:107001,end:107020,reason:'Completed all-in estimator validation, inspected; never confirmation.'},{start:108001,end:108028,reason:'Oversized scaling calibration aborted on runtime projection; conservatively retire entire reservation.'},{start:108101,end:108114,reason:'Completed all worker-count engineering calibrations with explicit diagnostic reuse.'}];
 for(const range of ranges)if(!r.retired_inspected_ranges.some((x:{start:number;end:number})=>x.start===range.start&&x.end===range.end))r.retired_inspected_ranges.push(range);
 atomicJSON(path,r);
}finally{release();}

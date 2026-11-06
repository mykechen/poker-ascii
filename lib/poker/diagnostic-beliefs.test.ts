import {expect,it} from 'vitest';
import {DiagnosticBeliefs,trueHandScore} from './diagnostic-beliefs';
import {replayObservations,type ReplayObservation} from './contextual-replay';
import type {PublicView} from './view';
const row:ReplayObservation={match:0,hand:1,seat:1,order:1,board:['2c','7h','Jd'],known:['As','Kh','2c','7h','Jd'],context:{facing:true,canRaise:false,position:'field',size:'small',depth:'short',players:'few'},actual:'passive'};
it('matches own-model replay across earlier streets and resets per hand',()=>{
 const rows:ReplayObservation[]=[{...row,board:[],known:['As','Kh'],order:0},row,{...row,hand:2,order:2}];
 for(const kind of ['current','uniform'] as const){const model={version:1 as const,kind},tracker=new DiagnosticBeliefs(model);expect(rows.map(r=>tracker.observe(r).prediction)).toEqual(replayObservations(rows,model).map(r=>r.probabilities));}
 const tracker=new DiagnosticBeliefs({version:1,kind:'current'}),first=tracker.observe(row);tracker.reset();expect(tracker.observe(row)).toEqual(first);
});
it('snapshots and truth scoring cannot change inference',()=>{
 const tracker=new DiagnosticBeliefs({version:1,kind:'current'}),result=tracker.observe(row),copy=structuredClone(result.after);
 expect(trueHandScore(result.after,['3c','4d']).probability).toBeGreaterThan(0);expect(result.after).toEqual(copy);
 result.after[0]!.weight=999;result.after[0]!.cards[0]='As';
 const reference=new DiagnosticBeliefs({version:1,kind:'current'});reference.observe(row);
 expect(tracker.observe({...row,order:2})).toEqual(reference.observe({...row,order:2}));
});
it('reads only acting own holes and conditions live opponent snapshots',()=>{
 const tracker=new DiagnosticBeliefs({version:1,kind:'current'});
 const opponent={seat:1,inHand:true,folded:false,get hole(){throw new Error('Private access');}};
 const view={handNumber:1,toAct:0,board:row.board,seats:[{seat:0,inHand:true,folded:false,hole:['As','Kh']},opponent]} as unknown as PublicView;
 const ranges=tracker.ranges(view);expect(ranges[1]!.every(h=>h.cards.every(c=>!row.known.includes(c)))).toBe(true);
 ranges[1]![0]!.weight=999;expect(tracker.ranges(view)[1]![0]!.weight).not.toBe(999);
 expect(()=>tracker.ranges({...view,toAct:null})).toThrow();
});
it('validates true hands and range mass and clamps zero probability',()=>{
 expect(trueHandScore([{cards:['As','Kh'],weight:2}],['Kh','As'])).toEqual({probability:1,logLoss:0});
 expect(trueHandScore([{cards:['As','Kh'],weight:1}],['3c','4d']).logLoss).toBeCloseTo(-Math.log(1e-12));
 expect(()=>trueHandScore([{cards:['As','Kh'],weight:-1}],['3c','4d'])).toThrow();
 expect(()=>trueHandScore([],['As','As'])).toThrow();
});
it('keeps candidate own posterior histories independent and snapshots its model',()=>{
 const model={version:1 as const,kind:'frequency' as const,frequencies:{'110':[.2,.8,0] as [number,number,number]}};
 const a=new DiagnosticBeliefs(model),b=new DiagnosticBeliefs({version:1,kind:'current'});
 model.frequencies['110'][0]=.7;model.frequencies['110'][1]=.3;
 const posterior=a.observe(row).after,baseline=b.observe(row).after;
 expect(posterior).not.toEqual(baseline);
 const next={...row,order:2};
 expect(a.observe(next).prediction).toEqual(replayObservations([row,next],{version:1,kind:'frequency',frequencies:{'110':[.2,.8,0]}})[1]!.probabilities);
});

import {describe,it,expect} from 'vitest';
import {populationCoverage,populationObjective,fitPopulationOffsets,selectPopulationOffset} from './population-fit';
import {FEATURES} from './contextual-response';
describe('population fitting boundaries',()=>{
 it('allows shared batch identities across strata but rejects duplicate pairs',()=>{
  expect(()=>populationCoverage([{batch:1,stratum:'legacy',rows:[]},{batch:1,stratum:'expanded',rows:[]}])).not.toThrow();
  expect(()=>populationCoverage([{batch:1,stratum:'legacy',rows:[]},{batch:1,stratum:'legacy',rows:[]}])).toThrow();
 });
 it('requires both strata in the weighted objective',()=>expect(()=>populationObjective({legacy:[],expanded:[]},Array(2*FEATURES.length).fill(0),1)).toThrow());
 it('keeps exact current fallback when coverage is absent',()=>{
  const fit=fitPopulationOffsets([],1);
  expect(fit.model.supports).toEqual([]);
  expect(fit.model.coefficients.flat().every(x=>x===0)).toBe(true);
  expect(selectPopulationOffset([],[]).status).toBe('insufficient-data');
 });
});

import type {ReplayObservation} from './contextual-replay';
const row:ReplayObservation={match:0,hand:1,seat:1,order:0,board:['2c','7h','Jd'],known:[],context:{facing:true,canRaise:false,position:'field',size:'small',depth:'short',players:'few'},actual:'passive',components:[{weight:.4,probabilities:[.1,.9,0],group:'strong',draw:false,style:1},{weight:.6,probabilities:[.6,.4,0],group:'weak',draw:false,style:1}]};
const basePanels=Array.from({length:8},(_,batch)=>({batch:71001+batch,rows:Array.from({length:30},(_,i)=>({...row,hand:i,order:i,actual:i%5?'passive' as const:'fold' as const}))}));

const panels=basePanels.flatMap(p=>(['legacy','expanded'] as const).map(stratum=>({...p,stratum})));
it('weights strata equally regardless of duplicate observations and checks active gradients',()=>{
 for(const support of ['011','110','111']){
  const probabilities=(support==='011'?[0,.4,.6]:support==='110'?[.2,.8,0]:[.2,.3,.5]) as [number,number,number];
  const r={...row,components:[{...row.components![0]!,weight:1,probabilities}]};
  const rows={legacy:[r],expanded:[r,r]},beta=Array(2*FEATURES.length).fill(0);
  const indices=[...(support[0]==='1'?[FEATURES.indexOf(`support:${support}`)]:[]),...(support[2]==='1'?[FEATURES.length+FEATURES.indexOf(`support:${support}`)]:[])];
  indices.forEach(i=>beta[i]=.2);
  expect(populationObjective(rows,beta,1)).toEqual(populationObjective({...rows,expanded:[r,r,r,r]},beta,1));
  for(const i of indices){const hi=[...beta],lo=[...beta];hi[i]+=1e-5;lo[i]-=1e-5;expect(populationObjective(rows,beta,1).gradient[i]).toBeCloseTo((populationObjective(rows,hi,1).loss-populationObjective(rows,lo,1).loss)/2e-5,6);}
 }
});
it('converges deterministically and masks minority actions',()=>{
 const fit=fitPopulationOffsets(panels,.1);expect(fit.converged).toBe(true);expect(fit.model.supports).toEqual(['110']);expect(fitPopulationOffsets(panels,.1)).toEqual(fit);
 expect(fitPopulationOffsets(panels.map(p=>p.stratum==='expanded'?{...p,rows:p.rows.map(r=>({...r,actual:'passive' as const}))}:p),1).model.supports).toEqual([]);
});
it('vetoes per-stratum deterioration and breaks ties toward stronger penalties',()=>{
 const score=(id:string,legacy:number,expanded:number)=>({id,byStratum:Object.fromEntries(([['legacy',legacy],['expanded',expanded]] as const).map(([s,logLoss])=>[s,{id,scores:{count:240,brier:.3,logLoss},groups:{}}])) as Record<'legacy'|'expanded',import('./contextual-selection').SelectionScore>});
 expect(selectPopulationOffset([score('current',1,1),score('offset:1',1.03,.5)],panels).selected).toBe('current');
 expect(selectPopulationOffset([score('current',1,1),score('offset:1',.9,.9),score('offset:10',.9,.9)],panels).selected).toBe('offset:10');
});

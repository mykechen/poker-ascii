import {expect,it} from 'vitest';
import {supportCoverage,fitSupportOffsets,selectSupportOffset} from './support-offset';
import {FEATURES,modelResponse} from './contextual-response';
import type {ReplayObservation} from './contextual-replay';
const row:ReplayObservation={match:0,hand:1,seat:1,order:0,board:['2c','7h','Jd'],known:[],context:{facing:true,canRaise:false,position:'field',size:'small',depth:'short',players:'few'},actual:'passive',components:[{weight:.4,probabilities:[.1,.9,0],group:'strong',draw:false,style:1},{weight:.6,probabilities:[.6,.4,0],group:'weak',draw:false,style:1}]};
const panels=Array.from({length:8},(_,batch)=>({batch:71001+batch,rows:Array.from({length:30},(_,i)=>({...row,hand:i,order:i,actual:i%5?'passive' as const:'fold' as const}))}));
it('counts flop coverage across batch identities without counting repeat actions as hands',()=>{
 const c=supportCoverage(panels)['110'];expect(c).toMatchObject({observations:240,hands:240,batches:8});
 const repeated=panels.map(p=>({...p,rows:p.rows.map(r=>({...r,hand:1}))}));
 expect(supportCoverage(repeated)['110'].hands).toBe(8);
 expect(supportCoverage(panels.map(p=>({...p,rows:p.rows.map(r=>({...r,board:[]}))})))).toEqual({});
});
it('falls back exactly if independent coverage is inadequate',()=>{
 const fit=fitSupportOffsets(panels.slice(0,7),.1);
 expect(fit.model.supports).toEqual([]);expect(fit.model.coefficients.flat().every(v=>v===0)).toBe(true);
 expect(modelResponse([.2,.8,0],row.context,row.board,fit.model)).toEqual([.2,.8,0]);
});
it('fits deterministically with only allowed support slots and preserves latent differences',()=>{
 const fit=fitSupportOffsets(panels,.1);expect(fit.converged).toBe(true);expect(fitSupportOffsets(panels,.1)).toEqual(fit);
 expect(fit.model.supports).toEqual(['110']);
 fit.model.coefficients.forEach((values,k)=>values.forEach((v,i)=>{if(k!==0||i!==FEATURES.indexOf('support:110'))expect(v).toBe(0);}));
 const a=modelResponse([.1,.9,0],row.context,row.board,fit.model),b=modelResponse([.6,.4,0],row.context,row.board,fit.model);
 expect(a[0]).not.toBeCloseTo(b[0]);expect(a[2]).toBe(0);
 expect(fitSupportOffsets(panels,.1,0).converged).toBe(false);
});
it('stops selection without sparse validation coverage; never selects diagnostic frequency',()=>{
 const insufficient=selectSupportOffset([],panels.slice(0,2));expect(insufficient.status).toBe('insufficient-data');
 const scores=(id:string,loss:number)=>({id,scores:{count:240,brier:.3,logLoss:loss},groups:{'110:true':{count:240,brier:.3,logLoss:loss}}});
 expect(selectSupportOffset([scores('current',1),scores('frequency',.1),scores('offset:1',.9),scores('offset:10',.9)],panels)).toMatchObject({status:'selected',selected:'offset:10'});
});
it('rejects duplicate batch identities and mismatched latent supports',()=>{
 expect(()=>supportCoverage([panels[0],panels[0]])).toThrow();
 expect(()=>supportCoverage([{batch:1,rows:[{...row,components:[...row.components!,{weight:0,probabilities:[.1,.2,.7],group:'weak',draw:false,style:0}]}]}])).toThrow();
});
it('support-only analytic gradient matches finite differences',async()=>{
 const {objective}=await import('./contextual-fit');
 const beta=Array(2*FEATURES.length).fill(0),i=FEATURES.indexOf('support:110');beta[i]=.2;
 const hi=[...beta],lo=[...beta];hi[i]+=1e-5;lo[i]-=1e-5;
 expect(objective([row],beta,.1).gradient[i]).toBeCloseTo((objective([row],hi,.1).loss-objective([row],lo,.1).loss)/2e-5,6);
});
it('checks aggression-only and coupled support gradients',async()=>{
 const {objective}=await import('./contextual-fit');
 for(const support of ['011','111']){
  const probabilities=support==='011'?[0,.4,.6] as [number,number,number]:[.2,.3,.5] as [number,number,number];
  const example={...row,actual:'aggressive' as const,components:[{...row.components![0],weight:1,probabilities}]};
  const n=FEATURES.length,i=FEATURES.indexOf(`support:${support}`),beta=Array(2*n).fill(0);beta[i]=.1;beta[n+i]=-.2;
  for(const k of support==='011'?[n+i]:[i,n+i]){
   const hi=[...beta],lo=[...beta];hi[k]+=1e-5;lo[k]-=1e-5;
   expect(objective([example],beta,1).gradient[k]).toBeCloseTo((objective([example],hi,1).loss-objective([example],lo,1).loss)/2e-5,6);
  }
 }
});

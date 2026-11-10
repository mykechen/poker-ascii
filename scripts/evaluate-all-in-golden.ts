import {writeFileSync} from 'node:fs';
import {adjustedPayout,type AllInPoint} from '../lib/poker/evaluation/all-in';
const point:AllInPoint={board:[],button:0,terminalChance:true,pots:[{name:'POT',amount:400}],players:[{seat:0,hole:['As','Ah'],committed:200,folded:false,allIn:true},{seat:1,hole:['Kc','Kd'],committed:200,folded:false,allIn:true}]};
const started=performance.now();const result=adjustedPayout(point);const equity=result.payouts[0]!/400;
// Exact win/tie counts from exhaustive enumeration; tolerance checks a conventional AA/KK sanity range, not an external oracle.
if(result.runouts!==1712304||equity<0.81||equity>0.83||Math.abs(result.payouts.reduce((a,b)=>a+b,0)-400)>1e-8)throw new Error('Preflop enumeration sanity failure');
writeFileSync(process.argv[2]??'handoffs/evaluation-2026-11-09-r2/preflop-golden.json',JSON.stringify({point,result,equity,elapsedMs:performance.now()-started,classification:'fixed exhaustive engine enumeration; no Monte Carlo',maxSeconds:7200},null,2),{flag:'wx'});

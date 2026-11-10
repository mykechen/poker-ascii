import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {it,expect} from 'vitest';
import {adjustedPayout,type AllInPoint} from './all-in';
const point=():AllInPoint=>({board:['2c','3d','7h','9s'],button:0,terminalChance:true,pots:[],players:[{seat:0,hole:['As','Ah'],committed:200,folded:false,allIn:true},{seat:1,hole:['Kc','Kd'],committed:200,folded:false,allIn:true}]});
it('AA vs KK turn exact two-out enumeration',()=>{const r=adjustedPayout(point());expect(r.runouts).toBe(44);expect(r.payouts[0]).toBeCloseTo(400*42/44,10);expect(r.payouts[1]).toBeCloseTo(400*2/44,10);});
it('three-way exact main/side pot equities use engine payout rules',()=>{const p=point();p.players[0]!.committed=100;p.players.push({seat:2,hole:['Qc','Qd'],committed:200,folded:false,allIn:true});const r=adjustedPayout(p);expect(r.runouts).toBe(42);expect(r.payouts.slice(0,3)).toEqual([300*38/42,(300*2+200*40)/42,(300*2+200*2)/42]);});
it('odd chip goes clockwise from button, folded dead cards excluded',()=>{const p=point();p.board=['Tc','Jc','Qc','Kc','Ac'];p.players[0]!.hole=['2s','3s'];p.players[1]!.hole=['4s','5s'];p.players.forEach(x=>x.committed=101);p.players.push({seat:2,hole:['6s','7s'],committed:1,folded:true,allIn:false});expect(adjustedPayout(p)).toEqual({runouts:1,payouts:[101,102,0,0,0,0,0,0]});});
it('rejects duplicate cards and nonterminal chance states',()=>{const p=point();p.players[1]!.hole=['As','Kd'];expect(()=>adjustedPayout(p)).toThrow();expect(()=>adjustedPayout({...point(),terminalChance:false})).toThrow();});
it('AA vs KK preflop exhausts all 1,712,304 boards and matches frozen exact payout',async()=>{
 const root=mkdtempSync(join(tmpdir(),'all-in-golden-')),output=join(root,'golden.json');
 try{
  // Keep the Vitest RPC loop responsive during the exhaustive CPU-bound enumeration.
  await promisify(execFile)(process.execPath,[resolve('node_modules/vite-node/vite-node.mjs'),resolve('scripts/evaluate-all-in-golden.ts'),output]);
  const r=JSON.parse(readFileSync(output,'utf8')).result;
  expect(r.runouts).toBe(1712304);expect(r.payouts[0]).toBeCloseTo(325.0219587176109,10);expect(r.payouts[1]).toBeCloseTo(74.97804128238911,10);
 }finally{rmSync(root,{recursive:true,force:true});}
},120000);

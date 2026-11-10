import {describe,it,expect} from 'vitest';
import {playMatch} from '../train';
import {station} from '../strategies';
import {runSeed,validateProtocol,hashObject,type Protocol} from './protocol';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
const protocol = ():Protocol => ({version:1,id:'test',classification:'engineering-smoke',sourceHash:'a'.repeat(64),poolHash:hashObject(pool),pool,arms:[{id:'a',samples:50},{id:'b',samples:50}],seeds:[105001,105002],hands:2,players:[6,7,8],stack:200,smallBlind:1,bigBlind:2,adjustAllIn:false,maxSeconds:600});
const pool=[{id:'heuristic',opponents:['chart','tight','station','position','aggressor']}];
describe('evaluation protocol',()=>{
 it('records raw stacks independently of cumulative net without changing play',()=>{
  const seats=Array.from({length:6},(_,i)=>({name:`s${i}`,policy:station}));let count=0;
  const plain=playMatch({seats,hands:2,seed:105001});
  const captured=playMatch({seats,hands:2,seed:105001,onEvaluation:event=>{count++;if(event.kind==='hand')expect(event.state.seats.slice(0,6).reduce((n,s)=>n+s.stack,0)).toBe(1200);}});
  expect(captured).toEqual(plain);expect(count).toBeGreaterThan(2);
 });
 it('identical arms pair to zero, deck fingerprints are sample-independent, conserved and reproducible',()=>{
  const p=protocol();const a=runSeed(p,105001);expect(runSeed(p,105001)).toEqual(a);
  const changed=runSeed({...p,arms:[p.arms[0]!,{id:'b',samples:128}]},105001);
  const aa=a.filter(r=>r.arm==='a'),bb=a.filter(r=>r.arm==='b');expect(aa).toHaveLength(42);
  for(let i=0;i<aa.length;i++){expect(aa[i]!.rawChips).toEqual(bb[i]!.rawChips);expect(aa[i]!.deckHash).toBe(bb[i]!.deckHash);expect(aa[i]!.rawChips.reduce((x,y)=>x+y,0)).toBe(0);}
  expect(changed.map(r=>r.deckHash)).toEqual(a.map(r=>r.deckHash));
 },120000);
 it('rejects malformed protocols and pool tampering',()=>{
  expect(()=>validateProtocol({...protocol(),seeds:[1,1]})).toThrow();
  expect(()=>validateProtocol({...protocol(),poolHash:'b'.repeat(64)})).toThrow();
  expect(()=>validateProtocol({...protocol(),hands:0})).toThrow();
 });
 it('keeps privileged scoring outside all non-evaluation modules and feature import closure',()=>{
  function walk(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
  const files=walk('lib').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')&&!f.includes('/evaluation/'));
  for(const file of files)expect(readFileSync(file,'utf8'),file).not.toMatch(/(?:from\s*|import\s*\()["'][^"']*evaluation\//);
  // No training export is produced by the evaluator. Private output has a distinct schema.
  expect(runSeed(protocol(),105001)[0]!.schema).toBe('evaluation-private-v1');
 },120000);
});

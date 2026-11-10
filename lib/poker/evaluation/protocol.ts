import {createHash} from 'node:crypto';
import {createAdaptivePolicy} from '../adaptive';
import {strategyById,type StrategyId} from '../strategies';
import {playMatch,type EvaluationEvent} from '../train';
import {describePots} from '../pots';
import type {Card} from '../types';
import {adjustedPayout,type AllInPoint} from './all-in';
export type PoolCell={id:string;opponents:string[]};
export type Arm={id:string;samples:number};
export type Protocol={version:1;id:string;classification:string;sourceHash:string;poolHash:string;pool:PoolCell[];arms:Arm[];seeds:number[];hands:number;players:number[];stack:number;smallBlind:number;bigBlind:number;adjustAllIn:boolean;maxSeconds:number};
export type HandRecord={schema:'evaluation-private-v1';id:string;seed:number;cell:string;players:number;rotation:number;hand:number;arm:string;hero:number;deckHash:string;rawChips:number[];rawBb:number;adjustedBb:number;allInPoints:AllInPoint[];terminalBoard:Card[]};
export function hashObject(value:unknown):string{return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function validateProtocol(p:Protocol):void{
 if(p.version!==1||!p.id||!p.classification||!/^[a-f0-9]{64}$/.test(p.sourceHash)||p.poolHash!==hashObject(p.pool))throw new Error('Invalid identity/source/pool hash');
 for(const xs of [p.seeds,p.players,p.arms.map(a=>a.id),p.pool.map(c=>c.id)])if(!xs.length||new Set<unknown>(xs).size!==xs.length)throw new Error('Missing or duplicate protocol entries');
 if(!p.seeds.every(s=>Number.isSafeInteger(s)&&s>0&&s<=0xffffffff)||!p.players.every(n=>[6,7,8].includes(n)))throw new Error('Invalid seed/player count');
 for(const [n,min,max] of [[p.hands,1,100000],[p.stack,2,1000000],[p.smallBlind,1,p.bigBlind],[p.bigBlind,p.smallBlind,p.stack],[p.maxSeconds,1,7200]])if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error('Invalid work/blind/stack/runtime bound');
 if(!p.arms.every(a=>a.id&&Number.isSafeInteger(a.samples)&&a.samples>=1))throw new Error('Invalid arms');
 for(const c of p.pool){if(!c.opponents.length)throw new Error('Empty lineup');for(const id of c.opponents)if(id!=='baseline-v0')strategyById(id as StrategyId);}
}
function adaptive(samples:number){return createAdaptivePolicy({samples,seed:42,riverSamples:16,riverRiskPenalty:1,learn:false,styleRetention:1,responseModel:{version:1,kind:'current'}}).policy;}
export function runSeed(p:Protocol,seed:number,onTiming?:(timing:{allInMs:number})=>void):HandRecord[]{
 validateProtocol(p);if(!p.seeds.includes(seed))throw new Error('Seed not in manifest');
 const rows:HandRecord[]=[];let allInMs=0;
 for(const cell of p.pool)for(const players of p.players)for(let rotation=0;rotation<players;rotation++)for(const arm of p.arms){
  const hero=(players-rotation)%players;
  const participants=Array.from({length:players},(_,i)=>{
   const id=i===0?'hero':cell.opponents[(i-1+p.seeds.indexOf(seed))%cell.opponents.length]!;
   return {name:i===0?'hero':`opponent-${i}`,policy:i===0?adaptive(arm.samples):id==='baseline-v0'?adaptive(50):strategyById(id as StrategyId).policy};
  });
  let deckHash='',points:AllInPoint[]=[];let terminalChance:AllInPoint|null=null;
  function capture(event:EvaluationEvent){
   if(event.kind==='deal'){deckHash=hashObject(event.deck);points=[];terminalChance=null;return;}
   if(event.kind==='action'){
    const {before,after}=event;
    const newlyAllIn=after.seats.some((s,i)=>s.allIn&&!before.seats[i]!.allIn);
    const runout=after.phase==='complete'&&after.result?.showed===true&&before.board.length<5;
    if(newlyAllIn||runout){
     const point:AllInPoint={board:[...before.board],button:after.button??0,players:after.seats.flatMap((s,seat)=>s.hole.length===2?[{seat,hole:[...s.hole],committed:s.handCommitted,folded:s.folded||!s.inHand,allIn:s.allIn}]:[]),pots:describePots(after.seats.map(s=>({committed:s.handCommitted,allIn:s.allIn}))),terminalChance:runout};
     points.push(point);if(runout)terminalChance=point;
    }return;
   }
   const {state,beforeStacks}=event;const rawChips=beforeStacks.map((s,i)=>state.seats[i]!.stack-s);
   if(rawChips.reduce((a,b)=>a+b,0)!==0)throw new Error('Chip conservation failure');
   const point=terminalChance as AllInPoint|null;
   const adjustmentStarted=performance.now();
   const paid=p.adjustAllIn&&point&&!point.players.find(x=>x.seat===hero)!.folded?adjustedPayout(point).payouts[hero]!:null;
   allInMs+=performance.now()-adjustmentStarted;
   const heroCommitted=state.seats[hero]!.handCommitted;
   rows.push({schema:'evaluation-private-v1',id:`${seed}:${cell.id}:${players}:${rotation}:${state.handNumber}:${arm.id}`,seed,cell:cell.id,players,rotation,hand:state.handNumber,arm:arm.id,hero,deckHash,rawChips,rawBb:rawChips[hero]!/p.bigBlind,adjustedBb:paid===null?rawChips[hero]!/p.bigBlind:(paid-heroCommitted)/p.bigBlind,allInPoints:points,terminalBoard:[...state.board]});
  }
  const report=playMatch({seats:participants.map((_,seat)=>participants[(seat+rotation)%players]!),hands:p.hands,stack:p.stack,smallBlind:p.smallBlind,bigBlind:p.bigBlind,seed,invalidAction:'throw',onEvaluation:capture});
  if(report.fallbacks.some(x=>x!==0)||report.net.reduce((a,b)=>a+b,0)!==0)throw new Error('Fallback/accounting failure');
 }
 validateRows(p,seed,rows);onTiming?.({allInMs});return rows;
}
export function validateRows(p:Protocol,seed:number,rows:HandRecord[]):void{
 const expected=p.pool.length*p.players.reduce((a,b)=>a+b,0)*p.hands*p.arms.length;
 if(rows.length!==expected||new Set(rows.map(r=>r.id)).size!==expected)throw new Error('Missing/duplicate cells');
 const expectedIds=new Set<string>();
 for(const cell of p.pool)for(const players of p.players)for(let rotation=0;rotation<players;rotation++)for(let hand=1;hand<=p.hands;hand++)for(const arm of p.arms)expectedIds.add(`${seed}:${cell.id}:${players}:${rotation}:${hand}:${arm.id}`);
 const pairs=new Map<string,string>();
 for(const r of rows){if(!expectedIds.has(r.id)||r.id!==`${r.seed}:${r.cell}:${r.players}:${r.rotation}:${r.hand}:${r.arm}`||r.hero!==(r.players-r.rotation)%r.players||r.rawChips.length!==r.players||r.rawChips.reduce((a,b)=>a+b,0)!==0||![r.rawBb,r.adjustedBb].every(Number.isFinite))throw new Error('Manifest cell/accounting mismatch');if(r.seed!==seed)throw new Error('Seed identity mismatch');const key=`${r.cell}:${r.players}:${r.rotation}:${r.hand}`;const deck=pairs.get(key);if(deck&&deck!==r.deckHash)throw new Error('Deck mismatch');pairs.set(key,r.deckHash);}
}

import {writeFileSync} from 'node:fs';
import {playMatch} from '../../lib/poker/train';
import {createAdaptivePolicy} from '../../lib/poker/adaptive';
import type {PublicView} from '../../lib/poker/view';
import {strategyById} from '../../lib/poker/strategies';
import type {Policy} from '../../lib/poker/bot';
const rows:unknown[]=[];const started=performance.now();
// Fixed descriptive pilot, not profit confirmation; distinct audit-only seeds.
for(const samples of [50,128])for(const seed of [104001,104002,104003,104004,104005,104006,104007,104008,104009,104010])for(let rotation=0;rotation<6;rotation++){
 const actual=createAdaptivePolicy({samples,seed:42,riverSamples:16,riverRiskPenalty:1,learn:false,styleRetention:1});
 const actions:Record<string,unknown>[]=[];const boards:unknown[]=[];let previous=0;
 const policy:Policy=Object.assign((view:PublicView)=>{const a=actual.policy(view);actions.push({hand:view.handNumber,street:view.street,action:a.action,cost:view.validActions.find(x=>x.action==='call'),blinds:view.bigBlind});return a;},{startSession:actual.policy.startSession,observe:(before:PublicView,after:PublicView)=>{actual.policy.observe?.(before,after);if(after.phase==='complete')boards.push({hand:after.handNumber,board:after.board,hero:after.seats[(6-rotation)%6]!.hole});}});
 const participants=[{name:'audit',policy},...(['chart','tight','station','position','aggressor'] as const).map((id,i)=>({name:`opponent-${i}`,policy:strategyById(id).policy}))];
 const begin=performance.now();const report=playMatch({seats:participants.map((_,seat)=>participants[(seat+rotation)%6]!),hands:8,seed,invalidAction:'throw',onHand:(hand,net)=>{const hero=(6-rotation)%6,current=net[hero]!;rows.push({samples,seed,rotation,hand,bb:(current-previous)/2,actions:actions.filter(a=>a.hand===hand)});previous=current;}});
 rows.push({samples,seed,rotation,elapsedMs:performance.now()-begin,report,boards});
}
writeFileSync('handoffs/audit-2026-11-09/pilot.json',JSON.stringify({classification:'descriptive variance/throughput/strategy pilot; not confirmatory',settings:{seeds:[104001,104002,104003,104004,104005,104006,104007,104008,104009,104010],hands:8,players:6,samples:[50,128],riverSamples:16},elapsedMs:performance.now()-started,rows},null,2));

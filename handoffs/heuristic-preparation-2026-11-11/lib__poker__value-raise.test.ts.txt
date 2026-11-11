import {expect,it} from 'vitest';
import {apply,createTable} from './engine';
import {projectForPlayer,type PublicView} from './view';
import {createValueRaiseControl,valueRaiseDecision,type ControlEstimate} from './value-raise';
import type {PolicyAction} from './bot';

const check:PolicyAction={action:'check',reason:'baseline'};
const strong:ControlEstimate={equity:.9,standardError:0,expectedPayout:27,expectedPayoutStandardError:0};
function view():PublicView{
 let state=createTable();
 for(let seat=0;seat<3;seat++)state=apply(state,{type:'sit',seat,name:`P${seat}`,stack:200});
 state=apply(state,{type:'startHand'});
 const v=projectForPlayer(state,state.toAct);
 v.street='flop';v.board=['Ah','Kh','Qh'];v.betting={currentBet:0,minRaise:2,raiseOpen:true};
 v.pot=30;v.validActions=[{action:'check'},{action:'raise',min:2,max:190}];v.presets={min:2,half:15,pot:30,allIn:190};
 for(const seat of v.seats)if(seat.inHand){seat.handCommitted=10;seat.streetCommitted=0;seat.stack=190;seat.allIn=false;}
 v.log=[{seat:null,name:null,action:'deal',amount:null,raiseTo:null,street:'preflop',stackAfter:null,potAfter:0,text:'deal'},...v.seats.filter(s=>s.inHand).map(s=>({seat:s.seat,name:s.name,action:'call' as const,amount:10,raiseTo:null,street:'preflop' as const,stackAfter:190,potAfter:30,text:'contribution'}))];
 v.seats[v.toAct!]!.hole=['Jh','Th'];return v;
}
it('raises half pot only above the strict conservative 70% threshold',()=>{
 const v=view();expect(valueRaiseDecision(v,strong,check).decision).toMatchObject({action:'raise',amount:15});
 expect(valueRaiseDecision(v,{...strong,equity:.7,expectedPayout:21},check).decision).toBe(check);
 expect(valueRaiseDecision(v,{...strong,equity:.75,standardError:.03},check).decision).toBe(check);
 expect(valueRaiseDecision(v,{...strong,expectedPayout:24,expectedPayoutStandardError:2},check).decision).toBe(check);
});
it('clips half-pot sizing to the published legal interval',()=>{
 const v=view();v.presets!.half=1;
 expect(valueRaiseDecision(v,strong,check).decision).toMatchObject({action:'raise',amount:2});
 v.presets!.half=1000;expect(valueRaiseDecision(v,strong,check).decision).toMatchObject({action:'raise',amount:190});
});
it('raises on the turn and falls back with only one live contestant',()=>{
 const turn=view();turn.street='turn';turn.board.push('2c');
 expect(valueRaiseDecision(turn,strong,check).decision).toMatchObject({action:'raise',amount:15});
 const single=view();for(const seat of single.seats)if(seat.seat!==single.toAct)seat.folded=true;
 expect(valueRaiseDecision(single,strong,check).decision).toBe(check);
});
it('preserves baseline facing a bet, on river, without a responder or without legal raising',()=>{
 const bet=view();bet.betting!.currentBet=2;expect(valueRaiseDecision(bet,strong,check).decision).toBe(check);
 const river=view();river.street='river';expect(valueRaiseDecision(river,strong,check).decision).toBe(check);
 const alone=view();for(const s of alone.seats)if(s.seat!==alone.toAct)s.allIn=true;
 expect(valueRaiseDecision(alone,strong,check).decision).toBe(check);
 const closed=view();closed.validActions=[{action:'check'}];expect(valueRaiseDecision(closed,strong,check).decision).toBe(check);
 const call:PolicyAction={action:'call',reason:'baseline'};expect(valueRaiseDecision(view(),strong,call).decision).toBe(call);
});
it('requires universal equity as well as eligible main-pot payout strength',()=>{
 const v=view();const actor=v.toAct!;const other=v.seats.filter(s=>s.inHand&&s.seat!==actor);
 v.seats[actor]!.handCommitted=20;other[0]!.handCommitted=10;other[0]!.allIn=true;other[0]!.stack=0;other[1]!.handCommitted=20;
 // Hero can win all 50 committed chips, but showdown share against the covering opponent is weak.
 expect(valueRaiseDecision(v,{...strong,equity:.5,expectedPayout:45},check).decision).toBe(check);
 expect(valueRaiseDecision(v,{...strong,expectedPayout:45},check).decision.action).toBe('raise');
});
it('uses folded dead money but excludes pot layers above the hero commitment',()=>{
 const v=view();const actor=v.toAct!;const others=v.seats.filter(s=>s.inHand&&s.seat!==actor);
 v.seats[actor]!.handCommitted=10;others[0]!.handCommitted=20;others[0]!.folded=true;others[1]!.handCommitted=20;
 expect(valueRaiseDecision(v,strong,check).decision.action).toBe('raise');
 delete v.seats[actor]!.handCommitted;expect(valueRaiseDecision(v,strong,check).decision).toBe(check);
});
it('fails explicitly on invalid estimates rather than converting them into decisions',()=>{
 expect(()=>valueRaiseDecision(view(),{...strong,equity:NaN},check)).toThrow(/Invalid/);
 expect(()=>valueRaiseDecision(view(),null,check)).toThrow(/Missing/);
});
it('obtains its estimate through the baseline public callback and resets counters per session',()=>{
 const control=createValueRaiseControl({samples:128,seed:42,riverSamples:16,learn:false});
 control.policy.startSession!(['P0','P1','P2']);
 expect(control.policy(view())).toMatchObject({action:'raise',amount:15});
 expect(control.stats()).toMatchObject({decisions:1,eligible:1,raises:1});
 control.policy.startSession!(['P0','P1','P2']);expect(control.stats()).toEqual({decisions:0,eligible:0,raises:0});
});

import {expect,it} from "vitest";
import {apply,createTable} from "./engine";
import {projectForPlayer} from "./view";
it("publishes betting reconstruction fields without deck or opponent holes",()=>{
 let state=createTable();
 for(let seat=0;seat<6;seat++)state=apply(state,{type:"sit",seat,name:`P${seat}`,stack:200});
 state=apply(state,{type:"startHand"});
 const view=projectForPlayer(state,state.toAct);
 expect(view.betting).toEqual({currentBet:state.currentBet,minRaise:state.minRaise,raiseOpen:state.raiseOpen});
 expect(view).not.toHaveProperty("deck");
 expect(view.seats.filter(s=>s.inHand&&s.seat!==state.toAct).every(s=>s.hole==="down")).toBe(true);
 expect(view.seats.map(s=>s.handCommitted)).toEqual(state.seats.map(s=>s.handCommitted));
});

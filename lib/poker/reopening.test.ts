import { expect, it } from "vitest";
import { apply, createTable, legalActions } from "./engine";
import { freshDeck } from "./cards";

it("reopens an earlier caller after cumulative short all-ins reach a full raise", () => {
  let state = createTable();
  for (const [seat, stack] of [200, 14, 20, 200].entries()) {
    state = apply(state, { type: "sit", seat, name: `P${seat}`, stack });
  }
  state = apply(state, { type: "startHand", deck: freshDeck() });
  state = apply(state, { type: "act", seat: 3, action: "raise", amount: 10 });
  state = apply(state, { type: "act", seat: 0, action: "call" });
  state = apply(state, { type: "act", seat: 1, action: "all_in" });
  state = apply(state, { type: "act", seat: 2, action: "all_in" });
  expect(state.error).toBeNull();
  expect(state.toAct).toBe(3);
  expect(legalActions(state)).toContainEqual({ action: "raise", min: 28, max: 200 });
});
it("does not offer an uncontestable raise against an all-in opponent", () => {
 let state = createTable();
 state = apply(state,{type:"sit",seat:0,name:"short",stack:10});
 state = apply(state,{type:"sit",seat:1,name:"deep",stack:200});
 state = apply(state,{type:"startHand",deck:freshDeck()});
 state = apply(state,{type:"act",seat:0,action:"all_in"});
 expect(legalActions(state)).toEqual([{action:"fold"},{action:"call",amount:8}]);
});

import { legalActions } from "./engine";
import { describePots, type LivePot } from "./pots";
import type { Card, LegalAction, TableState } from "./types";

export type VisibleHole = Card[] | "down" | null;

export type PublicSeat = {
  seat: number;
  occupied: boolean;
  name: string | null;
  stack: number;
  away: boolean;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  streetCommitted: number;
  hole: VisibleHole;
  button: boolean;
  smallBlind: boolean;
  bigBlind: boolean;
  toAct: boolean;
  lastAction: string | null;
};

export type RaisePresets = {
  min: number;
  half: number;
  pot: number;
  allIn: number;
};

export type PublicView = {
  seats: PublicSeat[];
  board: Card[];
  pot: number;
  pots: LivePot[];
  street: TableState["street"];
  phase: TableState["phase"];
  handNumber: number;
  smallBlind: number;
  bigBlind: number;
  toAct: number | null;
  actorName: string | null;
  validActions: LegalAction[];
  presets: RaisePresets | null;
  log: TableState["log"];
  result: TableState["result"];
  error: string | null;
  revealRequired: boolean;
};

/**
 * One player's view of a shared table.
 * They see their own hole cards. Everyone else stays face down until showdown.
 * Action buttons are included only when this seat is the one to act.
 */
export function projectForPlayer(state: TableState, viewer: number | null): PublicView {
  const showdown = state.phase === "complete" && state.result?.showed === true;
  const yourTurn = state.phase === "betting" && viewer !== null && state.toAct === viewer;
  const seats: PublicSeat[] = state.seats.map((seat, index) => {
    let hole: VisibleHole = null;
    if (seat.hole.length === 2) {
      const mine = index === viewer;
      const tableSees = showdown && seat.inHand && !seat.folded;
      hole = mine || tableSees ? seat.hole : "down";
    }
    return seatView(state, seat, index, hole);
  });
  const validActions = yourTurn ? legalActions(state) : [];
  return viewOf(state, seats, validActions, false);
}

/** Hide hole cards except the revealed actor, and live hands at showdown. */
export function projectView(state: TableState, revealed: boolean): PublicView {
  const showdown = state.phase === "complete" && state.result?.showed === true;
  const revealRequired = state.phase === "betting" && state.toAct !== null && !revealed;
  const seats: PublicSeat[] = state.seats.map((seat, index) => {
    let hole: VisibleHole = null;
    if (seat.hole.length === 2) {
      const actorSees = revealed && index === state.toAct && state.phase === "betting";
      const tableSees = showdown && seat.inHand && !seat.folded;
      hole = actorSees || tableSees ? seat.hole : "down";
    }
    return seatView(state, seat, index, hole);
  });

  const validActions = revealRequired ? [] : legalActions(state);
  return viewOf(state, seats, validActions, revealRequired);
}

function seatView(state: TableState, seat: TableState["seats"][number], index: number, hole: VisibleHole): PublicSeat {
  return {
    seat: index,
    occupied: seat.name !== null,
    name: seat.name,
    stack: seat.stack,
    away: seat.away,
    inHand: seat.inHand,
    folded: seat.folded,
    allIn: seat.allIn,
    streetCommitted: seat.streetCommitted,
    hole,
    button: state.button === index && state.phase !== "idle",
    smallBlind: state.smallBlindSeat === index && state.phase !== "idle",
    bigBlind: state.bigBlindSeat === index && state.phase !== "idle",
    toAct: state.toAct === index,
    lastAction: seat.lastAction,
  };
}

function viewOf(state: TableState, seats: PublicSeat[], validActions: LegalAction[], revealRequired: boolean): PublicView {
  return {
    seats,
    board: state.board,
    pot: state.pot,
    pots: describePots(state.seats.map((seat) => ({ committed: seat.handCommitted, allIn: seat.allIn }))),
    street: state.street,
    phase: state.phase,
    handNumber: state.handNumber,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    toAct: state.toAct,
    actorName: state.toAct === null ? null : state.seats[state.toAct]?.name ?? null,
    validActions,
    presets: presets(state, validActions),
    log: state.log,
    result: state.result,
    error: state.error,
    revealRequired,
  };
}

function presets(state: TableState, actions: LegalAction[]): RaisePresets | null {
  const raise = actions.find((action) => action.action === "raise");
  const allIn = actions.find((action) => action.action === "all_in");
  if (!raise || raise.action !== "raise" || state.toAct === null) return null;
  const seat = state.seats[state.toAct]!;
  const toCall = Math.max(0, state.currentBet - seat.streetCommitted);
  const potSized =
    state.currentBet === 0 ? state.pot : state.currentBet + state.pot + toCall;
  const halfSized =
    state.currentBet === 0
      ? Math.floor(state.pot / 2)
      : state.currentBet + Math.floor((state.pot + toCall) / 2);
  const clamp = (amount: number) => Math.min(raise.max, Math.max(raise.min, amount));
  return {
    min: raise.min,
    half: clamp(halfSized),
    pot: clamp(potSized),
    allIn: allIn && allIn.action === "all_in" ? allIn.amount : raise.max,
  };
}

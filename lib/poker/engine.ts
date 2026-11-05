/**
 * Local no-limit hold'em. apply() is the only way chips move. legalActions()
 * is the offer a seat can answer. Raise amounts are raise-to totals.
 */
import { formatCards, isCard, shuffleDeck } from "./cards";
import { evaluate } from "./evaluator";
import { settlePots, type PotPlayer } from "./pots";
import {
  SEAT_COUNT,
  type Card,
  type Command,
  type LegalAction,
  type LogAction,
  type LogEntry,
  type PlayAction,
  type SeatState,
  type Street,
  type TableState,
  type Winner,
} from "./types";

const CHIP_CAP = 1_000_000_000;

export function emptySeat(): SeatState {
  return {
    name: null,
    stack: 0,
    away: false,
    hole: [],
    inHand: false,
    folded: false,
    allIn: false,
    streetCommitted: 0,
    handCommitted: 0,
    acted: false,
    lastAction: null,
  };
}

export function createTable(): TableState {
  return {
    seats: Array.from({ length: SEAT_COUNT }, emptySeat),
    smallBlind: 1,
    bigBlind: 2,
    button: null,
    smallBlindSeat: null,
    bigBlindSeat: null,
    handNumber: 0,
    street: null,
    deck: [],
    board: [],
    pot: 0,
    currentBet: 0,
    minRaise: 2,
    raiseOpen: true,
    toAct: null,
    phase: "idle",
    log: [],
    result: null,
    error: null,
  };
}

export function legalActions(state: TableState): LegalAction[] {
  if (state.phase !== "betting" || state.toAct === null) return [];
  const seat = state.seats[state.toAct];
  if (!seat || !seat.inHand || seat.folded || seat.allIn) return [];

  const toCall = state.currentBet - seat.streetCommitted;
  const actions: LegalAction[] = [];
  if (toCall > 0) {
    actions.push({ action: "fold" });
    actions.push({ action: "call", amount: Math.min(toCall, seat.stack) });
  } else {
    actions.push({ action: "check" });
  }

  if (canRaise(state, seat)) {
    const maxTo = seat.streetCommitted + seat.stack;
    const minTo = state.currentBet + state.minRaise;
    if (maxTo >= minTo) actions.push({ action: "raise", min: minTo, max: maxTo });
    actions.push({ action: "all_in", amount: maxTo });
  } else if (seat.stack > 0 && toCall >= seat.stack) {
    actions.push({ action: "all_in", amount: seat.streetCommitted + seat.stack });
  }
  return actions;
}

export function apply(state: TableState, command: Command): TableState {
  switch (command.type) {
    case "sit":
      return sit(state, command.seat, command.name, command.stack);
    case "leave":
      return leave(state, command.seat);
    case "away":
      return setAway(state, command.seat, true);
    case "back":
      return setAway(state, command.seat, false);
    case "addChips":
      return addChips(state, command.seat, command.amount);
    case "setBlinds":
      return setBlinds(state, command.smallBlind, command.bigBlind);
    case "startHand":
      return startHand(state, command.deck);
    case "act":
      return act(state, command.seat, command.action, command.amount);
  }
}

function sit(state: TableState, index: number, name: string, stack: number): TableState {
  if (!betweenHands(state)) return fail(state, "Players can sit between hands.");
  if (!seatIndex(index)) return fail(state, "That seat does not exist.");
  if (state.seats[index]!.name !== null) return fail(state, "That seat is taken.");
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 16) return fail(state, "Use a name of 1 to 16 characters.");
  if (!wholeChips(stack, 1)) return fail(state, "Stack must be a whole number of chips.");
  const next = cloneState(state);
  next.seats[index] = { ...emptySeat(), name: trimmed, stack };
  next.error = null;
  return next;
}

function leave(state: TableState, index: number): TableState {
  if (!betweenHands(state)) return fail(state, "Players can leave between hands.");
  if (!occupied(state, index)) return fail(state, "That seat is empty.");
  const next = cloneState(state);
  next.seats[index] = emptySeat();
  next.error = null;
  return next;
}

function setAway(state: TableState, index: number, away: boolean): TableState {
  if (!betweenHands(state)) return fail(state, "Sit out between hands.");
  if (!occupied(state, index)) return fail(state, "That seat is empty.");
  const next = cloneState(state);
  next.seats[index]!.away = away;
  next.error = null;
  return next;
}

function addChips(state: TableState, index: number, amount: number): TableState {
  if (!betweenHands(state)) return fail(state, "Chips can be added between hands.");
  if (!occupied(state, index)) return fail(state, "That seat is empty.");
  if (!wholeChips(amount, 1)) return fail(state, "Add a whole number of chips.");
  if (state.seats[index]!.stack + amount > CHIP_CAP) return fail(state, "That stack is too large.");
  const next = cloneState(state);
  next.seats[index]!.stack += amount;
  next.error = null;
  return next;
}

function setBlinds(state: TableState, smallBlind: number, bigBlind: number): TableState {
  if (!betweenHands(state)) return fail(state, "Blinds can be changed between hands.");
  if (!wholeChips(smallBlind, 1) || !wholeChips(bigBlind, 1)) {
    return fail(state, "Blinds must be whole numbers of chips.");
  }
  if (smallBlind > bigBlind) return fail(state, "The small blind cannot exceed the big blind.");
  const next = cloneState(state);
  next.smallBlind = smallBlind;
  next.bigBlind = bigBlind;
  next.minRaise = bigBlind;
  next.error = null;
  return next;
}

function startHand(state: TableState, supplied?: Card[]): TableState {
  if (state.phase === "betting") return fail(state, "A hand is already in progress.");
  const players: number[] = [];
  for (let i = 0; i < SEAT_COUNT; i++) if (eligible(state, i)) players.push(i);
  if (players.length < 2) return fail(state, "Two players with chips are needed to deal.");

  const deck = supplied ? [...supplied] : shuffleDeck();
  const deckError = validateDeck(deck, players.length * 2 + 5);
  if (deckError) return fail(state, deckError);

  const next = cloneState(state);
  next.error = null;
  next.result = null;
  next.board = [];
  next.deck = deck;
  next.handNumber += 1;
  next.street = "preflop";
  next.phase = "betting";
  next.pot = 0;
  next.currentBet = 0;
  next.minRaise = next.bigBlind;
  next.raiseOpen = true;
  next.toAct = null;

  for (const seat of next.seats) {
    seat.hole = [];
    seat.inHand = false;
    seat.folded = false;
    seat.allIn = false;
    seat.streetCommitted = 0;
    seat.handCommitted = 0;
    seat.acted = false;
    seat.lastAction = null;
  }

  const button = next.button === null ? players[0]! : nextIndex(next.button, (i) => eligible(next, i));
  if (button === null) return fail(state, "Two players with chips are needed to deal.");
  next.button = button;

  const ring = clockwise(button, (i) => eligible(next, i));
  const headsUp = ring.length === 2;
  const smallBlindSeat = headsUp ? ring[0]! : ring[1]!;
  const bigBlindSeat = headsUp ? ring[1]! : ring[2]!;
  next.smallBlindSeat = smallBlindSeat;
  next.bigBlindSeat = bigBlindSeat;
  for (const index of ring) next.seats[index]!.inHand = true;

  const dealOrder = clockwise(smallBlindSeat, (i) => next.seats[i]!.inHand);
  for (let round = 0; round < 2; round++) {
    for (const index of dealOrder) next.seats[index]!.hole.push(draw(next));
  }

  postBlind(next, smallBlindSeat, next.smallBlind, "small");
  postBlind(next, bigBlindSeat, next.bigBlind, "big");
  // A call costs a full big blind even when the posted blind was short.
  next.currentBet = next.bigBlind;
  next.minRaise = next.bigBlind;
  next.raiseOpen = true;
  syncPot(next);
  pushLog(next, {
    seat: null,
    name: null,
    action: "deal",
    amount: null,
    raiseTo: null,
    street: "preflop",
    stackAfter: null,
    potAfter: next.pot,
    text: `Hand ${next.handNumber} dealt. Blinds ${next.smallBlind}/${next.bigBlind}.`,
  });

  next.toAct = nextIndex(bigBlindSeat, (i) => needsToAct(next, i));
  if (next.toAct === null) closeBetting(next);
  return next;
}

function act(state: TableState, index: number, action: PlayAction, amount: number | undefined): TableState {
  if (state.phase !== "betting" || state.toAct === null) return fail(state, "No one is to act.");
  if (index !== state.toAct) return fail(state, "It is not that seat's turn.");
  const offered = legalActions(state);
  const match = offered.find((item) => item.action === action);
  if (!match) return fail(state, `${pretty(action)} is not legal now.`);

  let raiseTo: number | null = null;
  if (match.action === "raise") {
    if (!Number.isSafeInteger(amount)) return fail(state, "Enter a whole number of chips.");
    if (amount! < match.min || amount! > match.max) {
      return fail(state, `A raise must be from ${match.min} to ${match.max}.`);
    }
    raiseTo = amount!;
  } else if (match.action === "all_in") {
    raiseTo = match.amount;
  }

  const next = cloneState(state);
  const seat = next.seats[index]!;
  if (match.action === "fold") {
    seat.folded = true;
    seat.acted = true;
    seat.lastAction = "FOLD";
    logPlayer(next, index, "fold", null, null, `${seat.name} folds`);
  } else if (match.action === "check") {
    seat.acted = true;
    seat.lastAction = "CHECK";
    logPlayer(next, index, "check", null, null, `${seat.name} checks`);
  } else if (match.action === "call" || (raiseTo !== null && raiseTo <= next.currentBet)) {
    const pay = Math.min(seat.stack, Math.max(0, next.currentBet - seat.streetCommitted));
    commit(seat, pay);
    seat.acted = true;
    seat.lastAction = seat.allIn ? `CALL ${pay} ALL-IN` : `CALL ${pay}`;
    logPlayer(
      next,
      index,
      seat.allIn ? "all_in" : "call",
      pay,
      seat.streetCommitted,
      seat.allIn ? `${seat.name} calls ${pay} all-in` : `${seat.name} calls ${pay}`,
    );
  } else if (raiseTo !== null) {
    const previousBet = next.currentBet;
    const before = seat.streetCommitted;
    const increment = raiseTo - previousBet;
    const full = increment >= next.minRaise;
    commit(seat, raiseTo - before);
    next.currentBet = raiseTo;
    if (full) {
      next.minRaise = increment;
      next.raiseOpen = true;
      for (const other of next.seats) {
        if (other.inHand && !other.folded && !other.allIn) other.acted = false;
      }
    } else {
      next.raiseOpen = false;
    }
    seat.acted = true;
    const opening = previousBet === 0;
    const kind: LogAction = seat.allIn ? "all_in" : opening ? "bet" : "raise";
    seat.lastAction = seat.allIn ? `ALL-IN ${raiseTo}` : opening ? `BET ${raiseTo}` : `RAISE ${raiseTo}`;
    const verb = seat.allIn ? "is all-in for" : opening ? "bets" : "raises to";
    logPlayer(next, index, kind, raiseTo - before, raiseTo, `${seat.name} ${verb} ${raiseTo}`);
  }

  next.error = null;
  syncPot(next);
  const last = next.log[next.log.length - 1];
  if (last) last.potAfter = next.pot;
  closeOrContinue(next, index);
  return next;
}

function closeOrContinue(state: TableState, actor: number) {
  if (liveCount(state) <= 1) {
    award(state, false);
    return;
  }
  const nextActor = nextIndex(actor, (i) => needsToAct(state, i));
  if (nextActor !== null) {
    state.toAct = nextActor;
    return;
  }
  closeBetting(state);
}

function closeBetting(state: TableState) {
  if (liveCount(state) <= 1) {
    award(state, false);
    return;
  }
  if (canBetCount(state) >= 2 && state.street !== "river") {
    nextStreet(state);
    return;
  }
  if (canBetCount(state) >= 2 && state.street === "river") {
    showdown(state);
    return;
  }
  runOut(state);
  showdown(state);
}

function nextStreet(state: TableState) {
  if (state.street === "preflop") dealBoard(state, 3, "flop");
  else if (state.street === "flop") dealBoard(state, 1, "turn");
  else if (state.street === "turn") dealBoard(state, 1, "river");
  else {
    showdown(state);
    return;
  }
  for (const seat of state.seats) {
    seat.streetCommitted = 0;
    seat.lastAction = null;
    if (seat.inHand && !seat.folded && !seat.allIn) seat.acted = false;
  }
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.raiseOpen = true;
  const actor = state.button === null ? null : nextIndex(state.button, (i) => needsToAct(state, i));
  if (actor === null) {
    closeBetting(state);
    return;
  }
  state.toAct = actor;
}

function runOut(state: TableState) {
  while (state.board.length < 5) {
    if (state.board.length === 0) dealBoard(state, 3, "flop");
    else if (state.board.length === 3) dealBoard(state, 1, "turn");
    else dealBoard(state, 1, "river");
  }
}

function showdown(state: TableState) {
  state.street = "river";
  state.toAct = null;
  award(state, true);
}

function award(state: TableState, showed: boolean) {
  const players: PotPlayer[] = [];
  for (let i = 0; i < SEAT_COUNT; i++) {
    const seat = state.seats[i]!;
    if (!seat.inHand && seat.handCommitted === 0) continue;
    let score: number[] | null = null;
    if (showed && seat.inHand && !seat.folded) {
      score = evaluate([...seat.hole, ...state.board]).score;
    }
    players.push({
      seat: i,
      committed: seat.handCommitted,
      folded: !seat.inHand || seat.folded,
      score,
    });
  }

  const paid = settlePots(state.button ?? 0, players);
  const winners: Winner[] = [];
  for (let i = 0; i < SEAT_COUNT; i++) {
    const chips = paid.get(i) ?? 0;
    if (chips <= 0) continue;
    const seat = state.seats[i]!;
    seat.stack += chips;
    const hand = showed && seat.inHand && !seat.folded ? evaluate([...seat.hole, ...state.board]).description : null;
    winners.push({
      seat: i,
      name: seat.name ?? "Player",
      awarded: chips,
      net: chips - seat.handCommitted,
      hand,
    });
  }
  winners.sort((a, b) => a.seat - b.seat);

  state.result = {
    winners,
    showed,
    board: [...state.board],
    text: resultText(winners),
  };
  state.phase = "complete";
  state.toAct = null;
  syncPot(state);
  pushLog(state, {
    seat: null,
    name: null,
    action: "win",
    amount: null,
    raiseTo: null,
    street: state.street,
    stackAfter: null,
    potAfter: state.pot,
    text: state.result.text,
  });
}

function resultText(winners: Winner[]): string {
  if (winners.length === 0) return "No pot.";
  if (winners.length === 1) {
    const winner = winners[0]!;
    const hand = winner.hand ? ` · ${winner.hand}` : "";
    return `${winner.name} wins ${winner.net}${hand}`;
  }
  return winners
    .map((winner) => {
      const sign = winner.net > 0 ? "+" : "";
      const hand = winner.hand ? ` · ${winner.hand}` : "";
      return `${winner.name} ${sign}${winner.net}${hand}`;
    })
    .join("  ");
}

function postBlind(state: TableState, index: number, amount: number, which: "small" | "big") {
  const seat = state.seats[index]!;
  const pay = Math.min(seat.stack, amount);
  commit(seat, pay);
  syncPot(state);
  const tag = which === "small" ? "SB" : "BB";
  seat.lastAction = seat.allIn ? `${tag} ${pay} ALL-IN` : `${tag} ${pay}`;
  const name = which === "small" ? "small blind" : "big blind";
  logPlayer(
    state,
    index,
    "blind",
    pay,
    seat.streetCommitted,
    seat.allIn ? `${seat.name} posts ${name} ${pay} all-in` : `${seat.name} posts ${name} ${pay}`,
  );
}

function dealBoard(state: TableState, count: number, street: Street) {
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) cards.push(draw(state));
  state.board.push(...cards);
  state.street = street;
  pushLog(state, {
    seat: null,
    name: null,
    action: "deal",
    amount: null,
    raiseTo: null,
    street,
    stackAfter: null,
    potAfter: state.pot,
    text: `${street[0]!.toUpperCase()}${street.slice(1)} ${formatCards(cards)}`,
  });
}

function commit(seat: SeatState, chips: number) {
  if (chips < 0 || chips > seat.stack) throw new Error("Chip commit is out of range.");
  seat.stack -= chips;
  seat.streetCommitted += chips;
  seat.handCommitted += chips;
  if (seat.stack === 0) seat.allIn = true;
}

function canRaise(state: TableState, seat: SeatState): boolean {
  const toCall = state.currentBet - seat.streetCommitted;
  if (seat.stack <= toCall || canBetCount(state) < 2) return false;
  if (seat.acted && !state.raiseOpen && toCall < state.minRaise) return false;
  return true;
}

function needsToAct(state: TableState, index: number): boolean {
  const seat = state.seats[index]!;
  if (!seat.inHand || seat.folded || seat.allIn) return false;
  if (seat.streetCommitted < state.currentBet) return true;
  return !seat.acted;
}

function liveCount(state: TableState): number {
  return state.seats.filter((seat) => seat.inHand && !seat.folded).length;
}

function canBetCount(state: TableState): number {
  return state.seats.filter((seat) => seat.inHand && !seat.folded && !seat.allIn).length;
}

function syncPot(state: TableState) {
  state.pot = state.seats.reduce((sum, seat) => sum + seat.handCommitted, 0);
}

function logPlayer(
  state: TableState,
  index: number,
  action: LogAction,
  amount: number | null,
  raiseTo: number | null,
  text: string,
) {
  const seat = state.seats[index]!;
  pushLog(state, {
    seat: index,
    name: seat.name,
    action,
    amount,
    raiseTo,
    street: state.street,
    stackAfter: seat.stack,
    potAfter: state.pot,
    text,
  });
}

function pushLog(state: TableState, entry: LogEntry) {
  state.log.push(entry);
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}

function draw(state: TableState): Card {
  const card = state.deck.shift();
  if (!card) throw new Error("The deck ran out of cards.");
  return card;
}

function betweenHands(state: TableState): boolean {
  return state.phase === "idle" || state.phase === "complete";
}

function occupied(state: TableState, index: number): boolean {
  return seatIndex(index) && state.seats[index]!.name !== null;
}

function eligible(state: TableState, index: number): boolean {
  const seat = state.seats[index];
  return seat !== undefined && seat.name !== null && !seat.away && seat.stack > 0;
}

function seatIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < SEAT_COUNT;
}

function wholeChips(value: number, min: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= CHIP_CAP;
}

function validateDeck(deck: Card[], needed: number): string | null {
  if (deck.length < needed) return "The deck does not have enough cards.";
  const seen = new Set<string>();
  for (const item of deck) {
    if (!isCard(item)) return "The deck has a card that is not a playing card.";
    if (seen.has(item)) return "The deck has a duplicate card.";
    seen.add(item);
  }
  return null;
}

function nextIndex(from: number, pred: (index: number) => boolean): number | null {
  for (let step = 1; step <= SEAT_COUNT; step++) {
    const index = (from + step) % SEAT_COUNT;
    if (pred(index)) return index;
  }
  return null;
}

function clockwise(start: number, pred: (index: number) => boolean): number[] {
  const indexes: number[] = [];
  for (let step = 0; step < SEAT_COUNT; step++) {
    const index = (start + step) % SEAT_COUNT;
    if (pred(index)) indexes.push(index);
  }
  return indexes;
}

function fail(state: TableState, error: string): TableState {
  if (state.error === error) return state;
  return { ...state, error };
}

function cloneState(state: TableState): TableState {
  return {
    ...state,
    seats: state.seats.map((seat) => ({ ...seat, hole: [...seat.hole] })),
    deck: [...state.deck],
    board: [...state.board],
    log: state.log.map((entry) => ({ ...entry })),
    result: state.result
      ? { ...state.result, winners: state.result.winners.map((winner) => ({ ...winner })), board: [...state.result.board] }
      : null,
    error: null,
  };
}

function pretty(action: PlayAction): string {
  if (action === "all_in") return "All-in";
  return action.charAt(0).toUpperCase() + action.slice(1);
}

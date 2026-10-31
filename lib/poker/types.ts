export const SEAT_COUNT = 8;

export type Suit = "c" | "d" | "h" | "s";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";
export type Card = `${Rank}${Suit}`;

export type Street = "preflop" | "flop" | "turn" | "river";
export type Phase = "idle" | "betting" | "complete";

export type SeatState = {
  name: string | null;
  stack: number;
  away: boolean;
  hole: Card[];
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  streetCommitted: number;
  handCommitted: number;
  acted: boolean;
  lastAction: string | null;
};

export type LogAction =
  | "blind"
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all_in"
  | "deal"
  | "win";

export type LogEntry = {
  seat: number | null;
  name: string | null;
  action: LogAction;
  /** Chips added by this action. Null for check and fold. */
  amount: number | null;
  /** Raise-to total for bet, raise, and all-in. */
  raiseTo: number | null;
  street: Street | null;
  stackAfter: number | null;
  potAfter: number;
  text: string;
};

export type Winner = {
  seat: number;
  name: string;
  /** Chips returned from the pot, including an uncalled bet. */
  awarded: number;
  /** Awarded chips minus what this player put in. */
  net: number;
  hand: string | null;
};

export type HandResult = {
  winners: Winner[];
  showed: boolean;
  board: Card[];
  text: string;
};

export type LegalAction =
  | { action: "fold" }
  | { action: "check" }
  | { action: "call"; amount: number }
  | { action: "raise"; min: number; max: number }
  | { action: "all_in"; amount: number };

export type PlayAction = LegalAction["action"];

export type TableState = {
  seats: SeatState[];
  smallBlind: number;
  bigBlind: number;
  button: number | null;
  smallBlindSeat: number | null;
  bigBlindSeat: number | null;
  handNumber: number;
  street: Street | null;
  deck: Card[];
  board: Card[];
  pot: number;
  /** Chips a player must have committed this street to match the bet. */
  currentBet: number;
  /** Minimum increase of a full bet or raise on this street. */
  minRaise: number;
  /** False after a short all-in. Players who already acted cannot raise. */
  raiseOpen: boolean;
  toAct: number | null;
  phase: Phase;
  log: LogEntry[];
  result: HandResult | null;
  error: string | null;
};

export type Command =
  | { type: "sit"; seat: number; name: string; stack: number }
  | { type: "leave"; seat: number }
  | { type: "away"; seat: number }
  | { type: "back"; seat: number }
  | { type: "addChips"; seat: number; amount: number }
  | { type: "setBlinds"; smallBlind: number; bigBlind: number }
  | { type: "startHand"; deck?: Card[] }
  | { type: "act"; seat: number; action: PlayAction; amount?: number };

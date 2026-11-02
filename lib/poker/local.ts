import { readBotAction } from "./bot";
import type { BotNote } from "./bot";
import { apply, createTable, legalActions } from "./engine";
import { ACTION_MS, BOT_THINK_MS, STREET_PAUSE_MS } from "./timing";
import { SEAT_COUNT, type Command, type TableState } from "./types";
import { projectForPlayer } from "./view";

export type LocalSession = {
  table: TableState;
  revealed: boolean;
  bots: boolean[];
  botNotes: BotNote[];
  streetKey: string | null;
  streetReadyAt: number | null;
  turnKey: string | null;
  turnSeenAt: number | null;
  botAttempt: string | null;
};

export type LocalAction =
  | Command
  | { type: "reveal" }
  | { type: "seatBot"; seat: number; name: string; stack: number }
  | { type: "botTick"; now: number };

export function createLocalSession(): LocalSession {
  return {
    table: createTable(),
    revealed: false,
    bots: Array.from({ length: SEAT_COUNT }, () => false),
    botNotes: [],
    streetKey: null,
    streetReadyAt: null,
    turnKey: null,
    turnSeenAt: null,
    botAttempt: null,
  };
}

export function reduceLocal(session: LocalSession, action: LocalAction): LocalSession {
  if (action.type === "botTick") return tick(session, action.now);
  if (action.type === "reveal") {
    if (session.table.toAct !== null && session.bots[session.table.toAct]) return session;
    return { ...session, revealed: true };
  }
  if (action.type === "seatBot") return seatBot(session, action);
  if (action.type === "act" && session.bots[action.seat]) {
    return { ...session, table: { ...session.table, error: "That seat plays itself." } };
  }
  if (action.type === "leave") {
    const table = apply(session.table, action);
    if (table.error) return { ...session, table };
    const bots = session.bots.slice();
    bots[action.seat] = false;
    return moved(session, table, bots);
  }
  return moved(session, apply(session.table, action), session.bots);
}

/** When the seated bot should act. Null while a person is to act, or before the clock starts. */
export function botActAt(session: LocalSession): number | null {
  const seat = session.table.toAct;
  if (session.table.phase !== "betting" || seat === null || !session.bots[seat]) return null;
  if (session.streetReadyAt === null || session.turnSeenAt === null) return null;
  return Math.max(session.turnSeenAt, session.streetReadyAt) + BOT_THINK_MS;
}

function seatBot(session: LocalSession, action: { seat: number; name: string; stack: number }): LocalSession {
  if (session.bots.filter(Boolean).length >= 7) {
    return { ...session, table: { ...session.table, error: "Seven bots is the limit." } };
  }
  const table = apply(session.table, { type: "sit", seat: action.seat, name: action.name, stack: action.stack });
  if (table.error) return { ...session, table };
  const bots = session.bots.slice();
  bots[action.seat] = true;
  return moved(session, table, bots);
}

function moved(session: LocalSession, table: TableState, bots: boolean[]): LocalSession {
  const sameActor =
    table.phase === "betting" &&
    table.toAct !== null &&
    table.toAct === session.table.toAct &&
    table.handNumber === session.table.handNumber &&
    table.street === session.table.street;
  return {
    ...session,
    table,
    bots,
    revealed: sameActor ? session.revealed : false,
    botNotes: table.handNumber === session.table.handNumber ? session.botNotes : [],
  };
}

function tick(session: LocalSession, now: number): LocalSession {
  const table = session.table;
  if (table.phase !== "betting" || table.toAct === null) return session;
  const streetKey = `${table.handNumber}:${table.street}`;
  const streetReadyAt = session.streetKey === streetKey && session.streetReadyAt !== null ? session.streetReadyAt : now + STREET_PAUSE_MS;
  const turnKey = `${streetKey}:${table.toAct}`;
  const turnSeenAt = session.turnKey === turnKey && session.turnSeenAt !== null ? session.turnSeenAt : now;
  const clocksSame =
    session.streetKey === streetKey &&
    session.streetReadyAt === streetReadyAt &&
    session.turnKey === turnKey &&
    session.turnSeenAt === turnSeenAt;
  const base = clocksSame ? session : { ...session, streetKey, streetReadyAt, turnKey, turnSeenAt };
  if (!session.bots[table.toAct]) return base;

  const openAt = Math.max(turnSeenAt, streetReadyAt);
  if (now < openAt + BOT_THINK_MS) return base;
  if (session.botAttempt === turnKey) {
    if (now >= openAt + ACTION_MS) return timedOut(base, table.toAct, now);
    return base;
  }

  const decision = readBotAction(projectForPlayer(table, table.toAct));
  if (!decision) {
    const failed = { ...base, botAttempt: turnKey };
    if (now >= openAt + ACTION_MS) return timedOut(failed, table.toAct, now);
    return failed;
  }
  const next = apply(table, { type: "act", seat: table.toAct, action: decision.action, amount: decision.amount });
  if (next.error) return { ...base, botAttempt: turnKey };
  return afterBot(base, next, table.toAct, decision.reason, now);
}

function timedOut(session: LocalSession, seat: number, now: number): LocalSession {
  const offered = legalActions(session.table);
  const action = offered.some((item) => item.action === "check") ? "check" : offered.some((item) => item.action === "fold") ? "fold" : null;
  if (action === null) return session;
  const next = apply(session.table, { type: "act", seat, action });
  if (next.error) return session;
  return afterBot(session, next, seat, "Timed out.", now);
}

function afterBot(session: LocalSession, table: TableState, seat: number, text: string, now: number): LocalSession {
  const note: BotNote = { handNumber: table.handNumber, at: table.log.length, seat, text };
  const notes = table.handNumber === session.table.handNumber ? [...session.botNotes, note] : [note];
  const streetKey = table.phase === "betting" ? `${table.handNumber}:${table.street}` : null;
  const turnKey = table.phase === "betting" && table.toAct !== null ? `${streetKey}:${table.toAct}` : null;
  const newStreet = streetKey !== null && streetKey !== session.streetKey;
  return {
    ...session,
    table,
    revealed: false,
    botNotes: notes,
    botAttempt: null,
    streetKey,
    streetReadyAt: streetKey === null ? null : newStreet ? now + STREET_PAUSE_MS : session.streetReadyAt,
    turnKey,
    turnSeenAt: turnKey === null ? null : now,
  };
}

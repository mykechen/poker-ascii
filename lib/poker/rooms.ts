import { randomBytes, randomInt } from "node:crypto";
import { apply, createTable } from "./engine";
import type { Command, PlayAction, TableState } from "./types";
import { projectForPlayer, type PublicView } from "./view";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const ACTIONS: readonly PlayAction[] = ["fold", "check", "call", "raise", "all_in"];

export type RoomSnapshot = {
  code: string;
  version: number;
  you: number | null;
  view: PublicView;
};

export type RoomResult = RoomSnapshot & { token: string };

type Waiter = {
  resolve: (room: Room) => void;
};

type Room = {
  code: string;
  table: TableState;
  version: number;
  updatedAt: number;
  seats: Map<string, number | null>;
  waiters: Waiter[];
};

type Store = Map<string, Room>;

function store(): Store {
  const globalStore = globalThis as typeof globalThis & { __nlheRooms?: Store };
  if (!globalStore.__nlheRooms) globalStore.__nlheRooms = new Map();
  return globalStore.__nlheRooms;
}

export function resetRooms(): void {
  store().clear();
}

export function normalizeCode(value: string): string | null {
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 4 || code.length > 6) return null;
  return code;
}

export function openTable(input: {
  smallBlind: number;
  bigBlind: number;
  name: string;
  stack: number;
  seat?: number;
}): RoomResult | { error: string } {
  prune();
  const room = blankRoom();
  const blinds = apply(room.table, {
    type: "setBlinds",
    smallBlind: input.smallBlind,
    bigBlind: input.bigBlind,
  });
  if (blinds.error) return { error: blinds.error };
  room.table = blinds;
  const token = mintToken();
  const sat = sitToken(room, token, {
    type: "sit",
    seat: input.seat ?? 0,
    name: input.name,
    stack: input.stack,
  });
  if ("error" in sat) return sat;
  store().set(room.code, room);
  return { token, ...snapshot(room, token) };
}

export function readSnapshot(code: string, token: string | null): RoomSnapshot | null {
  prune();
  const room = store().get(code);
  if (!room) return null;
  return snapshot(room, token);
}

export function waitForSnapshot(
  code: string,
  token: string | null,
  since: number,
  timeoutMs: number,
): Promise<RoomSnapshot | null> {
  const room = store().get(code);
  if (!room) return Promise.resolve(null);
  if (room.version !== since) return Promise.resolve(snapshot(room, token));

  return new Promise((resolve) => {
    let settled = false;
    const waiter: Waiter = {
      resolve: (next) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(snapshot(next, token));
      },
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      room.waiters = room.waiters.filter((item) => item !== waiter);
      const current = store().get(code);
      resolve(current ? snapshot(current, token) : null);
    }, timeoutMs);
    room.waiters.push(waiter);
  });
}

export function perform(code: string, token: string | null, command: Command): RoomResult | { error: string } {
  prune();
  const room = store().get(code);
  if (!room) return { error: "No table with that code." };

  const playerToken = token ?? mintToken();
  const known = room.seats.has(playerToken);
  if (!known && command.type !== "sit") return { error: "Sit down before you act." };

  const seat = room.seats.get(playerToken) ?? null;
  if (command.type === "startHand") {
    if (seat === null) return { error: "Sit down before you deal." };
    return commit(room, playerToken, { type: "startHand" });
  }
  if (command.type === "setBlinds") {
    if (seat === null) return { error: "Sit down before you change the blinds." };
    return commit(room, playerToken, command);
  }
  if (command.type === "sit") {
    if (seat !== null) return { error: "You already have a seat." };
    return sitToken(room, playerToken, command);
  }
  if (seat === null) return { error: "Sit down before you act." };

  if (command.type === "leave") {
    const result = commit(room, playerToken, { type: "leave", seat });
    if (!("error" in result)) room.seats.set(playerToken, null);
    return result;
  }
  if (command.type === "away" || command.type === "back" || command.type === "addChips") {
    return commit(room, playerToken, { ...command, seat });
  }
  if (command.type === "act") {
    return commit(room, playerToken, { type: "act", seat, action: command.action, amount: command.amount });
  }
  return { error: "That action is not part of the table." };
}

export function parseCommand(value: unknown): Command | { error: string } {
  if (!value || typeof value !== "object") return { error: "Send a table action." };
  const command = value as Record<string, unknown>;
  switch (command.type) {
    case "sit":
      if (typeof command.name !== "string" || !whole(command.stack) || !whole(command.seat)) {
        return { error: "A seat needs a name, a stack, and a seat number." };
      }
      return { type: "sit", name: command.name, stack: command.stack, seat: command.seat };
    case "leave":
      return { type: "leave", seat: 0 };
    case "away":
      return { type: "away", seat: 0 };
    case "back":
      return { type: "back", seat: 0 };
    case "addChips":
      if (!whole(command.amount)) return { error: "Add a whole number of chips." };
      return { type: "addChips", seat: 0, amount: command.amount };
    case "setBlinds":
      if (!whole(command.smallBlind) || !whole(command.bigBlind)) {
        return { error: "Blinds must be whole numbers of chips." };
      }
      return { type: "setBlinds", smallBlind: command.smallBlind, bigBlind: command.bigBlind };
    case "startHand":
      return { type: "startHand" };
    case "act":
      if (typeof command.action !== "string" || !ACTIONS.includes(command.action as PlayAction)) {
        return { error: "That action is not part of the table." };
      }
      return {
        type: "act",
        seat: 0,
        action: command.action as PlayAction,
        amount: whole(command.amount) ? command.amount : undefined,
      };
    default:
      return { error: "That action is not part of the table." };
  }
}

function sitToken(room: Room, token: string, command: Extract<Command, { type: "sit" }>): RoomResult | { error: string } {
  const next = apply(room.table, command);
  if (next.error) return { error: next.error };
  room.table = next;
  room.seats.set(token, command.seat);
  publish(room);
  return { token, ...snapshot(room, token) };
}

function commit(room: Room, token: string, command: Command): RoomResult | { error: string } {
  const next = apply(room.table, command);
  if (next.error) return { error: next.error };
  room.table = next;
  publish(room);
  return { token, ...snapshot(room, token) };
}

function snapshot(room: Room, token: string | null): RoomSnapshot {
  const you = token ? room.seats.get(token) ?? null : null;
  const view = projectForPlayer(room.table, you);
  return { code: room.code, version: room.version, you, view };
}

function publish(room: Room) {
  room.version += 1;
  room.updatedAt = Date.now();
  const waiters = room.waiters;
  room.waiters = [];
  for (const waiter of waiters) waiter.resolve(room);
}

function blankRoom(): Room {
  let code = "";
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  } while (store().has(code));
  return {
    code,
    table: createTable(),
    version: 0,
    updatedAt: Date.now(),
    seats: new Map(),
    waiters: [],
  };
}

function mintToken(): string {
  return randomBytes(24).toString("base64url");
}

function prune() {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [code, room] of store()) {
    if (room.updatedAt < cutoff) store().delete(code);
  }
}

function whole(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

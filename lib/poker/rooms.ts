import { randomBytes, randomInt } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readBotAction, type BotNote, type Policy } from "./bot";
import { liveBotAction, nextOpening } from "./live-bot";
import { legalActions, apply, createTable } from "./engine";
import { ACTION_MS, BETWEEN_HANDS_MS, BOT_THINK_MS, STREET_PAUSE_MS } from "./timing";
import { SEAT_COUNT, type Command, type PlayAction, type TableState } from "./types";
import { projectForPlayer, type PublicView } from "./view";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const ACTIONS: readonly PlayAction[] = ["fold", "check", "call", "raise", "all_in"];

export { ACTION_MS, BETWEEN_HANDS_MS, STREET_PAUSE_MS };

/** Null plays the table bot (v1 with range-defense river sizing). Tests swap in a policy; the table still rejects anything outside the menu. */
let botPolicy: Policy | null = null;

export function setBotPolicy(next: Policy | null): void {
  botPolicy = next;
}

export type RoomCommand = Command | { type: "boot"; seat: number } | { type: "seatBot"; seat: number; name: string; stack: number };

export type RoomClock = {
  pauseMs: number;
  remainMs: number | null;
  dealMs: number | null;
  /** Milliseconds until a bot seat acts. Null when a person is to act. */
  botMs: number | null;
};

export type RoomSnapshot = {
  code: string;
  version: number;
  you: number | null;
  host: boolean;
  known: boolean;
  seatKey: string | null;
  clock: RoomClock;
  view: PublicView;
  bots: boolean[];
  botNotes: BotNote[];
};

export type RoomResult = RoomSnapshot & { token: string };

type Waiter = {
  resolve: (room: Room) => void;
};

type Room = {
  code: string;
  table: TableState;
  /** The table right after this hand was dealt. The bot replays the hand from here. */
  handOpening: TableState | null;
  version: number;
  updatedAt: number;
  hostToken: string;
  seats: Map<string, number | null>;
  waiters: Waiter[];
  timer?: ReturnType<typeof setTimeout>;
  actNotBefore: number | null;
  actDeadline: number | null;
  dealAt: number | null;
  notifiedPause: number | null;
  bots: Set<number>;
  botNotes: BotNote[];
  /** Set when a bot already failed this turn, so the timeout can stand. */
  botAttempt: string | null;
};

type Runtime = {
  rooms: Map<string, Room>;
  /** Undefined uses the default file outside tests. Null keeps rooms in memory. */
  fileOverride: string | null | undefined;
  loaded: boolean;
  now: () => number;
};

function runtime(): Runtime {
  const globalRuntime = globalThis as typeof globalThis & { __nlhe?: Runtime };
  if (!globalRuntime.__nlhe) {
    globalRuntime.__nlhe = {
      rooms: new Map(),
      fileOverride: undefined,
      loaded: false,
      now: () => Date.now(),
    };
  }
  return globalRuntime.__nlhe;
}

function sharedRedis(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

function persistenceFile(): string | null {
  const current = runtime();
  if (current.fileOverride !== undefined) return current.fileOverride;
  if (process.env.VITEST || sharedRedis() || process.env.VERCEL) return null;
  return path.join(process.cwd(), "data", "rooms.json");
}

const ROOMS_KEY = "nlhe:rooms";

/** Load every table from the shared store. No-op when this process keeps the file itself. */
export async function pullSharedRooms(): Promise<void> {
  const redis = sharedRedis();
  if (!redis) return;
  const raw = await redisCommand(redis, ["GET", ROOMS_KEY]);
  const current = runtime();
  current.loaded = true;
  current.rooms.clear();
  if (typeof raw !== "string" || raw.length === 0) return;
  const parsed = JSON.parse(raw) as { rooms?: SerializedRoom[] };
  for (const item of parsed.rooms ?? []) {
    const room = deserialize(item);
    current.rooms.set(room.code, room);
  }
}

/** Write every table to the shared store. No-op when this process keeps the file itself. */
export async function pushSharedRooms(): Promise<void> {
  const redis = sharedRedis();
  if (!redis) return;
  const payload = JSON.stringify({ rooms: [...runtime().rooms.values()].map(serialize) });
  await redisCommand(redis, ["SET", ROOMS_KEY, payload]);
}

async function redisCommand(redis: { url: string; token: string }, command: string[]): Promise<unknown> {
  const response = await fetch(redis.url, {
    method: "POST",
    headers: { authorization: `Bearer ${redis.token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Shared table store returned ${response.status}.`);
  const body = (await response.json()) as { result?: unknown };
  return body.result;
}

export function resetRooms(): void {
  const current = runtime();
  for (const room of current.rooms.values()) {
    if (room.timer) clearTimeout(room.timer);
  }
  current.rooms.clear();
  current.fileOverride = null;
  current.loaded = true;
  current.now = () => Date.now();
  botPolicy = null;
}

export function configureRooms(options: { file: string | null }): void {
  const current = runtime();
  for (const room of current.rooms.values()) {
    if (room.timer) clearTimeout(room.timer);
  }
  current.rooms.clear();
  current.fileOverride = options.file;
  current.loaded = false;
  current.now = () => Date.now();
}

export function reloadRooms(): void {
  const current = runtime();
  for (const room of current.rooms.values()) {
    if (room.timer) clearTimeout(room.timer);
  }
  current.rooms.clear();
  current.loaded = false;
}

export function freezeRooms(at = 1_700_000_000_000): void {
  runtime().now = () => at;
}

export function advanceRooms(ms: number): void {
  const current = runtime();
  const at = current.now() + ms;
  current.now = () => at;
  for (const room of ready().values()) sync(room);
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
  room.hostToken = token;
  ready().set(room.code, room);
  const sat = sitToken(room, token, {
    type: "sit",
    seat: input.seat ?? 0,
    name: input.name,
    stack: input.stack,
  });
  if ("error" in sat) {
    ready().delete(room.code);
    save();
    return sat;
  }
  return sat;
}

export function readSnapshot(code: string, token: string | null): RoomSnapshot | null {
  prune();
  const room = ready().get(code);
  if (!room) return null;
  sync(room);
  return snapshot(room, token);
}

export function waitForSnapshot(
  code: string,
  token: string | null,
  since: number,
  timeoutMs: number,
): Promise<RoomSnapshot | null> {
  const room = ready().get(code);
  if (!room) return Promise.resolve(null);
  sync(room);
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
      const current = ready().get(code);
      resolve(current ? snapshot(current, token) : null);
    }, timeoutMs);
    room.waiters.push(waiter);
  });
}

export function perform(code: string, token: string | null, command: RoomCommand): RoomResult | { error: string } {
  prune();
  const room = ready().get(code);
  if (!room) return { error: "No table with that code." };
  sync(room);

  const playerToken = token ?? mintToken();
  const known = room.seats.has(playerToken);
  if (!known && command.type !== "sit") return { error: "Sit down before you act." };

  const seat = room.seats.get(playerToken) ?? null;
  if (command.type === "seatBot") return seatBot(room, playerToken, command);
  if (command.type === "boot") return boot(room, playerToken, command.seat);
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
  if (command.type === "act" && room.actNotBefore !== null && runtime().now() < room.actNotBefore) {
    return { error: "Wait for the street." };
  }

  if (command.type === "leave") {
    const wasBot = room.bots.has(seat);
    const result = commit(room, playerToken, { type: "leave", seat });
    if (!("error" in result)) {
      room.seats.set(playerToken, null);
      if (wasBot) {
        room.bots.delete(seat);
        publish(room);
        return { token: playerToken, ...snapshot(room, playerToken) };
      }
    }
    return result;
  }
  if (command.type === "away" || command.type === "back" || command.type === "addChips") {
    const resolved = actedSeat(room, playerToken, command.seat);
    if (typeof resolved !== "number") return resolved;
    return commit(room, playerToken, { ...command, seat: resolved });
  }
  if (command.type === "act") {
    return commit(room, playerToken, { type: "act", seat, action: command.action, amount: command.amount });
  }
  return { error: "That action is not part of the table." };
}

export function parseCommand(value: unknown): RoomCommand | { error: string } {
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
      return { type: "away", seat: requestedSeat(command.seat) };
    case "back":
      return { type: "back", seat: requestedSeat(command.seat) };
    case "addChips":
      if (!whole(command.amount)) return { error: "Add a whole number of chips." };
      return { type: "addChips", seat: requestedSeat(command.seat), amount: command.amount };
    case "seatBot":
      if (typeof command.name !== "string" || !whole(command.stack) || !whole(command.seat)) {
        return { error: "A seat needs a name, a stack, and a seat number." };
      }
      return { type: "seatBot", name: command.name, stack: command.stack, seat: command.seat };
    case "setBlinds":
      if (!whole(command.smallBlind) || !whole(command.bigBlind)) {
        return { error: "Blinds must be whole numbers of chips." };
      }
      return { type: "setBlinds", smallBlind: command.smallBlind, bigBlind: command.bigBlind };
    case "startHand":
      return { type: "startHand" };
    case "boot":
      if (!whole(command.seat)) return { error: "Choose a seat to clear." };
      return { type: "boot", seat: command.seat };
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

function boot(room: Room, token: string, seat: number): RoomResult | { error: string } {
  if (token !== room.hostToken) return { error: "Only the player who opened the table can clear a seat." };
  if (room.table.phase === "betting") return { error: "Clear a seat between hands." };
  const seated = [...room.seats.entries()].find(([, index]) => index === seat);
  if (!seated) return { error: "That seat is empty." };
  const before = room.table;
  const next = apply(room.table, { type: "leave", seat });
  if (next.error) return { error: next.error };
  room.table = next;
  room.seats.set(seated[0], null);
  room.bots.delete(seat);
  follow(room, before, next);
  publish(room);
  return { token, ...snapshot(room, token) };
}

function seatBot(
  room: Room,
  token: string,
  command: { seat: number; name: string; stack: number },
): RoomResult | { error: string } {
  if (token !== room.hostToken) return { error: "Only the player who opened the table can seat a bot." };
  if (room.bots.size >= 7) return { error: "Seven bots is the limit." };
  const before = room.table;
  const next = apply(room.table, { type: "sit", seat: command.seat, name: command.name, stack: command.stack });
  if (next.error) return { error: next.error };
  room.table = next;
  room.seats.set(mintToken(), command.seat);
  room.bots.add(command.seat);
  follow(room, before, next);
  publish(room);
  return { token, ...snapshot(room, token) };
}

function actedSeat(room: Room, token: string, requested: number): number | { error: string } {
  const own = room.seats.get(token) ?? null;
  if (requested < 0) {
    if (own === null) return { error: "Sit down before you act." };
    return own;
  }
  if (own === requested) return requested;
  if (token === room.hostToken && room.bots.has(requested)) return requested;
  return { error: "That seat is not a bot." };
}

function requestedSeat(value: unknown): number {
  return whole(value) ? value : -1;
}

function sitToken(room: Room, token: string, command: Extract<Command, { type: "sit" }>): RoomResult | { error: string } {
  const before = room.table;
  const next = apply(room.table, command);
  if (next.error) return { error: next.error };
  room.table = next;
  room.seats.set(token, command.seat);
  follow(room, before, next);
  publish(room);
  return { token, ...snapshot(room, token) };
}

function commit(room: Room, token: string, command: Command): RoomResult | { error: string } {
  const before = room.table;
  const next = apply(room.table, command);
  if (next.error) return { error: next.error };
  room.table = next;
  follow(room, before, next);
  publish(room);
  return { token, ...snapshot(room, token) };
}

function follow(room: Room, before: TableState, after: TableState) {
  const now = runtime().now();
  if (before.handNumber !== after.handNumber) room.botNotes = [];
  room.handOpening = nextOpening(room.handOpening, before, after);
  if (after.phase === "complete") {
    room.actNotBefore = null;
    room.actDeadline = null;
    room.notifiedPause = null;
    room.dealAt = now + BETWEEN_HANDS_MS;
    return;
  }
  if (after.phase === "betting" && after.toAct !== null) {
    const newStreet = before.handNumber !== after.handNumber || before.street !== after.street || before.phase !== "betting";
    const pause = newStreet ? STREET_PAUSE_MS : 0;
    room.actNotBefore = now + pause;
    room.actDeadline = room.actNotBefore + ACTION_MS;
    room.dealAt = null;
    room.notifiedPause = pause === 0 ? room.actNotBefore : null;
    return;
  }
  room.actNotBefore = null;
  room.actDeadline = null;
  room.notifiedPause = null;
  room.dealAt = null;
}

function sync(room: Room) {
  let changed = false;
  for (let step = 0; step < 30; step++) {
    const now = runtime().now();
    if (room.dealAt !== null && now >= room.dealAt && room.table.phase !== "betting") {
      const before = room.table;
      const next = apply(room.table, { type: "startHand" });
      room.dealAt = null;
      changed = true;
      if (!next.error) {
        room.table = next;
        follow(room, before, next);
        continue;
      }
      continue;
    }
    if (takeBotAction(room, now)) {
      changed = true;
      continue;
    }
    const waiting =
      room.table.phase === "betting" &&
      room.table.toAct !== null &&
      room.actDeadline !== null &&
      room.actNotBefore !== null &&
      now >= room.actDeadline &&
      now >= room.actNotBefore;
    if (waiting) {
      const seat = room.table.toAct!;
      const offered = legalActions(room.table);
      const action = offered.some((item) => item.action === "check")
        ? "check"
        : offered.some((item) => item.action === "fold")
          ? "fold"
          : null;
      if (action === null) {
        room.actDeadline = null;
        break;
      }
      const before = room.table;
      const next = apply(room.table, { type: "act", seat, action });
      if (next.error) {
        room.actDeadline = null;
        break;
      }
      room.table = next;
      if (room.bots.has(seat)) {
        room.botNotes.push({ handNumber: next.handNumber, at: next.log.length, seat, text: "Timed out." });
      }
      follow(room, before, next);
      changed = true;
      continue;
    }
    break;
  }

  const now = runtime().now();
  const pauseOpened =
    room.table.phase === "betting" &&
    room.actNotBefore !== null &&
    room.notifiedPause !== room.actNotBefore &&
    now >= room.actNotBefore;
  if (pauseOpened) {
    room.notifiedPause = room.actNotBefore;
    changed = true;
  }
  if (changed) publish(room);
  else arm(room);
}

function snapshot(room: Room, token: string | null): RoomSnapshot {
  const now = runtime().now();
  const you = token ? (room.seats.get(token) ?? null) : null;
  const view = projectForPlayer(room.table, you);
  const pauseMs =
    room.table.phase === "betting" && room.actNotBefore !== null ? Math.max(0, room.actNotBefore - now) : 0;
  if (pauseMs > 0) {
    view.validActions = [];
    view.presets = null;
  }
  const remainMs =
    pauseMs === 0 && room.table.phase === "betting" && room.actDeadline !== null
      ? Math.max(0, room.actDeadline - now)
      : null;
  const dealMs =
    room.dealAt !== null && room.table.phase !== "betting" ? Math.max(0, room.dealAt - now) : null;
  const botDue =
    room.table.phase === "betting" &&
    room.table.toAct !== null &&
    room.bots.has(room.table.toAct) &&
    room.actNotBefore !== null;
  const botMs = botDue ? Math.max(0, room.actNotBefore! + BOT_THINK_MS - now) : null;
  return {
    code: room.code,
    version: room.version,
    you,
    host: token !== null && token === room.hostToken,
    known: token !== null && room.seats.has(token),
    seatKey: you !== null && token !== null ? token : null,
    clock: { pauseMs, remainMs, dealMs, botMs },
    view,
    bots: Array.from({ length: SEAT_COUNT }, (_, index) => room.bots.has(index)),
    botNotes: room.botNotes.filter((note) => note.handNumber === room.table.handNumber),
  };
}

function takeBotAction(room: Room, now: number): boolean {
  const seat = room.table.toAct;
  if (room.table.phase !== "betting" || seat === null || !room.bots.has(seat)) return false;
  if (room.actNotBefore === null || now < room.actNotBefore + BOT_THINK_MS) return false;
  const key = `${room.table.handNumber}:${room.table.street}:${seat}`;
  if (room.botAttempt === key) return false;
  room.botAttempt = key;
  const decision = botPolicy
    ? readBotAction(projectForPlayer(room.table, seat), botPolicy)
    : liveBotAction(room.handOpening, room.table, seat);
  if (!decision) {
    console.error("Bot did not return a legal action.", seat);
    return false;
  }
  const before = room.table;
  const next = apply(room.table, { type: "act", seat, action: decision.action, amount: decision.amount });
  if (next.error) {
    console.error("Bot action was rejected.", seat);
    return false;
  }
  room.table = next;
  room.botNotes.push({ handNumber: next.handNumber, at: next.log.length, seat, text: decision.reason });
  room.botAttempt = null;
  follow(room, before, next);
  return true;
}

function publish(room: Room) {
  room.version += 1;
  room.updatedAt = runtime().now();
  const waiters = room.waiters;
  room.waiters = [];
  for (const waiter of waiters) waiter.resolve(room);
  arm(room);
  save();
}

function arm(room: Room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = undefined;
  if (process.env.VITEST) return;
  const now = runtime().now();
  const times: number[] = [];
  if (room.dealAt !== null && room.dealAt > now) times.push(room.dealAt);
  if (room.actDeadline !== null && room.actDeadline > now) times.push(room.actDeadline);
  if (room.actNotBefore !== null && room.notifiedPause !== room.actNotBefore && room.actNotBefore > now) {
    times.push(room.actNotBefore);
  }
  if (
    room.table.phase === "betting" &&
    room.table.toAct !== null &&
    room.bots.has(room.table.toAct) &&
    room.actNotBefore !== null
  ) {
    const botAt = room.actNotBefore + BOT_THINK_MS;
    if (botAt > now) times.push(botAt);
  }
  if (times.length === 0) return;
  const delay = Math.max(0, Math.min(...times) - now);
  room.timer = setTimeout(() => {
    room.timer = undefined;
    sync(room);
  }, delay);
  room.timer.unref?.();
}

function blankRoom(): Room {
  let code = "";
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  } while (ready().has(code));
  return {
    code,
    table: createTable(),
    handOpening: null,
    version: 0,
    updatedAt: runtime().now(),
    hostToken: "",
    seats: new Map(),
    waiters: [],
    actNotBefore: null,
    actDeadline: null,
    dealAt: null,
    notifiedPause: null,
    bots: new Set(),
    botNotes: [],
    botAttempt: null,
  };
}

function mintToken(): string {
  return randomBytes(24).toString("base64url");
}

function prune() {
  const cutoff = runtime().now() - ROOM_TTL_MS;
  let removed = false;
  for (const [code, room] of ready()) {
    if (room.updatedAt < cutoff) {
      if (room.timer) clearTimeout(room.timer);
      ready().delete(code);
      removed = true;
    }
  }
  if (removed) save();
}

function ready(): Map<string, Room> {
  const current = runtime();
  if (!current.loaded) {
    current.loaded = true;
    const file = persistenceFile();
    if (file) loadFile(file, current.rooms);
  }
  return current.rooms;
}

function loadFile(file: string, rooms: Map<string, Room>) {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { rooms?: SerializedRoom[] };
    for (const item of parsed.rooms ?? []) {
      const room = deserialize(item);
      rooms.set(room.code, room);
      arm(room);
    }
  } catch (error) {
    const missing = error && typeof error === "object" && "code" in error && error.code === "ENOENT";
    if (!missing) console.error("Could not read saved tables.", error);
  }
}

function save() {
  const file = persistenceFile();
  if (!file) return;
  const payload = {
    rooms: [...runtime().rooms.values()].map(serialize),
  };
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    writeFileSync(temporary, JSON.stringify(payload));
    renameSync(temporary, file);
  } catch (error) {
    console.error("Could not save tables to disk.", error);
  }
}

type SerializedRoom = {
  code: string;
  table: TableState;
  handOpening?: TableState | null;
  version: number;
  updatedAt: number;
  hostToken: string;
  seats: [string, number | null][];
  actNotBefore: number | null;
  actDeadline: number | null;
  dealAt: number | null;
  notifiedPause: number | null;
  bots?: number[];
  botNotes?: BotNote[];
};

function serialize(room: Room): SerializedRoom {
  return {
    code: room.code,
    table: room.table,
    handOpening: room.handOpening,
    version: room.version,
    updatedAt: room.updatedAt,
    hostToken: room.hostToken,
    seats: [...room.seats.entries()],
    actNotBefore: room.actNotBefore,
    actDeadline: room.actDeadline,
    dealAt: room.dealAt,
    notifiedPause: room.notifiedPause,
    bots: [...room.bots],
    botNotes: room.botNotes,
  };
}

function deserialize(item: SerializedRoom): Room {
  const bots = (item.bots ?? []).filter((seat) => item.table.seats[seat]?.name);
  return {
    code: item.code,
    table: item.table,
    handOpening: item.handOpening ?? null,
    version: item.version,
    updatedAt: item.updatedAt,
    hostToken: item.hostToken,
    seats: new Map(item.seats),
    waiters: [],
    actNotBefore: item.actNotBefore,
    actDeadline: item.actDeadline,
    dealAt: item.dealAt,
    notifiedPause: item.notifiedPause,
    bots: new Set(bots),
    botNotes: item.botNotes ?? [],
    botAttempt: null,
  };
}

function whole(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

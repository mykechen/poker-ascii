import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { describePots } from "./pots";
import { BOT_THINK_MS } from "./timing";
import type { Command } from "./types";
import {
  ACTION_MS,
  BETWEEN_HANDS_MS,
  STREET_PAUSE_MS,
  advanceRooms,
  configureRooms,
  freezeRooms,
  openTable,
  perform,
  readSnapshot,
  reloadRooms,
  resetRooms,
  setBotPolicy,
  waitForSnapshot,
} from "./rooms";

beforeEach(() => {
  resetRooms();
});

describe("shared tables", () => {
  it("shows each player only their own cards, and buttons only on their turn", () => {
    const host = open("Ada");
    const guest = perform(host.code, null, { type: "sit", seat: 1, name: "Bo", stack: 200 });
    expect("error" in guest).toBe(false);
    if ("error" in guest) return;

    freezeRooms();
    const dealt = perform(host.code, host.token, { type: "startHand" });
    expect("error" in dealt).toBe(false);
    expect(readSnapshot(host.code, host.token)!.view.validActions).toEqual([]);
    advanceRooms(STREET_PAUSE_MS);

    const ada = readSnapshot(host.code, host.token)!;
    const bo = readSnapshot(host.code, guest.token)!;
    const crowd = readSnapshot(host.code, null)!;

    expect(ada.you).toBe(0);
    expect(bo.you).toBe(1);
    expect(ada.view.seats[0]!.hole).not.toBe("down");
    expect(ada.view.seats[1]!.hole).toBe("down");
    expect(bo.view.seats[1]!.hole).not.toBe("down");
    expect(bo.view.seats[0]!.hole).toBe("down");
    expect(crowd.view.seats[0]!.hole).toBe("down");
    expect(crowd.view.seats[1]!.hole).toBe("down");
    expect(ada.view.seats[0]!.hole).not.toEqual(bo.view.seats[1]!.hole);
    expect(ada.view.validActions.length).toBeGreaterThan(0);
    expect(bo.view.validActions).toEqual([]);
    expect(JSON.stringify(ada.view)).not.toContain("deck");
  });

  it("refuses an out-of-turn action and still accepts the seat that is up", () => {
    const host = open("Ada");
    const guest = perform(host.code, null, { type: "sit", seat: 1, name: "Bo", stack: 200 });
    if ("error" in guest) throw new Error(guest.error);
    freezeRooms();
    perform(host.code, host.token, { type: "startHand" });
    const earlyStreet = perform(host.code, host.token, { type: "act", seat: 0, action: "fold" });
    expect(earlyStreet).toEqual({ error: "Wait for the street." });
    advanceRooms(STREET_PAUSE_MS);

    const early = perform(host.code, guest.token, { type: "act", seat: 0, action: "fold" });
    expect(early).toEqual({ error: "It is not that seat's turn." });
    expect(readSnapshot(host.code, host.token)!.view.phase).toBe("betting");

    const folded = perform(host.code, host.token, { type: "act", seat: 9, action: "fold" });
    expect("error" in folded).toBe(false);
    if ("error" in folded) return;
    expect(folded.view.seats[0]!.folded).toBe(true);
  });

  it("ignores a deck supplied by the browser", () => {
    const host = open("Ada");
    perform(host.code, null, { type: "sit", seat: 1, name: "Bo", stack: 200 });
    const rigged = { type: "startHand", deck: Array.from({ length: 52 }, () => "Ah") } as Command;
    const dealt = perform(host.code, host.token, rigged);
    expect("error" in dealt).toBe(false);
    if ("error" in dealt) return;
    expect(dealt.view.phase).toBe("betting");
    expect(dealt.view.handNumber).toBe(1);
  });

  it("lets a player stand up and sit again", () => {
    const host = open("Ada");
    const left = perform(host.code, host.token, { type: "leave", seat: 0 });
    expect("error" in left).toBe(false);
    const again = perform(host.code, host.token, { type: "sit", seat: 3, name: "Ada", stack: 50 });
    expect("error" in again).toBe(false);
    if ("error" in again) return;
    expect(again.you).toBe(3);
    expect(again.view.seats[0]!.occupied).toBe(false);
    expect(again.view.seats[3]!.name).toBe("Ada");
  });

  it("wakes a waiting player when the table changes", async () => {
    const host = open("Ada");
    const pending = waitForSnapshot(host.code, host.token, host.version, 1000);
    perform(host.code, null, { type: "sit", seat: 2, name: "Bo", stack: 80 });
    const next = await pending;
    expect(next!.version).toBeGreaterThan(host.version);
    expect(next!.view.seats[2]!.name).toBe("Bo");
  });

  it("checks or folds when the turn timer ends, then deals the next hand", () => {
    const host = open("Ada");
    const guest = perform(host.code, null, { type: "sit", seat: 1, name: "Bo", stack: 200 });
    if ("error" in guest) throw new Error(guest.error);
    freezeRooms();
    perform(host.code, host.token, { type: "startHand" });
    advanceRooms(STREET_PAUSE_MS + ACTION_MS);
    const timed = readSnapshot(host.code, host.token)!;
    expect(timed.view.phase).toBe("complete");
    expect(timed.view.seats[0]!.folded).toBe(true);
    expect(timed.clock.dealMs).toBe(BETWEEN_HANDS_MS);

    advanceRooms(BETWEEN_HANDS_MS);
    const next = readSnapshot(host.code, host.token)!;
    expect(next.view.handNumber).toBe(2);
    expect(next.view.phase).toBe("betting");
    expect(next.clock.pauseMs).toBe(STREET_PAUSE_MS);
  });

  it("does not deal the next hand when one player is sitting out", () => {
    const host = open("Ada");
    perform(host.code, null, { type: "sit", seat: 1, name: "Bo", stack: 200 });
    freezeRooms();
    perform(host.code, host.token, { type: "startHand" });
    advanceRooms(STREET_PAUSE_MS + ACTION_MS);
    const satOut = perform(host.code, host.token, { type: "away", seat: 0 });
    expect("error" in satOut).toBe(false);
    advanceRooms(BETWEEN_HANDS_MS);
    const held = readSnapshot(host.code, host.token)!;
    expect(held.view.handNumber).toBe(1);
    expect(held.view.phase).toBe("complete");
    expect(held.clock.dealMs).toBeNull();
  });

  it("lets the opener clear a seat between hands", () => {
    const host = open("Ada");
    const guest = perform(host.code, null, { type: "sit", seat: 1, name: "Bo", stack: 200 });
    if ("error" in guest) throw new Error(guest.error);
    const denied = perform(host.code, guest.token, { type: "boot", seat: 0 });
    expect(denied).toEqual({ error: "Only the player who opened the table can clear a seat." });
    const cleared = perform(host.code, host.token, { type: "boot", seat: 1 });
    expect("error" in cleared).toBe(false);
    if ("error" in cleared) return;
    expect(cleared.view.seats[1]!.occupied).toBe(false);
    const bo = readSnapshot(host.code, guest.token)!;
    expect(bo.you).toBeNull();
    expect(bo.known).toBe(true);
    expect(readSnapshot(host.code, host.token)!.seatKey).toBe(host.token);
  });

  it("restores a table from disk with the same seat key", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "nlhe-"));
    configureRooms({ file: path.join(directory, "rooms.json") });
    const host = open("Ada");
    reloadRooms();
    const restored = readSnapshot(host.code, host.token);
    expect(restored?.you).toBe(0);
    expect(restored?.host).toBe(true);
    expect(restored?.view.seats[0]!.name).toBe("Ada");
    expect(restored?.view.seats[0]!.stack).toBe(200);
    expect(restored?.seatKey).toBe(host.token);
  });
});

describe("bot seats", () => {
  it("lets the opener seat a bot, and keeps the bot token out of the snapshot", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "nlhe-"));
    configureRooms({ file: path.join(directory, "rooms.json") });
    const host = open("Ada");
    const guest = perform(host.code, null, { type: "sit", seat: 2, name: "Bo", stack: 200 });
    if ("error" in guest) throw new Error(guest.error);
    const denied = perform(host.code, guest.token, { type: "seatBot", seat: 1, name: "Cal", stack: 200 });
    expect(denied).toEqual({ error: "Only the player who opened the table can seat a bot." });
    const seated = perform(host.code, host.token, { type: "seatBot", seat: 1, name: "Cal", stack: 150 });
    expect("error" in seated).toBe(false);
    if ("error" in seated) return;
    expect(seated.token).toBe(host.token);
    expect(seated.you).toBe(0);
    expect(seated.bots[1]).toBe(true);
    expect(seated.view.seats[1]!.name).toBe("Cal");
    expect(seated.view.seats[1]!.stack).toBe(150);

    const saved = JSON.parse(readFileSync(path.join(directory, "rooms.json"), "utf8")) as {
      rooms: { seats: [string, number | null][] }[];
    };
    const secret = saved.rooms[0]!.seats.map(([token]) => token).find((token) => token !== host.token && token !== guest.token);
    expect(secret).toBeTruthy();
    expect(JSON.stringify(readSnapshot(host.code, host.token))).not.toContain(secret!);

    reloadRooms();
    expect(readSnapshot(host.code, host.token)!.bots[1]).toBe(true);
  });

  it("acts only for a bot, after the pause and the think, and times out if the policy fails", () => {
    const host = openTable({ smallBlind: 1, bigBlind: 2, name: "Ada", stack: 200, seat: 1 });
    if ("error" in host) throw new Error(host.error);
    const seated = perform(host.code, host.token, { type: "seatBot", seat: 0, name: "Cal", stack: 200 });
    if ("error" in seated) throw new Error(seated.error);
    freezeRooms();
    perform(host.code, host.token, { type: "startHand" });
    advanceRooms(STREET_PAUSE_MS + BOT_THINK_MS - 1);
    const waiting = readSnapshot(host.code, host.token)!;
    expect(waiting.view.toAct).toBe(0);
    expect(waiting.view.phase).toBe("betting");
    expect(waiting.view.seats[0]!.lastAction).toBe("SB 1");
    expect(waiting.botNotes).toEqual([]);
    advanceRooms(1);
    const acted = readSnapshot(host.code, host.token)!;
    expect(acted.view.toAct === 0 && acted.view.seats[0]!.lastAction === null && acted.view.phase === "betting").toBe(false);
    expect(acted.botNotes.length).toBeGreaterThan(0);
    expect(acted.botNotes.every((note) => !/[2-9TJQKA][cdhs]/.test(note.text))).toBe(true);
    expect(acted.view.seats[1]!.folded).toBe(false);

    resetRooms();
    const person = open("Ada");
    perform(person.code, person.token, { type: "seatBot", seat: 1, name: "Cal", stack: 200 });
    let calls = 0;
    setBotPolicy(() => {
      calls += 1;
      return { action: "fold", reason: "Nope." };
    });
    freezeRooms();
    perform(person.code, person.token, { type: "startHand" });
    advanceRooms(STREET_PAUSE_MS + BOT_THINK_MS);
    expect(calls).toBe(0);
    expect(readSnapshot(person.code, person.token)!.view.toAct).toBe(0);
    advanceRooms(ACTION_MS - BOT_THINK_MS);
    expect(calls).toBe(0);
    expect(readSnapshot(person.code, person.token)!.view.seats[0]!.folded).toBe(true);

    resetRooms();
    const again = openTable({ smallBlind: 1, bigBlind: 2, name: "Ada", stack: 200, seat: 1 });
    if ("error" in again) throw new Error(again.error);
    perform(again.code, again.token, { type: "seatBot", seat: 0, name: "Cal", stack: 200 });
    setBotPolicy(() => {
      throw new Error("boom");
    });
    freezeRooms();
    perform(again.code, again.token, { type: "startHand" });
    advanceRooms(STREET_PAUSE_MS + BOT_THINK_MS);
    expect(readSnapshot(again.code, again.token)!.view.toAct).toBe(0);
    expect(readSnapshot(again.code, again.token)!.botNotes).toEqual([]);
    advanceRooms(ACTION_MS - BOT_THINK_MS);
    const timed = readSnapshot(again.code, again.token)!;
    expect(timed.view.seats[0]!.folded).toBe(true);
    expect(timed.botNotes.map((note) => note.text)).toContain("Timed out.");
  });

  it("caps the table at seven bots and lets the opener tend the seat", () => {
    const host = open("Ada");
    for (let seat = 1; seat <= 7; seat++) {
      const sat = perform(host.code, host.token, { type: "seatBot", seat, name: `B${seat}`, stack: 100 });
      expect("error" in sat).toBe(false);
    }
    perform(host.code, host.token, { type: "leave", seat: 0 });
    const eighth = perform(host.code, host.token, { type: "seatBot", seat: 0, name: "Extra", stack: 100 });
    expect(eighth).toEqual({ error: "Seven bots is the limit." });

    resetRooms();
    const opener = open("Ada");
    perform(opener.code, opener.token, { type: "seatBot", seat: 1, name: "Cal", stack: 200 });
    const filled = perform(opener.code, opener.token, { type: "addChips", seat: 1, amount: 40 });
    expect("error" in filled).toBe(false);
    if ("error" in filled) return;
    expect(filled.view.seats[1]!.stack).toBe(240);
    freezeRooms();
    perform(opener.code, opener.token, { type: "startHand" });
    const during = perform(opener.code, opener.token, { type: "seatBot", seat: 2, name: "Dee", stack: 200 });
    expect(during).toEqual({ error: "Players can sit between hands." });
    advanceRooms(STREET_PAUSE_MS + ACTION_MS);
    const away = perform(opener.code, opener.token, { type: "away", seat: 1 });
    expect("error" in away).toBe(false);
    if ("error" in away) return;
    expect(away.view.seats[1]!.away).toBe(true);
    const guest = perform(opener.code, null, { type: "sit", seat: 2, name: "Bo", stack: 200 });
    if ("error" in guest) throw new Error(guest.error);
    const refused = perform(opener.code, guest.token, { type: "addChips", seat: 1, amount: 40 });
    expect(refused).toEqual({ error: "That seat is not a bot." });
    const cleared = perform(opener.code, opener.token, { type: "boot", seat: 1 });
    expect("error" in cleared).toBe(false);
    if ("error" in cleared) return;
    expect(cleared.view.seats[1]!.occupied).toBe(false);
    expect(cleared.bots[1]).toBe(false);
  });
});

describe("pots on the felt", () => {
  it("splits a short stack into a main pot and a side pot", () => {
    expect(
      describePots([
        { committed: 100, allIn: false },
        { committed: 100, allIn: false },
        { committed: 30, allIn: true },
        { committed: 0, allIn: false },
      ]),
    ).toEqual([
      { name: "POT", amount: 90 },
      { name: "SIDE 1", amount: 140 },
    ]);
    expect(
      describePots([
        { committed: 1, allIn: false },
        { committed: 2, allIn: false },
      ]),
    ).toEqual([{ name: "POT", amount: 3 }]);
  });
});

function open(name: string) {
  const result = openTable({ smallBlind: 1, bigBlind: 2, name, stack: 200 });
  if ("error" in result) throw new Error(result.error);
  return result;
}

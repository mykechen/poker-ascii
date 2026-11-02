import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { describePots } from "./pots";
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

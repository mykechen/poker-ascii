import { describe, expect, it, beforeEach } from "vitest";
import type { Command } from "./types";
import { openTable, perform, readSnapshot, resetRooms, waitForSnapshot } from "./rooms";

beforeEach(() => {
  resetRooms();
});

describe("shared tables", () => {
  it("shows each player only their own cards, and buttons only on their turn", () => {
    const host = open("Ada");
    const guest = perform(host.code, null, { type: "sit", seat: 1, name: "Bo", stack: 200 });
    expect("error" in guest).toBe(false);
    if ("error" in guest) return;

    const dealt = perform(host.code, host.token, { type: "startHand" });
    expect("error" in dealt).toBe(false);

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
    perform(host.code, host.token, { type: "startHand" });

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
});

function open(name: string) {
  const result = openTable({ smallBlind: 1, bigBlind: 2, name, stack: 200 });
  if ("error" in result) throw new Error(result.error);
  return result;
}

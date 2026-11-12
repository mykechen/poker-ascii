import { describe, expect, it } from "vitest";
import { createLocalSession, reduceLocal } from "./local";
import { ACTION_MS, BOT_THINK_MS, STREET_PAUSE_MS } from "./timing";
import type { Card } from "./types";
import { freshDeck } from "./cards";
import { projectView } from "./view";

function pad(deck: Card[]): Card[] {
  const used = new Set(deck);
  return [...deck, ...freshDeck().filter((item) => !used.has(item))];
}

describe("local bot seat", () => {
  it("waits out the street pause and does not reveal a bot's cards", () => {
    let session = createLocalSession();
    session = reduceLocal(session, { type: "sit", seat: 1, name: "Ada", stack: 200 });
    session = reduceLocal(session, { type: "seatBot", seat: 0, name: "Cal", stack: 200 });
    session = reduceLocal(session, { type: "startHand", deck: pad(["7c", "As", "2d", "Kd"]) });
    expect(session.table.toAct).toBe(0);
    session = reduceLocal(session, { type: "botTick", now: 1_000 });
    session = reduceLocal(session, { type: "reveal" });
    expect(session.revealed).toBe(false);
    expect(projectView(session.table, session.revealed).seats[0]!.hole).toBe("down");
    session = reduceLocal(session, { type: "botTick", now: 1_000 + STREET_PAUSE_MS + BOT_THINK_MS - 1 });
    expect(session.table.toAct).toBe(0);
    expect(session.table.seats[0]!.lastAction).toBe("SB 1");
    expect(session.botNotes).toEqual([]);
    session = reduceLocal(session, { type: "botTick", now: 1_000 + STREET_PAUSE_MS + BOT_THINK_MS });
    // The table bot completes 7-2 heads-up from the small blind: one chip for a share of four.
    expect(session.table.seats[0]!.lastAction).toBe("CALL 1");
    expect(session.botNotes).toHaveLength(1);
    expect(session.botNotes[0]!.text).toMatch(/^Equity \d+\.\d%\. Showdown call value -?\d+\.\d\.$/);
  });

  it("checks or folds a bot that fails, and refuses a person acting for it", () => {
    let session = createLocalSession();
    session = reduceLocal(session, { type: "sit", seat: 1, name: "Ada", stack: 200 });
    session = reduceLocal(session, { type: "seatBot", seat: 0, name: "Cal", stack: 200 });
    const blocked = reduceLocal(session, { type: "act", seat: 0, action: "fold" });
    expect(blocked.table.error).toBe("That seat plays itself.");
    expect(blocked.table.seats[0]!.stack).toBe(200);
    session = reduceLocal(session, { type: "startHand" });
    session = reduceLocal(session, { type: "botTick", now: 0 });
    const failed = { ...session, botAttempt: `${session.table.handNumber}:${session.table.street}:${session.table.toAct}` };
    const later = reduceLocal(failed, { type: "botTick", now: STREET_PAUSE_MS + ACTION_MS });
    expect(later.botNotes.at(-1)?.text).toBe("Timed out.");
  });
});

import { createAdaptivePolicy } from "./adaptive";
import { readBotAction, type PolicyAction } from "./bot";
import { apply } from "./engine";
import { learner } from "./learner";
import { SEAT_COUNT, type Command, type LogEntry, type TableState } from "./types";
import { projectForPlayer } from "./view";

/**
 * Research baseline v1, frozen under tag poker-baseline-v1-128.
 * These are the exact settings of the 128-sample arm in the adoption study.
 */
export const V1_OPTIONS: Parameters<typeof createAdaptivePolicy>[0] = {
  samples: 128,
  seed: 42,
  riverSamples: 16,
  riverRiskPenalty: 1,
  learn: false,
  styleRetention: 1,
  responseModel: { version: 1, kind: "current" },
};

/**
 * The table plays v1 with range-defense river sizing (handoffs/river-defense-2026-11-12):
 * +41 bb/100 over v1 against size-reading opponents, at a cost against players who call any shove.
 */
export const TABLE_BOT_OPTIONS: Parameters<typeof createAdaptivePolicy>[0] = { ...V1_OPTIONS, riverRangeDefense: 1 };

export class HandReplayError extends Error {}

/**
 * The table's bot. It plays when this hand's opening state is known. A table saved
 * before openings were recorded, or a replay that fails, falls back to the chart
 * learner for that turn so a live table never stalls on a bot error.
 */
export function liveBotAction(opening: TableState | null, table: TableState, seat: number): PolicyAction | null {
  if (opening === null || opening.handNumber !== table.handNumber) {
    console.warn(`No opening state for hand ${table.handNumber}; the chart bot plays seat ${seat}.`);
    return readBotAction(projectForPlayer(table, seat), learner);
  }
  try {
    return decideTableBot(opening, table, seat);
  } catch (error) {
    console.error(`The table bot failed on hand ${table.handNumber}, seat ${seat}; the chart bot plays this turn.`, error);
    return readBotAction(projectForPlayer(table, seat), learner);
  }
}

/** The state a table bot needs to remember: the table right after this hand was dealt. */
export function nextOpening(previous: TableState | null, before: TableState, after: TableState): TableState | null {
  if (after.handNumber !== before.handNumber && after.phase === "betting") return after;
  return previous;
}

/**
 * The bot reads opponents from every action in the current hand. Tables are stored as plain
 * data between requests, so instead of keeping a live policy object we rebuild one per
 * decision: replay the hand from its opening state and feed each step to `observe`,
 * exactly as the training harness does. It forgets everything between hands, so the
 * current hand is all the history it needs.
 */
export function decideTableBot(opening: TableState, current: TableState, seat: number): PolicyAction | null {
  if (current.phase !== "betting" || current.toAct !== seat) {
    throw new HandReplayError(`Seat ${seat} is not to act in hand ${current.handNumber}.`);
  }
  const states = replayHand(opening, current);
  const { policy } = createAdaptivePolicy(TABLE_BOT_OPTIONS);
  policy.startSession?.(Array.from({ length: SEAT_COUNT }, (_, index) => `seat-${index}`));
  for (let step = 1; step < states.length; step++) {
    policy.observe?.(projectForPlayer(states[step - 1]!, seat), projectForPlayer(states[step]!, seat));
  }
  return readBotAction(projectForPlayer(current, seat), policy);
}

/** Every table state from the opening deal to `current`, rebuilt from the action log. */
export function replayHand(opening: TableState, current: TableState): TableState[] {
  if (opening.handNumber !== current.handNumber) {
    throw new HandReplayError(`Opening is hand ${opening.handNumber}, table is on hand ${current.handNumber}.`);
  }
  const states = [opening];
  let state = opening;
  for (const entry of handActions(current.log)) {
    const next = apply(state, commandFor(entry));
    if (next.error) throw new HandReplayError(`Replay of "${entry.text}" failed: ${next.error}`);
    states.push(next);
    state = next;
  }
  const replayed = JSON.stringify(handActions(state.log));
  if (replayed !== JSON.stringify(handActions(current.log)) || state.toAct !== current.toAct) {
    throw new HandReplayError(`Replay of hand ${current.handNumber} does not match the table.`);
  }
  return states;
}

const PLAYER_ACTIONS = new Set<LogEntry["action"]>(["fold", "check", "call", "bet", "raise", "all_in"]);

/** Player actions after this hand's deal. The log keeps 400 entries, so index from the deal, not from the start. */
function handActions(log: LogEntry[]): LogEntry[] {
  const deal = log.findLastIndex((entry) => entry.action === "deal" && entry.street === "preflop");
  if (deal < 0) throw new HandReplayError("The log has no deal for this hand.");
  return log.slice(deal + 1).filter((entry) => entry.seat !== null && PLAYER_ACTIONS.has(entry.action));
}

function commandFor(entry: LogEntry): Command {
  const seat = entry.seat!;
  switch (entry.action) {
    case "fold":
    case "check":
    case "call":
      return { type: "act", seat, action: entry.action };
    case "all_in":
      // A call that empties the stack is logged as all-in too; the engine treats both the same.
      return { type: "act", seat, action: "all_in" };
    case "bet":
    case "raise":
      if (entry.raiseTo === null) throw new HandReplayError(`"${entry.text}" has no raise-to amount.`);
      return { type: "act", seat, action: "raise", amount: entry.raiseTo };
    default:
      throw new HandReplayError(`"${entry.text}" is not a player action.`);
  }
}

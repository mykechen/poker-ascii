/**
 * Exploratory paired screen: v1 versus range-defense river models.
 * Every arm plays the same seeds, lineups and hero seat rotations, so arm differences
 * come from the hero's decisions, not the deal. Writes one JSON shard per process.
 *
 * Usage: vite-node scripts/river-defense-screen.ts <seedStart> <seedCount> <hands> <outFile> [cellId,...] [armId,...]
 * The defense arms ran twice: first with plain river sampling, then (as defense-1.0-stratified)
 * after stratified sampling replaced it. Only the second matches the current code.
 */
import { writeFileSync } from "node:fs";
import { createAdaptivePolicy } from "../lib/poker/adaptive";
import { V1_OPTIONS } from "../lib/poker/live-bot";
import { strategyById, type StrategyId } from "../lib/poker/strategies";
import { playMatch } from "../lib/poker/train";

export const ARMS: { id: string; rangeDefense?: number }[] = [
  { id: "v1" },
  { id: "defense-0.7", rangeDefense: 0.7 },
  { id: "defense-1.0", rangeDefense: 1.0 },
  { id: "defense-1.0-stratified", rangeDefense: 1.0 },
];

/** Pot-odds-aware opponents stand in for real players; loose ones call or attack regardless of price. */
export const CELLS: { id: string; opponents: StrategyId[] }[] = [
  { id: "pot-odds", opponents: ["equity-defender", "equity-pressure", "chart", "tight", "position"] },
  { id: "loose", opponents: ["station", "maniac", "aggressor", "multiway", "learner"] },
  // Every opponent reads river bet size, the way a thinking player does.
  { id: "size-aware", opponents: ["size-reader", "size-reader", "size-reader", "size-reader", "size-reader"] },
];

const [seedStart, seedCount, hands, outFile, cellList, armList] = process.argv.slice(2);
if (!seedStart || !seedCount || !hands || !outFile) throw new Error("Usage: <seedStart> <seedCount> <hands> <outFile>");
const start = Number(seedStart), count = Number(seedCount), handCount = Number(hands);
if (![start, count, handCount].every(Number.isSafeInteger)) throw new Error("Seeds and hands must be whole numbers.");

const cells = cellList ? cellList.split(",").map((id) => {
  const cell = CELLS.find((item) => item.id === id);
  if (!cell) throw new Error(`Unknown cell ${id}; use ${CELLS.map((item) => item.id).join(", ")}.`);
  return cell;
}) : CELLS;
const arms = armList ? armList.split(",").map((id) => {
  const arm = ARMS.find((item) => item.id === id);
  if (!arm) throw new Error(`Unknown arm ${id}; use ${ARMS.map((item) => item.id).join(", ")}.`);
  return arm;
}) : ARMS;
const rows: { seed: number; cell: string; rotation: number; arm: string; heroNet: number; hands: number; ms: number }[] = [];
for (let seed = start; seed < start + count; seed++) {
  for (const cell of cells) {
    const players = cell.opponents.length + 1;
    for (let rotation = 0; rotation < players; rotation++) {
      for (const arm of arms) {
        const hero = { name: "hero", policy: createAdaptivePolicy({ ...V1_OPTIONS, riverRangeDefense: arm.rangeDefense }).policy };
        const field = cell.opponents.map((id, i) => ({ name: `opp-${i}`, policy: strategyById(id).policy }));
        const lineup = [hero, ...field];
        const seats = lineup.map((_, seat) => lineup[(seat + rotation) % players]!);
        const heroSeat = seats.indexOf(hero);
        const started = performance.now();
        const report = playMatch({ seats, seed, hands: handCount, stack: 200, smallBlind: 1, bigBlind: 2, invalidAction: "throw" });
        if (report.fallbacks.some((n) => n !== 0) || report.net.reduce((a, b) => a + b, 0) !== 0) {
          throw new Error(`Accounting or legality failed: seed ${seed}, cell ${cell.id}, rotation ${rotation}, arm ${arm.id}.`);
        }
        rows.push({ seed, cell: cell.id, rotation, arm: arm.id, heroNet: report.net[heroSeat]!, hands: handCount, ms: performance.now() - started });
      }
    }
  }
}
writeFileSync(outFile, JSON.stringify({ seedStart: start, seedCount: count, hands: handCount, arms, cells, rows }));

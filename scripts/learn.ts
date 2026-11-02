import { writeFileSync } from "node:fs";
import type { Policy } from "../lib/poker/bot";
import { learner, tableFoldRate } from "../lib/poker/learner";
import { aggressor, chart, station } from "../lib/poker/strategies";
import { playMatch } from "../lib/poker/train";

const hands = flag("hands", 2000);
const seeds = flag("seeds", 8);
const bigBlind = 2;

const matchups = [
  { name: "Aggressor vs chart", hero: aggressor, field: chart },
  { name: "Learner vs chart", hero: learner, field: chart },
  { name: "Aggressor vs station", hero: aggressor, field: station },
  { name: "Learner vs station", hero: learner, field: station },
];

console.log(`${hands} hands, ${seeds} seeds, one style versus five copies of the field`);
console.log("");

const rows = matchups.map((matchup) => {
  const deltas: number[] = [];
  const notes = { bluffs: 0, value: 0, steals: 0, decisions: 0, rate: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    const base = seatNet(matchup.field, matchup.field, seed);
    const watched = watch(matchup.hero, notes);
    const net = seatNet(watched, matchup.field, seed);
    deltas.push(((net - base) / bigBlind / hands) * 100);
  }
  const mean = deltas.reduce((sum, item) => sum + item, 0) / deltas.length;
  const row = {
    name: matchup.name,
    mean,
    low: Math.min(...deltas),
    high: Math.max(...deltas),
    ahead: deltas.filter((item) => item > 0).length,
    seeds: deltas,
    bluffsPer100: (notes.bluffs / seeds / hands) * 100,
    valuePer100: (notes.value / seeds / hands) * 100,
    stealsPer100: (notes.steals / seeds / hands) * 100,
    foldRate: notes.decisions === 0 ? 0 : notes.rate / notes.decisions,
  };
  console.log(
    `${row.name.padEnd(24)} ${signed(row.mean).padStart(8)}   seeds ${row.ahead}/${seeds}   bluffs ${row.bluffsPer100.toFixed(1)}/100   fold rate ${row.foldRate.toFixed(2)}`,
  );
  return row;
});

writeFileSync("/tmp/learn.json", JSON.stringify({ hands, seeds, rows }, null, 2));

function seatNet(hero: Policy, field: Policy, seed: number): number {
  const report = playMatch({
    seats: Array.from({ length: 6 }, (_, seat) =>
      seat === 0 ? { name: "Hero", policy: hero } : { name: `Field ${seat + 1}`, policy: field },
    ),
    hands,
    seed,
  });
  return report.net[0] ?? 0;
}

function watch(policy: Policy, notes: { bluffs: number; value: number; steals: number; decisions: number; rate: number }): Policy {
  return (view) => {
    notes.decisions += 1;
    notes.rate += tableFoldRate(view).rate;
    const decision = policy(view);
    if (decision.reason.startsWith("Bluff.") || decision.reason.startsWith("Semi-bluff.")) notes.bluffs += 1;
    if (decision.reason.startsWith("Thin value.")) notes.value += 1;
    if (decision.reason.startsWith("Steal.")) notes.steals += 1;
    return decision;
  };
}

function signed(value: number): string {
  const text = value.toFixed(1);
  return value > 0 ? `+${text}` : text;
}

function flag(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value)) throw new Error(`--${name} needs a whole number.`);
  return value;
}

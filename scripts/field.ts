import { writeFileSync } from "node:fs";
import { playMatch, type TrainSeat } from "../lib/poker/train";
import { chart, strategies, type Strategy } from "../lib/poker/strategies";

const hands = flag("hands", 2400);
const seeds = flag("seeds", 10);
const bigBlind = 2;
const fieldSeats = 6;
const challengers = strategies.filter((item) => item.id !== "chart");

const baseline = new Map<number, number>();
const baselineCurve: number[] = [];
for (let seed = 1; seed <= seeds; seed++) {
  const curve = seed === 1 ? baselineCurve : undefined;
  baseline.set(seed, runSeat(chartSeats(chart), seed, curve));
}

const versus = challengers.map((item) => {
  const deltas: number[] = [];
  const curve: number[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const net = runSeat(chartSeats(item.policy), seed, seed === 1 ? curve : undefined);
    deltas.push(bb100(net - baseline.get(seed)!, hands));
  }
  return row(item, deltas, curve.map((net, index) => bb100(net - baselineCurve[index]!, (index + 1) * 200)));
});

const mixedHands = Math.floor(hands / strategies.length) * strategies.length;
const mixedSeeds = seeds;
const mixedNets = strategies.map(() => [] as number[]);
for (let seed = 1; seed <= mixedSeeds; seed++) {
  const report = playMatch({
    seats: strategies.map((item) => ({ name: item.name, policy: item.policy })),
    hands: mixedHands,
    seed,
  });
  report.bb100.forEach((score, index) => mixedNets[index]!.push(score));
}

const payload = {
  hands,
  seeds,
  bigBlind,
  fieldSeats,
  mixedHands,
  mixedSeats: strategies.length,
  generatedAt: new Date().toISOString(),
  versus,
  mixed: strategies.map((item, index) => ({
    id: item.id,
    name: item.name,
    rule: item.rule,
    mean: mean(mixedNets[index]!),
    low: Math.min(...mixedNets[index]!),
    high: Math.max(...mixedNets[index]!),
    seeds: mixedNets[index]!,
  })),
};

console.log(`${hands} hands, ${seeds} seeds, challenger versus five copies of the chart`);
console.log("");
for (const item of versus) {
  console.log(
    `${item.name.padEnd(16)} ${signed(item.mean).padStart(7)}   seeds ${item.ahead}/${seeds}   ${signed(item.low)} to ${signed(item.high)}`,
  );
}
console.log("");
console.log(`${mixedHands} hands, ${mixedSeeds} seeds, all ${strategies.length} styles at one table`);
console.log("");
for (const item of payload.mixed) {
  console.log(`${item.name.padEnd(16)} ${signed(item.mean).padStart(7)}   ${signed(item.low)} to ${signed(item.high)}`);
}

writeFileSync("/tmp/field.json", JSON.stringify(payload));

function chartSeats(policy: Strategy["policy"]): TrainSeat[] {
  return Array.from({ length: fieldSeats }, (_, seat) =>
    seat === 0 ? { name: "Candidate", policy } : { name: `Chart ${seat + 1}`, policy: chart },
  );
}

function runSeat(seats: TrainSeat[], seed: number, curve?: number[]): number {
  const report = playMatch({
    seats,
    hands,
    seed,
    onHand(finished, net) {
      if (curve && finished % 200 === 0) curve.push(net[0] ?? 0);
    },
  });
  return report.net[0] ?? 0;
}

function row(item: Strategy, deltas: number[], curve: number[]) {
  return {
    id: item.id,
    name: item.name,
    rule: item.rule,
    mean: mean(deltas),
    low: Math.min(...deltas),
    high: Math.max(...deltas),
    ahead: deltas.filter((score) => score > 0).length,
    seeds: deltas,
    curve,
  };
}

function bb100(net: number, dealt: number): number {
  return (net / bigBlind / dealt) * 100;
}

function mean(values: number[]): number {
  return values.reduce((sum, item) => sum + item, 0) / values.length;
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

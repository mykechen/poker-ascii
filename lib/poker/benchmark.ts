import { playMatch, type TrainSeat, type TrainReport } from "./train";

export type BenchmarkOptions = { seats: TrainSeat[]; seeds: number[]; hands: number };
export type BenchmarkReport = {
  mode: "fixed";
  runs: { seed: number; rotation: number; participantAtSeat: number[]; report: TrainReport }[];
  meanBb100: number[];
  /** Approximate 95% normal intervals across independent seed batches; null below 30 batches. */
  intervals: ([number, number] | null)[];
};

export function runBenchmark(options: BenchmarkOptions): BenchmarkReport {
  if (options.seats.length < 6 || options.seats.length > 8) throw new Error("Benchmark requires six to eight players.");
  if (!options.seeds.length || new Set(options.seeds.map(seed => seed >>> 0)).size !== options.seeds.length || options.seeds.some(s => !Number.isSafeInteger(s))) throw new Error("Provide distinct integer seeds.");
  const count = options.seats.length;
  const runs: BenchmarkReport["runs"] = [];
  const batches: number[][] = [];
  for (const seed of options.seeds) {
    const scores = options.seats.map(() => 0);
    for (let rotation = 0; rotation < count; rotation++) {
      const participantAtSeat = options.seats.map((_, seat) => (seat + rotation) % count);
      const report = playMatch({ seats: participantAtSeat.map(i => options.seats[i]!), seed, hands: options.hands, invalidAction: "throw" });
      report.bb100.forEach((score, seat) => { scores[participantAtSeat[seat]!] += score / count; });
      runs.push({ seed, rotation, participantAtSeat, report });
    }
    batches.push(scores);
  }
  const meanBb100 = options.seats.map((_, i) => batches.reduce((sum, b) => sum + b[i]!, 0) / batches.length);
  const intervals = meanBb100.map((mean, i): [number, number] | null => {
    if (batches.length < 30) return null;
    const variance = batches.reduce((sum, batch) => sum + (batch[i]! - mean) ** 2, 0) / (batches.length - 1);
    const margin = 1.96 * Math.sqrt(variance / batches.length);
    return [mean - margin, mean + margin];
  });
  return { mode: "fixed", runs, meanBb100, intervals };
}

/** Participant zero is replaced; rotations and deal seeds remain paired. */
export function comparePolicies(options: BenchmarkOptions, challenger: TrainSeat["policy"], baseline: TrainSeat["policy"]) {
  const run = (policy: TrainSeat["policy"]) => runBenchmark({ ...options, seats: options.seats.map((seat,i) => i === 0 ? {name: seat.name, policy} : seat) });
  const candidate = run(challenger);
  const control = run(baseline);
  const deltas = options.seeds.map(seed => {
    const difference = (report: BenchmarkReport) => report.runs.filter(r => r.seed === seed).reduce((sum,r) => sum + r.report.bb100[r.participantAtSeat.indexOf(0)]!,0) / options.seats.length;
    return difference(candidate) - difference(control);
  });
  return {candidate,control,deltas,meanDelta: deltas.reduce((a,b)=>a+b,0)/deltas.length};
}

export function equalWeightScores(scoresBySize: number[][]): number[] {
  const count = scoresBySize[0]?.length ?? 0;
  if (!count || scoresBySize.some(scores => scores.length !== count || scores.some(score => !Number.isFinite(score)))) throw new Error("Provide equally sized finite score arrays for the same participants.");
  return Array.from({length:count}, (_,i)=>scoresBySize.reduce((sum,scores)=>sum+scores[i]!,0)/scoresBySize.length);
}

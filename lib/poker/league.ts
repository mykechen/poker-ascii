import { createAdaptivePolicy } from "./adaptive";
import { runBenchmark, type BenchmarkReport } from "./benchmark";
import { scorePrediction } from "./calibration";
import { simplePolicy } from "./bot";
import { strategyById, type StrategyId } from "./strategies";

export type LeagueField = { id: string; opponents: StrategyId[] };
export type LeaguePlan = { tuningSeeds: number[]; evaluationSeeds: number[]; tuningFields: LeagueField[]; evaluationFields: LeagueField[]; tableSizes: number[]; hands: number };
export type LeagueConfiguration = { id: string; mode: "frozen" | "equity" | "chart"; styleRetention: number; riverRiskPenalty: number; equitySamples: number; riverSamples: number };
export type LeagueRow = { seed: number; players: number; field: string; bb100: number };
export type LeagueBatch = { configuration: LeagueConfiguration; seed: number; rows: LeagueRow[]; cells: { players: number; field: string; report: BenchmarkReport }[]; elapsedMs: number; riverDecisions: number; riverComputeMs: number; calibration: Record<string, {count:number;brierSum:number;logLossSum:number;uniformBrierSum:number;uniformLogLossSum:number}> };

export function validateLeaguePlan(plan: LeaguePlan): void {
  const normalize = (seeds: number[]) => seeds.map(s => s >>> 0);
  for (const seeds of [plan.tuningSeeds, plan.evaluationSeeds]) if (!seeds.length || seeds.some(s => !Number.isSafeInteger(s)) || new Set(normalize(seeds)).size !== seeds.length) throw new Error("Provide distinct integer seeds per partition.");
  const tuning = new Set(normalize(plan.tuningSeeds));
  if (normalize(plan.evaluationSeeds).some(s => tuning.has(s))) throw new Error("Tuning and evaluation seed streams overlap.");
  const fields = [...plan.tuningFields, ...plan.evaluationFields];
  if (!plan.tuningFields.length || !plan.evaluationFields.length || fields.some(f => !f.id || !f.opponents.length) || new Set(fields.map(f => f.id)).size !== fields.length) throw new Error("Provide distinct nonempty field identities across partitions.");
  fields.forEach(f => f.opponents.forEach(strategyById));
  if (!plan.tableSizes.length || new Set(plan.tableSizes).size !== plan.tableSizes.length || plan.tableSizes.some(n => ![6, 7, 8].includes(n))) throw new Error("Use distinct table sizes from 6, 7, 8.");
  for (const players of plan.tableSizes) {
    const composition = (field: LeagueField) => Array.from({length:players-1},(_,i)=>field.opponents[i%field.opponents.length]).join(":");
    const training = new Set(plan.tuningFields.map(composition));
    if(plan.evaluationFields.some(field=>training.has(composition(field))))throw new Error("Held-out field composition overlaps tuning.");
  }
  if (!Number.isSafeInteger(plan.hands) || plan.hands < 1 || plan.hands > 100000) throw new Error("Hands must be between 1 and 100000.");
}

export function summarizeLeague(rows: LeagueRow[]) {
  if (!rows.length || rows.some(r => !Number.isFinite(r.bb100))) throw new Error("Provide finite league scores.");
  const seeds = [...new Set(rows.map(r => r.seed))].sort((a, b) => a - b);
  const cells = [...new Set(rows.map(r => `${r.players}:${r.field}`))].sort();
  for (const seed of seeds) {
    const batch = rows.filter(r => r.seed === seed);
    if (batch.length !== cells.length || new Set(batch.map(r => `${r.players}:${r.field}`)).size !== cells.length) throw new Error("League seed batches must contain every cell exactly once.");
  }
  const seedScores = seeds.map(seed => rows.filter(r => r.seed === seed).reduce((sum, r) => sum + r.bb100, 0) / cells.length);
  const meanBb100 = seedScores.reduce((a, b) => a + b, 0) / seeds.length;
  const cellScores = cells.map(cell => ({ cell, meanBb100: rows.filter(r => `${r.players}:${r.field}` === cell).reduce((sum, r) => sum + r.bb100, 0) / seeds.length }));
  const variance = seeds.length > 1 ? seedScores.reduce((sum, n) => sum + (n - meanBb100) ** 2, 0) / (seeds.length - 1) : null;
  const standardError = variance === null ? null : Math.sqrt(variance / seeds.length);
  const interval95 = seeds.length < 30 || standardError === null ? null : [meanBb100 - 1.96 * standardError, meanBb100 + 1.96 * standardError];
  return { meanBb100, standardError, interval95, seeds, seedScores, cellScores, worstCellBb100: Math.min(...cellScores.map(c => c.meanBb100)) };
}

export function selectConfiguration(scores: { id: string; meanBb100: number }[]): string {
  if (!scores.length || scores.some(s => !s.id || !Number.isFinite(s.meanBb100)) || new Set(scores.map(s => s.id)).size !== scores.length) throw new Error("Provide unique finite candidate scores.");
  return [...scores].sort((a, b) => b.meanBb100 - a.meanBb100 || a.id.localeCompare(b.id))[0]!.id;
}

export function runLeagueBatch(configuration: LeagueConfiguration, seed: number, fields: LeagueField[], tableSizes: number[], hands: number): LeagueBatch {
  if (!configuration.id || !["frozen", "equity", "chart"].includes(configuration.mode) || !Number.isFinite(configuration.styleRetention) || configuration.styleRetention < 0 || configuration.styleRetention > 1 || !Number.isFinite(configuration.riverRiskPenalty) || configuration.riverRiskPenalty < 0 || !Number.isSafeInteger(configuration.equitySamples) || configuration.equitySamples < 2 || configuration.equitySamples > 1000000 || !Number.isSafeInteger(configuration.riverSamples) || configuration.riverSamples < 2 || configuration.riverSamples > 10000) throw new Error("Invalid league configuration.");
  if(!fields.length || fields.some(f=>!f.id || !f.opponents.length) || new Set(fields.map(f=>f.id)).size!==fields.length)throw new Error("Provide nonempty unique league fields.");
  fields.forEach(field=>field.opponents.forEach(strategyById));
  if(!tableSizes.length || new Set(tableSizes).size!==tableSizes.length || tableSizes.some(n=>![6,7,8].includes(n)))throw new Error("Use distinct league table sizes 6, 7, 8.");
  if(!Number.isSafeInteger(seed) || !Number.isSafeInteger(hands) || hands<1 || hands>100000)throw new Error("Invalid league seed or hand count.");
  const started = performance.now();
  let riverDecisions = 0, riverComputeMs = 0;
  const calibration: LeagueBatch["calibration"] = {};
  const cells: LeagueBatch["cells"] = [];
  const rows: LeagueRow[] = [];
  for (const field of fields) for (const players of tableSizes) {
    const seats = Array.from({ length: players }, (_, i) => i === 0
      ? { name: configuration.id.slice(0, 16), policy: simplePolicy, policyFactory: () => configuration.mode === "chart" ? simplePolicy : createAdaptivePolicy({ samples: configuration.equitySamples, riverSamples: configuration.mode === "equity" ? false : configuration.riverSamples, learn: false, styleRetention: configuration.styleRetention, riverRiskPenalty: configuration.riverRiskPenalty, seed: 42, onRiverDecision: r => { riverDecisions++; riverComputeMs += r.elapsedMs; }, onPrediction: record => { const score=scorePrediction(record.probabilities,record.actual);const cell=calibration[record.street]??{count:0,brierSum:0,logLossSum:0,uniformBrierSum:0,uniformLogLossSum:0};cell.count++;cell.brierSum+=score.brier;cell.logLossSum+=score.logLoss;cell.uniformBrierSum+=score.uniformBrier;cell.uniformLogLossSum+=score.uniformLogLoss;calibration[record.street]=cell; } }).policy }
      : { name: `opponent-${i}`, policy: strategyById(field.opponents[(i - 1) % field.opponents.length]!).policy });
    const report = runBenchmark({ seats, seeds: [seed], hands });
    cells.push({ players, field: field.id, report });
    rows.push({ seed, players, field: field.id, bb100: report.meanBb100[0]! });
  }
  return { configuration: { ...configuration }, seed, rows, cells, elapsedMs: performance.now() - started, riverDecisions, riverComputeMs, calibration };
}

export function pairedLeagueDelta(candidate: LeagueRow[], control: LeagueRow[]) {
  const key = (r: LeagueRow) => `${r.seed}:${r.players}:${r.field}`;
  const controls = new Map(control.map(r => [key(r), r.bb100]));
  if (candidate.length !== control.length || controls.size !== control.length || new Set(candidate.map(key)).size !== candidate.length || candidate.some(r => !controls.has(key(r)))) throw new Error("Missing or duplicate paired league cells.");
  return summarizeLeague(candidate.map(r => ({ ...r, bb100: r.bb100 - controls.get(key(r))! })));
}

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pairedLeagueDelta, runLeagueBatch, selectConfiguration, summarizeLeague, validateLeaguePlan, type LeagueBatch, type LeagueConfiguration, type LeaguePlan } from "../lib/poker/league";

function flag(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const n = Number(process.argv[i + 1]);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`--${name} requires a positive integer.`);
  return n;
}
const hands = flag("hands", 12), tuningCount = flag("tuning-seeds", 2), evaluationCount = flag("evaluation-seeds", 3);
if (tuningCount > 100 || evaluationCount > 100) throw new Error("Use at most 100 seed batches per partition.");
const outputIndex = process.argv.indexOf("--output");
const output = outputIndex < 0 ? "data/league-screening.json" : process.argv[outputIndex + 1];
if (!output || output.startsWith("--")) throw new Error("--output requires a path.");
const plan: LeaguePlan = {
  hands, tableSizes: [6, 7, 8], tuningSeeds: Array.from({ length: tuningCount }, (_, i) => 101 + i), evaluationSeeds: Array.from({ length: evaluationCount }, (_, i) => 10001 + i),
  tuningFields: [{ id: "balanced-train", opponents: ["chart", "tight", "station", "position"] }, { id: "pressure-train", opponents: ["aggressor", "position", "chart"] }],
  evaluationFields: [{ id: "unseen-mix", opponents: ["multiway", "learner", "maniac", "station", "tight"] }, { id: "unseen-pressure", opponents: ["maniac", "learner", "multiway"] }],
};
validateLeaguePlan(plan);
const base = { mode: "adaptive" as const, equitySamples: 50, riverSamples: 16, styleRetention: 1, riverRiskPenalty: 0 };
const grid: LeagueConfiguration[] = [{ ...base, id: "full-memory" }, { ...base, id: "tempered", styleRetention: 0.8 }, { ...base, id: "tempered-cautious", styleRetention: 0.8, riverRiskPenalty: 1 }];
const hash = createHash("sha256");
for (const file of readdirSync("lib/poker").filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts")).sort()) hash.update(file).update(readFileSync(`lib/poker/${file}`));
hash.update(readFileSync("scripts/league.ts")).update(readFileSync("package.json"));
const sourceHash = hash.digest("hex");
const experimentId = createHash("sha256").update(JSON.stringify({ plan, grid, sourceHash })).digest("hex");
type State = { schemaVersion: number; experimentId: string; sourceHash: string; sourceCommit: string; plan: LeaguePlan; grid: LeagueConfiguration[]; tuning: LeagueBatch[]; evaluation: LeagueBatch[]; selected: LeagueConfiguration | null; complete: boolean; results?: object };
let state: State = { schemaVersion: 1, experimentId, sourceHash, sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), plan, grid, tuning: [], evaluation: [], selected: null, complete: false };
if (existsSync(output)) {
  const saved = JSON.parse(readFileSync(output, "utf8")) as State;
  if (saved.experimentId !== experimentId) throw new Error("Checkpoint configuration/source mismatch; use a different --output path.");
  state = saved;
}
function save() {
  mkdirSync(dirname(output!), { recursive: true });
  writeFileSync(`${output}.tmp`, JSON.stringify(state, null, 2));
  renameSync(`${output}.tmp`, output!);
}
function run(phase: "tuning" | "evaluation", config: LeagueConfiguration, seeds: number[]) {
  for (const seed of seeds) {
    if (state[phase].some(b => b.configuration.id === config.id && b.seed === seed)) continue;
    const batch = runLeagueBatch(config, seed, phase === "tuning" ? plan.tuningFields : plan.evaluationFields, plan.tableSizes, plan.hands);
    state[phase].push(batch); save();
    process.stderr.write(`${phase} ${config.id} seed ${seed}: ${summarizeLeague(batch.rows).meanBb100.toFixed(1)} bb/100, ${(batch.elapsedMs / 1000).toFixed(1)}s\n`);
  }
}
for (const config of grid) run("tuning", config, plan.tuningSeeds);
const tuningScores = grid.map(config => ({ id: config.id, ...summarizeLeague(state.tuning.filter(b => b.configuration.id === config.id).flatMap(b => b.rows)) }));
const selectedId = selectConfiguration(tuningScores);
if (state.selected && state.selected.id !== selectedId) throw new Error("Frozen selection does not match completed tuning scores.");
state.selected = { ...grid.find(c => c.id === selectedId)! }; save();
const controls: LeagueConfiguration[] = [{ ...state.selected, id: "frozen-control", mode: "frozen" }, { ...state.selected, id: "equity-control", mode: "equity" }, { ...base, id: "chart-control", mode: "chart" }];
for (const config of [state.selected, ...controls]) run("evaluation", config, plan.evaluationSeeds);
const summaries = [state.selected, ...controls].map(config => ({ id: config.id, configuration: config, ...summarizeLeague(state.evaluation.filter(b => b.configuration.id === config.id).flatMap(b => b.rows)) }));
const selectedRows = state.evaluation.filter(b => b.configuration.id === state.selected!.id).flatMap(b => b.rows);
const deltas = controls.map(config => ({ versus: config.id, ...pairedLeagueDelta(selectedRows, state.evaluation.filter(b => b.configuration.id === config.id).flatMap(b => b.rows)) }));
state.results = { tuningScores, summaries, deltas, label: "Exploratory fixed-stack screening; selection uses tuning partition only; no promotion or superiority claim" };
state.complete = true; save();
console.log(JSON.stringify({ output, selected: state.selected.id, ...state.results }, null, 2));

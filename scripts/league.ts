import {seedRange} from "../lib/poker/forecast-diagnostics";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { summarizeCalibration } from "../lib/poker/calibration";
import { renderHandoff, restartHandoff, interruptHandoff } from "../lib/poker/handoff";
import { dirname } from "node:path";
import { pairedLeagueDelta, runLeagueBatch, selectConfiguration, summarizeLeague, validateLeaguePlan, type LeagueBatch, type LeagueConfiguration, type LeaguePlan } from "../lib/poker/league";

function flag(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const n = Number(process.argv[i + 1]);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`--${name} requires a positive integer.`);
  return n;
}
const hands = flag("hands", 24), tuningCount = flag("tuning-seeds", 2), evaluationCount = flag("evaluation-seeds", 3);
if (tuningCount > 100 || evaluationCount > 100) throw new Error("Use at most 100 seed batches per partition.");
const outputIndex = process.argv.indexOf("--output");
const output = outputIndex < 0 ? "data/no-memory-calibration.json" : process.argv[outputIndex + 1];
if (!output || output.startsWith("--")) throw new Error("--output requires a path.");
const plan: LeaguePlan = {
  hands, tableSizes: [6, 7, 8], tuningSeeds: seedRange(flag("tuning-seed-start",20001),tuningCount), evaluationSeeds: seedRange(flag("evaluation-seed-start",30001),evaluationCount),
  tuningFields: [{ id: "balanced-train", opponents: ["chart", "tight", "station", "position"] }, { id: "pressure-train", opponents: ["aggressor", "position", "chart"] }],
  evaluationFields: [{ id: "unseen-mix", opponents: ["multiway", "learner", "maniac", "station", "tight"] }, { id: "unseen-pressure", opponents: ["maniac", "learner", "multiway"] }],
};
validateLeaguePlan(plan);
const base = { mode: "frozen" as const, equitySamples: 50, riverSamples: 16, styleRetention: 1, riverRiskPenalty: 0 };
const grid: LeagueConfiguration[] = [0,1,2].map(riverRiskPenalty=>({...base,id:`no-memory-risk-${riverRiskPenalty}`,riverRiskPenalty}));
const hash = createHash("sha256");
for (const file of readdirSync("lib/poker").filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts")).sort()) hash.update(file).update(readFileSync(`lib/poker/${file}`));
hash.update(readFileSync("scripts/league.ts")).update(readFileSync("package.json"));
const sourceHash = hash.digest("hex");
const experimentId = createHash("sha256").update(JSON.stringify({ plan, grid, sourceHash })).digest("hex");
type State = { schemaVersion: number; experimentId: string; sourceHash: string; sourceCommit: string; plan: LeaguePlan; grid: LeagueConfiguration[]; tuning: LeagueBatch[]; evaluation: LeagueBatch[]; selected: LeagueConfiguration | null; complete: boolean; status: "running"|"complete"|"failed"|"interrupted"; handoffDirectory: string; updatedAt: string; error?: string; results?: object };
let state: State = { schemaVersion: 1, experimentId, sourceHash, sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), plan, grid, tuning: [], evaluation: [], selected: null, complete: false, status:"running", handoffDirectory:`handoffs/runs/${new Date().toISOString().slice(0,10)}-${experimentId.slice(0,12)}`, updatedAt:new Date().toISOString() };
if (existsSync(output)) {
  const saved = JSON.parse(readFileSync(output, "utf8")) as State;
  if (saved.experimentId !== experimentId) throw new Error("Checkpoint configuration/source mismatch; use a different --output path.");
  state = saved;
}
function save() {
  state.updatedAt=new Date().toISOString();
  mkdirSync(dirname(output!), { recursive: true });
  writeFileSync(`${output}.tmp`, JSON.stringify(state, null, 2));
  renameSync(`${output}.tmp`, output!);
  const scheduledBatches=grid.length*plan.tuningSeeds.length+3*plan.evaluationSeeds.length;
  const batches=[...state.tuning,...state.evaluation];
  const reports=batches.flatMap(b=>b.cells.flatMap(c=>c.report.runs.map(r=>r.report)));
  const accounting={hands:reports.reduce((n,r)=>n+r.hands,0),matches:reports.length,illegalFallbacks:reports.reduce((n,r)=>n+r.fallbacks.reduce((a,b)=>a+b,0),0),nonconservingMatches:reports.filter(r=>r.net.reduce((a,b)=>a+b,0)!==0).length};
  const record={id:experimentId,status:state.status,sourceCommit:state.sourceCommit,sourceHash,updatedAt:state.updatedAt,completedBatches:batches.length,scheduledBatches,plan,configurations:grid,selected:state.selected,results:{accounting,...state.results},error:state.error,nextSteps:state.complete?["Inspect held-out profit and prediction scores before choosing the next experiment.","Use fresh held-out seeds for future selection; no automatic promotion."]:["Complete remaining batches using this exact checkpoint/source configuration."]};
  mkdirSync(state.handoffDirectory,{recursive:true});
  const writeAtomic=(path:string,contents:string|Buffer)=>{writeFileSync(`${path}.tmp`,contents);renameSync(`${path}.tmp`,path);};
  writeAtomic(`${state.handoffDirectory}/handoff.md`,renderHandoff(record));
  writeAtomic(`${state.handoffDirectory}/summary.json`,JSON.stringify(record,null,2)+"\n");
  writeAtomic(`${state.handoffDirectory}/raw-results.json.gz`,gzipSync(JSON.stringify(state)));
}
async function run(phase: "tuning" | "evaluation", config: LeagueConfiguration, seeds: number[]) {
  for (const seed of seeds) {
    if (state[phase].some(b => b.configuration.id === config.id && b.seed === seed)) continue;
    const batch = runLeagueBatch(config, seed, phase === "tuning" ? plan.tuningFields : plan.evaluationFields, plan.tableSizes, plan.hands);
    state[phase].push(batch); save();
    await new Promise<void>(resolve=>setImmediate(resolve));
    process.stderr.write(`${phase} ${config.id} seed ${seed}: ${summarizeLeague(batch.rows).meanBb100.toFixed(1)} bb/100, ${(batch.elapsedMs / 1000).toFixed(1)}s\n`);
  }
}
for(const [signal,code] of [["SIGINT",130],["SIGTERM",143]] as const)process.once(signal,()=>{
  interruptHandoff(state);save();process.exit(state.complete?0:code);
});
async function main() {
restartHandoff(state);
save();
try {
for (const config of grid) await run("tuning", config, plan.tuningSeeds);
const tuningScores = grid.map(config => ({ id: config.id, ...summarizeLeague(state.tuning.filter(b => b.configuration.id === config.id).flatMap(b => b.rows)) }));
const selectedId = selectConfiguration(tuningScores);
if (state.selected && state.selected.id !== selectedId) throw new Error("Frozen selection does not match completed tuning scores.");
state.selected = { ...grid.find(c => c.id === selectedId)! }; save();
const controls: LeagueConfiguration[] = [{ ...state.selected, id: "equity-control", mode: "equity" }, { ...base, id: "chart-control", mode: "chart" }];
for (const config of [state.selected, ...controls]) await run("evaluation", config, plan.evaluationSeeds);
const summaries = [state.selected, ...controls].map(config => ({ id: config.id, configuration: config, ...summarizeLeague(state.evaluation.filter(b => b.configuration.id === config.id).flatMap(b => b.rows)) }));
const selectedRows = state.evaluation.filter(b => b.configuration.id === state.selected!.id).flatMap(b => b.rows);
const deltas = controls.map(config => ({ versus: config.id, ...pairedLeagueDelta(selectedRows, state.evaluation.filter(b => b.configuration.id === config.id).flatMap(b => b.rows)) }));
const calibration=[state.selected,...controls].map(config=>({id:config.id,streets:summarizeCalibration(state.evaluation.filter(b=>b.configuration.id===config.id).map(b=>b.calibration))}));
state.results = { tuningScores, summaries, deltas, calibration, label: "Exploratory fixed-stack screening; selection uses tuning partition only; no promotion or superiority claim" };
state.complete = true; state.status="complete"; save();
console.log(JSON.stringify({ output, selected: state.selected.id, ...state.results }, null, 2));

} catch(error) {state.status="failed";state.error=error instanceof Error?error.message:String(error);save();throw error;}

}
await main();

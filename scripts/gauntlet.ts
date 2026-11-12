/**
 * Runs a gauntlet plan: candidate versus champion on fresh, reserved seeds.
 *
 *   vite-node scripts/gauntlet.ts next-seeds <count>              prints the next unused seed block
 *   vite-node scripts/gauntlet.ts run <plan.json> <outDir> [workers]
 *
 * `run` refuses seeds that the registry has seen, reserves them before playing, and writes
 * rows.jsonl, summary.json (with the promotion decision) and provenance.json to outDir.
 *
 * Battery rules (the owner's standing instruction: keep runs light on the laptop):
 * at most MAX_WORKERS low-priority workers; sleep is held off only while on AC power; on
 * battery below LOW_BATTERY_PERCENT the run stops itself and is recorded as aborted.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setPriority } from "node:os";
import { resolve } from "node:path";
import { summarizeGauntlet, validatePlan, type GauntletPlan, type GauntletRow } from "../lib/poker/gauntlet";
import { hashObject } from "../lib/poker/evaluation/protocol";
import { acquireControllerLock, atomicJSON, reserveSeeds } from "../lib/poker/evaluation/provenance";

/** Overridable so the controller can be exercised against a copy without touching real reservations. */
const REGISTRY = process.env.GAUNTLET_REGISTRY ?? "handoffs/seed-registry.json";
/** Gauntlet seeds start here so they never mix with earlier experiments' numbering. */
const GAUNTLET_SEED_FLOOR = 2_000_000;
const DEFAULT_WORKERS = 3;
const MAX_WORKERS = 4;
/** Unix niceness for workers: the rest of the machine stays responsive and gets the CPU first. */
const WORKER_NICENESS = 15;
const LOW_BATTERY_PERCENT = 25;
const BATTERY_CHECK_MS = 60_000;

type Registry = Parameters<typeof reserveSeeds>[0];
const readRegistry = (): Registry => JSON.parse(readFileSync(REGISTRY, "utf8"));

function nextSeeds(registry: Registry, count: number): number[] {
  const used = [
    ...registry.retired_inspected_ranges.map((r) => r.end),
    ...registry.reserved_not_run.map((r) => r.end),
    ...registry.started_batches.map((r) => r.seed),
    ...(registry.evaluation_reservations ?? []).flatMap((r) => r.seeds),
  ];
  const start = Math.max(GAUNTLET_SEED_FLOOR, ...used.map((s) => s + 1));
  return Array.from({ length: count }, (_, i) => start + i);
}

/** Null where there is no battery (or pmset is unavailable), so the guard never trips by mistake. */
export function batteryState(): { percent: number; onBattery: boolean } | null {
  if (process.platform !== "darwin") return null;
  try {
    const out = execFileSync("pmset", ["-g", "batt"], { encoding: "utf8", timeout: 5000 });
    const percent = out.match(/(\d+)%/);
    if (!percent) return null;
    return { percent: Number(percent[1]), onBattery: out.includes("'Battery Power'") };
  } catch {
    return null;
  }
}

class RunStopped extends Error {}

async function runPool(plan: GauntletPlan, workers: number, onSeed: (seed: number, rows: GauntletRow[]) => void, stopSignal: { reason: string | null; stop: () => void }): Promise<void> {
  const queue = [...plan.seeds];
  const children = new Set<ChildProcess>();
  stopSignal.stop = () => children.forEach((child) => child.kill("SIGTERM"));
  await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, () => new Promise<void>((done, fail) => {
    const child = spawn(process.execPath, [resolve("node_modules/vite-node/vite-node.mjs"), resolve("scripts/gauntlet-worker.ts")], { stdio: ["ignore", "inherit", "pipe", "ipc"] });
    children.add(child);
    try { setPriority(child.pid!, WORKER_NICENESS); } catch (error) { console.warn(`Could not lower worker priority: ${String(error)}`); }
    let stderr = "";
    child.stderr!.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-16000); });
    let finished = false;
    const send = () => {
      const seed = stopSignal.reason ? undefined : queue.shift();
      if (seed === undefined) { finished = true; child.disconnect(); return; }
      child.send({ plan, seed });
    };
    child.on("message", (message: { seed: number; rows?: GauntletRow[]; error?: string }) => {
      if (message.error || !message.rows) { fail(new Error(`Seed ${message.seed} failed: ${message.error}`)); stopSignal.stop(); return; }
      onSeed(message.seed, message.rows);
      send();
    });
    child.on("error", fail);
    child.on("exit", (code, signal) => {
      children.delete(child);
      if (stopSignal.reason) fail(new RunStopped(stopSignal.reason));
      else if (finished && code === 0) done();
      else fail(new Error(`Worker exited (${code}/${signal}) before finishing: ${stderr}`));
    });
    send();
  })));
}

async function run(planFile: string, outDir: string, workers: number) {
  const plan = JSON.parse(readFileSync(planFile, "utf8")) as GauntletPlan;
  validatePlan(plan);
  if (!Number.isSafeInteger(workers) || workers < 1 || workers > MAX_WORKERS) throw new Error(`Use 1 to ${MAX_WORKERS} workers; more drains the battery.`);
  const battery = batteryState();
  if (battery?.onBattery && battery.percent < LOW_BATTERY_PERCENT) throw new Error(`Battery is at ${battery.percent}% and unplugged; plug in before running.`);

  const release = acquireControllerLock();
  // -s holds off system sleep only while on AC power, so on battery the Mac can still sleep.
  const caffeinate = process.platform === "darwin" ? spawn("/usr/bin/caffeinate", ["-s", "-w", String(process.pid)], { stdio: "ignore" }) : undefined;
  const stopSignal: { reason: string | null; stop: () => void } = { reason: null, stop: () => {} };
  const planHash = hashObject(plan);
  const rows: GauntletRow[] = [];
  let provenance: Record<string, unknown> | null = null;
  let finalized = false;
  // Synchronous on purpose: on a signal the runner may exit right after our handler returns.
  const finalize = (status: "complete" | "aborted" | "failed", reason?: string) => {
    if (finalized) return;
    finalized = true;
    clearInterval(batteryWatch);
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    stopSignal.stop();
    try {
      if (provenance) {
        atomicJSON(`${outDir}/provenance.json`, { ...provenance, status, ...(reason ? { reason } : {}), seedsFinished: new Set(rows.map((row) => row.seed)).size, endedAt: new Date().toISOString() });
        markReservation(planHash, status);
      }
    } finally {
      caffeinate?.kill("SIGTERM");
      release();
    }
  };
  const requestStop = (reason: string) => { if (!stopSignal.reason) { stopSignal.reason = reason; console.error(`Stopping: ${reason}`); stopSignal.stop(); } };
  const onSignal = () => { requestStop("stopped by signal"); finalize("aborted", "stopped by signal"); process.exit(130); };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  const batteryWatch = setInterval(() => {
    const state = batteryState();
    if (state?.onBattery && state.percent < LOW_BATTERY_PERCENT) requestStop(`battery at ${state.percent}% on battery power`);
  }, BATTERY_CHECK_MS);

  try {
    // Throws on any seed the registry has already seen, before a single hand is played.
    const registry = reserveSeeds(readRegistry(), plan.seeds, plan.id, planHash, "gauntlet");
    registry.evaluation_reservations!.at(-1)!.status = "started";
    atomicJSON(REGISTRY, registry);
    mkdirSync(outDir, { recursive: false });
    const base = { plan: plan.id, planHash, commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), dirty: execFileSync("git", ["status", "--porcelain", "lib/poker"], { encoding: "utf8" }).trim() !== "", workers, workerNiceness: WORKER_NICENESS, node: process.version, startedAt: new Date().toISOString() };
    atomicJSON(`${outDir}/plan.json`, plan);
    atomicJSON(`${outDir}/provenance.json`, { ...base, status: "running" });
    provenance = base;
    await runPool(plan, workers, (seed, seedRows) => {
      rows.push(...seedRows);
      writeFileSync(`${outDir}/rows.jsonl`, seedRows.map((row) => JSON.stringify(row)).join("\n") + "\n", { flag: "a" });
      console.log(`seed ${seed} done (${new Set(rows.map((row) => row.seed)).size}/${plan.seeds.length})`);
    }, stopSignal);
    const summary = summarizeGauntlet(plan, rows);
    atomicJSON(`${outDir}/summary.json`, summary);
    finalize("complete");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    finalize(error instanceof RunStopped ? "aborted" : "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

function markReservation(planHash: string, status: string) {
  const registry = readRegistry();
  const reservation = registry.evaluation_reservations?.find((r) => r.protocolHash === planHash);
  if (!reservation) throw new Error(`No registry reservation for plan hash ${planHash}.`);
  reservation.status = status;
  atomicJSON(REGISTRY, registry);
}

const [command, ...args] = process.argv.slice(2);
if (command === "next-seeds") {
  const count = Number(args[0]);
  if (!Number.isSafeInteger(count) || count < 2) throw new Error("Usage: next-seeds <count of at least 2>");
  const seeds = nextSeeds(readRegistry(), count);
  console.log(JSON.stringify({ start: seeds[0], end: seeds.at(-1), count }));
} else if (command === "run" && (args.length === 2 || args.length === 3)) {
  await run(args[0]!, args[1]!, args[2] === undefined ? DEFAULT_WORKERS : Number(args[2]));
} else {
  throw new Error("Usage: next-seeds <count> | run <plan.json> <outDir> [workers]");
}

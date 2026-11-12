import { runGauntletSeed, type GauntletPlan } from "../lib/poker/gauntlet";

process.on("message", (message: { plan: GauntletPlan; seed: number }) => {
  try {
    process.send?.({ seed: message.seed, rows: runGauntletSeed(message.plan, message.seed) });
  } catch (error) {
    process.send?.({ seed: message.seed, error: error instanceof Error ? error.stack : String(error) });
  }
});

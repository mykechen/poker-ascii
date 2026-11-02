import { simplePolicy } from "../lib/poker/bot";
import { candidate } from "../lib/poker/candidate";
import { formatReport, playMatch, type TrainSeat } from "../lib/poker/train";

const hands = flag("hands", 1200);
const seatCount = flag("seats", 6);
const seed = flag("seed", 1);
const stack = flag("stack", 200);
const smallBlind = flag("sb", 1);
const bigBlind = flag("bb", 2);

const seats: TrainSeat[] = Array.from({ length: seatCount }, (_, seat) =>
  seat === 0 ? { name: "Candidate", policy: candidate } : { name: `Chart ${seat + 1}`, policy: simplePolicy },
);

let printed = 0;
const report = playMatch({
  seats,
  hands,
  stack,
  smallBlind,
  bigBlind,
  seed,
  onHand(finished, net) {
    if (finished !== hands && finished - printed < 100) return;
    const score = (net[0] ?? 0) / bigBlind / finished * 100;
    console.log(`${finished} hands, candidate ${score.toFixed(1)} bb/100`);
    printed = finished;
  },
});

console.log("");
console.log(formatReport(report));
console.log("");
console.log("Seat 0 is the candidate. The other seats play the chart. Run this seed again after one change.");

function flag(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value)) {
    console.error(`--${name} needs a whole number.`);
    process.exit(1);
  }
  return value;
}

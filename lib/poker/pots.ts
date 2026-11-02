import { compareScores } from "./evaluator";

export type PotPlayer = {
  seat: number;
  committed: number;
  folded: boolean;
  /** Null when the hand is not shown. */
  score: number[] | null;
};

/**
 * Split each contribution level into its own pot.
 * One leftover chip goes to the winner closest clockwise from the button,
 * starting with the seat immediately left of the button.
 */
export type LivePot = {
  name: string;
  amount: number;
};

/**
 * Pots currently in the middle.
 * A side pot appears only when an all-in stack is smaller than the chips still in front of other players.
 * An unmatched bet stays inside the single pot until someone is all-in for less.
 */
export function describePots(players: { committed: number; allIn: boolean }[]): LivePot[] {
  const active = players.filter((player) => player.committed > 0);
  const total = active.reduce((sum, player) => sum + player.committed, 0);
  if (total === 0) return [];
  const max = Math.max(...active.map((player) => player.committed));
  const cuts = [...new Set(active.filter((player) => player.allIn && player.committed < max).map((player) => player.committed))].sort(
    (a, b) => a - b,
  );
  if (cuts.length === 0) return [{ name: "POT", amount: total }];

  const sizes: number[] = [];
  let previous = 0;
  for (const level of [...cuts, max]) {
    const contributors = active.filter((player) => player.committed >= level);
    const size = (level - previous) * contributors.length;
    previous = level;
    if (size > 0 && contributors.length >= 2) sizes.push(size);
  }
  if (sizes.length === 0) return [{ name: "POT", amount: total }];
  return sizes.map((amount, index) => ({
    name: index === 0 ? "POT" : `SIDE ${index}`,
    amount,
  }));
}

export function settlePots(button: number, players: PotPlayer[]): Map<number, number> {
  const awarded = new Map<number, number>();
  const add = (seat: number, chips: number) => {
    awarded.set(seat, (awarded.get(seat) ?? 0) + chips);
  };

  const levels = [...new Set(players.map((player) => player.committed).filter((n) => n > 0))].sort(
    (a, b) => a - b,
  );
  let previous = 0;
  for (const level of levels) {
    const contributors = players.filter((player) => player.committed >= level);
    const size = (level - previous) * contributors.length;
    previous = level;
    if (size <= 0) continue;

    let eligible = contributors.filter((player) => !player.folded);
    if (eligible.length === 0) {
      const live = players.filter((player) => !player.folded);
      if (live.length === 1) eligible = live;
      else continue;
    }

    let winners = eligible;
    const scored = eligible.filter((player) => player.score !== null);
    if (scored.length === eligible.length && scored.length > 0) {
      let best = scored[0]!.score!;
      for (const player of scored.slice(1)) {
        if (compareScores(player.score!, best) > 0) best = player.score!;
      }
      winners = scored.filter((player) => compareScores(player.score!, best) === 0);
    }

    const share = Math.floor(size / winners.length);
    let remainder = size - share * winners.length;
    for (const player of winners) add(player.seat, share);
    for (const seat of clockwise(button, new Set(winners.map((player) => player.seat)))) {
      if (remainder === 0) break;
      add(seat, 1);
      remainder -= 1;
    }
  }

  return awarded;
}

function clockwise(button: number, seats: Set<number>): number[] {
  const ordered: number[] = [];
  for (let step = 1; step <= 8; step++) {
    const seat = (button + step) % 8;
    if (seats.has(seat)) ordered.push(seat);
  }
  return ordered;
}

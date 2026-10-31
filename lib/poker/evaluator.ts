import { rankValue, suitChar } from "./cards";
import type { Card } from "./types";

export type HandScore = {
  score: number[];
  description: string;
};

const SINGULAR: Record<number, string> = {
  14: "Ace",
  13: "King",
  12: "Queen",
  11: "Jack",
  10: "Ten",
  9: "Nine",
  8: "Eight",
  7: "Seven",
  6: "Six",
  5: "Five",
  4: "Four",
  3: "Three",
  2: "Two",
};

const PLURAL: Record<number, string> = {
  14: "Aces",
  13: "Kings",
  12: "Queens",
  11: "Jacks",
  10: "Tens",
  9: "Nines",
  8: "Eights",
  7: "Sevens",
  6: "Sixes",
  5: "Fives",
  4: "Fours",
  3: "Threes",
  2: "Twos",
};

export function compareScores(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function evaluate(cards: Card[]): HandScore {
  if (cards.length < 5) throw new Error("A hand needs at least five cards.");
  let best: HandScore | null = null;
  for (const five of combinations(cards, 5)) {
    const current = evaluateFive(five);
    if (best === null || compareScores(current.score, best.score) > 0) best = current;
  }
  if (best === null) throw new Error("No five-card hand.");
  return best;
}

function evaluateFive(cards: Card[]): HandScore {
  const ranks = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards.every((item) => suitChar(item) === suitChar(cards[0]!));
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const straightHigh = straightHighCard(ranks);

  if (flush && straightHigh !== null) {
    return {
      score: [8, straightHigh],
      description: straightHigh === 14 ? "Royal flush" : `Straight flush, ${high(straightHigh)}`,
    };
  }
  if (groups[0]?.[1] === 4) {
    return {
      score: [7, groups[0][0], groups[1]![0]],
      description: `Four of a kind, ${PLURAL[groups[0][0]]}`,
    };
  }
  if (groups[0]?.[1] === 3 && groups[1]?.[1] === 2) {
    return {
      score: [6, groups[0][0], groups[1][0]],
      description: `Full house, ${PLURAL[groups[0][0]]} full of ${PLURAL[groups[1][0]]}`,
    };
  }
  if (flush) {
    return { score: [5, ...ranks], description: `Flush, ${high(ranks[0]!)}` };
  }
  if (straightHigh !== null) {
    return { score: [4, straightHigh], description: `Straight, ${high(straightHigh)}` };
  }
  if (groups[0]?.[1] === 3) {
    const kickers = groups.slice(1).map((group) => group[0]);
    return {
      score: [3, groups[0][0], ...kickers],
      description: `Three of a kind, ${PLURAL[groups[0][0]]}`,
    };
  }
  if (groups[0]?.[1] === 2 && groups[1]?.[1] === 2) {
    return {
      score: [2, groups[0][0], groups[1][0], groups[2]![0]],
      description: `Two pair, ${PLURAL[groups[0][0]]} and ${PLURAL[groups[1][0]]}`,
    };
  }
  if (groups[0]?.[1] === 2) {
    const kickers = groups.slice(1).map((group) => group[0]);
    return {
      score: [1, groups[0][0], ...kickers],
      description: `Pair of ${PLURAL[groups[0][0]]}`,
    };
  }
  return { score: [0, ...ranks], description: `${SINGULAR[ranks[0]!]} high` };
}

function high(rank: number): string {
  if (rank === 5) return "five high";
  return `${SINGULAR[rank]} high`;
}

function straightHighCard(ranksDesc: number[]): number | null {
  const unique = [...new Set(ranksDesc)];
  const withWheel = unique.includes(14) ? [...unique, 1] : unique;
  const ordered = [...new Set(withWheel)].sort((a, b) => b - a);
  for (let i = 0; i <= ordered.length - 5; i++) {
    const slice = ordered.slice(i, i + 5);
    if (slice[0]! - slice[4]! === 4) return slice[0] === 1 ? 5 : slice[0]!;
  }
  return null;
}

function combinations<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, chosen: T[]) => {
    if (chosen.length === size) {
      out.push([...chosen]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      chosen.push(items[i]!);
      pick(i + 1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return out;
}

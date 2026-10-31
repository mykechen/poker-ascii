import type { Card, Rank, Suit } from "./types";

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export const SUITS = ["c", "d", "h", "s"] as const;

const CARD_RE = /^[2-9TJQKA][cdhs]$/;

const SUIT_SYMBOL: Record<Suit, string> = {
  c: "♣",
  d: "♦",
  h: "♥",
  s: "♠",
};

export function isCard(value: string): value is Card {
  return CARD_RE.test(value);
}

export function card(value: string): Card {
  if (!isCard(value)) throw new Error(`Bad card ${value}`);
  return value;
}

export function rankChar(value: Card): Rank {
  return value[0] as Rank;
}

export function suitChar(value: Card): Suit {
  return value[1] as Suit;
}

/** Ace is 14. */
export function rankValue(value: Card): number {
  const index = RANKS.indexOf(rankChar(value));
  return index + 2;
}

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) deck.push(`${rank}${suit}`);
  }
  return deck;
}

export function shuffleDeck(rng: () => number = Math.random): Card[] {
  const deck = freshDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const current = deck[i];
    const swap = deck[j];
    if (current === undefined || swap === undefined) continue;
    deck[i] = swap;
    deck[j] = current;
  }
  return deck;
}

export function cardParts(value: Card): { rank: string; suit: string } {
  return { rank: value[0] === "T" ? "T" : value[0], suit: SUIT_SYMBOL[suitChar(value)] };
}

export function formatCards(cards: Card[]): string {
  return cards.map((item) => item).join(" ");
}

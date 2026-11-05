import { freshDeck, isCard } from "./cards";
import { compareScores, evaluate } from "./evaluator";
import { mulberry32 } from "./train";
import type { Card } from "./types";

export type WeightedHand = { cards: [Card, Card]; weight: number };
export type EquityInput = { hero: [Card, Card]; board: Card[]; opponents: WeightedHand[][]; pots?: { amount: number; eligible: number[] }[]; samples?: number; seed?: number; exactLimit?: number };
export type EquityResult = { equity: number; expectedPayout: number | null; standardError: number; method: "exact" | "monte-carlo"; outcomes: number; attempts: number };

export function uniformRange(): WeightedHand[] {
  const deck = freshDeck();
  return deck.flatMap((a,i)=>deck.slice(i+1).map(b=>({cards:[a,b] as [Card,Card],weight:1})));
}

export function estimateEquity(input: EquityInput): EquityResult {
  const known = [...input.hero, ...input.board];
  if (input.hero.length !== 2 || ![0,3,4,5].includes(input.board.length) || known.some(c=>!isCard(c)) || new Set(known).size !== known.length) throw new Error("Invalid or duplicate known cards.");
  if (input.opponents.length < 1 || input.opponents.length > 7) throw new Error("Provide one to seven opponent ranges.");
  if (input.pots?.some(p=>!Number.isFinite(p.amount) || p.amount<0 || !p.eligible.length || new Set(p.eligible).size!==p.eligible.length || p.eligible.some(i=>!Number.isInteger(i) || i<0 || i>input.opponents.length))) throw new Error("Invalid pot eligibility.");
  const samples = input.samples ?? 1000;
  const limit = input.exactLimit ?? 10000;
  if (!Number.isSafeInteger(samples) || samples < 2 || samples > 1000000 || !Number.isSafeInteger(limit) || limit < 0 || limit > 1000000 || !Number.isSafeInteger(input.seed ?? 1)) throw new Error("Invalid sampling budget or seed.");
  const ranges = input.opponents.map(range => {
    const seen = new Set<string>();
    for (const hand of range) {
      if (hand.cards.length !== 2 || hand.cards.some(c=>!isCard(c)) || hand.cards[0] === hand.cards[1] || !Number.isFinite(hand.weight) || hand.weight < 0) throw new Error("Invalid weighted hand.");
      const key = [...hand.cards].sort().join("");
      if (seen.has(key)) throw new Error("Duplicate range combination.");
      seen.add(key);
    }
    const valid = range.filter(h=>h.weight>0 && h.cards.every(c=>!known.includes(c)));
    if (!valid.length) throw new Error("No compatible hands in opponent range.");
    const maximum = Math.max(...valid.map(h=>h.weight));
    const total = valid.reduce((n,h)=>n+h.weight/maximum,0);
    return valid.map(h=>({...h,weight:(h.weight/maximum)/total}));
  });
  const missing = 5-input.board.length;
  let boards = 1;
  const remaining = 52-known.length-2*ranges.length;
  for(let i=1;i<=missing;i++) boards *= (remaining-i+1)/i;
  const upper = ranges.reduce((n,r)=>n*r.length,boards);
  let sum=0, squares=0, mass=0, outcomes=0, attempts=0, payout=0;
  const score = (hands: WeightedHand[], board: Card[], weight: number) => {
    const hero = evaluate([...input.hero,...board]).score;
    let ties=1, lost=false;
    for(const hand of hands) {
      const comparison=compareScores(evaluate([...hand.cards,...board]).score,hero);
      if(comparison>0) {lost=true;break;}
      if(comparison===0) ties++;
    }
    const share=lost?0:1/ties;
    if (input.pots) {
      const scores=[hero,...hands.map(hand=>evaluate([...hand.cards,...board]).score)];
      for(const pot of input.pots) {
        if(!pot.eligible.includes(0)) continue;
        const comparisons=pot.eligible.map(i=>compareScores(scores[i]!,hero));
        if(!comparisons.some(c=>c>0)) payout+=weight*pot.amount/comparisons.filter(c=>c===0).length;
      }
    }
    sum+=weight*share; squares+=weight*share*share; mass+=weight; outcomes++;
  };
  if(upper<=limit) {
    const visit = (hands: WeightedHand[], used: Set<Card>, weight: number) => {
      if(hands.length<ranges.length) {
        for(const hand of ranges[hands.length]!) if(hand.cards.every(c=>!used.has(c))) visit([...hands,hand],new Set([...used,...hand.cards]),weight*hand.weight);
        return;
      }
      const deck=freshDeck().filter(c=>!used.has(c));
      const complete = (extra: Card[], start: number) => {
        if(extra.length===missing) {score(hands,[...input.board,...extra],weight);return;}
        for(let i=start;i<=deck.length-(missing-extra.length);i++) complete([...extra,deck[i]!],i+1);
      };
      complete([],0);
    };
    visit([],new Set(known),1);
    if(!mass) throw new Error("No compatible joint opponent hands.");
    return {equity:sum/mass,expectedPayout:input.pots?payout/mass:null,standardError:0,method:"exact",outcomes,attempts:outcomes};
  }
  const random=mulberry32(input.seed??1);
  const cumulative=ranges.map(range=>{let total=0;return range.map(hand=>({hand,cut:total+=hand.weight}));});
  while(outcomes<samples && attempts<samples*100) {
    attempts++;
    const used=new Set(known);
    const hands: WeightedHand[]=[];
    for(const range of cumulative) {
      const draw=random();
      const hand=(range.find(h=>draw<h.cut)??range[range.length-1]!).hand;
      if(hand.cards.some(c=>used.has(c))) break;
      hands.push(hand);hand.cards.forEach(c=>used.add(c));
    }
    // Reject the entire joint draw; sequentially renormalizing ranges biases compatible combinations.
    if(hands.length!==ranges.length) continue;
    const deck=freshDeck().filter(c=>!used.has(c));
    for(let i=0;i<missing;i++) {const j=i+Math.floor(random()*(deck.length-i));[deck[i],deck[j]]=[deck[j]!,deck[i]!];}
    score(hands,[...input.board,...deck.slice(0,missing)],1);
  }
  if(outcomes<samples) throw new Error("Unable to sample compatible joint ranges within budget.");
  const equity=sum/mass;
  const variance=Math.max(0,(squares-outcomes*equity*equity)/(outcomes-1));
  return {equity,expectedPayout:input.pots?payout/mass:null,standardError:Math.sqrt(variance/outcomes),method:"monte-carlo",outcomes,attempts};
}

import type { Street } from "./types";

export type ActionClass = "fold" | "passive" | "aggressive";
type Counts = { fold: number; passive: number; aggressive: number };

/** Session-local descriptive frequencies; hand strength is never inferred as an observed label. */
export class OpponentModel {
  private players = new Map<string, Map<string, Counts>>();
  constructor(readonly priorStrength = 12) {
    if (!Number.isFinite(priorStrength) || priorStrength <= 0) throw new Error("Prior strength must be positive.");
  }
  startSession(ids: string[]): void {
    if (new Set(ids).size !== ids.length || ids.some(id=>!id)) throw new Error("Session identities must be unique and nonempty.");
    this.players = new Map(ids.map(id=>[id,new Map()]));
  }
  private counts(id: string, street: Street, facingBet: boolean): Counts {
    const player=this.players.get(id);
    if (!player) throw new Error(`Unknown opponent session ${id}.`);
    const key=`${street}:${facingBet}`;
    let counts=player.get(key);
    if (!counts) {counts={fold:0,passive:0,aggressive:0};player.set(key,counts);}
    return counts;
  }
  record(id: string, street: Street, facingBet: boolean, action: ActionClass): void {
    if (!facingBet && action==="fold") throw new Error("Fold observation requires a faced bet.");
    this.counts(id,street,facingBet)[action]++;
  }
  tendency(id: string, street: Street, facingBet: boolean) {
    const c=this.counts(id,street,facingBet);
    const samples=c.fold+c.passive+c.aggressive;
    const mass=this.priorStrength+samples;
    const foldMean=facingBet?(this.priorStrength*0.5+c.fold)/mass:0;
    const aggressiveMean=(this.priorStrength*(facingBet?0.2:0.3)+c.aggressive)/mass;
    return {samples,foldMean,aggressiveMean,foldVariance:foldMean*(1-foldMean)/(mass+1),aggressiveVariance:aggressiveMean*(1-aggressiveMean)/(mass+1)};
  }
}

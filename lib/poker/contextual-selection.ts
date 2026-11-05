import {forecastScores} from "./forecast-diagnostics";
import {supportKey} from "./contextual-response";
import type {ReplayObservation} from "./contextual-replay";
import type {Probabilities} from "./contextual-response";
type Score=ReturnType<typeof forecastScores>;
export type SelectionScore={id:string;scores:Score;groups:Record<string,Score>};
export function panelScores(id:string,rows:(ReplayObservation&{probabilities:Probabilities})[]):SelectionScore {
 const flop=rows.filter(r=>r.board.length===3);
 const key=(r:typeof flop[number])=>`${supportKey(r.probabilities)}:${r.context.facing}`;
 return {id,scores:forecastScores(flop),groups:Object.fromEntries([...new Set(flop.map(key))].sort().map(k=>[k,forecastScores(flop.filter(r=>key(r)===k))]))};
}
export function selectResponse(candidates:SelectionScore[]):string {
 const current=candidates.find(c=>c.id==="current");if(!current)throw new Error("Selection requires current baseline.");
 const eligible=candidates.filter(c=>c.id==="current"||c.scores.logLoss<=current.scores.logLoss*.99&&c.scores.brier<=current.scores.brier&&Object.entries(current.groups).every(([key,base])=>base.count<100||!!c.groups[key]&&c.groups[key]!.logLoss<=base.logLoss+.02));
 const best=Math.min(...eligible.map(c=>c.scores.logLoss));
 const rank=(id:string)=>id==="current"?0:id==="frequency"?1:id==="uniform"?2:3;
 return eligible.filter(c=>c.scores.logLoss<=best+1e-6).sort((a,b)=>rank(a.id)-rank(b.id)||(Number(b.id.split(":")[1])||0)-(Number(a.id.split(":")[1])||0))[0]!.id;
}

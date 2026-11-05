export type RunHandoff = {
  id:string;status:"running"|"complete"|"failed"|"interrupted";sourceCommit:string;sourceHash:string;updatedAt:string;
  completedBatches:number;scheduledBatches:number;plan:unknown;configurations:unknown;selected:unknown;results?:unknown;error?:string;nextSteps:string[];
};
export function renderHandoff(run:RunHandoff):string {
  const json=(value:unknown)=>"```json\n"+JSON.stringify(value,null,2)+"\n```";
  return [`# Run ${run.id}`,`Status: **${run.status}** · Updated: ${run.updatedAt}`,`Source commit: ${run.sourceCommit}\n\nSource fingerprint: ${run.sourceHash}`,`Completed batches: ${run.completedBatches}/${run.scheduledBatches}`,"## Objective and settings", "No cross-hand opponent memory. Preserve within-hand range inference. Fixed 100bb stacks, 1/2 blinds, no rake; 6–8 players.",json(run.plan),"## Configurations",json(run.configurations),"## Frozen tuning selection",json(run.selected),...(run.results?["## Results",json(run.results)]:[]),...(run.error?["## Failure",run.error]:[]),"## Limits","Small screening runs do not establish superiority. Prediction scores are action-level diagnostics with correlated observations. Historical runs on different seeds are not paired comparisons. No live-policy promotion is automatic.","## Next steps",...run.nextSteps.map(step=>`- ${step}`),"\nMachine-readable summary and compressed raw checkpoint are stored beside this handoff."].join("\n\n")+"\n";
}

type RunStatus = {complete:boolean;status:RunHandoff["status"];error?:string};
export function restartHandoff(state:RunStatus):void {
  state.status=state.complete?"complete":"running";
  delete state.error;
}
export function interruptHandoff(state:RunStatus):void {
  if(!state.complete)state.status="interrupted";
}

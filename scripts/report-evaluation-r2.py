"""Finalize the already-frozen exploratory analysis; never launch or extend a game run."""
import json,math,hashlib,datetime
from pathlib import Path
from python.evaluation.analyze import load,report
from python.evaluation.confirmatory import budget_scenario
root=Path('handoffs/evaluation-2026-11-09-r2')
frozen=json.loads((root/'analysis-source-pilot.json').read_text())
for file,content in frozen['files'].items():
    if Path(file).read_text()!=content:raise SystemExit('Frozen analysis changed: '+file)
def save(name,value):
    with (root/name).open('x') as f:json.dump(value,f,indent=2);f.write('\n')
def wall_rate(name):
    d=root/name;p=json.loads((d/'provenance.json').read_text());t=json.loads((d/'timing.json').read_text())
    if p['status']!='complete':raise ValueError('Incomplete cost measurement')
    seconds=(datetime.datetime.fromisoformat(p['endedAt'])-datetime.datetime.fromisoformat(p['startedAt'])).total_seconds()
    return min(t['handsPerHour'],t['physicalHands']/seconds*3600)
choice=json.loads((root/'worker-choice.json').read_text())
raw_rate=.8*min(wall_rate('raw-cost'),wall_rate('raw-cost-matched'))
adj_rate=.8*min(choice['conservativeLaunchRate']/.8,wall_rate('sustained-14-awake'),wall_rate('variance-pilot'))
rows=load(root/'variance-pilot');m=report(rows,adj_rate,raw_rate)
m['analysisSourceHash']=frozen['hash'];m['workers']=choice['workers']
m['measuredRates']={name:wall_rate(name) for name in ['raw-cost','raw-cost-matched','sustained-14-awake','variance-pilot']}
save('pilot-metrics.json',m)
if not m['unbiasednessDiagnostic']['passed']:raise SystemExit('STOP: main-pilot adjustment diagnostic excludes zero; report before any further use')
# Costs are actual run wall time; incomplete technical runs never supply return/variance samples.
spent=[]
for d in root.iterdir():
    if not d.is_dir() or not (d/'provenance.json').exists():continue
    p=json.loads((d/'provenance.json').read_text())
    if 'startedAt' in p and 'endedAt' in p:
        seconds=(datetime.datetime.fromisoformat(p['endedAt'])-datetime.datetime.fromisoformat(p['startedAt'])).total_seconds()
        spent.append({'run':d.name,'hours':seconds/3600,'status':p['status']})
    elif p.get('status')=='aborted-runtime-prediction':spent.append({'run':d.name,'hours':1/6,'status':'conservative ten-minute charge; exact abort timestamp unavailable'})
unit=json.loads((root/'unit-replay.json').read_text())
spent.append({'run':'SD diagnostic replay','hours':unit['elapsedMs']/3600000,'status':'complete'})
spent.append({'run':'verification/golden allowance','hours':.25,'status':'conservative allowance covering archived test/golden runs'})
spent_hours=sum(s['hours'] for s in spent)
# This phase's models do not exist. These remain explicitly labeled cost/variance proxy scenarios.
factor=m['varianceUpper95FactorNormalClusterApprox']
metric=min(['rawBb','adjustedBb'],key=lambda k:m['designs'][k]['rotated']['variance']/(raw_rate if k=='rawBb' else adj_rate))
rate=raw_rate if metric=='rawBb' else adj_rate
variance=m['designs'][metric]['rotated']['variance']*factor
paired_hands=m['designs'][metric]['rotated']['physicalHandsPerUnit']
delta=m['exploratorySamplingDeltaBb100'];mean=delta['mean'];lower=delta['ci95'][0]
assumed=mean if mean<0 else max(0,min(mean/2,lower))
ni=None
if assumed>-5:ni=budget_scenario(variance,assumed,rate,paired_hands,arms=2,threshold=-5,comparisons=1)
engineering_caps={'Task4.0 heuristic exploratory screen':2,'Task3A exporter/bridge checks':.5,'Task4A labels allowance (not throughput guarantee)':4,'Task4B fixed training allowance':2,'Task5 parity/latency checks':.5}
allowance=sum(engineering_caps.values())
scenarios=[]
for threshold in [0,5]:
    for effect in [10,20,30]:
        s=budget_scenario(variance,effect,rate,paired_hands,arms=3,threshold=threshold,comparisons=3)
        s['claim']='superiority' if threshold==0 else 'at least +5'
        s['allPlanPredictedHours']=spent_hours+allowance+ni['predictedHours']+s['predictedHours'] if ni else None
        s['allPlanReservedRunSlotHours']=spent_hours+allowance+ni['runSlotsHours']+s['runSlotsHours'] if ni else None
        s['fits48Predicted']=s['allPlanPredictedHours'] is not None and s['allPlanPredictedHours']<=48;s['fits48ReservedSlots']=s['allPlanReservedRunSlotHours'] is not None and s['allPlanReservedRunSlotHours']<=48
        scenarios.append(s)
options=[budget_scenario(variance,effect,rate,paired_hands,arms=2,threshold=0,comparisons=1) for effect in [10,20,30]]
result={'classification':'Planning proxies only; not permission to execute Phase1B/3+ or final policy-specific N','budgetHours':48,'thisSessionComputeHours':spent_hours,'spent':spent,'engineeringCapsHours':engineering_caps,'recommendedCurrentEstimator':metric,'varianceUpperFactor':factor,'varianceUpper':variance,'planningPhysicalHandsPerHour':rate,'samplingNI':ni,'samplingAssumedTrueEffectBb100':assumed,'samplingAssumptionRule':'negative mean retained; otherwise max(0,min(half mean, nominal95% lower bound))','samplingMarginProposalBb100':5,'ABCPrimaryScenarios':scenarios,'singleCandidateOption':options,'limitations':['Future model/heuristic variance, covariance and latency unmeasured; freeze new pilot-based N before confirmation.','ABC counts size the primary model-v1 contrast with family3 correction; secondary contrasts are not guaranteed80% power without coherent effect assumptions.','Engineering allowances are hard compute envelopes, not proof of adequate training data/model quality.','Budget excludes inactive approval/calendar waiting, includes suspended time within a launched run.','Ten-minute sustained target yielded fixed completed windows512–567s; winner540s, not an exactly600s completed run.']}
save('confirmatory-budget.json',result)
print(json.dumps({'rawRate':raw_rate,'adjustedRate':adj_rate,'estimator':metric,'spentHours':spent_hours,'samplingNI':ni,'abc':scenarios},indent=2))
# A reviewable Markdown appendix keeps all assumptions next to the numbers.
lines=['\n## Completed exploratory pilot and measured power\n']
lines.append(f"Frozen run:840 independent seeds,70,560 physical simulations; observed unique base decks {m['observedUniqueBaseDecks']:,}, distinct table/deal layouts {m['observedDistinctTableDealLayouts']:,}. All seeds120001–120840 are retired from confirmation. Fourteen workers selected; main wall throughput {m['measuredRates']['variance-pilot']:,.0f}hands/hour. No adoption or profit claim.\n")
for arm,v in m['arms'].items():lines.append(f"- Arm{arm}: raw SD {v['rawSD']:.4f}bb/hand; adjusted SD {v['adjustedSD']:.4f}; adjusted/raw hand variance {v['varianceRatio']:.4f}.\n")
lines.append(f"\nPer-hand cross-arm correlations: raw {m['perHandCorrelation']['rawBb']:.4f}, adjusted {m['perHandCorrelation']['adjustedBb']:.4f}. Planning rates, after20%safety reduction: raw {raw_rate:,.0f}, adjusted {adj_rate:,.0f}physical hands/hour on14workers. Full raw/adjusted cluster correlations and variances are in evaluation-2026-11-09-r2/pilot-metrics.json.\n")
lines.append(f"Variance-upper sensitivity multiplier {factor:.4f} assumes approximately normal independent cluster means. Counts below use that upper variance, not just the point estimate; normal power approximation,80%power, Bonferroni3 two-sided family alpha.05. The +5 scenario is sensitivity only, not a default confirmatory effect assumption.\n")
for metric_name,designs in m['designs'].items():
    for design,d in designs.items():
        lines.append(f"\n### {metric_name}: {design}\n\nIndependent unit: {d['independentUnit']}; {d['physicalHandsPerUnit']:g}physical simulations/unit. Full schedule balancing quantum {d['seedBalancingQuantum']}units. Single-rotation scenarios need explicit scheduling support before execution; current runner executes full rotations.\n")
        for effect,s in d['scenariosSuperiorityBonferroni3'].items():
            lines.append(f"- True +{effect}bb/100: {s['conservativeUpperVarianceSeedUnits']:,}units, {int(s['conservativePhysicalHands']):,}physical hands, {s['conservativeHours']:.2f}wall hours, {s['conservativeRuns']}runs of at most2h (<=90min predicted work/run). Point-variance estimate: {s['hours']:.2f}h.\n")
lines.append('\n## Remaining confirmatory compute and the48-hour budget\n')
lines.append(f"This session is conservatively charged {spent_hours:.2f}compute hours, including interrupted/capped runs and a15-minute verification/golden allowance. Inactive permission/calendar waiting is excluded; suspended time within a launched run is included. Engineering allowances for remaining stages total {allowance:g}h, including2h heuristic screen,0.5h bridge,4h labels,2h training,0.5h parity/latency. These are budget caps, not proven throughput or data adequacy.\n")
lines.append(f"For the currently implemented50/128 comparison, {metric} has the better full-rotation variance/time ratio and is the current estimator proposal. Future policies require remeasurement. Sampling pilot adjusted macro delta is {mean:.2f}bb/100 with nominal descriptive95%CI[{delta['ci95'][0]:.2f},{delta['ci95'][1]:.2f}]. This is exploratory, not promotion evidence. Prespecified conservative planning effect is {assumed:.3f}bb/100; proposed noninferiority null is−5bb/100.\n")
if ni:
    lines.append(f"- Task1B: {ni['requiredSeedClusters']:,}fresh seed clusters, {ni['totalPhysicalHands']:,}physical hands ({ni['handsPerArm']:,}/arm), {ni['runsAtMostTwoHours']}runs, {ni['predictedHours']:.2f}predicted wall hours; {ni['runSlotsHours']:.0f}h if all two-hour slots are charged. One adoption contrast,95%two-sided lower bound (one-sided alpha.025) must exceed−5. This5bb/100 margin is a NEW concrete proposal for owner review; cost<=3x and original latency proposals are unchanged.\n")
else:lines.append('- Task1B: the conservative assumed true effect does not exceed the proposed−5margin; no finite80%power design is justified at that assumption. Return to owner rather than manufacture N or freeze128.\n')
lines.append('\nTask6 is one shared three-arm family, not three separately charged experiments. Counts below size primary model−v1 with Bonferroni3; they do not promise80%power for both secondary contrasts. Required final N cannot be frozen until model/heuristic variance, covariance, latency and coherent expected effects are measured in separate exploratory pilots. Current50/128 variance/cost is only a proxy.\n')
for s in scenarios:
    total='not determined' if s['allPlanPredictedHours'] is None else f"{s['allPlanPredictedHours']:.2f}h predicted / {s['allPlanReservedRunSlotHours']:.2f}h reserved slots"
    lines.append(f"- {s['claim']}, true +{s['assumedTrueEffectBb100']}: {s['requiredSeedClusters']:,}clusters, {s['totalPhysicalHands']:,}total hands ({s['handsPerArm']:,}/arm), {s['runsAtMostTwoHours']}runs, {s['predictedHours']:.2f}h test work. Whole-plan total {total}. Fits48h: predicted={s['fits48Predicted']}, full slots={s['fits48ReservedSlots']}.\n")
lines.append('\nBudget options if a row does not fit: use Task4.0 to justify a larger assumed true effect before final N; retain the original50 configuration only by an explicit owner baseline decision if128 adoption is infeasible; investigate AIVAT/chance controls under a separate fixed pilot; or propose a single independently selected candidate versus v1, dropping the three-arm family and its secondary claims. The last option changes multiplicity and scope and requires owner review.\n')
for s in options:lines.append(f"- Single-candidate option, true +{s['assumedTrueEffectBb100']}superiority: {s['totalPhysicalHands']:,}hands, {s['runsAtMostTwoHours']}runs, {s['predictedHours']:.2f}h (one contrast, no model/heuristic secondary claims).\n")
lines.append('\nNo Phase1B, heuristic control, Phase3, rollout-label generation or model work was started in this session. The full future plan fits only conditionally on the effect/variance/cost assumptions shown; unmeasured model behavior is not a budget guarantee. All final manifests must pass freshness and budget gates before launch.\n')
plan=Path('handoffs/PLAN-2026-11-09-r2.md')
if '## Completed exploratory pilot and measured power' in plan.read_text():raise SystemExit('Appendix already exists; do not overwrite reviewed results')
with plan.open('a') as f:f.writelines(lines)

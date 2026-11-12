import json,statistics as st,math
from pathlib import Path
from collections import defaultdict
from python.evaluation.analyze import load
from python.evaluation.power import paired_ci,required_units,chi_square_quantile
root=Path('handoffs/heuristic-screen-2026-11-12/screen')
assert json.loads((root/'controller.json').read_text())['status']=='all-runs-complete-awaiting-pooled-analysis'
rows=load(root/'run-1');cells=defaultdict(list)
for r in rows:cells[r['seed'],r['arm'],r['cell'],r['players']].append(r['rawBb'])
macro=defaultdict(list)
for (seed,arm,cell,players),values in cells.items():macro[seed,arm].append(st.mean(values))
seeds=sorted({r['seed'] for r in rows})
delta=[100*(st.mean(macro[s,'control'])-st.mean(macro[s,'v1'])) for s in seeds]
ci=paired_ci(delta)
timing=json.loads((root/'run-1/timing.json').read_text());stats=defaultdict(int)
for t in timing['seedTimings']:
 for v in t['controlStats'].values():
  for k,n in v.items():stats[k]+=n
variance=st.variance(delta)/10000
factor=(len(seeds)-1)/chi_square_quantile(.05,len(seeds)-1)
rate=.85*timing['handsPerHour']
scenarios={}
for effect in [5,10,20,30,40,50]:
 n=math.ceil(required_units(variance*factor,effect,comparisons=3)/5)*5
 hands=n*126
 scenarios[effect]=dict(seedClusters=n,threeArmHands=hands,wallHours=hands/rate,twoHourRuns=math.ceil(hands/(rate*1.5)))
out=dict(classification='Exploratory heuristic screen; no promotion claim',physicalHands=len(rows),seedClusters=len(seeds),controlMinusV1Bb100=ci,exposure=dict(stats),rawClusterVariance=variance,varianceUpperFactor=factor,measuredHandsPerHour=timing['handsPerHour'],planningHandsPerHour=rate,conservativePlanningEffectBb100=max(0,min(ci['mean']/2,ci['ci95'][0])),threeArmPowerProxies=scenarios,limitations=['Future model variance and latency remain unmeasured','Power uses this heuristic contrast as a proxy and80%power withBonferroni3','Raw scoring; exploratory seeds retired'])
(root/'result.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))

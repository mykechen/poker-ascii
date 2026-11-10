"""One pooled, prespecified raw-return adoption analysis after both complete runs."""
import json,hashlib,statistics as st
from pathlib import Path
from collections import defaultdict
from python.evaluation.analyze import load
from python.evaluation.power import paired_ci
root=Path('handoffs/adoption-2026-11-10')
study=json.loads((root/'study.json').read_text());controller=json.loads((root/'controller.json').read_text())
if controller['status']!='all-runs-complete-awaiting-pooled-analysis':raise SystemExit('Both runs must complete; no interim return analysis')
rows=[];seeds=set();pool_hash=None
for run in study['runs']:
 d=Path(run['out']);p=json.loads((d/'protocol.json').read_text());prov=json.loads((d/'provenance.json').read_text())
 if prov['protocolHash']!=run['protocolHash'] or p['sourceHash']!=study['sourceHash'] or prov['diagnosticReuse'] or p['adjustAllIn']:raise ValueError('Study/source/scoring identity mismatch')
 if pool_hash is not None and pool_hash!=p['poolHash']:raise ValueError('Pool changed between runs')
 pool_hash=p['poolHash']
 if seeds.intersection(p['seeds']):raise ValueError('Seed reuse across runs')
 seeds.update(p['seeds']);rows.extend(load(d))
if len(seeds)!=study['clusters'] or len(rows)!=study['physicalHands']:raise ValueError('Incomplete study')
cells=defaultdict(list)
for r in rows:cells[r['seed'],r['arm'],r['cell'],r['players']].append(r['rawBb'])
macro=defaultdict(list)
for (seed,arm,cell,players),values in cells.items():macro[seed,arm].append(st.mean(values))
differences=[100*(st.mean(macro[s,'128'])-st.mean(macro[s,'50'])) for s in sorted(seeds)]
ci=paired_ci(differences);lower=ci['ci95'][0]
result={'classification':'Independent fixed-work adoption confirmation, not final model-goal test','metric':'128-minus-50 raw bb/100, equal seed/stratum/table/rotation weights','physicalHands':len(rows),'handsPerArm':len(rows)//2,'independentSeedClusters':len(seeds),'result':ci,'noninferiorityMarginBb100':5,'passedNoninferiority':lower>-5,'alpha':'one contrast95%two-sided CI; one-sided lower-tail alpha.025','adoptionDecision':'pending fresh cost check','noOptionalStopping':True,'sourceHash':study['sourceHash'],'studyHash':hashlib.sha256((root/'study.json').read_bytes()).hexdigest(),'analysisScript':Path(__file__).read_text(),'statisticsSourceHash':hashlib.sha256(Path('python/evaluation/power.py').read_bytes()).hexdigest(),'reference':'128sampling effect is not counted toward the later +5goal if128 becomesv1'}
with (root/'pooled-result.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in result.items() if k!='analysisScript'},indent=2))

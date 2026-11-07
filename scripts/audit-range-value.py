"""Audit reproduced inspected histories and summarize paired diagnostic differences."""
import gzip,json,math,sys
from pathlib import Path
from collections import defaultdict
p=Path(sys.argv[1]);progress=json.loads((p/'progress.json').read_text());summary=json.loads((p/'summary.json').read_text())
assert progress['status']=='complete' and progress['completedSeeds']==list(range(93001,93011))
records=[];matches=hands=0
for seed in progress['completedSeeds']:
 raw=json.loads(gzip.decompress((p/f'reproduction-{seed}.json.gz').read_bytes()))
 archived=json.loads(gzip.decompress((Path(progress['settings']['sourceRun'])/f'challenge-independent-{seed}-current.json.gz').read_bytes()))
 for cell in raw['reproduced']:
  original=next(c for c in archived['batch']['cells'] if c['players']==cell['players'] and c['field']==cell['field'])
  assert cell['report']['runs']==original['report']['runs']
  for run in cell['report']['runs']:
   r=run['report'];matches+=1;hands+=r['hands'];assert sum(r['net'])==0 and all(x==0 for x in r['fallbacks'])
 records+=raw['rangeRecords']
assert matches==420 and hands==1680
assert len(records)%2==0
for a,b in zip(records[::2],records[1::2]):
 assert a['model']=='current' and b['model']=='offset'
 assert all(a[k]==b[k] for k in ['seed','field','players','rotation','match','hand','seat','actual','support','observerActive','family'])
for r in records:
 assert all(math.isfinite(r[k]) for k in ['beforeLoss','afterLoss','informationGain','actionLoss'])
 for phase in ['before','after']:
  assert abs(r[phase+'Loss']+math.log(max(1e-12,r[phase+'Probability'])))<1e-9
 assert abs(r['informationGain']-(r['beforeLoss']-r['afterLoss']))<1e-9
 assert r['model'] in ['current','offset']
def mean(xs):return sum(xs)/len(xs) if xs else None
def stats(xs):
 m=mean(xs);return {'count':len(xs),'mean':m,'seedSE':math.sqrt(sum((x-m)**2 for x in xs)/(len(xs)-1)/len(xs)) if len(xs)>1 else None,'interval95':None}
def range_delta(rows,equal_hand=False):
 result={}
 for metric in ['beforeLoss','afterLoss','informationGain','actionLoss']:
  seed_values=[]
  for seed in progress['completedSeeds']:
   bymodel={m:[r for r in rows if r['seed']==seed and r['model']==m] for m in ['current','offset']}
   if not bymodel['current']:continue
   def score(rs):
    if not equal_hand:return mean([r[metric] for r in rs])
    groups=defaultdict(list)
    for r in rs:groups[tuple(r[k] for k in ['field','players','rotation','match','hand'])].append(r[metric])
    return mean([mean(v) for v in groups.values()])
   seed_values.append(score(bymodel['offset'])-score(bymodel['current']))
  result[metric]=stats(seed_values)
 return result
states=json.loads(gzip.decompress((p/'selected-states.json.gz').read_bytes()))
assert len(states)==len(summary['valueResults'])==len(progress['completedStates'])==min(160,progress['eligibleHands'])
assert [s['id'] for s in states]==sorted(s['id'] for s in states)
assert len({s['id'] for s in states})==len(states)
import hashlib
for state in states:
 i=state['identity'];expected=hashlib.sha256(json.dumps([i['seed'],i['field'],i['players'],i['rotation'],i['hand'],state['view']['street'],len(state['view']['log'])],separators=(',',':')).encode()).hexdigest()
 assert expected==state['id']
 assert state['view']['seats'][state['view']['toAct']]['hole']==state['holes'][str(state['view']['toAct'])]
 assert all(seat['hole'] in [None,'down'] for seat in state['view']['seats'] if seat['seat']!=state['view']['toAct'])
values=[]
for state in states:
 r=json.loads((p/f"value-{state['id'][:20]}.json").read_text());assert r['id']==state['id'] and r['identity']==state['identity']
 assert r['current50']['action']==state['actualAction'] and abs(r['current50']['callValue']-state['baselineCallValue'])<1e-8
 for m in ['current','offset']:
  v=r['models'][m];ref=v['reference'];assert ref['action']==('call' if ref['callValue']>=0 else 'fold')
  assert len(v['replicates'])==8
  assert abs(v['absoluteValueError']-abs(v['valueError']))<1e-9
  assert abs(v['samplingFlipFraction']-sum(x['action']!=ref['action'] for x in v['replicates'])/8)<1e-9
  if m=='current':assert v['replicates'][0]==r['current50']
  assert abs(v['valueError']-(ref['callValue']-r['oracle']['callValue']))<1e-8
  assert abs(v['referencePayoff']-(r['oracle']['callValue'] if ref['action']=='call' else 0))<1e-8
  assert abs(v['privilegedInformationGap']-(max(0,r['oracle']['callValue'])-v['referencePayoff']))<1e-8
 values.append(r)
value_metrics={}
for m in ['current','offset']:
 value_metrics[m]={metric:mean([r['models'][m][metric] for r in values]) for metric in ['absoluteValueError','valueError','privilegedInformationGap','referencePayoff','samplingFlipFraction']}
 value_metrics[m]['rootMeanSquaredValueError']=math.sqrt(mean([r['models'][m]['valueError']**2 for r in values]))
 value_metrics[m]['baseline50ReferencePayoff']=mean([r['oracle']['callValue'] if r['models'][m]['replicates'][0]['action']=='call' else 0 for r in values])
 value_metrics[m]['baseline50PrivilegedInformationGap']=mean([max(0,r['oracle']['callValue'])-(r['oracle']['callValue'] if r['models'][m]['replicates'][0]['action']=='call' else 0) for r in values])
 value_metrics[m]['baseline50Versus512FlipCount']=sum(r['models'][m]['replicates'][0]['action']!=r['models'][m]['reference']['action'] for r in values)
value_deltas={}
for metric in ['absoluteValueError','privilegedInformationGap','referencePayoff','samplingFlipFraction']:
 ds=[]
 for seed in progress['completedSeeds']:
  rs=[r for r in values if r['identity']['seed']==seed]
  if rs:ds.append(mean([r['models']['offset'][metric]-r['models']['current'][metric] for r in rs]))
 value_deltas[metric]=stats(ds)
output={'classification':'Inspected diagnostic reuse; no new profit evidence.','reproducedMatches':matches,'reproducedHands':hands,'fallbacks':0,'archivedAccountingExact':True,'flopActions':len(records)//2,'rangeDeltaOffsetMinusCurrent':range_delta(records),'rangeDeltaEqualHand':range_delta(records,True),'rangeDeltaObserverActive':range_delta([r for r in records if r['observerActive']]),'rangeDeltaByAction':{a:range_delta([r for r in records if r['actual']==a]) for a in ['fold','passive','aggressive']},'rangeDeltaBySupport':{k:range_delta([r for r in records if r['support']==k]) for k in sorted({r['support'] for r in records})},'rangeDeltaByFamily':{k:range_delta([r for r in records if r['family']==k]) for k in sorted({r['family'] for r in records})},'valueStates':len(values),'valueMetrics':value_metrics,'valueDeltaSeedMeans':value_deltas,'baseline50ModelActionDisagreements':sum(r['models']['current']['replicates'][0]['action']!=r['models']['offset']['replicates'][0]['action'] for r in values),'observerNotFoldedFlopActions':sum(r['model']=='current' and r['observerActive'] for r in records),'referenceActionDisagreements':sum(r['models']['current']['reference']['action']!=r['models']['offset']['reference']['action'] for r in values),'source50DecisionReproduction':True,'verificationScope':'Archived accounting and recorded metric arithmetic audited; oracle enumeration validated by helper tests/source/runtime assertions, not independently re-enumerated here.','limitations':['Ten inspected seed batches; conventional intervals omitted.','Privileged fractional-share no-future-betting reference is not actionable regret or GTO.','Restricted sampled paid flop/turn decisions, not whole-policy profit.']}
(p/'audit.json').write_text(json.dumps(output,indent=2)+'\n');print(json.dumps(output,indent=2))

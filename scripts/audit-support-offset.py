"""Audit inspected raw batches and saved pre-update predictions, without refitting."""
import gzip,hashlib,json,math,sys
from pathlib import Path
from collections import defaultdict,Counter
folder=Path(sys.argv[1]);progress=json.loads((folder/'progress.json').read_text());summary=json.loads((folder/'summary.json').read_text());freeze=json.loads((folder/'freeze.json').read_text())
assert progress['status']=='complete'
assert set(progress['completed'])=={f'training-{s}' for s in range(71001,71021)}|{f'validation-{s}' for s in range(72001,72011)}
coverage={};matches=hands=0
for phase,seeds in [('training',range(71001,71021)),('validation',range(72001,72011))]:
 groups=defaultdict(lambda:{'observations':0,'hands':set(),'batches':set(),'actions':Counter()})
 for seed in seeds:
  raw=json.loads(gzip.decompress((folder/f'{phase}-{seed}.json.gz').read_bytes()));batch=raw['batch']
  assert batch['seed']==seed and batch['configuration']['responseModel']=={'version':1,'kind':'current'}
  assert len(batch['cells'])==(9 if phase=='training' else 6)
  for cell in batch['cells']:
   runs=cell['report']['runs'];assert len(runs)==cell['players']
   assert sorted(r['participantAtSeat'].index(0) for r in runs)==list(range(cell['players']))
   for run in runs:
    r=run['report'];matches+=1;hands+=r['hands']
    assert r['hands']==4 and r['stack']==200 and r['bigBlind']==2 and r['smallBlind']==1
    assert sum(r['net'])==0 and all(x==0 for x in r['fallbacks'])
    assert all(abs(net/2/4*100-bb)<1e-8 for net,bb in zip(r['net'],r['bb100']))
   mean=sum(r['report']['bb100'][r['participantAtSeat'].index(0)] for r in runs)/len(runs)
   row=next(r for r in batch['rows'] if r['players']==cell['players'] and r['field']==cell['field'])
   assert abs(row['bb100']-mean)<1e-8
  for row in raw['observations']:
   if len(row['board'])!=3:continue
   key=''.join('1' if p>0 else '0' for p in row['components'][0]['probabilities'])
   g=groups[key];g['observations']+=1;g['hands'].add((seed,row['match'],row['hand']));g['batches'].add(seed);g['actions'][row['actual']]+=1
 coverage[phase]={k:{'observations':g['observations'],'hands':len(g['hands']),'batches':len(g['batches']),'actions':dict(g['actions'])} for k,g in groups.items()}
 assert coverage[phase]==summary['coverage'][phase]
assert matches==1680 and hands==6720
allowed={'110':{0},'011':{1},'111':{0,1}}
for fit in summary['fits']:
 model=fit['model'];eligible={k for k,g in coverage['training'].items() if k in allowed and g['observations']>=200 and g['hands']>=50 and g['batches']>=8}
 assert set(model['supports'])==eligible
 for axis,values in enumerate(model['coefficients']):
  for i,v in enumerate(values):
   feature=model['features'][i];support=feature.removeprefix('support:')
   if support not in eligible or axis not in allowed[support] or feature!='support:'+support:assert v==0
 assert fit['converged']==all(t['converged'] for t in fit['traces'].values())
 for t in fit['traces'].values():
  losses=[x['loss'] for x in t['trace']]
  assert all(b<=a+1e-10 for a,b in zip(losses,losses[1:]))
assert hashlib.sha256(json.dumps(freeze['model'],separators=(',',':')).encode()).hexdigest()==freeze['modelHash']
score_map={}
for result in summary['scores']:
 groups=defaultdict(list)
 for seed in range(72001,72011):
  rows=json.loads(gzip.decompress((folder/f"scores-{result['id'].replace(':','-')}-{seed}.json.gz").read_bytes()))
  raw_panel=json.loads(gzip.decompress((folder/f'validation-{seed}.json.gz').read_bytes()))['observations']
  expected_rows=[r for r in raw_panel if len(r['board'])==3]
  assert len(rows)==len(expected_rows)
  for row,original in zip(rows,expected_rows):
   assert all(row[k]==original[k] for k in ['match','hand','order','actual','context'])
   probs=row['probabilities'];assert all(0<=p<=1 for p in probs) and abs(sum(probs)-1)<1e-8
   i=['fold','passive','aggressive'].index(row['actual']);loss=-math.log(max(1e-12,probs[i]));brier=sum((p-(j==i))**2 for j,p in enumerate(probs))
   key=''.join('1' if p>0 else '0' for p in probs)+':'+str(row['context']['facing']).lower()
   for k in ['all',key]:groups[k].append((loss,brier))
 for key,values in groups.items():
  expected=result['scores'] if key=='all' else result['groups'][key]
  assert len(values)==expected['count']
  assert abs(sum(v[0] for v in values)/len(values)-expected['logLoss'])<1e-9
  assert abs(sum(v[1] for v in values)/len(values)-expected['brier'])<1e-9
 score_map[result['id']]=result
sparse=coverage['validation'].get('110',{});covered=sparse.get('observations',0)>=100 and sparse.get('hands',0)>=30 and sparse.get('batches',0)>=5
if not covered:assert summary['decision']['status']=='insufficient-data' and freeze['decision']['selected']=='current'
else:
 current=score_map['current'];eligible=[current]
 for key,r in score_map.items():
  if not key.startswith('offset:'):continue
  if r['scores']['logLoss']<=current['scores']['logLoss']*.99 and r['scores']['brier']<=current['scores']['brier'] and all(base['count']<100 or r['groups'][k]['logLoss']<=base['logLoss']+.02 for k,base in current['groups'].items()):eligible.append(r)
 best=min(r['scores']['logLoss'] for r in eligible)
 tied=[r for r in eligible if r['scores']['logLoss']<=best+1e-6]
 selected=sorted(tied,key=lambda r:(0,0) if r['id']=='current' else (1,-float(r['id'].split(':')[1])))[0]['id']
 assert summary['decision']['selected']==freeze['decision']['selected']==selected
registry=json.loads((folder.parents[1]/'seed-registry.json').read_text());started=[r for r in registry['started_batches'] if r['directory']==str(folder)]
assert len(started)==30 and len({r['seed'] for r in started})==30
training_freeze=json.loads((folder/'training-freeze.json').read_text())
assert freeze['model']==training_freeze['models'][freeze['decision']['selected']]==progress['models'][freeze['decision']['selected']]
for fit in summary['fits']:
 key='offset:'+str(fit['model']['lambda']).removesuffix('.0')
 assert (key in progress['models'])==fit['converged']
 if fit['converged']:assert progress['models'][key]==fit['model']
assert all(r['startedAt']>=training_freeze['frozenAt'] for r in started if r['phase']=='validation')
output={'matches':matches,'hands':hands,'fallbacks':0,'zeroSum':True,'coverageRecomputed':True,'coefficientMasksVerified':True,'scoreArithmeticRecomputed':True,'selectionRecomputed':True,'freezeHashVerified':True,'trainingFreezeNoLaterThanValidationAtMillisecondPrecision':True,'decision':summary['decision']}
(folder/'audit.json').write_text(json.dumps(output,indent=2)+'\n');print(json.dumps(output))

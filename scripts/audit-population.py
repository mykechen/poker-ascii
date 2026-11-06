"""Independent audit of balanced fields, population fitting provenance and common-panel scoring."""
import gzip,hashlib,json,math,random,sys
from pathlib import Path
from collections import defaultdict,Counter
folder=Path(sys.argv[1]);progress=json.loads((folder/'progress.json').read_text());summary=json.loads((folder/'summary.json').read_text());settings=progress['settings']
assert progress['status']=='complete' and summary['status']=='complete'
rawpanels={'training':{},'validation':{}};reports=[];challenge=defaultdict(list);effective_counts=defaultdict(Counter)
def support(r):return ''.join('1' if x>0 else '0' for x in r['components'][0]['probabilities'])
for key in progress['completed']:
 raw=json.loads(gzip.decompress((folder/(key+'.json.gz')).read_bytes()));batch=raw['batch'];parts=key.split('-');phase=parts[0];stratum=parts[1];seed=batch['seed'];model=batch['configuration']['id']
 assert batch['configuration']['responseModel']==progress['models'][model]
 assert batch['configuration']['equitySamples']==50 and batch['configuration']['riverSamples']==16
 assert len(batch['rows'])==len(batch['cells'])==len(raw['effectiveFields'])*3
 assert len({(r['players'],r['field']) for r in batch['rows']})==len(batch['rows'])
 index=seed-({'training':91001,'validation':92001,'challenge':93001}[phase])
 template=settings['challengeFields'] if phase=='challenge' else settings['fields'][phase][stratum]
 assert len(raw['effectiveFields'])==len(template)
 for f,t in zip(raw['effectiveFields'],template):
  start=index%len(t['opponents']);expected=t['opponents'][start:]+t['opponents'][:start]
  assert f['id']==t['id'] and f['opponents']==expected
  for players in [6,7,8]:
   if model=='current':effective_counts[phase,stratum,t['id'],players].update(expected[i%len(expected)] for i in range(players-1))
 for cell in batch['cells']:
  runs=cell['report']['runs'];assert len(runs)==cell['players']
  assert sorted(r['participantAtSeat'].index(0) for r in runs)==list(range(cell['players']))
  for run in runs:
   r=run['report'];reports.append(r)
   assert r['hands']==4 and r['stack']==200 and r['bigBlind']==2 and r['smallBlind']==1
   assert sum(r['net'])==0 and all(v==0 for v in r['fallbacks'])
   assert all(abs(net/8*100-bb)<1e-8 for net,bb in zip(r['net'],r['bb100']))
  mean=sum(r['report']['bb100'][r['participantAtSeat'].index(0)] for r in runs)/len(runs)
  row=next(r for r in batch['rows'] if r['players']==cell['players'] and r['field']==cell['field']);assert abs(row['bb100']-mean)<1e-8
 if phase=='challenge':challenge[model].append(batch)
 else:rawpanels[phase][stratum,seed]=raw['observations'];assert model=='current'
assert len(rawpanels['training'])==60 and len(rawpanels['validation'])==40
for counts in effective_counts.values():assert len(set(counts.values()))==1
coverage={}
for phase in ['training','validation']:
 coverage[phase]={}
 for stratum in ['legacy','expanded']:
  groups=defaultdict(list)
  for (s,seed),rows in rawpanels[phase].items():
   if s!=stratum:continue
   for row in rows:
    if len(row['board'])==3:groups[support(row)].append((seed,row))
  def count(rows):return {'observations':len(rows),'hands':len({(seed,r['match'],r['hand']) for seed,r in rows}),'batches':len({seed for seed,r in rows})}
  coverage[phase][stratum]={k:{**count(rows),'actions':{action:count([(seed,r) for seed,r in rows if r['actual']==action]) for action in sorted({r['actual'] for seed,r in rows})}} for k,rows in groups.items()}
 assert coverage[phase]==summary['coverage'][phase]
def enough(c,o,h,b):return c is not None and c['observations']>=o and c['hands']>=h and c['batches']>=b
for fit in summary['fits']:
 model=fit['model'];eligible=[]
 for key in ['011','110','111']:
  good=True
  for s in ['legacy','expanded']:
   c=coverage['training'][s].get(key)
   good &= enough(c,200,50,8)
   if key=='110':good &= all(enough(c.get('actions',{}).get(a) if c else None,20,10,5) for a in ['fold','passive'])
  if good:eligible.append(key)
 assert model['supports']==eligible
 allowed={'011':{1},'110':{0},'111':{0,1}}
 for axis,coefs in enumerate(model['coefficients']):
  for i,v in enumerate(coefs):
   f=model['features'][i];key=f.removeprefix('support:')
   if f!='support:'+key or key not in eligible or axis not in allowed[key]:assert v==0
 for key in eligible:
  fi=model['features'].index('support:'+key);offsets=[model['coefficients'][a][fi] for a in [0,1]]
  loss=fit['model']['lambda']*sum(v*v for v in offsets)/2
  for stratum in ['legacy','expanded']:
   rows=[r for (s,seed),rs in rawpanels['training'].items() if s==stratum for r in rs if len(r['board'])==3 and support(r)==key]
   losses=[]
   for r in rows:
    actual=['fold','passive','aggressive'].index(r['actual']);prob=0
    for c in r['components']:
     q=[p*math.exp(max(-3,min(3,shift))) for p,shift in zip(c['probabilities'],[offsets[0],0,offsets[1]])];total=sum(q);prob+=c['weight']*q[actual]/total
    losses.append(-math.log(prob))
   loss+=sum(losses)/len(losses)/2
  assert abs(loss-fit['traces'][key]['trace'][-1]['loss'])<1e-8
scores={};seed_scores={};action_scores={}
for result in summary['scores']:
 model=result['id'];scores[model]={};seed_scores[model]={};action_scores[model]={}
 for stratum in ['legacy','expanded']:
  groups=defaultdict(list);perseed={};actions=defaultdict(list)
  for seed in range(92001,92021):
   rows=json.loads(gzip.decompress((folder/f"scores-{model.replace(':','-')}-{stratum}-{seed}.json.gz").read_bytes()));raw=[r for r in rawpanels['validation'][stratum,seed] if len(r['board'])==3];assert len(rows)==len(raw)
   batchgroups=defaultdict(list)
   for row,original in zip(rows,raw):
    assert all(row[k]==original[k] for k in ['match','hand','order','actual','context'])
    p=row['probabilities'];assert all(0<=x<=1 for x in p) and abs(sum(p)-1)<1e-8
    index=['fold','passive','aggressive'].index(row['actual']);value=(-math.log(max(1e-12,p[index])),sum((x-(i==index))**2 for i,x in enumerate(p)))
    key=''.join('1' if x>0 else '0' for x in p)+':'+str(row['context']['facing']).lower()
    for k in ['all',key]:groups[k].append(value);batchgroups[k].append(value)
    actions[key+':'+row['actual']].append(value);batchgroups[key+':'+row['actual']].append(value)
   perseed[seed]={k:(sum(x[0] for x in rows),sum(x[1] for x in rows),len(rows)) for k,rows in batchgroups.items()}
  expected=result['byStratum'][stratum]
  for key,values in groups.items():
   e=expected['scores'] if key=='all' else expected['groups'][key]
   assert e['count']==len(values) and abs(e['logLoss']-sum(x[0] for x in values)/len(values))<1e-9 and abs(e['brier']-sum(x[1] for x in values)/len(values))<1e-9
  scores[model][stratum]=expected;seed_scores[model][stratum]=perseed
  action_scores[model][stratum]={k:{'count':len(v),'logLoss':sum(x[0] for x in v)/len(v),'brier':sum(x[1] for x in v)/len(v)} for k,v in actions.items()}
covered=True
for stratum in ['legacy','expanded']:
 c=coverage['validation'][stratum].get('110');covered &= enough(c,100,30,5) and enough(c.get('actions',{}).get('fold') if c else None,10 if stratum=='legacy' else 20,5 if stratum=='legacy' else 10,3 if stratum=='legacy' else 5)
macro=lambda m,k:sum(scores[m][s]['scores'][k] for s in ['legacy','expanded'])/2
eligible=['current']
if covered:
 for m in scores:
  if m=='current':continue
  good=macro(m,'logLoss')<=macro('current','logLoss')*.99 and macro(m,'brier')<=macro('current','brier')
  for s in ['legacy','expanded']:
   a,b=scores[m][s],scores['current'][s];good &= a['scores']['logLoss']<=b['scores']['logLoss']+.02 and a['scores']['brier']<=b['scores']['brier']+.02 and all(v['count']<100 or a['groups'][k]['logLoss']<=v['logLoss']+.02 for k,v in b['groups'].items())
  if good:eligible.append(m)
 best=min(macro(m,'logLoss') for m in eligible);tied=[m for m in eligible if macro(m,'logLoss')<=best+1e-6];selected=sorted(tied,key=lambda m:(0,0) if m=='current' else (1,-float(m.split(':')[1])))[0]
else:selected='current'
assert summary['selection']['selected']==selected and summary['selection']['status']==('selected' if covered else 'insufficient-data')
freeze=json.loads((folder/'freeze.json').read_text());training=json.loads((folder/'training-freeze.json').read_text())
assert progress['models']==training['models']
assert freeze['model']==training['models'][selected] and hashlib.sha256(json.dumps(freeze['model'],separators=(',',':')).encode()).hexdigest()==freeze['modelHash']
for fit in summary['fits']:
 key='offset:'+str(fit['model']['lambda']).removesuffix('.0');assert (key in training['models'])==fit['converged']
 assert fit['converged']==all(t['converged'] for t in fit['traces'].values())
 if fit['converged']:assert training['models'][key]==fit['model']
assert set(challenge)==({'current',selected} if covered and selected!='current' else {'current'})
expected_keys={f'training-{stratum}-{seed}-current' for stratum in ['legacy','expanded'] for seed in range(91001,91031)}|{f'validation-{stratum}-{seed}-current' for stratum in ['legacy','expanded'] for seed in range(92001,92021)}|{f"challenge-independent-{seed}-{m.replace(':','-')}" for seed in range(93001,93011) for m in challenge}
assert set(progress['completed'])==expected_keys and len(progress['completed'])==len(expected_keys)
for m,bs in challenge.items():
 assert all(b['configuration']['responseModel']==({'version':1,'kind':'current'} if m=='current' else freeze['model']) for b in bs)
 assert {b['seed'] for b in bs}==set(range(93001,93011))
 expected=next(x for x in summary['challenge']['summaries'] if x['id']==m)
 means=[sum(r['bb100'] for r in b['rows'])/6 for b in bs];assert abs(sum(means)/10-expected['meanBb100'])<1e-8 and expected['interval95'] is None
if len(challenge)==2:
 def means(model):return {b['seed']:sum(r['bb100'] for r in b['rows'])/6 for b in challenge[model]}
 a,b=means(selected),means('current');d=[a[seed]-b[seed] for seed in range(93001,93011)]
 assert abs(sum(d)/10-summary['challenge']['delta']['meanBb100'])<1e-8 and summary['challenge']['delta']['interval95'] is None
assert len(reports)==5460+420*len(challenge) and sum(r['hands'] for r in reports)==len(reports)*4
registry=json.loads((folder.parents[1]/'seed-registry.json').read_text());started=[r for r in registry['started_batches'] if r['directory']==str(folder)]
assert len(started)==100+10*len(challenge)
assert all(r['startedAt']>=training['frozenAt'] for r in started if r['phase']=='validation')
assert all(r['startedAt']>=freeze['frozenAt'] for r in started if r['phase']=='challenge')
# Paired seed-cluster bootstrap: natural pooled action scores within each stratum/group.
rng=random.Random(42);bootstrap={}
def percentile(values,p):
 values=sorted(values);x=(len(values)-1)*p;i=math.floor(x);j=math.ceil(x);return values[i]+(values[j]-values[i])*(x-i)
for model in sorted(m for m in scores if m!='current'):
 bootstrap[model]={}
 for stratum in ['expanded','legacy']:
  result={}
  keys=sorted(set(k for batch in seed_scores['current'][stratum].values() for k in batch))
  for key in keys:
   loss=[];brier=[];zero=0
   for _ in range(10000):
    seeds=[rng.randrange(92001,92021) for _ in range(20)]
    cur=[seed_scores['current'][stratum][seed].get(key,(0,0,0)) for seed in seeds];off=[seed_scores[model][stratum][seed].get(key,(0,0,0)) for seed in seeds]
    count=sum(v[2] for v in cur);assert count==sum(v[2] for v in off)
    if not count:zero+=1;continue
    loss.append((sum(v[0] for v in off)-sum(v[0] for v in cur))/count);brier.append((sum(v[1] for v in off)-sum(v[1] for v in cur))/count)
   result[key]={'resamples':10000,'zeroCountReplicates':zero,'lossDifference95':None if zero else [percentile(loss,.025),percentile(loss,.975)],'brierDifference95':None if zero else [percentile(brier,.025),percentile(brier,.975)]}
  bootstrap[model][stratum]=result
output={'matches':len(reports),'hands':len(reports)*4,'fallbacks':0,'zeroSum':True,'lineupMultiplicityBalanced':True,'coverageRecomputed':True,'weightedObjectivesRecomputed':True,'forecastScoresRecomputed':True,'selectionRecomputed':True,'modelFreezeVerified':True,'selection':summary['selection'],'actionScores':action_scores,'pairedSeedBootstrap':bootstrap}
(folder/'audit.json').write_text(json.dumps(output,indent=2)+'\n');print(json.dumps({k:v for k,v in output.items() if k not in ['actionScores','pairedSeedBootstrap']}))

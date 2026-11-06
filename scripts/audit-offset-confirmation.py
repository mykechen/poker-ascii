"""Independent complete-run raw accounting, forecast arithmetic and paired seed-bootstrap audit."""
import gzip,hashlib,json,math,random,sys
from pathlib import Path
from collections import defaultdict,Counter
folder=Path(sys.argv[1]);progress=json.loads((folder/'progress.json').read_text());summary=json.loads((folder/'summary.json').read_text());freeze=json.loads((folder/'freeze.json').read_text())
assert progress['status']=='complete' and summary['complete']
assert set(progress['completed'])=={f'panel-{s}-current' for s in range(82001,82021)}|{f'profit-{s}-{m}' for s in range(81001,81101) for m in ['offset','current']}
assert progress['completedPairs']==list(range(81001,81101))
assert hashlib.sha256(json.dumps(freeze['model'],separators=(',',':')).encode()).hexdigest()==summary['settings']['modelHash']=='0e6bf741dacad60f8e221090ad90269c0d948d65dad1ec8a1038e8a2adea442f'
reports=[];profit={'offset':{},'current':{}};panels={};sparse=[]
for key in progress['completed']:
 raw=json.loads(gzip.decompress((folder/(key+'.json.gz')).read_bytes()));batch=raw['batch'];phase,seed,model=key.split('-');seed=int(seed)
 assert batch['seed']==seed and batch['configuration']['id']==model
 assert batch['configuration']['responseModel']==(freeze['model'] if model=='offset' else {'version':1,'kind':'current'})
 assert batch['configuration']['equitySamples']==50 and batch['configuration']['riverSamples']==16
 assert len(batch['cells'])==6
 for cell in batch['cells']:
  runs=cell['report']['runs'];assert len(runs)==cell['players']
  assert sorted(r['participantAtSeat'].index(0) for r in runs)==list(range(cell['players']))
  for run in runs:
   r=run['report'];reports.append(r)
   assert r['hands']==4 and r['stack']==200 and r['bigBlind']==2 and r['smallBlind']==1
   assert sum(r['net'])==0 and all(x==0 for x in r['fallbacks'])
   assert all(abs(net/8*100-bb)<1e-8 for net,bb in zip(r['net'],r['bb100']))
  mean=sum(r['report']['bb100'][r['participantAtSeat'].index(0)] for r in runs)/len(runs)
  row=next(r for r in batch['rows'] if r['players']==cell['players'] and r['field']==cell['field'])
  assert abs(mean-row['bb100'])<1e-8
  if phase=='profit':profit[model][seed,cell['players'],cell['field']]=mean
 if phase=='panel':
  panels[seed]=[r for r in raw['observations'] if len(r['board'])==3]
  for r in panels[seed]:
   support=''.join('1' if p>0 else '0' for p in r['components'][0]['probabilities'])
   if support=='110':sparse.append((seed,r))
 else:assert not raw['observations']
assert len(reports)==9240 and sum(r['hands'] for r in reports)==36960
folds=[(s,r) for s,r in sparse if r['actual']=='fold']
coverage={'observations':len(sparse),'hands':len({(s,r['match'],r['hand']) for s,r in sparse}),'batches':len({s for s,r in sparse}),'folds':len(folds),'foldHands':len({(s,r['match'],r['hand']) for s,r in folds}),'foldBatches':len({s for s,r in folds})}
assert coverage==summary['coverage']
values=[sum(profit['offset'][k]-profit['current'][k] for k in profit['offset'] if k[0]==s)/6 for s in range(81001,81101)]
mean=sum(values)/100;se=math.sqrt(sum((x-mean)**2 for x in values)/99/100)
assert abs(summary['decision']['mean']-mean)<1e-8 and abs(summary['decision']['standardError']-se)<1e-8
assert all(abs(x-y)<1e-8 for x,y in zip(summary['decision']['interval95'],[mean-1.98422*se,mean+1.98422*se]))
assert len(profit['offset'])==len(profit['current'])==600
assert len(summary['cellIntervals'])==len({c['cell'] for c in summary['cellIntervals']})==6
assert summary['decision']['fixedComplete']
assert summary['decision']['trueGainAboveFive']==(mean-1.98422*se>5)
cells=[]
for cell in summary['cellIntervals']:
 players,field=cell['cell'].split(':');d=[profit['offset'][s,int(players),field]-profit['current'][s,int(players),field] for s in range(81001,81101)]
 m=sum(d)/100;e=math.sqrt(sum((x-m)**2 for x in d)/99/100)
 assert abs(m-cell['mean'])<1e-8 and abs(m-1.98422*e-cell['lower95'])<1e-8 and abs(m+1.98422*e-cell['upper95'])<1e-8;cells.append(m)
metrics={};perseed={};classes={}
for model in ['current','offset']:
 groups=defaultdict(list);batches={};classgroups=defaultdict(list)
 for seed in range(82001,82021):
  scored=json.loads(gzip.decompress((folder/f'scores-{seed}-{model}.json.gz').read_bytes()));assert len(scored)==len(panels[seed])
  batchgroups=defaultdict(list)
  for row,original in zip(scored,panels[seed]):
   assert all(row[k]==original[k] for k in ['match','hand','order','actual','context'])
   p=row['probabilities'];assert all(0<=v<=1 for v in p) and abs(sum(p)-1)<1e-8
   i=['fold','passive','aggressive'].index(row['actual']);pair=(-math.log(max(1e-12,p[i])),sum((v-(j==i))**2 for j,v in enumerate(p)))
   key=''.join('1' if v>0 else '0' for v in p)+':'+str(row['context']['facing']).lower()
   for k in ['all',key]:groups[k].append(pair);batchgroups[k].append(pair)
   if key=='110:true':classgroups[row['actual']].append(pair)
  batches[seed]={k:(sum(v[0] for v in rows),sum(v[1] for v in rows),len(rows)) for k,rows in batchgroups.items()}
 for k,rows in groups.items():
  expected=summary['forecast'][model]['scores'] if k=='all' else summary['forecast'][model]['groups'][k]
  assert expected['count']==len(rows) and abs(sum(v[0] for v in rows)/len(rows)-expected['logLoss'])<1e-9 and abs(sum(v[1] for v in rows)/len(rows)-expected['brier'])<1e-9
 metrics[model]=summary['forecast'][model];perseed[model]=batches
 classes[model]={k:{'count':len(rows),'logLoss':sum(v[0] for v in rows)/len(rows),'brier':sum(v[1] for v in rows)/len(rows)} for k,rows in classgroups.items()}
c=metrics['current'];o=metrics['offset']
covered=coverage['observations']>=100 and coverage['hands']>=30 and coverage['batches']>=5 and coverage['folds']>=20 and coverage['foldHands']>=10 and coverage['foldBatches']>=5
forecastpass=covered and o['scores']['brier']<=c['scores']['brier'] and all(base['count']<100 or o['groups'][k]['logLoss']<=base['logLoss']+.02 for k,base in c['groups'].items())
target=mean>=5 and mean-1.98422*se>0;downside=all(x>=-5 for x in cells)
assert summary['decision']['allGatesPass']==(target and downside and forecastpass)
assert summary['decision']['targetSignal']==target and summary['decision']['downsidePass']==downside and summary['decision']['sparseCovered']==covered and summary['decision']['forecastPass']==forecastpass
registry=json.loads((folder.parents[1]/'seed-registry.json').read_text());started=[r for r in registry['started_batches'] if r['directory']==str(folder)]
assert len(started)==220 and all(r['startedAt']>=progress['startedAt'] for r in started)
assert all(r['startedAt']>freeze['frozenAt'] for r in started)
for index,seed in enumerate(range(81001,81101)):
 order=[r['id'] for r in started if r['seed']==seed];assert order==(['current','offset'] if index%2 else ['offset','current'])
rng=random.Random(42);bootstrap={}
for group in ['all','110:true']:
 loss=[];brier=[];zero=0
 for _ in range(10000):
  selected=[rng.randrange(82001,82021) for _ in range(20)]
  cur=[perseed['current'][s].get(group,(0,0,0)) for s in selected];off=[perseed['offset'][s].get(group,(0,0,0)) for s in selected]
  count=sum(v[2] for v in cur);assert count==sum(v[2] for v in off)
  if not count:zero+=1;continue
  loss.append((sum(v[0] for v in off)-sum(v[0] for v in cur))/count);brier.append((sum(v[1] for v in off)-sum(v[1] for v in cur))/count)
 def percentile(values,p):
  values=sorted(values);x=(len(values)-1)*p;i=math.floor(x);j=math.ceil(x);return values[i]+(values[j]-values[i])*(x-i)
 bootstrap[group]={'resamples':10000,'zeroCountReplicates':zero,'lossDifference95':None if zero else [percentile(loss,.025),percentile(loss,.975)],'brierDifference95':None if zero else [percentile(brier,.025),percentile(brier,.975)]}
output={'matches':len(reports),'hands':36960,'fallbacks':0,'zeroSum':True,'freezeHashVerified':True,'rotationMeansRecomputed':True,'pairedMean':mean,'pairedSE':se,'interval95':[mean-1.98422*se,mean+1.98422*se],'coverage':coverage,'forecastScoresRecomputed':True,'gatesRecomputed':True,'sparseActionConditionalScores':classes,'pairedSeedBootstrap':bootstrap}
(folder/'audit.json').write_text(json.dumps(output,indent=2)+'\n');print(json.dumps(output))

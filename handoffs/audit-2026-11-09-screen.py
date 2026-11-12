import json, gzip, hashlib, pathlib, subprocess, sys
root=pathlib.Path('/private/tmp/poker-training-foundation')
d=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else sorted(root.glob('handoffs/diagnostics/*decision-stability-*'))[-1]
p=json.loads((d/'progress.json').read_text()); assert p['status']!='running', 'Wait for completion'
settings=p['settings']; failures=[]
def check(condition,message):
 if not condition: failures.append(message)
manifest=json.loads((d/'eligible-manifest.json').read_text()); states=json.loads(gzip.decompress((d/'states.json.gz').read_bytes())); result=json.loads((d/'results.json').read_text())
seen=set()
for m in manifest:
 key=tuple(m[k] for k in ['seed','population','field','players','rotation','hand'])
 check(key not in seen,'Repeated eligible hand');seen.add(key)
 identity=[m[k] for k in ['seed','population','field','players','rotation','hand']]+[m['cell'].split(':')[1],m['logLength']]
 check(hashlib.sha256(json.dumps(identity,separators=(',',':')).encode()).hexdigest()==m['id'],'Manifest hash mismatch')
for cell,quota in settings['quotas'].items():
 expected=sorted(m['id'] for m in manifest if m['cell']==cell)[:quota]
 check(sorted(s['id'] for s in states if s['cell']==cell)==expected,'Reservoir mismatch '+cell)
for s in states:
 actor=s['view']['toAct']
 check(all(not isinstance(v['hole'],list) or v['seat']==actor for v in s['view']['seats']),'Private opponent hole in snapshot')
 check(len(s['opponentSeats'])==len(s['ranges']),'Range mapping mismatch')
reports=list(d.glob('match-*.json'))
for f in reports:
 r=json.loads(f.read_text());check(sum(r['net'])==0,'Nonconserving '+f.name);check(all(x==0 for x in r['fallbacks']),'Fallback '+f.name)
check(len(reports)==p['completedMatches'],'Match count mismatch')
check(len(result['results'])==p['completedStates'],'State count mismatch')
h=hashlib.sha256()
files=sorted(str(f.relative_to(root)) for f in (root/'lib/poker').glob('*.ts') if not f.name.endswith('.test.ts'))+['scripts/decision-stability.ts','docs/superpowers/specs/2026-11-08-decision-stability-revision.md','docs/superpowers/specs/2026-11-07-decision-stability-execution.md','package.json','package-lock.json']
for name in files:
 data=subprocess.check_output(['git','show',p['source']+':'+name],cwd=root);h.update(name.encode());h.update(data)
h.update(json.dumps(settings,separators=(',',':'),ensure_ascii=False).encode());check(h.hexdigest()==p['fingerprint'],'Source fingerprint mismatch')
for row in result['results']:
 ref=row['budgets']['512']['streams']
 for budget,b in row['budgets'].items():
  values=[v['callValue'] for v in b['streams']];mean=sum(values)/8
  metrics={'flipFraction':sum((values[i]>=0)!=(values[j]>=0) for i in range(8) for j in range(i+1,8))/28,'referenceDisagreement':sum((v>=0)!=(ref[i]['callValue']>=0) for i,v in enumerate(values))/8,'callValueSD':(sum((v-mean)**2 for v in values)/7)**.5,'nearZeroFraction':sum(abs(v)<=2 for v in values)/8}
  for k,v in metrics.items():check(abs(v-b['metrics'][k])<1e-9,'Metric mismatch '+k)

import math, statistics
assignments=json.loads((d/'assignments.json').read_text()); amap={}
for a in assignments:
 key=tuple(a[k] for k in ['seed','population','field','players','rotation','hand'])
 check(key not in amap,'Duplicate scheduled assignment');amap[key]=a['street']
 digest=hashlib.sha256(json.dumps(list(key),separators=(',',':')).encode()).digest()
 check(a['street']==['preflop','flop','turn'][int.from_bytes(digest[:4],'big')%3],'Assignment mismatch')
for m in manifest:
 key=tuple(m[k] for k in ['seed','population','field','players','rotation','hand'])
 check(amap.get(key)==m['cell'].split(':')[1],'Captured wrong street')
check(len(assignments)==len(reports)*4,'Scheduled hands mismatch')
summary=json.loads((d/'summary.json').read_text()); cluster={}; metrics=['flipFraction','referenceDisagreement','callValueSD','nearZeroFraction']
for budget in ['50','128','512']:
 cluster[budget]={}
 for metric in metrics:
  cells={}
  for cell in settings['quotas']:
   byseed={}
   for seed in settings['seeds']:
    groups={}
    for row in result['results']:
     if row['cell']==cell and row['seed']==seed:
      groups.setdefault((row['field'],row['players'],row['rotation']),[]).append(row['budgets'][budget]['metrics'][metric])
    if groups:byseed[seed]=statistics.mean(statistics.mean(v) for v in groups.values())
   mean=statistics.mean(byseed.values());cells[cell]=byseed
   check(abs(mean-summary['summary'][budget][metric]['cells'][cell]['mean'])<1e-12,'Cluster mean mismatch')
   expected=statistics.stdev(byseed.values())/math.sqrt(len(byseed)) if len(byseed)>1 else None
   archived=summary['summary'][budget][metric]['cells'][cell]['standardError']
   check(expected==archived or expected is not None and abs(expected-archived)<1e-12,'Cluster SE mismatch')
  check(abs(statistics.mean(statistics.mean(v.values()) for v in cells.values())-summary['summary'][budget][metric]['macroMean'])<1e-12,'Macro mismatch')
  cluster[budget][metric]=cells
# Descriptive paired t intervals. No multiplicity adjustment or profit interpretation.
tcrit=[None,12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093]
def interval(values):
 n=len(values);mean=statistics.mean(values);se=statistics.stdev(values)/math.sqrt(n) if n>1 else None
 return dict(n=n,mean=mean,standardError=se,approximate95CI=[mean-tcrit[n-1]*se,mean+tcrit[n-1]*se] if se is not None else None)
comparisons={}
for budget in ['128','512']:
 cells={}
 for cell in settings['quotas']:
  baseline=cluster['50']['flipFraction'][cell];candidate=cluster[budget]['flipFraction'][cell]
  cells[cell]=interval([baseline[s]-candidate[s] for s in baseline])
 complete=[s for s in settings['seeds'] if all(s in cluster['50']['flipFraction'][c] for c in settings['quotas'])]
 comparisons[budget]={'positiveMeansReducedInstability':True,'cells':cells,'macroCompleteSeedSensitivity':interval([statistics.mean(cluster['50']['flipFraction'][c][s]-cluster[budget]['flipFraction'][c][s] for c in settings['quotas']) for s in complete]) if complete else None,'completeSeeds':complete}
latency={}
for budget in ['50','128','512']:
 times=[s['elapsedMs'] for row in result['results'] for s in row['budgets'][budget]['streams']]
 check(abs(sum(times)-summary['timing'][budget]['totalMs'])<1e-6,'Timing mismatch')
 latency[budget]={'decisions':len(times),'totalMs':sum(times),'meanMs':statistics.mean(times),'medianMs':statistics.median(times),'p95Ms':sorted(times)[math.ceil(.95*len(times))-1]}
report={'directory':str(d),'source':p['source'],'status':p['status'],'failures':failures,'matches':len(reports),'assignments':len(assignments),'eligible':len(manifest),'states':len(states),'scored':len(result['results']),'pairedInstabilityReduction':comparisons,'latency':latency,'limits':['Inspected fixed current-policy states; eight RNG streams are not independent poker hands.','Descriptive paired seed t intervals; approximate critical values; no multiple-comparison adjustment.','Complete-seed macro sensitivity differs from archived macro when cell seed coverage differs.','No profit confidence interval: no candidate on-policy profit experiment occurred. Stability is not correctness or strength.','No independent equity-world enumeration or earliest-decision replay; assignment and accounting checked from archives.','Snapshot hole privacy only; arbitrary log content not exhaustively inspected.']}
(root/'handoffs/audit-2026-11-09-screen.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'failures':failures,'latency':latency,'pairedMacro':{b:v['macroCompleteSeedSensitivity'] for b,v in comparisons.items()}},indent=2));sys.exit(bool(failures))

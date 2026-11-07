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
files=sorted(str(f.relative_to(root)) for f in (root/'lib/poker').glob('*.ts') if not f.name.endswith('.test.ts'))+['scripts/decision-stability.ts','docs/superpowers/specs/2026-11-07-decision-stability-execution.md','package.json','package-lock.json']
for name in files:
 data=subprocess.check_output(['git','show',p['source']+':'+name],cwd=root);h.update(name.encode());h.update(data)
h.update(json.dumps(settings,separators=(',',':'),ensure_ascii=False).encode());check(h.hexdigest()==p['fingerprint'],'Source fingerprint mismatch')
for row in result['results']:
 ref=row['budgets']['512']['streams']
 for budget,b in row['budgets'].items():
  values=[v['callValue'] for v in b['streams']];mean=sum(values)/8
  metrics={'flipFraction':sum((values[i]>=0)!=(values[j]>=0) for i in range(8) for j in range(i+1,8))/28,'referenceDisagreement':sum((v>=0)!=(ref[i]['callValue']>=0) for i,v in enumerate(values))/8,'callValueSD':(sum((v-mean)**2 for v in values)/7)**.5,'nearZeroFraction':sum(abs(v)<=2 for v in values)/8}
  for k,v in metrics.items():check(abs(v-b['metrics'][k])<1e-9,'Metric mismatch '+k)
print(json.dumps({'directory':str(d),'status':p['status'],'matches':len(reports),'manifest':len(manifest),'states':len(states),'scored':len(result['results']),'failures':failures,'limits':['Does not independently replay first-paid ownership or poker equity worlds; checks unique hand assignment and archived arithmetic.','Privacy check covers snapshot seat holes, not arbitrary log fields.']},indent=2))
sys.exit(bool(failures))

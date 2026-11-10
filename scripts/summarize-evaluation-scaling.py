import json
from datetime import datetime
from pathlib import Path
root=Path('handoffs/evaluation-2026-11-09-r2');rows=[]
for directory in sorted(root.iterdir()):
    if not directory.is_dir() or not (directory/'protocol.json').exists():continue
    p=json.loads((directory/'protocol.json').read_text());prov=json.loads((directory/'provenance.json').read_text())
    if p['classification']!='scaling-diagnostic' or 'sleep-interrupted' in prov.get('integrityClassification',''):continue
    if prov['status']!='complete':
        if prov['status']=='failed' and 'endedAt' in prov:
            elapsed=(datetime.fromisoformat(prov['endedAt'])-datetime.fromisoformat(prov['startedAt'])).total_seconds()
            if elapsed>=p['maxSeconds'] and p['maxSeconds']==600:
                seed_files=list(directory.glob('seed-*.json'));expected=len(p['pool'])*sum(p['players'])*p['hands']*len(p['arms']);hands=0
                for file in seed_files:
                    rr=json.loads(file.read_text())
                    if len(rr)!=expected or len({r['id'] for r in rr})!=expected:raise ValueError('Invalid complete seed file')
                    hands+=len(rr)
                rows.append({'run':directory.name,'workers':prov['workers'],'seconds':elapsed,'hands':hands,'handsPerHour':hands/elapsed*3600,'peakWorkerMiB':None,'workerMemory':None,'allInFractionOfWorkerService':None,'thermalStart':prov['thermalStart'],'thermalEnd':'unavailable after resource cap','sourceHash':prov['sourceHash'],'status':'capped-throughput-lower-bound','note':'Only whole completed clusters counted; all in-flight work charged to elapsed time, excluded from numerator. Not return/variance evidence.'})
        continue
    t=json.loads((directory/'timing.json').read_text());service=t.get('seedTimings',[])
    rows.append({'run':directory.name,'workers':prov['workers'],'seconds':t['elapsedMs']/1000,'hands':t['physicalHands'],'handsPerHour':t['handsPerHour'],'peakWorkerMiB':max(t['peakWorkerRssBytes'])/2**20,'workerMemory':t.get('workerMemory'),'allInFractionOfWorkerService':sum(x['allInMs'] for x in service)/sum(x['elapsedMs'] for x in service) if service else None,'thermalStart':prov['thermalStart'],'thermalEnd':t['thermalEnd'],'sourceHash':prov['sourceHash']})
(root/'scaling-results.json').write_text(json.dumps(rows,indent=2)+'\n')
for r in rows:print(r['run'],r['workers'],round(r['seconds'],1),round(r['handsPerHour']),round(r['peakWorkerMiB'],1) if r['peakWorkerMiB'] is not None else 'unavailable')

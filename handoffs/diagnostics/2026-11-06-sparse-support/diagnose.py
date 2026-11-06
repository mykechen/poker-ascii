"""Descriptive diagnosis of inspected data only; no fitting or fresh evaluation."""
import gzip,json,math
from pathlib import Path
from collections import Counter,defaultdict
root=Path(__file__).resolve().parents[3]
pilot=root/'handoffs/runs/2026-11-05-contextual-adfb6f523ebe'
confirm=root/'handoffs/runs/2026-11-06-confirmation-b667480ae1c9'
raw=json.loads(gzip.decompress((pilot/'raw-results.json.gz').read_bytes()))
frequency=json.loads((pilot/'freeze.json').read_text())['model']['frequencies']['110']
def support(row):
 return ''.join('1' if x>0 else '0' for x in row['components'][0]['probabilities'])
def analyze(panels):
 sparse=[(b,r) for b,p in enumerate(panels) for r in p if len(r['board'])==3 and support(r)=='110']
 counts=Counter(r['actual'] for _,r in sparse)
 groups={}
 for field in ['size','depth','position','players']:
  result={}
  for value in sorted({r['context'][field] for _,r in sparse}):
   rows=[r for _,r in sparse if r['context'][field]==value]
   result[str(value)]={'count':len(rows),'actions':dict(Counter(r['actual'] for r in rows))}
  groups[field]=result
 fold_rows=[(b,r) for b,r in sparse if r['actual']=='fold']
 return {'count':len(sparse),'actions':dict(counts),'frequencyLogLoss':sum(-math.log(frequency[0 if r['actual']=='fold' else 1]) for _,r in sparse)/len(sparse),'foldLossShare':sum(-math.log(frequency[0]) for _ in fold_rows)/sum(-math.log(frequency[0 if r['actual']=='fold' else 1]) for _,r in sparse),'distinctHands':len({(b,r['match'],r['hand']) for b,r in sparse}),'foldDistinctHands':len({(b,r['match'],r['hand']) for b,r in fold_rows}),'foldBatches':dict(Counter(b for b,r in fold_rows)),'context':groups}
confirmation=[json.loads(gzip.decompress((confirm/f'panel-{seed}-current.json.gz').read_bytes()))['observations'] for seed in range(62001,62011)]
result={'warning':'All inspected data; descriptive only, no new independent evidence. Context comparisons are post hoc.','frozen110':frequency,'training':analyze(raw['panels']['training']),'validation':analyze(raw['panels']['validation']),'confirmation':analyze(confirmation)}
# Reproduce the smoothed training estimate directly from observed classes.
c=result['training']['actions'];total=sum(c.values())+2
assert abs((c.get('fold',0)+1)/total-frequency[0])<1e-12
assert result['confirmation']['count']==63
assert abs(result['confirmation']['frequencyLogLoss']-.8443565534404063)<1e-9
out=Path(__file__).with_name('diagnosis.json');out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))

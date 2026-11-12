import json,math,statistics as st
from pathlib import Path
p=Path('handoffs/audit-2026-11-09');r=json.loads((p/'pilot.json').read_text());hands=[x for x in r['rows'] if 'bb'in x];matches=[x for x in r['rows'] if 'report'in x]
a={(x['seed'],x['rotation'],x['hand']):x['bb'] for x in hands if x['samples']==50};b={(x['seed'],x['rotation'],x['hand']):x['bb'] for x in hands if x['samples']==128};keys=sorted(a)
def var(x):return st.variance(x)
def corr(x,y):return sum((v-st.mean(x))*(w-st.mean(y)) for v,w in zip(x,y))/((len(x)-1)*st.stdev(x)*st.stdev(y))
x=[a[k]for k in keys];y=[b[k]for k in keys];d=[b[k]-a[k]for k in keys]
# Rotated cluster is same deal/hand averaged across all six rotations.
k2=sorted(set((s,h)for s,rot,h in keys));xr=[st.mean(a[s,rot,h]for rot in range(6))for s,h in k2];yr=[st.mean(b[s,rot,h]for rot in range(6))for s,h in k2]
rate={n:480/(sum(m['elapsedMs']for m in matches if m['samples']==n)/3600000)for n in [50,128]};factor=(1.95996398454+.84162123357)**2/.05**2
power={}
for name,v,mult in [('unpaired',var(x)+var(y),1),('paired',var(d),1),('rotated',var([v-w for v,w in zip(yr,xr)]),6)]:
 units=math.ceil(factor*v);physical=units*2*mult;seconds=units*mult*(3600/rate[50]+3600/rate[128]);power[name]={'varianceDifference':v,'requiredUnits':units,'physicalHands':physical,'hours':seconds/3600,'twoHourRunsIdeal':math.ceil(seconds/7200),'twoHourRunsWith90minWork':math.ceil(seconds/5400)}
strategy={}
for n in [50,128]:
 hh=[h for h in hands if h['samples']==n];actions=[a for h in hh for a in h['actions']];pre=[a for a in actions if a['street']=='preflop'];street={}
 for s in ['preflop','flop','turn','river']:
  aa=[a for a in actions if a['street']==s];last=[h['bb']for h in hh if h['actions']and h['actions'][-1]['street']==s];street[s]={'decisions':len(aa),'aggressive':sum(a['action']in ['raise','bet','all_in']for a in aa),'lastActionHands':len(last),'lastActionBb100':100*st.mean(last)if last else None}
 strategy[n]={'hands':len(hh),'vpip':sum(any(a['street']=='preflop'and a['action']in ['call','raise','bet','all_in']for a in h['actions'])for h in hh)/len(hh),'pfr':sum(any(a['street']=='preflop'and a['action']in ['raise','bet','all_in']for a in h['actions'])for h in hh)/len(hh),'streets':street}
# Paired seed-cluster effect: descriptive only, Student t9=2.262.
seeds=sorted(set(k[0]for k in keys));dd=[100*st.mean(b[k]-a[k]for k in keys if k[0]==s)for s in seeds];se=st.stdev(dd)/math.sqrt(10)
out={'handSD50':st.stdev(x),'handSD128':st.stdev(y),'pairedHandCorrelation':corr(x,y),'rotatedCorrelation':corr(xr,yr),'throughputHandsPerHour':rate,'power':power,'strategy':strategy,'descriptiveDeltaBb100':st.mean(dd),'descriptiveCI95':[st.mean(dd)-2.262*se,st.mean(dd)+2.262*se],'handsPerArm':480,'elapsedMs':r['elapsedMs']}
(p/'metrics.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))

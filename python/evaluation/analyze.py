import argparse,json,statistics as st,hashlib,math
from pathlib import Path
from collections import defaultdict
from .power import paired_ci,correlation,design_rows,required_units,chi_square_quantile

def load(directory):
    p=Path(directory)
    prov=json.loads((p/'provenance.json').read_text())
    if prov['status']!='complete':raise ValueError('Incomplete run cannot be analyzed')
    rows=[json.loads(s) for s in (p/'hands.jsonl').read_text().splitlines()]
    if len({r['id'] for r in rows})!=len(rows):raise ValueError('Duplicate rows')
    protocol=json.loads((p/'protocol.json').read_text())
    digest=lambda value:hashlib.sha256(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
    if prov['protocolHash']!=digest(protocol) or prov['sourceHash']!=protocol['sourceHash']:raise ValueError('Protocol/source provenance mismatch')
    source=json.loads((p/'source.json').read_text())
    if source['hash']!=protocol['sourceHash'] or digest(source['files'])!=source['hash']:raise ValueError('Source snapshot mismatch')
    if digest(protocol['pool'])!=protocol['poolHash']:raise ValueError('Pool mismatch')
    expected_ids={f'{seed}:{cell["id"]}:{players}:{rotation}:{hand}:{arm["id"]}' for seed in protocol['seeds'] for cell in protocol['pool'] for players in protocol['players'] for rotation in range(players) for hand in range(1,protocol['hands']+1) for arm in protocol['arms']}
    if {r['id'] for r in rows}!=expected_ids:raise ValueError('Missing/foreign manifest cells')
    for r in rows:
        identity=f'{r["seed"]}:{r["cell"]}:{r["players"]}:{r["rotation"]}:{r["hand"]}:{r["arm"]}'
        if r['schema']!='evaluation-private-v1' or r['id']!=identity or r['hero']!=(r['players']-r['rotation'])%r['players']:raise ValueError('Row identity mismatch')
        if len(r['rawChips'])!=r['players'] or sum(r['rawChips'])!=0 or not all(__import__('math').isfinite(r[m]) for m in ['rawBb','adjustedBb']):raise ValueError('Accounting/nonfinite outcome')
        if r['rawBb']!=r['rawChips'][r['hero']]/protocol['bigBlind']:raise ValueError('Unit mismatch')
    decks={}
    for r in rows:
        key=(r['seed'],r['cell'],r['players'],r['rotation'],r['hand'])
        if key in decks and decks[key]!=r['deckHash']:raise ValueError('Paired deck mismatch')
        decks[key]=r['deckHash']
    expected=len(protocol['seeds'])*len(protocol['pool'])*sum(protocol['players'])*protocol['hands']*len(protocol['arms'])
    if len(rows)!=expected:raise ValueError('Missing rows')
    return rows

def unbiased(rows):
    seed_values=defaultdict(list)
    for r in rows:seed_values[r['seed']].append(r['adjustedBb']-r['rawBb'])
    ci=paired_ci([st.mean(v) for v in seed_values.values()]);lo,hi=ci['ci95']
    byarm={}
    for arm in sorted({r['arm'] for r in rows}):
        rr=[r for r in rows if r['arm']==arm];raw=[r['rawBb'] for r in rr];adj=[r['adjustedBb'] for r in rr]
        g=defaultdict(list)
        for r in rr:g[r['seed']].append(r['adjustedBb']-r['rawBb'])
        byarm[arm]={'rawSD':st.stdev(raw),'adjustedSD':st.stdev(adj),'varianceRatio':st.variance(adj)/st.variance(raw),'pairedAdjustmentCI':paired_ci([st.mean(v) for v in g.values()])}
    return {'pairedAdjustmentCI':ci,'passed':lo<=0<=hi,'byArm':byarm,'physicalHands':len(rows),'note':'CI diagnostic supports, but cannot prove, unbiasedness; conditional exact enumeration provides the argument.'}

def report(rows,rate,raw_rate=None):
    out={'physicalHands':len(rows),'seeds':len({r['seed'] for r in rows}),'handsPerHour':{'raw':raw_rate or rate,'adjusted':rate},'arms':{},'designs':{}}
    for arm in sorted({r['arm'] for r in rows}):
        r=[x for x in rows if x['arm']==arm];out['arms'][arm]={'rawSD':st.stdev(x['rawBb'] for x in r),'adjustedSD':st.stdev(x['adjustedBb'] for x in r),'varianceRatio':st.variance(x['adjustedBb'] for x in r)/st.variance(x['rawBb'] for x in r)}
    out['observedUniqueBaseDecks']=len({r['deckHash'] for r in rows})
    out['observedDistinctTableDealLayouts']=len({(r['seed'],r['players'],r['hand']) for r in rows})
    df=out['seeds']-1;variance_upper_factor=df/chi_square_quantile(.05,df)
    out['varianceUpper95FactorNormalClusterApprox']=variance_upper_factor
    for metric in ['rawBb','adjustedBb']:
        out['designs'][metric]={}
        design_rate=(raw_rate or rate) if metric=='rawBb' else rate
        for name,d in design_rows(rows,metric).items():
            scenarios={}
            quantum=5 if name=='rotated' else math.lcm(5,*{r['players'] for r in rows})
            per_run=math.floor(design_rate*1.5/d['physicalHandsPerUnit']/quantum)*quantum
            if per_run<1:raise ValueError('A whole seed unit cannot fit the run budget')
            for effect in [5,10,20,30]:
                units=math.ceil(required_units(d['variance'],effect)/quantum)*quantum;physical=units*d['physicalHandsPerUnit'];hours=physical/design_rate
                conservative=math.ceil(required_units(d['variance']*variance_upper_factor,effect)/quantum)*quantum
                scenarios[effect]={'requiredSeedUnits':units,'physicalHands':physical,'hours':hours,'handsPerArm':physical/2,'independentSeeds':units*(2 if name=='unpaired' else 1),'handsPerHour':design_rate,'twoHourRunsAt90minWork':math.ceil(units/per_run),'conservativeUpperVarianceSeedUnits':conservative,'conservativePhysicalHands':conservative*d['physicalHandsPerUnit'],'conservativeHours':conservative*d['physicalHandsPerUnit']/design_rate,'conservativeRuns':math.ceil(conservative/per_run),'uniqueBaseDecks':units*max(r['hand'] for r in rows)*(2 if name=='unpaired' else 1),'distinctTableDealLayouts':units*max(r['hand'] for r in rows)*len({r['players'] for r in rows})*(2 if name=='unpaired' else 1)}
            out['designs'][metric][name]={**d,'seedBalancingQuantum':quantum,'scenariosSuperiorityBonferroni3':scenarios}
    arms=sorted({r['arm'] for r in rows});a={tuple(r[k] for k in ['seed','cell','players','rotation','hand']):r for r in rows if r['arm']==arms[0]};b={tuple(r[k] for k in ['seed','cell','players','rotation','hand']):r for r in rows if r['arm']==arms[1]}
    if a.keys()!=b.keys():raise ValueError('Pairing mismatch')
    out['iidHandApproximation']={}
    for metric in ['rawBb','adjustedBb']:
        x=[a[k][metric] for k in sorted(a)];y=[b[k][metric] for k in sorted(a)]
        grouped=defaultdict(list)
        for k in a:grouped[(k[0],k[1],k[2],k[4])].append(b[k][metric]-a[k][metric])
        out['iidHandApproximation'][metric]={'unpairedVariance':st.variance(x)+st.variance(y),'pairedVariance':st.variance([v-u for u,v in zip(x,y)]),'rotatedVariance':st.variance([st.mean(v) for v in grouped.values()]),'warning':'Per-hand/deal approximation only, not independent seed-cluster sizing.'}
    out['perHandCorrelation']={m:correlation([a[k][m] for k in sorted(a)],[b[k][m] for k in sorted(a)]) for m in ['rawBb','adjustedBb']}
    sampling=defaultdict(list)
    for r in rows:sampling[r['seed'],r['arm'],r['cell'],r['players']].append(r['adjustedBb'])
    cell_means=defaultdict(list)
    for (seed,arm,cell,players),values in sampling.items():cell_means[seed,arm].append(st.mean(values))
    out['exploratorySamplingDeltaBb100']=paired_ci([100*(st.mean(cell_means[seed,'128'])-st.mean(cell_means[seed,'50'])) for seed in sorted({r['seed'] for r in rows})])
    out['unbiasednessDiagnostic']=unbiased(rows)
    out['limitations']=['Exploratory seeds retired from confirmation. No promotion or profit claim.', 'Power uses normal planning approximation, seed-cluster variance, equal pool/table weights; pilot uncertainty remains.', 'Preassigned single-rotation throughput proxied by full-rotation physical-hand rate; new policy latency/correlation must be measured. Raw and adjusted use separate measured same-worker rates when supplied.', 'Assumed effects are scenarios; no model or heuristic pilot exists to justify choosing an effect yet.']
    return out
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--run',required=True);ap.add_argument('--unbiased',action='store_true');ap.add_argument('--rate',type=float);ap.add_argument('--raw-rate',type=float);ap.add_argument('--out',required=True);a=ap.parse_args();rows=load(a.run)
    result=unbiased(rows) if a.unbiased else report(rows,a.rate,a.raw_rate)
    Path(a.out).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2) if a.unbiased else a.out)
    if a.unbiased and not result['passed']:raise SystemExit('STOP: unbiasedness diagnostic failed')

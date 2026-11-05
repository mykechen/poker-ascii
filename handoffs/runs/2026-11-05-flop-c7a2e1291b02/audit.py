"""Recompute raw accounting, calibration and paired profit without policy code."""
import gzip
import json
import math
from pathlib import Path

root = Path(__file__).resolve().parent
state = json.load(gzip.open(root / 'raw-results.json.gz', 'rt'))
summary = json.loads((root / 'summary.json').read_text())
freeze = json.loads((root / 'freeze.json').read_text())
assert state['status'] == summary['status'] == 'complete'
assert freeze == state['freeze']
partitions = list(state['settings']['seeds'].values())
assert len(set(sum(partitions, []))) == sum(map(len, partitions))
reports = [r['report'] for phase in ['training', 'validation', 'evaluation'] for b in state[phase] for c in b['cells'] for r in c['report']['runs']]
accounting = dict(hands=sum(r['hands'] for r in reports), matches=len(reports), illegalFallbacks=sum(sum(r['fallbacks']) for r in reports), nonconservingMatches=sum(sum(r['net']) != 0 for r in reports))
assert accounting == summary['accounting']
assert accounting['illegalFallbacks'] == accounting['nonconservingMatches'] == 0
for phase in ['training', 'validation', 'evaluation']:
    for batch in state[phase]:
        for cell in batch['cells']:
            runs = cell['report']['runs']
            candidate = sum(r['report']['net'][r['participantAtSeat'].index(0)] / r['report']['bigBlind'] / r['report']['hands'] * 100 for r in runs) / len(runs)
            row = next(r for r in batch['rows'] if r['players'] == cell['players'] and r['field'] == cell['field'])
            assert math.isclose(candidate, row['bb100'], abs_tol=1e-9)
        for street, totals in batch['calibration'].items():
            rows = [r for r in batch['forecasts'] if r['street'] == street]
            assert len(rows) == totals['count']
            brier = loss = 0
            for r in rows:
                p = r['probabilities']
                assert math.isclose(sum(p), 1, abs_tol=1e-6)
                actual = ['fold', 'passive', 'aggressive'].index(r['actual'])
                brier += sum((x - (i == actual)) ** 2 for i, x in enumerate(p))
                loss -= math.log(max(1e-12, p[actual]))
                assert not any(k in r for k in ['cards', 'hole', 'deck'])
            assert math.isclose(brier, totals['brierSum'], abs_tol=1e-8)
            assert math.isclose(loss, totals['logLossSum'], abs_tol=1e-8)
profits = {}
for name in ['fitted-river', 'current-river', 'equity-control']:
    batches = [b for b in state['evaluation'] if b['configuration']['id'] == name]
    seed_means = [sum(r['bb100'] for r in b['rows']) / len(b['rows']) for b in batches]
    profits[name] = sum(seed_means) / len(seed_means)
    reported = next(r['profit']['meanBb100'] for r in state['results']['summaries'] if r['id'] == name)
    assert math.isclose(profits[name], reported, abs_tol=1e-9)
result = dict(accounting=accounting, frozenWeight=freeze['weight'], meanBb100=profits, forecastScoresRecomputed=True, rawProfitRecomputed=True)
(root / 'audit.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))

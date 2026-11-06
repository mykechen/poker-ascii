"""Independent raw accounting and aggregate audit: python3 scripts/audit-frequency-confirmation.py RUN_DIR."""
import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

folder = Path(sys.argv[1])
progress = json.loads((folder / 'progress.json').read_text())
summary = json.loads((folder / 'summary.json').read_text())
assert progress['status'] == 'complete'
assert set(progress['completed']) == {f'profit-{seed}-{model}' for seed in range(61001, 61031) for model in ['frequency', 'current']} | {f'panel-{seed}-current' for seed in range(62001, 62011)}
assert len(progress['completed']) == 70
freeze = json.loads((folder / 'freeze.json').read_text())
assert hashlib.sha256(json.dumps(freeze['model'], separators=(',', ':')).encode()).hexdigest() == summary['settings']['modelHash']
rows = {'frequency': {}, 'current': {}}
reports = []
for key in progress['completed']:
    raw = json.loads(gzip.decompress((folder / (key + '.json.gz')).read_bytes()))
    batch = raw['batch']
    phase, seed, model = key.split('-')
    seed = int(seed)
    assert batch['seed'] == seed and batch['configuration']['id'] == model
    assert batch['configuration']['equitySamples'] == 50 and batch['configuration']['riverSamples'] == 16
    assert batch['configuration']['responseModel'] == (freeze['model'] if model == 'frequency' else {'version': 1, 'kind': 'current'})
    assert len(batch['cells']) == len(batch['rows']) == 6
    for cell in batch['cells']:
        runs = cell['report']['runs']
        assert len(runs) == cell['players']
        assert sorted(r['participantAtSeat'].index(0) for r in runs) == list(range(cell['players']))
        for run in runs:
            r = run['report']
            reports.append(r)
            assert r['hands'] == 2 and r['stack'] == 200 and r['bigBlind'] == 2 and r['smallBlind'] == 1
            assert sum(r['net']) == 0 and all(n == 0 for n in r['fallbacks'])
            for net, bb in zip(r['net'], r['bb100']):
                assert abs(net / 4 * 100 - bb) < 1e-8
        mean = sum(r['report']['bb100'][r['participantAtSeat'].index(0)] for r in runs) / len(runs)
        row = next(r for r in batch['rows'] if r['players'] == cell['players'] and r['field'] == cell['field'])
        assert abs(row['bb100'] - mean) < 1e-8
        if phase == 'profit':
            rows[model][seed, cell['players'], cell['field']] = mean
    if phase == 'panel':
        assert model == 'current' and 62001 <= seed <= 62010 and raw['observations']
    else:
        assert 61001 <= seed <= 61030 and not raw['observations']
assert len(reports) == 2940 and sum(r['hands'] for r in reports) == 5880
assert len(rows['frequency']) == len(rows['current']) == 180
seed_deltas = [sum(rows['frequency'][k] - rows['current'][k] for k in rows['frequency'] if k[0] == seed) / 6 for seed in range(61001, 61031)]
mean = sum(seed_deltas) / 30
se = math.sqrt(sum((x - mean) ** 2 for x in seed_deltas) / 29 / 30)
assert abs(mean - summary['decision']['mean']) < 1e-8
assert abs(se - summary['decision']['standardError']) < 1e-8
assert abs(mean - 2.04523 * se - summary['decision']['lower95']) < 1e-8
for cell in summary['cellIntervals']:
    players, field = cell['cell'].split(':')
    delta = sum(rows['frequency'][seed, int(players), field] - rows['current'][seed, int(players), field] for seed in range(61001, 61031)) / 30
    assert abs(delta - cell['mean']) < 1e-8
assert abs(mean + 2.04523 * se - summary['decision']['upper95']) < 1e-8
scores = summary['scores']
base = scores['current']['groups']
frequency = scores['frequency']['groups']
sparse_covered = base.get('110:true', {}).get('count', 0) >= 100 and frequency.get('110:true', {}).get('count') == base.get('110:true', {}).get('count')
support_pass = sparse_covered and all(v['count'] < 100 or k in frequency and frequency[k]['count'] == v['count'] and frequency[k]['logLoss'] <= v['logLoss'] + .02 for k, v in base.items())
target = mean >= 5 and mean - 2.04523 * se > 0
downside = all(c['mean'] >= -5 for c in summary['cellIntervals'])
assert summary['decision']['targetSignal'] == target
assert summary['decision']['downsidePass'] == downside
assert summary['decision']['supportPass'] == support_pass
assert summary['decision']['allGatesPass'] == (target and downside and support_pass)
registry = json.loads((folder.parents[1] / 'seed-registry.json').read_text())
started = [b for b in registry['started_batches'] if b['directory'] == str(folder)]
assert len(started) == 70
assert all(b['startedAt'] >= progress['startedAt'] for b in started)
assert len({(b['phase'], b['seed'], b['id']) for b in started}) == 70
output = {'matches': len(reports), 'hands': 5880, 'fallbacks': 0, 'zeroSum': True, 'freezeHashVerified': True, 'rotationMeansRecomputed': True, 'pairedMean': mean, 'pairedSE': se, 'interval95': [mean - 2.04523 * se, mean + 2.04523 * se]}
(folder / 'audit.json').write_text(json.dumps(output, indent=2) + '\n')
print(json.dumps(output))

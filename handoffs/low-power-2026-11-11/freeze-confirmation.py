from pathlib import Path
import datetime
import hashlib
import json
import math
import statistics
import subprocess

base = Path('handoffs/low-power-2026-11-11')
probe = base / 'paused'
root = base / 'confirmation'
load = lambda p: json.loads(p.read_text())
assert load(probe / 'controller.json')['status'] == 'all-runs-complete-awaiting-pooled-analysis'
timing = load(probe / 'run-1/timing.json')
assert timing['physicalHands'] == 6720 and timing['workerIdleMs'] == 2000
power = [json.loads(line) for line in (probe / 'power.jsonl').read_text().splitlines()]
origin = datetime.datetime.fromisoformat(power[0]['at'])
loaded = [p for p in power[1:-1] if (datetime.datetime.fromisoformat(p['at']) - origin).total_seconds() >= 45]
assert loaded and all(p['acPower'] and not p['stop'] for p in loaded)
draw = statistics.mean(p['batteryWatts'] for p in loaded)
rate = .85 * timing['handsPerHour']
hours = 332220 / rate
engineering = sum(load(base / label / 'run-1/timing.json')['elapsedMs'] for label in ('one','four','two-normal','paused')) / 3600000 + .15
spent = 48 - load(Path('handoffs/adoption-2026-11-10-fresh/budget-after.json'))['remainingRunHours'] + engineering
per_run = math.floor(1.5 * rate / 84 / 5) * 5
assert per_run >= 5 and spent + hours + 2 < 48
summary = dict(handsPerHour=timing['handsPerHour'], planningHandsPerHour=rate, meanBatteryDischargeWatts=draw, elapsedMinutes=timing['elapsedMs']/60000, startBatteryPercent=power[0]['batteryPercent'], endBatteryPercent=power[-1]['batteryPercent'], adoptionPredictedHours=hours, chargedBeforeConfirmationHours=spent, runs=math.ceil(3955/per_run), clustersPerFullBatch=per_run)
(base / 'paused-result.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2),flush=True)
if max(0, draw) * 2 * 1.5 > (60-25) * .60:
    raise SystemExit('Projected battery use exceeds the available reserve')
root.mkdir()
study = load(Path('handoffs/adoption-2026-11-10-fresh/study.json'))
study.update(frozenAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), workers=2, qos='normal', collectBatteryDraw=True, powerSampleSeconds=15, stopBatteryPercent=25, minStartBatteryPercent=60, runs=[], spentBeforeThisSessionHours=spent, analysis='Analyze only after every fixed batch completes', recovery={'excluded':['handoffs/adoption-2026-11-10','handoffs/adoption-2026-11-10-fresh'],'reason':'Prior power interruptions. Both studies excluded without inspecting returns.'}, planning=summary)
for i, offset in enumerate(range(0,3955,per_run),1):
    id = f'adoption-low-power-r{i}'
    subprocess.run(['node_modules/.bin/vite-node','scripts/freeze-evaluation.ts','--id',id,'--seed-start',str(180001+offset),'--clusters',str(min(per_run,3955-offset)),'--hands','1','--classification','adoption-confirmation','--adjust','false','--max-seconds','7140','--worker-idle-ms','2000'],check=True)
    path = Path('handoffs/protocols') / f'{id}.json'
    p = load(path)
    study['sourceHash'] = p['sourceHash']
    study['runs'].append(dict(protocol=str(path), protocolHash=hashlib.sha256(json.dumps(p,separators=(',',':'),ensure_ascii=False).encode()).hexdigest(),out=str(root/f'run-{i}')))
(root/'study.json').write_text(json.dumps(study,indent=2)+'\n')
for f in ('run-adoption-study.py','adoption_power.py','analyze-adoption-study.py'):
    (root/f).write_bytes(Path('scripts',f).read_bytes())

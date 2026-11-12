#!/bin/zsh
set -eu
root=handoffs/low-power-2026-11-11/confirmation
node_modules/.bin/vite-node scripts/recover-adoption-batch.ts
python3 scripts/run-adoption-study.py "$root/final-continuation"
python3 - <<'PY'
from pathlib import Path
import json,datetime
r=Path('handoffs/low-power-2026-11-11/confirmation')
assert json.loads((r/'final-continuation/controller.json').read_text())['status']=='all-runs-complete-awaiting-pooled-analysis'
assert all(json.loads((r/f'run-{i}/provenance.json').read_text())['status']=='complete' for i in range(1,8))
(r/'recovery/original-controller.json').write_bytes((r/'controller.json').read_bytes())
(r/'controller.json').write_text(json.dumps(dict(status='all-runs-complete-awaiting-pooled-analysis',completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),technicalContinuation='recovery/manifest.json',originalController='recovery/original-controller.json'),indent=2)+'\n')
PY
PYTHONPATH=. python3 scripts/analyze-adoption-study.py "$root"
node_modules/.bin/vite-node scripts/measure-adoption-cost.ts "$root"

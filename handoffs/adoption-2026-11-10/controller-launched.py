"""Execute the two preregistered runs sequentially; no interim return analysis."""
import json,subprocess,signal,datetime
from pathlib import Path
root=Path('handoffs/adoption-2026-11-10');study=json.loads((root/'study.json').read_text());active=None;stopped=False

def stop(signum,frame):
 global stopped
 stopped=True
 if active is not None:active.terminate()
for sig in [signal.SIGINT,signal.SIGTERM]:signal.signal(sig,stop)
def status(value):
 (root/'controller.json.tmp').write_text(json.dumps(value,indent=2)+'\n');(root/'controller.json.tmp').replace(root/'controller.json')
for i,run in enumerate(study['runs']):
 if stopped:raise SystemExit('Stopped; no subsequent run launched')
 status({'status':'running','runIndex':i+1,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'noInterimAnalysis':True})
 with (root/f'run-{i+1}.log').open('x') as log:
  active=subprocess.Popen(['node_modules/.bin/vite-node','scripts/evaluate-frozen.ts','--protocol',run['protocol'],'--workers',str(study['workers']),'--out',run['out']],stdout=log,stderr=subprocess.STDOUT)
  code=active.wait();active=None
 if code or stopped:
  status({'status':'incomplete','runIndex':i+1,'exitCode':code,'reason':'technical failure/interrupt; no automatic retry or top-up'});raise SystemExit(code or 1)
 status({'status':'run-complete','runIndex':i+1,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'noInterimAnalysis':True})
status({'status':'all-runs-complete-awaiting-pooled-analysis','completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})

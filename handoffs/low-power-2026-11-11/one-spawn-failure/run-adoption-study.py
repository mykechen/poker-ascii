"""Execute the two preregistered runs sequentially; no interim return analysis."""
import json,subprocess,signal,datetime,hashlib,sys,os,plistlib
from adoption_power import parse_power,battery_details,runner_command
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else 'handoffs/adoption-2026-11-10');study=json.loads((root/'study.json').read_text());active=None;stopped=False

# Validate the complete preregistration before spending any seeds.
seen=set()
for run in study['runs']:
 protocol=json.loads(Path(run['protocol']).read_text())
 digest=hashlib.sha256(json.dumps(protocol,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
 if digest!=run['protocolHash'] or protocol['sourceHash']!=study['sourceHash']:raise SystemExit('Frozen study/protocol identity mismatch')
 if seen.intersection(protocol['seeds']):raise SystemExit('Seed overlap within study')
 seen.update(protocol['seeds'])
if len(seen)!=study['clusters']:raise SystemExit('Incomplete fixed study manifest')

def stop(signum,frame):
 global stopped
 stopped=True
 if active is not None and active.poll() is None:os.killpg(active.pid,signal.SIGTERM)
for sig in [signal.SIGINT,signal.SIGTERM]:signal.signal(sig,stop)
def status(value):
 (root/'controller.json.tmp').write_text(json.dumps(value,indent=2)+'\n');(root/'controller.json.tmp').replace(root/'controller.json')
def check_power():
 try:output=subprocess.check_output(['pmset','-g','batt'],text=True,timeout=5)
 except (OSError,subprocess.SubprocessError) as error:output=f'Power reading unavailable: {error}'
 power=parse_power(output)
 if study.get('collectBatteryDraw',False):
  try:
   battery=plistlib.loads(subprocess.check_output(['ioreg','-r','-c','AppleSmartBattery','-a'],timeout=5))[0]
   power.update(battery_details(battery))
  except (OSError,subprocess.SubprocessError,ValueError,IndexError) as error:power.update(stop=True,sensorError=str(error))
 if power['batteryPercent'] is not None and power['batteryPercent']<=study.get('stopBatteryPercent',15):power['stop']=True
 with (root/'power.jsonl').open('a') as f:f.write(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),**power,'raw':output})+'\n')
 return power['stop']
for i,run in enumerate(study['runs']):
 if stopped or check_power():raise SystemExit('Stopped by fixed power safety rule; no subsequent run launched')
 status({'status':'running','runIndex':i+1,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'noInterimAnalysis':True})
 with (root/f'run-{i+1}.log').open('x') as log:
  active=subprocess.Popen(runner_command(run,study['workers'],study.get('qos','normal')),stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  while True:
   try:code=active.wait(timeout=study.get('powerSampleSeconds',60));break
   except subprocess.TimeoutExpired:
    if check_power():
     stopped=True
     if active.poll() is None:os.killpg(active.pid,signal.SIGTERM)
  active=None
 if code or stopped:
  status({'status':'incomplete','runIndex':i+1,'exitCode':code,'reason':'technical failure/interrupt; no automatic retry or top-up'});raise SystemExit(code or 1)
 status({'status':'run-complete','runIndex':i+1,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'noInterimAnalysis':True})
 check_power()
status({'status':'all-runs-complete-awaiting-pooled-analysis','completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})

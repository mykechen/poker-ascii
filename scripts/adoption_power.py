"""Outcome-independent hardware safety rule fixed before study launch."""
import re
import math
import shutil
import os
import signal
import subprocess

def parse_power(output):
    match=re.search(r'(\d+)%',output)
    percent=int(match.group(1)) if match else None
    ac="Now drawing from 'AC Power'" in output
    return {'batteryPercent':percent,'acPower':ac,'stop':percent is None or percent<=15 or (not ac and percent<=20)}

def battery_details(battery):
    if not isinstance(battery,dict):raise ValueError('Invalid battery sensor record')
    adapter=battery.get('AdapterDetails')
    if adapter is None:adapter={}
    if not isinstance(adapter,dict):raise ValueError('Invalid charger sensor record')
    voltage=battery.get('Voltage');current=battery.get('Amperage')
    if not isinstance(voltage,(int,float)) or not isinstance(current,(int,float)) or voltage<=0 or not math.isfinite(voltage) or not math.isfinite(current):
        raise ValueError('Battery voltage/current unavailable')
    if current>2**63:current-=2**64
    return {'voltageMillivolts':voltage,'currentMilliamps':current,'batteryWatts':-voltage*current/1_000_000,'adapterWatts':adapter.get('Watts')}

def stop_process_group(process):
    if process is None:return
    def send(sig):
        try:os.killpg(process.pid,sig)
        except ProcessLookupError:pass
    send(signal.SIGTERM)
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        send(signal.SIGKILL)
        process.wait(timeout=5)
    finally:
        # A reaped leader can leave grandchildren behind in the same group.
        send(signal.SIGKILL)

def runner_command(run,workers,qos='normal'):
    if qos not in ['normal','background']:raise ValueError('Unknown scheduling mode')
    if not isinstance(workers,int) or not 1<=workers<=64:raise ValueError('Invalid workers')
    command=['node_modules/.bin/vite-node','scripts/evaluate-frozen.ts','--protocol',run['protocol'],'--workers',str(workers),'--out',run['out']]
    if qos=='background':
        executable=shutil.which('taskpolicy')
        if executable is None:raise FileNotFoundError('taskpolicy unavailable')
        return [executable,'-c','background']+command
    return command

"""Add derived identity sidecars; never alter executed protocols or simulator source."""
import json,hashlib
from pathlib import Path
root=Path('handoffs/evaluation-2026-11-09-r2')
def digest(value):return hashlib.sha256(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
for directory in root.iterdir():
    if not directory.is_dir() or not (directory/'protocol.json').exists():continue
    p=json.loads((directory/'protocol.json').read_text());s=json.loads((directory/'source.json').read_text())
    if digest(s['files'])!=p['sourceHash'] or s['hash']!=p['sourceHash']:raise ValueError('Source identity mismatch')
    config={k:p[k] for k in ['arms','stack','smallBlind','bigBlind','adjustAllIn']}
    config['fixedAdaptiveSettings']={'seed':42,'riverSamples':16,'riverRiskPenalty':1,'learn':False,'styleRetention':1,'responseModel':{'version':1,'kind':'current'}}
    config['semanticsSourceHash']=p['sourceHash']
    result={'sourceHash':p['sourceHash'],'poolHash':p['poolHash'],'protocolHash':digest(p),'configHash':digest(config),'config':config,'note':'Derived from executed protocol and its archived executable source; full protocolHash remains the authoritative combined execution/configuration identity.'}
    output=directory/'identities.json'
    if output.exists():
        if json.loads(output.read_text())!=result:raise ValueError('Identity sidecar changed')
    else:output.write_text(json.dumps(result,indent=2)+'\n')

"""Outcome-independent hardware safety rule fixed before study launch."""
import re

def parse_power(output):
    match=re.search(r'(\d+)%',output)
    percent=int(match.group(1)) if match else None
    ac="Now drawing from 'AC Power'" in output
    return {'batteryPercent':percent,'acPower':ac,'stop':percent is None or percent<=15 or (not ac and percent<=20)}

"""Generate exact fixed-work run partitions; never execute or reserve seeds implicitly."""
import math

def partition_clusters(seeds,physical_per_seed,hands_per_hour,max_run_seconds=7200):
    if not seeds or len(set(seeds))!=len(seeds):raise ValueError('Missing/duplicate seeds')
    if hands_per_hour<=0 or physical_per_seed<=0 or not 0<max_run_seconds<=7200:raise ValueError('Invalid work/runtime bound')
    work_seconds=min(5400,max_run_seconds*.75)
    per_run=math.floor(hands_per_hour*work_seconds/3600/physical_per_seed)
    if per_run<1:raise ValueError('One whole seed cluster cannot fit; change protocol before launch')
    return [{'index':i//per_run,'seeds':seeds[i:i+per_run],'physicalHands':len(seeds[i:i+per_run])*physical_per_seed,'predictedSeconds':len(seeds[i:i+per_run])*physical_per_seed/hands_per_hour*3600,'hardLimitSeconds':max_run_seconds} for i in range(0,len(seeds),per_run)]

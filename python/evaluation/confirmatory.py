"""Planning scenarios only. Unimplemented policy variances/latencies need fresh pilots."""
import math
from .power import required_units

def budget_scenario(variance,effect,rate,paired_hands_per_cluster,arms=2,threshold=0,comparisons=3):
    if rate<=0 or arms<2 or paired_hands_per_cluster<=0:raise ValueError('Invalid cost assumptions')
    units=max(30,required_units(variance,effect,comparisons,null_bb100=threshold))
    # Full-rotation design covers every position within each cluster; five seed offsets balance template multiplicities.
    units=math.ceil(units/5)*5
    physical_per_cluster=paired_hands_per_cluster*arms/2
    per_run=math.floor(rate*1.5/physical_per_cluster/5)*5
    if per_run<1:raise ValueError('A whole cluster exceeds the 90-minute work allowance')
    hands=units*physical_per_cluster;hours=hands/rate
    return {'assumedTrueEffectBb100':effect,'nullThresholdBb100':threshold,'comparisons':comparisons,'requiredSeedClusters':units,'totalPhysicalHands':int(hands),'handsPerArm':int(hands/arms),'runsAtMostTwoHours':math.ceil(units/per_run),'predictedHours':hours,'runSlotsHours':2*math.ceil(units/per_run),'maxClustersPerRun':per_run,'assumptions':'Full rotation; variance and per-arm cost proxy from 50/128 pilot; future policy-specific pilot required before final N.'}

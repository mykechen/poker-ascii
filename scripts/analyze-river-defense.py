"""Paired analysis of the river-defense screen: arm minus v1, in bb/100, clustered by seed.

Usage: python3 scripts/analyze-river-defense.py <directory-with-shard-*.json>
"""
import glob
import json
import math
import statistics
import sys
from collections import defaultdict

BIG_BLIND = 2


def main(directory: str) -> None:
    rows = []
    for path in sorted(glob.glob(f"{directory}/shard-*.json")):
        with open(path) as handle:
            rows.extend(json.load(handle)["rows"])
    if not rows:
        raise SystemExit(f"No shard rows found in {directory}.")

    # chips[cell][arm][seed] = hero net summed over rotations; hands likewise.
    chips = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    hands = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    ms = defaultdict(float)
    arm_hands = defaultdict(int)
    for row in rows:
        chips[row["cell"]][row["arm"]][row["seed"]] += row["heroNet"]
        hands[row["cell"]][row["arm"]][row["seed"]] += row["hands"]
        ms[row["arm"]] += row["ms"]
        arm_hands[row["arm"]] += row["hands"]

    summary = {"cells": {}, "msPerHand": {arm: ms[arm] / arm_hands[arm] for arm in ms}}
    for cell, arms in chips.items():
        seeds = sorted(arms["v1"])
        cell_summary = {"seeds": len(seeds), "absolute": {}, "versusV1": {}}
        for arm, by_seed in arms.items():
            total = sum(by_seed.values())
            count = sum(hands[cell][arm].values())
            cell_summary["absolute"][arm] = total / BIG_BLIND / count * 100
            if arm == "v1":
                continue
            if sorted(by_seed) != seeds:
                raise SystemExit(f"Arm {arm} in {cell} is not paired with v1 on the same seeds.")
            diffs = [
                (by_seed[s] - arms["v1"][s]) / BIG_BLIND / hands[cell][arm][s] * 100 for s in seeds
            ]
            mean = statistics.fmean(diffs)
            se = statistics.stdev(diffs) / math.sqrt(len(diffs))
            cell_summary["versusV1"][arm] = {
                "meanBb100": mean,
                "se": se,
                "ci95": [mean - 1.96 * se, mean + 1.96 * se],
            }
        summary["cells"][cell] = cell_summary
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])

"""Run from any directory: python3 audit.py. Audit archived raw accounting."""
import gzip
import hashlib
import json
from pathlib import Path

folder = Path(__file__).resolve().parent
raw = json.loads(gzip.decompress((folder / "raw-results.json.gz").read_bytes()))
summary = json.loads((folder / "summary.json").read_text())
freeze = json.loads((folder / "freeze.json").read_text())
assert raw["status"] == summary["status"] == "complete"
assert hashlib.sha256((folder / "freeze.json").read_bytes()).hexdigest() == (folder / "freeze.sha256").read_text().strip()
assert hashlib.sha256(json.dumps(freeze["model"], separators=(",", ":")).encode()).hexdigest() == freeze["modelHash"]
reports = []
for phase in ["training", "validation", "evaluation"]:
    assert len(raw[phase]) == summary[phase]
    for batch in raw[phase]:
        for cell in batch["cells"]:
            runs = cell["report"]["runs"]
            assert len(runs) == cell["players"]
            for run in runs:
                report = run["report"]
                reports.append(report)
                assert report["hands"] == 2 and report["stack"] == 200
                assert report["bigBlind"] == 2 and report["smallBlind"] == 1
                assert sum(report["net"]) == 0 and sum(report["fallbacks"]) == 0
                for net, score in zip(report["net"], report["bb100"]):
                    assert abs(net / 2 / 2 * 100 - score) < 1e-8
            mean = sum(r["report"]["bb100"][r["participantAtSeat"].index(0)] for r in runs) / len(runs)
            row = next(r for r in batch["rows"] if r["players"] == cell["players"] and r["field"] == cell["field"])
            assert abs(row["bb100"] - mean) < 1e-8
assert len(reports) == 840 and sum(r["hands"] for r in reports) == 1680
registry = json.loads((folder.parents[1] / "seed-registry.json").read_text())
batches = [b for b in registry["started_batches"] if b["directory"].endswith(folder.name)]
assert len(batches) == 18
assert all(b["startedAt"] > freeze["frozenAt"] for b in batches if b["phase"] == "evaluation")
assert not any(51005 <= b["seed"] <= 51008 for b in batches)
for result in raw["results"]["summaries"]:
    values = [b for b in raw["evaluation"] if b["configuration"]["id"] == result["id"]]
    means = [sum(r["bb100"] for r in b["rows"]) / len(b["rows"]) for b in values]
    assert abs(sum(means) / len(means) - result["profit"]["meanBb100"]) < 1e-8
    assert result["profit"]["interval95"] is None
output = {"matches": len(reports), "hands": sum(r["hands"] for r in reports), "fallbacks": 0,
          "zeroSum": True, "bb100Recomputed": True, "rotationMeansRecomputed": True,
          "freezeHashVerified": True, "freezeBeforeEveryEvaluation": True,
          "trainingFlopObservations": sum(sum(len(r["board"]) == 3 for r in panel) for panel in raw["panels"]["training"])}
(folder / "audit.json").write_text(json.dumps(output, indent=2) + "\n")
print(json.dumps(output))

# Run 0002 — no-memory calibration

Status: complete. Runtime source: 0f9d288.

15,120 hands / 630 matches; zero invalid actions or chip-accounting failures. Candidates reset opponent beliefs every hand.

Held-out means: river-search 685.53 bb/100; equity-only 710.93; chart 210.27. The river policy trails equity-only by 25.40 bb/100 in this small sample. Three held-out seed batches are insufficient to establish superiority or inferiority.

The response model beats a uniform forecast on river prediction scores but loses to it on the flop. Next priority is offline global flop-model calibration and computation profiling, with new seed partitions. No live-policy promotion.

[Detailed interpretation](runs/2026-11-05-5a4690bf0ef2/interpretation.md) · [Automatic handoff](runs/2026-11-05-5a4690bf0ef2/handoff.md) · [Machine-readable summary](runs/2026-11-05-5a4690bf0ef2/summary.json).

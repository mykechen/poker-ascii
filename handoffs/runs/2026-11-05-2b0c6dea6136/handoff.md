# Run 2b0c6dea61368ee1d7f835af3968292885a4127e58fcd3ba5f0b1f3a60fe8c59

Status: **complete** · Updated: 2026-11-05T06:21:31.687Z

Source commit: 4fa0bba19b35c325daeaf878336d78e46b9e16bc

Source fingerprint: dd12589ab66bd328f29be5064b60e1996f9f5eb37c78f2035c86bdc644332158

Completed batches: 6/6

## Objective and settings

No cross-hand opponent memory. Preserve within-hand range inference. Fixed 100bb stacks, 1/2 blinds, no rake; 6–8 players.

```json
{
  "hands": 1,
  "tableSizes": [
    6,
    7,
    8
  ],
  "tuningSeeds": [
    20001
  ],
  "evaluationSeeds": [
    30001
  ],
  "tuningFields": [
    {
      "id": "balanced-train",
      "opponents": [
        "chart",
        "tight",
        "station",
        "position"
      ]
    },
    {
      "id": "pressure-train",
      "opponents": [
        "aggressor",
        "position",
        "chart"
      ]
    }
  ],
  "evaluationFields": [
    {
      "id": "unseen-mix",
      "opponents": [
        "multiway",
        "learner",
        "maniac",
        "station",
        "tight"
      ]
    },
    {
      "id": "unseen-pressure",
      "opponents": [
        "maniac",
        "learner",
        "multiway"
      ]
    }
  ]
}
```

## Configurations

```json
[
  {
    "mode": "frozen",
    "equitySamples": 50,
    "riverSamples": 16,
    "styleRetention": 1,
    "riverRiskPenalty": 0,
    "id": "no-memory-risk-0"
  },
  {
    "mode": "frozen",
    "equitySamples": 50,
    "riverSamples": 16,
    "styleRetention": 1,
    "riverRiskPenalty": 1,
    "id": "no-memory-risk-1"
  },
  {
    "mode": "frozen",
    "equitySamples": 50,
    "riverSamples": 16,
    "styleRetention": 1,
    "riverRiskPenalty": 2,
    "id": "no-memory-risk-2"
  }
]
```

## Frozen tuning selection

```json
{
  "mode": "frozen",
  "equitySamples": 50,
  "riverSamples": 16,
  "styleRetention": 1,
  "riverRiskPenalty": 0,
  "id": "no-memory-risk-0"
}
```

## Results

```json
{
  "accounting": {
    "hands": 252,
    "matches": 252,
    "illegalFallbacks": 0,
    "nonconservingMatches": 0
  },
  "tuningScores": [
    {
      "id": "no-memory-risk-0",
      "meanBb100": 480.8035714285714,
      "standardError": null,
      "interval95": null,
      "seeds": [
        20001
      ],
      "seedScores": [
        480.8035714285714
      ],
      "cellScores": [
        {
          "cell": "6:balanced-train",
          "meanBb100": 16.666666666666668
        },
        {
          "cell": "6:pressure-train",
          "meanBb100": 458.3333333333333
        },
        {
          "cell": "7:balanced-train",
          "meanBb100": 1471.4285714285713
        },
        {
          "cell": "7:pressure-train",
          "meanBb100": -142.85714285714286
        },
        {
          "cell": "8:balanced-train",
          "meanBb100": 2318.75
        },
        {
          "cell": "8:pressure-train",
          "meanBb100": -1237.5
        }
      ],
      "worstCellBb100": -1237.5
    },
    {
      "id": "no-memory-risk-1",
      "meanBb100": 247.47023809523816,
      "standardError": null,
      "interval95": null,
      "seeds": [
        20001
      ],
      "seedScores": [
        247.47023809523816
      ],
      "cellScores": [
        {
          "cell": "6:balanced-train",
          "meanBb100": 16.666666666666668
        },
        {
          "cell": "6:pressure-train",
          "meanBb100": 458.3333333333333
        },
        {
          "cell": "7:balanced-train",
          "meanBb100": 71.42857142857143
        },
        {
          "cell": "7:pressure-train",
          "meanBb100": -142.85714285714286
        },
        {
          "cell": "8:balanced-train",
          "meanBb100": 2318.75
        },
        {
          "cell": "8:pressure-train",
          "meanBb100": -1237.5
        }
      ],
      "worstCellBb100": -1237.5
    },
    {
      "id": "no-memory-risk-2",
      "meanBb100": 99.5535714285714,
      "standardError": null,
      "interval95": null,
      "seeds": [
        20001
      ],
      "seedScores": [
        99.5535714285714
      ],
      "cellScores": [
        {
          "cell": "6:balanced-train",
          "meanBb100": 16.666666666666668
        },
        {
          "cell": "6:pressure-train",
          "meanBb100": -441.6666666666667
        },
        {
          "cell": "7:balanced-train",
          "meanBb100": 71.42857142857143
        },
        {
          "cell": "7:pressure-train",
          "meanBb100": -142.85714285714286
        },
        {
          "cell": "8:balanced-train",
          "meanBb100": 2331.25
        },
        {
          "cell": "8:pressure-train",
          "meanBb100": -1237.5
        }
      ],
      "worstCellBb100": -1237.5
    }
  ],
  "summaries": [
    {
      "id": "no-memory-risk-0",
      "configuration": {
        "mode": "frozen",
        "equitySamples": 50,
        "riverSamples": 16,
        "styleRetention": 1,
        "riverRiskPenalty": 0,
        "id": "no-memory-risk-0"
      },
      "meanBb100": -1034.970238095238,
      "standardError": null,
      "interval95": null,
      "seeds": [
        30001
      ],
      "seedScores": [
        -1034.970238095238
      ],
      "cellScores": [
        {
          "cell": "6:unseen-mix",
          "meanBb100": -1783.3333333333333
        },
        {
          "cell": "6:unseen-pressure",
          "meanBb100": -1691.6666666666667
        },
        {
          "cell": "7:unseen-mix",
          "meanBb100": 21.4285714285713
        },
        {
          "cell": "7:unseen-pressure",
          "meanBb100": -1500
        },
        {
          "cell": "8:unseen-mix",
          "meanBb100": -2518.75
        },
        {
          "cell": "8:unseen-pressure",
          "meanBb100": 1262.5
        }
      ],
      "worstCellBb100": -2518.75
    },
    {
      "id": "equity-control",
      "configuration": {
        "mode": "equity",
        "equitySamples": 50,
        "riverSamples": 16,
        "styleRetention": 1,
        "riverRiskPenalty": 0,
        "id": "equity-control"
      },
      "meanBb100": -974.2559523809524,
      "standardError": null,
      "interval95": null,
      "seeds": [
        30001
      ],
      "seedScores": [
        -974.2559523809524
      ],
      "cellScores": [
        {
          "cell": "6:unseen-mix",
          "meanBb100": -1783.3333333333333
        },
        {
          "cell": "6:unseen-pressure",
          "meanBb100": -1691.6666666666667
        },
        {
          "cell": "7:unseen-mix",
          "meanBb100": 385.7142857142857
        },
        {
          "cell": "7:unseen-pressure",
          "meanBb100": -1500
        },
        {
          "cell": "8:unseen-mix",
          "meanBb100": -2518.75
        },
        {
          "cell": "8:unseen-pressure",
          "meanBb100": 1262.5
        }
      ],
      "worstCellBb100": -2518.75
    },
    {
      "id": "chart-control",
      "configuration": {
        "mode": "chart",
        "equitySamples": 50,
        "riverSamples": 16,
        "styleRetention": 1,
        "riverRiskPenalty": 0,
        "id": "chart-control"
      },
      "meanBb100": -474.7519841269841,
      "standardError": null,
      "interval95": null,
      "seeds": [
        30001
      ],
      "seedScores": [
        -474.7519841269841
      ],
      "cellScores": [
        {
          "cell": "6:unseen-mix",
          "meanBb100": -150
        },
        {
          "cell": "6:unseen-pressure",
          "meanBb100": -133.33333333333334
        },
        {
          "cell": "7:unseen-mix",
          "meanBb100": -35.714285714285715
        },
        {
          "cell": "7:unseen-pressure",
          "meanBb100": -35.714285714285715
        },
        {
          "cell": "8:unseen-mix",
          "meanBb100": -1318.75
        },
        {
          "cell": "8:unseen-pressure",
          "meanBb100": -1175
        }
      ],
      "worstCellBb100": -1318.75
    }
  ],
  "deltas": [
    {
      "versus": "equity-control",
      "meanBb100": -60.714285714285744,
      "standardError": null,
      "interval95": null,
      "seeds": [
        30001
      ],
      "seedScores": [
        -60.714285714285744
      ],
      "cellScores": [
        {
          "cell": "6:unseen-mix",
          "meanBb100": 0
        },
        {
          "cell": "6:unseen-pressure",
          "meanBb100": 0
        },
        {
          "cell": "7:unseen-mix",
          "meanBb100": -364.28571428571445
        },
        {
          "cell": "7:unseen-pressure",
          "meanBb100": 0
        },
        {
          "cell": "8:unseen-mix",
          "meanBb100": 0
        },
        {
          "cell": "8:unseen-pressure",
          "meanBb100": 0
        }
      ],
      "worstCellBb100": -364.28571428571445
    },
    {
      "versus": "chart-control",
      "meanBb100": -560.2182539682539,
      "standardError": null,
      "interval95": null,
      "seeds": [
        30001
      ],
      "seedScores": [
        -560.2182539682539
      ],
      "cellScores": [
        {
          "cell": "6:unseen-mix",
          "meanBb100": -1633.3333333333333
        },
        {
          "cell": "6:unseen-pressure",
          "meanBb100": -1558.3333333333335
        },
        {
          "cell": "7:unseen-mix",
          "meanBb100": 57.14285714285701
        },
        {
          "cell": "7:unseen-pressure",
          "meanBb100": -1464.2857142857142
        },
        {
          "cell": "8:unseen-mix",
          "meanBb100": -1200
        },
        {
          "cell": "8:unseen-pressure",
          "meanBb100": 2437.5
        }
      ],
      "worstCellBb100": -1633.3333333333333
    }
  ],
  "calibration": [
    {
      "id": "no-memory-risk-0",
      "streets": [
        {
          "street": "preflop",
          "count": 367,
          "brier": 0.6375237225371599,
          "logLoss": 1.0646881068470329,
          "uniformBrier": 0.6462306993642117,
          "uniformLogLoss": 1.0488958585186057
        },
        {
          "street": "flop",
          "count": 51,
          "brier": 0.6800760472204016,
          "logLoss": 0.9712656814701492,
          "uniformBrier": 0.5718954248366014,
          "uniformLogLoss": 0.8680536977830751
        },
        {
          "street": "turn",
          "count": 34,
          "brier": 0.5217346093152402,
          "logLoss": 0.7612344377153579,
          "uniformBrier": 0.5539215686274508,
          "uniformLogLoss": 0.8243270684772922
        },
        {
          "street": "river",
          "count": 24,
          "brier": 0.33073128569741966,
          "logLoss": 0.5045529348625226,
          "uniformBrier": 0.5069444444444445,
          "uniformLogLoss": 0.7100415600644521
        }
      ]
    },
    {
      "id": "equity-control",
      "streets": [
        {
          "street": "preflop",
          "count": 367,
          "brier": 0.6375237225371599,
          "logLoss": 1.0646881068470329,
          "uniformBrier": 0.6462306993642117,
          "uniformLogLoss": 1.0488958585186057
        },
        {
          "street": "flop",
          "count": 51,
          "brier": 0.6800760472204016,
          "logLoss": 0.9712656814701492,
          "uniformBrier": 0.5718954248366014,
          "uniformLogLoss": 0.8680536977830751
        },
        {
          "street": "turn",
          "count": 34,
          "brier": 0.5217346093152402,
          "logLoss": 0.7612344377153579,
          "uniformBrier": 0.5539215686274508,
          "uniformLogLoss": 0.8243270684772922
        },
        {
          "street": "river",
          "count": 24,
          "brier": 0.36451019602949214,
          "logLoss": 0.5448223158626654,
          "uniformBrier": 0.5069444444444445,
          "uniformLogLoss": 0.7100415600644521
        }
      ]
    },
    {
      "id": "chart-control",
      "streets": []
    }
  ],
  "label": "Exploratory fixed-stack screening; selection uses tuning partition only; no promotion or superiority claim"
}
```

## Limits

Small screening runs do not establish superiority. Prediction scores are action-level diagnostics with correlated observations. Historical runs on different seeds are not paired comparisons. No live-policy promotion is automatic.

## Next steps

- Inspect held-out profit and prediction scores before choosing the next experiment.

- Use fresh held-out seeds for future selection; no automatic promotion.


Machine-readable summary and compressed raw checkpoint are stored beside this handoff.

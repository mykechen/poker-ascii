#!/bin/zsh
set -eu
study=handoffs/low-power-2026-11-11/confirmation
python3 scripts/run-adoption-study.py "$study"
PYTHONPATH=. python3 scripts/analyze-adoption-study.py "$study"
node_modules/.bin/vite-node scripts/measure-adoption-cost.ts "$study"

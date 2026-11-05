# External pre-optimization baseline

Source 7998411 in /private/tmp/poker-profile-baseline, separate from the implementation worktree. The source runtime matches the marked baseline profile; only documentation differed from candidate base0455b80.

Historical profiling reuse, not fresh strategy evidence. Three measured 168-hand/2381-decision repetitions at unchanged 50-equity/16-river budgets: 20.316,20.920,20.748 seconds. All repeated actions/payouts deterministic and all chips conserved, with zero invalid fallbacks.

Compared against ../2026-11-05-cache-candidate/. No baseline source was edited. Exact per-match data and hashes are retained in baseline-raw.json.gz and baseline.json.

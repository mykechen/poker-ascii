# Step 0005 — training computation profile and focused optimization

Status: complete. No poker-policy promotion.

Profiled unchanged budgets and exact public action traces. Initial absolute-clock analysis was rejected and retained because V8 and hrtime have different origins on this machine. Stack-marker bounds fixed alignment, including intervening GC; duration coverage was effectively100%.

The valid profile attributed about 60% inclusive CPU time to repeated hand-feature computation. Added one 8192-entry FIFO cache of pure card features, preserving hole/board roles and copying results. It stores no opponent identities, tendencies or weights; cross-hand opponent memory remains off.

External baseline median 20.748 seconds -> candidate 12.476seconds per 168-hand workload: about40% less time /1.66x throughput. All 2381 actions per repetition, payouts and forecast totals match exactly. Zero invalid actions and chip-accounting failures. This is workload-specific compute evidence, not better poker strength.

[Valid baseline CPU findings](runs/2026-11-05-computation-profile-marked/interpretation.md) · [Optimization interpretation](runs/2026-11-05-cache-candidate/interpretation.md) · [Exact comparison](runs/2026-11-05-cache-candidate/comparison.json) · [Rejected first analysis](runs/2026-11-05-computation-profile-baseline/analysis-failure.md).

Next: specify the contextual global flop-response experiment before fitting. No budget increases, opponent memory, earlier-street search or live bot change.

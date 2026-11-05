# Session opponent learning implementation

Use the approved adaptive-bot design. Keep existing stateless policies compatible.

1. Add optional policy lifecycle methods: startSession(join IDs), observe(before, after). Every participant receives its own projected views after every action, including the terminal transition. Start fresh models per match/session; restore-to-100bb operations do not reset learning.
2. Implement smoothed per-opponent fold and aggression estimates by street and faced-bet status. Track opportunity denominators explicitly; expose posterior variance and sample counts. Default prior strength is provisional and configurable, not claimed optimal.
3. Maintain weighted ranges per hand. Use Bayesian action likelihoods with nonzero support and card removal; reset ranges each hand, retain tendencies across hands. Joint compatibility remains the equity service's responsibility.
4. Store action contexts until showdown. Learn hand-conditioned action counts only from publicly revealed opponent cards; do not turn hidden folds into hand labels. Report this as selected reveal evidence, not unconditional bluff frequency.
5. Connect the models to the existing equity control and compare frozen/adaptive variants with identical simulation rules. This remains check/call showdown value, not response-tree EV.
6. Verify lifecycle delivery, session reset, modest single-observation updates, context separation, revealed-card processing exactly once, and six-player legal simulation. Run full tests, lint, typecheck, review, commit and push.

Scope: training harness integration first. Live room lifecycle wiring and response-aware betting decisions follow separately; do not silently replace live bot behavior.

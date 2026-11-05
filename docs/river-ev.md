# River response-policy EV

The adaptive policy now searches river actions; earlier streets retain the equity check/call control. Disable river search with `riverSamples: false` for ablations. Default search uses 64 sampled worlds per candidate; `onRiverDecision` receives candidate EVs, standard errors, samples, chosen action, and elapsed compute time.

Each world draws mutually compatible active opponent hands from weighted ranges by whole-joint rejection. Opponent response hypotheses are sampled conditional on their drawn hands. Folded hands are marginalized rather than assigned simulator cards. Public commitments, action flags, blinds, button, and raise state reconstruct a river state. The reconstructed legal menu must exactly match the published menu. No real deck or hidden opponent cards enter search.

Candidates include every available fold/check/call/all-in plus legal minimum, half-pot, and pot raise sizes. The engine applies each candidate and runs explicit stochastic response policies to terminal payouts. Default responses use only that actor's simulated hole cards and public context. If action returns to hero, a balanced response policy supplies continuation; search does not recursively assume omniscient hero decisions. An injected response policy is an experiment dependency and must be stateless across candidates.

All candidates share sampled worlds and response seeds. EV is final hero stack minus current hero stack: already committed chips are sunk. Engine settlement preserves exact integer side-pot and odd-chip behavior. Standard errors measure sampling noise, not model misspecification; choosing the largest noisy estimate introduces selection optimism. Search is approximate, not a poker equilibrium or guaranteed best response.

Boundaries: river only, small action menu, finite samples and action budget. Response models and sizing frequencies are provisional and require held-out calibration. Opponent/folded-card correlations remain unmodeled. No artificial thinking delays are used in training. No live-room policy was replaced.

Run `npm run benchmark:river -- 10 2 32` for hands per rotation, seed batches, and river worlds. The integration smoke command `npm run benchmark:river -- 4 1 16` completed 6/7/8 player rotations (84 simulated hands total), including 57 searches averaging about 16 ms on this machine. This tiny run cannot establish profitability.

Regression cases cover value bets versus callers, zero-equity bluffs versus folders, losing calls, short-stack pot eligibility, folded dead money, unmatched returns, seeded stochastic repeatability, private-state independence, and six-way raise/reraise continuations. Independent review found no important defect; expanded multiplayer continuation coverage followed its feedback.

Next: held-out predictive/profit evaluation, parameter optimization and diverse league opponents, then earlier-street search. Do not promote this bot based solely on smoke results.

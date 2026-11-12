# Revised bounded decision stability screen

Authorized scope: user requested running the next screen. Builder choice: preassign a street per hand, retaining one state per hand. Supersedes first-paid-hand ownership in the previous execution specification; all other schedule, quota, scoring, aggregation and cap definitions remain as in [original spec](2026-11-07-decision-stability-execution.md).

Fresh proposed collection seeds103001–103020; reserve only after independent review. Validation102001–102010 stays unreserved/unused. No inspected101001 seeds reused.

For each hand, SHA256 UTF-8 JSON [seed,population,field,players,rotation,hand]; read first unsigned32-bit big-endian word modulo3, mapped to preflop/flop/turn. Assignment depends only on scheduled identity, never cards, actions, value or outcome. Capture first paid decision on assigned street; if none occurs, report hand as unavailable, no reassignment. Selection hashes remain original spec's state identity hashes. Archive assignment identity for every scheduled hand, including unavailable hands. Maintain54/53/53 per-population quotas; missing coverage blocks scoring/selection, no top-ups.

Same current50-sample policy, river16/penalty1, no memory, six balanced templates,20seeds,2520matches/10080hands. Same50/128/512 scoring with8paired streams,120minute total cap. Archive cost/stability descriptively; no validation, profit run, promotion or main merge automatically follows.

Verify deterministic assignment, later-street eligibility, unchanged live decisions and raw accounting; full tests/lint/TypeScript/diff before committed source starts. Independent pre-run review and post-run audit. Existing previous-run data remain inspected. Final previous backup e0b9158 was successfully pushed and remote verified.

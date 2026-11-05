# Adaptive multiplayer poker bot

## Agreed objective

Maximize expected net chip profit in 6–8 player no-limit Texas Hold’em. Primary benchmark buy-in is 100bb, with fixed blinds and no rake. Heads-up optimization comes later, although live sessions must continue legally as players are eliminated.

Live stacks persist between hands. Fixed-stack benchmark hands restore 100bb to isolate strategy quality. Evaluate both modes separately; never pool their scores. Mixed-stack and short/deep-stack evaluation follow the baseline.

Players have unique join-session identities. Learn throughout their session; replacement players start fresh even when their names or seats match. Returning-player recognition is out of scope.

## Correctness and execution

The engine owns legality: minimum raises, short all-in reopening rights, action order, main/side pots, uncalled returns, ties, and chip conservation. Audit existing behavior before relying on training outcomes. Document table conventions, including odd chips. Invalid policy output fails training with a reproducible diagnostic rather than becoming a silent fold.

Training runs directly through the engine without UI, animation, or artificial thinking delays. Probability sampling and search still consume compute; record their cost and expose deterministic budgets.

## Probability and learning

Build weighted hole-card ranges with card removal and mutually compatible multiplayer samples. Estimate expected pot share including ties and eligible side pots. Enumerate affordable outcomes; otherwise use seeded Monte Carlo and report sampling uncertainty.

Maintain per-opponent tendency estimates and a per-hand range. Update after every observed action, then recompute candidate action EV at the next decision. Start from population priors and shrink sparse personal observations toward them. Condition on a manageable set of contexts: street, position, sizing, stack depth, and players remaining.

Revealed cards inform the earlier action sequence. Do not treat selected showdown hands as an unbiased sample of bluff frequency. Hidden folds remain unknown. Never classify players rigidly; unusual bluffs must retain nonzero model probability. Tune prior strength and optional evidence decay on held-out prediction and profit results.

No learning or policy component may consume simulator-only hole cards or future deck order. Deliver final-hand observations even if a bot receives no further turn.

## Strategy and EV progression

Retain existing policies as controls. Add position-aware tight/loose aggressive policies, an equity/pot-odds policy, value and pressure exploiters, then an adaptive EV policy. Isolate changes through ablations.

Begin action EV with river decisions and all-in calls. Extend to earlier streets through sampled response branches and explicit continuation policies. Model fold/call/raise responses, conditional continuing ranges, future cards, and side-pot eligibility. Estimates are conditional on these models, not exact solved-poker values.

Use a small legal sizing menu initially. Log equity, uncertainty, model assumptions, candidate values, chosen action, sample counts, and computation time. An estimate must identify whether it is showdown equity, terminal EV, or approximate rollout EV.

## Evaluation

Use independent deal and policy random streams, seat rotations, matched deals, held-out seeds/opponents, frozen policy versions, and independent session batches for uncertainty estimates. Report 6-, 7-, and 8-player results separately and an equally weighted summary. Track bb/100, per-family matchups, adverse matchups, legality failures, and compute cost.

Persistent sessions also report participation and elimination outcomes; survivor-only averages must not replace all-player profit accounting. Training populations include historical versions and adaptive opponents. No claim of universal superiority or multiplayer equilibrium guarantees follows from league wins.

## Delivery boundaries

Milestone 1: audited rules and reproducible fast benchmark harness.
Milestone 2: weighted equity service and range-equity policy.
Milestone 3: session identity, opponent observations, probabilistic adaptation, and reveal updates.
Milestone 4: action EV and league selection with ablations.

Builder choices: retain TypeScript/Vitest and existing engine interfaces where possible; add no runtime dependency without a concrete need. Numerical model parameters require experiments rather than invented optimal values. Later milestones receive detailed plans after predecessor interfaces are verified.

import { createAdaptivePolicy } from './adaptive';
import type { EquityResult } from './equity';
import type { Policy, PolicyAction } from './bot';
import type { PublicView } from './view';

export type ControlEstimate = Pick<EquityResult,
  'equity' | 'standardError' | 'expectedPayout' | 'expectedPayoutStandardError'>;
export type ControlStats = { decisions: number; eligible: number; raises: number };
export type ControlDecision = {
  decision: PolicyAction;
  eligible: boolean;
  lowerShare: number | null;
};

function eligiblePot(view: PublicView, actor: number): number | null {
  const contributions = view.seats.map(seat => seat.handCommitted);
  if (contributions.some(chips => typeof chips !== 'number' || !Number.isSafeInteger(chips) || chips < 0)) {
    return null;
  }
  const chips = contributions as number[];
  let previous = 0;
  let total = 0;
  const levels = [...new Set(chips.filter(amount => amount > 0))].sort((a, b) => a - b);
  for (const level of levels) {
    if (chips[actor]! >= level) total += (level - previous) * chips.filter(amount => amount >= level).length;
    previous = level;
  }
  return total;
}

export function valueRaiseDecision(
  view: PublicView, estimate: ControlEstimate | null, baseline: PolicyAction,
): ControlDecision {
  const fallback: ControlDecision = { decision: baseline, eligible: false, lowerShare: null };
  const actor = view.toAct;
  if (actor === null || view.phase !== 'betting' ||
      (view.street !== 'flop' && view.street !== 'turn') ||
      baseline.action !== 'check' || view.betting?.currentBet !== 0) return fallback;

  const live = view.seats.filter(seat => seat.inHand && !seat.folded);
  const responder = live.some(seat => seat.seat !== actor && !seat.allIn && seat.stack > 0);
  const raise = view.validActions.find(action => action.action === 'raise');
  if (live.length < 2 || !responder || raise?.action !== 'raise' || !view.presets) return fallback;
  const pot = eligiblePot(view, actor);
  if (pot === null || pot <= 0) return fallback;
  if (!estimate || estimate.expectedPayout === null || estimate.expectedPayoutStandardError === null) {
    throw new Error('Missing public equity estimate for value-raise control');
  }
  const { equity, standardError, expectedPayout, expectedPayoutStandardError } = estimate;
  if (![equity, standardError, expectedPayout, expectedPayoutStandardError].every(Number.isFinite) ||
      equity < 0 || equity > 1 + 1e-9 || standardError < 0 || expectedPayout < 0 ||
      expectedPayout > pot + 1e-9 || expectedPayoutStandardError < 0) {
    throw new Error('Invalid public value-raise estimate');
  }
  // Universal showdown share guards against strength in a locked main pot masking weak side-pot equity.
  const lowerShare = Math.max(0, Math.min(
    (expectedPayout - 1.96 * expectedPayoutStandardError) / pot,
    equity - 1.96 * standardError,
  ));
  if (lowerShare <= .70) return { decision: baseline, eligible: true, lowerShare };

  const half = view.presets.half;
  if (![half, raise.min, raise.max].every(Number.isSafeInteger) || raise.min > raise.max) {
    throw new Error('Invalid legal half-pot menu');
  }
  const amount = Math.max(raise.min, Math.min(raise.max, half));
  return {
    decision: { action: 'raise', amount, reason: `Value raise. Conservative share ${(100 * lowerShare).toFixed(1)}%. Half pot.` },
    eligible: true,
    lowerShare,
  };
}

export function createValueRaiseControl(options: Parameters<typeof createAdaptivePolicy>[0] = {}) {
  let last: ControlEstimate | null = null;
  let stats: ControlStats = { decisions: 0, eligible: 0, raises: 0 };
  const base = createAdaptivePolicy({
    ...options,
    onDecision: decision => {
      last = { ...decision.equity };
      options.onDecision?.(decision);
    },
  });
  const policy: Policy = Object.assign((view: PublicView) => {
    last = null;
    const fallback = base.policy(view);
    const result = valueRaiseDecision(view, last, fallback);
    stats.decisions++;
    if (result.eligible) stats.eligible++;
    if (result.decision !== fallback) stats.raises++;
    return result.decision;
  }, {
    startSession: (ids: string[]) => {
      last = null;
      stats = { decisions: 0, eligible: 0, raises: 0 };
      base.policy.startSession?.(ids);
    },
    observe: base.policy.observe,
  });
  return { policy, stats: () => ({ ...stats }) };
}

export const ACT_FUNDER_OUTCOMES = [
  'meeting_held',
  'positive_reply',
  'proposal_invited',
  'funded',
  'no_response',
  'not_a_fit',
] as const;

export type ActFunderOutcome = (typeof ACT_FUNDER_OUTCOMES)[number];

export interface ActFunderOutcomeEffect {
  interactionType: 'meeting' | 'email' | 'proposal' | 'decision';
  engagementStatus: 'approached' | 'meeting' | 'proposal' | 'won' | 'parked';
  learningDecision: 'partner' | 'apply' | 'won' | 'later' | 'no';
  clearsNextMove: boolean;
}

export function isActFunderOutcome(value: unknown): value is ActFunderOutcome {
  return typeof value === 'string' && ACT_FUNDER_OUTCOMES.includes(value as ActFunderOutcome);
}

export function funderOutcomeEffect(outcome: ActFunderOutcome): ActFunderOutcomeEffect {
  if (outcome === 'meeting_held') {
    return { interactionType: 'meeting', engagementStatus: 'meeting', learningDecision: 'partner', clearsNextMove: false };
  }
  if (outcome === 'positive_reply') {
    return { interactionType: 'email', engagementStatus: 'approached', learningDecision: 'partner', clearsNextMove: false };
  }
  if (outcome === 'proposal_invited') {
    return { interactionType: 'proposal', engagementStatus: 'proposal', learningDecision: 'apply', clearsNextMove: false };
  }
  if (outcome === 'funded') {
    return { interactionType: 'decision', engagementStatus: 'won', learningDecision: 'won', clearsNextMove: true };
  }
  if (outcome === 'no_response') {
    return { interactionType: 'email', engagementStatus: 'approached', learningDecision: 'later', clearsNextMove: false };
  }
  return { interactionType: 'decision', engagementStatus: 'parked', learningDecision: 'no', clearsNextMove: true };
}

export type OpportunityVerificationState = 'verified' | 'unverified' | 'forecast' | 'relationship' | 'internal';

export interface OpportunityVerification {
  state: OpportunityVerificationState;
  label: string;
  detail: string;
  verifiedAt: string | null;
}

export interface OpportunityVerificationInput {
  kind: 'public_program' | 'signal' | 'relationship' | 'pipeline';
  sourceSystem?: string | null;
  signalKind?: string | null;
  sourceUrl?: string | null;
  reviewSource?: string | null;
  lastVerifiedAt?: string | null;
}

function isPrivateMailboxUrl(value: string | null | undefined): boolean {
  return Boolean(value && /mail\.google\.com|outlook\.office\.com|outlook\.live\.com/i.test(value));
}

export function deriveOpportunityVerification(input: OpportunityVerificationInput): OpportunityVerification {
  if (input.kind === 'relationship') {
    return {
      state: 'relationship',
      label: 'Relationship intelligence',
      detail: 'This is a tracked funder or partner path, not a verified public funding round.',
      verifiedAt: null,
    };
  }

  if (input.signalKind === 'forecast_opportunity') {
    return {
      state: 'forecast',
      label: 'Forecast only',
      detail: 'A future program is signalled, but the amount, deadline or final eligibility may not be published yet.',
      verifiedAt: null,
    };
  }

  const officialReview = /official|program page checked|public source checked/i.test(input.reviewSource ?? '');
  if (input.sourceUrl && !isPrivateMailboxUrl(input.sourceUrl) && (input.lastVerifiedAt || officialReview)) {
    return {
      state: 'verified',
      label: 'Official source verified',
      detail: input.reviewSource?.trim() || 'The program has a dated verification record and a public source URL.',
      verifiedAt: input.lastVerifiedAt ?? null,
    };
  }

  if (input.kind === 'pipeline') {
    return {
      state: 'internal',
      label: 'ACT tracked record',
      detail: 'This is committed internal work. Recheck the public source before treating its deadline or eligibility as current.',
      verifiedAt: null,
    };
  }

  return {
    state: 'unverified',
    label: 'Verification needed',
    detail: input.sourceSystem === 'gmail' || isPrivateMailboxUrl(input.sourceUrl)
      ? 'The signal comes from correspondence; the public program or buyer request has not been independently verified here.'
      : 'A source record exists, but no dated official-source verification is attached.',
    verifiedAt: null,
  };
}

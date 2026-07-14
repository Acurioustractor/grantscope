import { describe, expect, it } from 'vitest';
import { deriveOpportunityVerification } from './act-opportunity-trust';

describe('ACT opportunity verification', () => {
  it('requires both a public URL and explicit verification evidence', () => {
    expect(deriveOpportunityVerification({
      kind: 'public_program',
      sourceUrl: 'https://example.org/program',
      lastVerifiedAt: '2026-07-13T00:00:00Z',
    }).state).toBe('verified');

    expect(deriveOpportunityVerification({
      kind: 'public_program',
      sourceSystem: 'public_web',
      sourceUrl: 'https://example.org/program',
    }).state).toBe('unverified');
  });

  it('never treats private correspondence as official verification', () => {
    const result = deriveOpportunityVerification({
      kind: 'signal',
      sourceSystem: 'gmail',
      sourceUrl: 'https://mail.google.com/mail/#all/thread-1',
      reviewSource: 'official program page checked',
    });

    expect(result.state).toBe('unverified');
    expect(result.detail).toContain('correspondence');
  });

  it('keeps forecasts and relationship intelligence distinct from open programs', () => {
    expect(deriveOpportunityVerification({ kind: 'signal', signalKind: 'forecast_opportunity' }).state).toBe('forecast');
    expect(deriveOpportunityVerification({ kind: 'relationship' }).state).toBe('relationship');
  });
});

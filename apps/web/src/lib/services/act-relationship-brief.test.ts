import { describe, expect, it } from 'vitest';
import { ACT_E2E_FUNDER_INTELLIGENCE, ACT_E2E_RELATIONSHIP_LEDGER } from './act-e2e-fixtures';
import { briefRelationshipNamesMatch, buildActRelationshipBrief } from './act-relationship-brief';

describe('ACT funder relationship brief', () => {
  it('matches trustee legal names to the relationship ledger', () => {
    expect(briefRelationshipNamesMatch('The Trustee For The Snow Foundation', 'Snow Foundation')).toBe(true);
    expect(briefRelationshipNamesMatch('Sydney Community Foundation', 'University of Sydney')).toBe(false);
  });

  it('joins funding research, direct people, and ACT relationship history', () => {
    const brief = buildActRelationshipBrief(ACT_E2E_FUNDER_INTELLIGENCE.dossiers[0], ACT_E2E_RELATIONSHIP_LEDGER);

    expect(brief.ledgerItem?.organisation).toBe('Snow Foundation');
    expect(brief.ledgerItem?.receivedTotal).toBe(50_000);
    expect(brief.directPeople.map((person) => person.name)).toContain('Alex Snow');
    expect(brief.actions.map((action) => action.title)).toContain('Ask Alex for an evidence call.');
    expect(brief.lastKnownContactAt).toBe('2026-07-08T03:00:00.000Z');
  });

  it('turns missing evidence into a concrete research action', () => {
    const dossier = {
      ...ACT_E2E_FUNDER_INTELLIGENCE.dossiers[0],
      evidenceGaps: ['recent_grantees'],
      people: [],
      paths: [],
    };
    const brief = buildActRelationshipBrief(dossier, null);

    expect(brief.unknowns).toContain('recent grantees');
    expect(brief.actions).toContainEqual(expect.objectContaining({
      title: 'Find recent grantees',
      kind: 'research',
    }));
  });
});

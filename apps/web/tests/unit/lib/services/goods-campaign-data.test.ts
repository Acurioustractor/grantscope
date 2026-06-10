import { describe, it, expect } from 'vitest';
import {
  CAPITAL_STACK,
  COMMITMENT_ORDER,
  evidenceBackedTotal,
  pipelineTotal,
  byCommitment,
  daysUntil,
  dgrRoutingWarnings,
  type CapitalSource,
} from '@/lib/services/goods-campaign-data';

function src(overrides: Partial<CapitalSource> = {}): CapitalSource {
  return {
    id: 's1',
    name: 'Test Source',
    kind: 'grant',
    askAud: 100_000,
    askLabel: '~$100K',
    commitment: 'in_conversation',
    writtenEvidence: null,
    matchEligibility: 'unknown',
    registryName: 'Test',
    status: 'status',
    nextMove: 'move',
    ...overrides,
  };
}

describe('COMMITMENT_ORDER', () => {
  it('is the strict target → signed ladder', () => {
    expect(COMMITMENT_ORDER).toEqual(['target', 'in_conversation', 'eligible', 'signed']);
  });
});

describe('CAPITAL_STACK seed integrity', () => {
  it('holds every source at unknown match eligibility until QBE confirms rules', () => {
    expect(CAPITAL_STACK.every((s) => s.matchEligibility === 'unknown')).toBe(true);
  });

  it('never claims a dollar ask for the QBE matched grant', () => {
    const qbe = CAPITAL_STACK.find((s) => s.kind === 'matched_grant');
    expect(qbe).toBeDefined();
    expect(qbe!.askAud).toBeNull();
    expect(qbe!.askLabel).toMatch(/unconfirmed/i);
  });

  it('has unique ids', () => {
    const ids = CAPITAL_STACK.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('evidenceBackedTotal', () => {
  it('counts only eligible/signed sources WITH written evidence', () => {
    const sources = [
      src({ askAud: 100_000, commitment: 'signed', writtenEvidence: 'Signed grant agreement' }),
      src({ askAud: 50_000, commitment: 'eligible', writtenEvidence: 'Term sheet' }),
      src({ askAud: 999_000, commitment: 'eligible', writtenEvidence: null }), // no evidence
      src({ askAud: 888_000, commitment: 'in_conversation', writtenEvidence: 'LOI' }), // not advanced
    ];
    expect(evidenceBackedTotal(sources)).toBe(150_000);
  });

  it('treats a null askAud as zero even when evidence-backed', () => {
    const sources = [src({ askAud: null, commitment: 'signed', writtenEvidence: 'LOI' })];
    expect(evidenceBackedTotal(sources)).toBe(0);
  });

  it('is zero for the seeded stack (nothing is signed/eligible yet)', () => {
    expect(evidenceBackedTotal(CAPITAL_STACK)).toBe(0);
  });
});

describe('pipelineTotal', () => {
  it('sums everything that is NOT evidence-backed', () => {
    const sources = [
      src({ askAud: 100_000, commitment: 'signed', writtenEvidence: 'Signed agreement' }), // backed, excluded
      src({ askAud: 50_000, commitment: 'in_conversation', writtenEvidence: 'LOI' }),
      src({ askAud: 200_000, commitment: 'target', writtenEvidence: null }),
      src({ askAud: null, commitment: 'target', writtenEvidence: null }), // null → 0
    ];
    expect(pipelineTotal(sources)).toBe(250_000);
  });

  it('every evidence-backed dollar is excluded from pipeline (no double-count)', () => {
    const sources = [
      src({ askAud: 100_000, commitment: 'signed', writtenEvidence: 'Agreement' }),
      src({ askAud: 50_000, commitment: 'in_conversation', writtenEvidence: null }),
    ];
    expect(evidenceBackedTotal(sources)).toBe(100_000);
    expect(pipelineTotal(sources)).toBe(50_000);
  });
});

describe('byCommitment', () => {
  it('groups sources into the four ladder buckets plus parked', () => {
    const grouped = byCommitment(CAPITAL_STACK);
    expect(Object.keys(grouped).sort()).toEqual([...COMMITMENT_ORDER, 'parked'].sort());
    // parked sits outside the active ladder, but no source may be dropped
    const total = COMMITMENT_ORDER.reduce((n, c) => n + grouped[c].length, grouped.parked.length);
    expect(total).toBe(CAPITAL_STACK.length);
  });

  it('places a target source in the target bucket', () => {
    const grouped = byCommitment([src({ commitment: 'target' })]);
    expect(grouped.target).toHaveLength(1);
    expect(grouped.in_conversation).toHaveLength(0);
  });
});

describe('dgrRoutingWarnings', () => {
  it('flags grant-like sources whose instrument does not confirm dgrRoute', () => {
    const sources = [
      // grant, dgrRoute true → confirmed, not a warning
      src({
        id: 'ok',
        kind: 'grant',
        instrument: {
          repayment: 'non-repayable grant',
          security: null,
          entityRequired: 'Butterfly',
          dgrRoute: true,
        },
      }),
      // grant, dgrRoute false → unconfirmed routing, warn
      src({
        id: 'warn-false',
        kind: 'grant',
        instrument: {
          repayment: 'non-repayable grant',
          security: null,
          entityRequired: 'ACT Pty',
          dgrRoute: false,
        },
      }),
      // matched_grant, no instrument at all → unconfirmed, warn
      src({ id: 'warn-missing', kind: 'matched_grant' }),
      // recoverable_grant, dgrRoute false → warn
      src({
        id: 'warn-recoverable',
        kind: 'recoverable_grant',
        instrument: { repayment: null, security: null, entityRequired: 'ACT Pty', dgrRoute: false },
      }),
      // loan → not grant-like, never a DGR routing warning even with dgrRoute false
      src({
        id: 'loan',
        kind: 'loan',
        instrument: { repayment: 'debt, terms TBC', security: null, entityRequired: 'ACT Pty', dgrRoute: false },
      }),
    ];
    const warned = dgrRoutingWarnings(sources).map((s) => s.id);
    expect(warned).toEqual(['warn-false', 'warn-missing', 'warn-recoverable']);
  });

  it('returns an empty array when every grant-like source confirms dgrRoute', () => {
    const sources = [
      src({
        id: 'g',
        kind: 'grant',
        instrument: { repayment: 'grant', security: null, entityRequired: 'Butterfly', dgrRoute: true },
      }),
      src({
        id: 'l',
        kind: 'loan',
        instrument: { repayment: 'debt, terms TBC', security: null, entityRequired: 'ACT Pty', dgrRoute: false },
      }),
    ];
    expect(dgrRoutingWarnings(sources)).toEqual([]);
  });
});

describe('daysUntil', () => {
  it('counts whole days forward with an injected now', () => {
    expect(daysUntil('2026-08-31', new Date('2026-08-01T00:00:00Z'))).toBe(30);
  });

  it('is negative once the date has passed', () => {
    expect(daysUntil('2026-08-31', new Date('2026-09-10T00:00:00Z'))).toBeLessThan(0);
  });

  it('returns 0 for an unparseable date', () => {
    expect(daysUntil('not-a-date', new Date('2026-08-01T00:00:00Z'))).toBe(0);
  });
});

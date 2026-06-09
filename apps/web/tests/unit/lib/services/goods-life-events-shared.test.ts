import { describe, it, expect } from 'vitest';
import {
  fmtAud,
  fmtDate,
  fyEndDate,
  effectiveDate,
  monthsAgo,
  freshnessFor,
  buildCard,
  bestCardPerSupporter,
  pickReasonsToReachOut,
  type RawLifeEvent,
} from '@/lib/services/goods-life-events-shared';

const ASOF = new Date('2026-06-09T00:00:00Z');

function raw(overrides: Partial<RawLifeEvent> = {}): RawLifeEvent {
  return {
    relId: 'r1',
    supporterName: 'Acme Foundation',
    relationshipType: 'funder',
    warmth: 50,
    kind: 'acnc_filing',
    eventDate: '2024-11-25',
    eventFy: '2023',
    amount: 407097,
    amount2: 0,
    periodTo: '2023-12-31',
    label: null,
    ...overrides,
  };
}

describe('fmtAud', () => {
  it('scales K / M / B honestly', () => {
    expect(fmtAud(407097)).toBe('$407K');
    expect(fmtAud(22219467)).toBe('$22.2M');
    expect(fmtAud(439260.7)).toBe('$439K');
    expect(fmtAud(2_500_000_000)).toBe('$2.5B');
    expect(fmtAud(950)).toBe('$950');
  });
  it('does not invent a figure when there is none', () => {
    expect(fmtAud(null)).toBe('undisclosed');
    expect(fmtAud(undefined)).toBe('undisclosed');
  });
});

describe('fmtDate', () => {
  it('formats an ISO date', () => {
    expect(fmtDate('2024-11-25')).toBe('25 Nov 2024');
    expect(fmtDate('2026-06-30T00:00:00Z')).toBe('30 Jun 2026');
  });
  it('returns null for empty or malformed input', () => {
    expect(fmtDate(null)).toBeNull();
    expect(fmtDate('not-a-date')).toBeNull();
  });
});

describe('fyEndDate', () => {
  it('handles the FY shapes the data actually carries', () => {
    expect(fyEndDate('2024-25')).toBe('2025-06-30');
    expect(fyEndDate('2023')).toBe('2023-06-30');
    expect(fyEndDate('2022-ongoing')).toBe('2022-06-30');
    expect(fyEndDate(null)).toBeNull();
    expect(fyEndDate('garbage')).toBeNull();
  });
});

describe('effectiveDate', () => {
  it('prefers a precise event date', () => {
    expect(effectiveDate(raw({ eventDate: '2024-11-25' }))).toBe('2024-11-25');
  });
  it('falls back to FY-end for justice funding with no precise date', () => {
    expect(effectiveDate(raw({ kind: 'justice_funding', eventDate: null, eventFy: '2024-25' }))).toBe(
      '2025-06-30',
    );
  });
});

describe('monthsAgo', () => {
  it('is negative for a future date (a contract that has not started)', () => {
    expect(monthsAgo('2026-12-09', ASOF)).toBeLessThan(0);
  });
  it('is roughly right for a past date', () => {
    expect(monthsAgo('2025-06-09', ASOF)).toBeCloseTo(12, 0);
  });
});

describe('freshnessFor', () => {
  it('a future-dated or very recent contract is new', () => {
    expect(freshnessFor(raw({ kind: 'gov_contract', eventDate: '2026-06-30' }), ASOF)).toBe('new');
  });
  it('an ACNC filing 19 months old is recent, not new (filings lag — honesty)', () => {
    expect(freshnessFor(raw({ kind: 'acnc_filing', eventDate: '2024-11-25' }), ASOF)).toBe('recent');
  });
  it('an old event is on-record', () => {
    expect(freshnessFor(raw({ kind: 'gov_contract', eventDate: '2019-01-01' }), ASOF)).toBe('on-record');
  });
});

describe('buildCard', () => {
  it('ACNC: latest return, never claims it just happened, shows gov share when present', () => {
    const c = buildCard(raw({ kind: 'acnc_filing', eventFy: '2023', amount: 1_000_000, amount2: 400_000 }), ASOF);
    expect(c.headline).toBe('Latest ACNC return');
    expect(c.when).toBe('FY2023');
    expect(c.detail).toBe('$1.0M revenue, 40% from government, filed 25 Nov 2024');
    expect(c.source).toBe('ACNC Annual Information Statement');
  });

  it('ACNC: omits the gov share when government revenue is zero', () => {
    const c = buildCard(raw({ kind: 'acnc_filing', amount: 407097, amount2: 0 }), ASOF);
    expect(c.detail).toBe('$407K revenue, filed 25 Nov 2024');
  });

  it('gov contract: fresh wins read as "new", name the buyer and start', () => {
    const c = buildCard(
      raw({
        kind: 'gov_contract',
        eventDate: '2026-04-19',
        eventFy: null,
        amount: 439260.7,
        amount2: null,
        label: "Attorney-General's Department",
      }),
      ASOF,
    );
    expect(c.headline).toBe('New government contract');
    expect(c.detail).toBe("$439K from Attorney-General's Department, beginning 19 Apr 2026");
    expect(c.freshness).toBe('new');
  });

  it('justice funding: coarse FY signal, labelled plainly', () => {
    const c = buildCard(
      raw({ kind: 'justice_funding', eventDate: null, eventFy: '2024-25', amount: 120000, label: 'Diversion program' }),
      ASOF,
    );
    expect(c.headline).toBe('Justice funding');
    expect(c.when).toBe('FY2024-25');
    expect(c.detail).toBe('$120K, Diversion program');
  });
});

describe('bestCardPerSupporter', () => {
  it('keeps the freshest event per supporter and counts the rest', () => {
    const raws: RawLifeEvent[] = [
      raw({ relId: 'r1', kind: 'acnc_filing', eventDate: '2024-11-25' }),
      raw({ relId: 'r1', kind: 'gov_contract', eventDate: '2026-04-19', eventFy: null, amount: 500000 }),
    ];
    const cards = bestCardPerSupporter(raws, ASOF);
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('gov_contract'); // 2026 beats 2024
    expect(cards[0].otherSignals).toBe(1);
  });
});

describe('pickReasonsToReachOut', () => {
  it('ranks freshest reason first, caps the feed, summary reflects the full set', () => {
    const raws: RawLifeEvent[] = [
      raw({ relId: 'a', supporterName: 'A', kind: 'acnc_filing', eventDate: '2024-06-30' }),
      raw({ relId: 'b', supporterName: 'B', kind: 'gov_contract', eventDate: '2026-05-01', eventFy: null }),
      raw({ relId: 'c', supporterName: 'C', kind: 'justice_funding', eventDate: null, eventFy: '2024-25' }),
    ];
    const out = pickReasonsToReachOut(raws, ASOF, 2);
    expect(out.cards).toHaveLength(2);
    expect(out.cards[0].supporterName).toBe('B'); // 2026 contract freshest
    expect(out.summary.supporters).toBe(3); // full set, not the capped 2
    expect(out.summary.fresh).toBe(1);
    expect(out.summary.feeds).toEqual({ acnc_filing: 1, gov_contract: 1, justice_funding: 1 });
  });

  it('is empty-safe', () => {
    const out = pickReasonsToReachOut([], ASOF);
    expect(out.cards).toEqual([]);
    expect(out.summary.supporters).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  nameKey,
  prettyStage,
  sourceLabel,
  buildTimeline,
  rankTimelines,
  assembleTimelines,
  type SupporterInput,
  type TimelineLifeEvent,
  type TimelineXeroInvoice,
  type SupporterTimeline,
} from '@/lib/services/goods-timeline-shared';

const ASOF = new Date('2026-06-09T00:00:00Z');

function supporter(o: Partial<SupporterInput> = {}): SupporterInput {
  return {
    relId: 'r1',
    name: 'Snow Foundation',
    relationshipType: 'funder',
    warmth: 70,
    stage: 'committed',
    lastTouchAt: '2026-05-20T09:00:00Z',
    ...o,
  };
}

describe('nameKey', () => {
  it('normalises whitespace and case for matching', () => {
    expect(nameKey('  The  John  Villiers Trust ')).toBe('the john villiers trust');
    expect(nameKey(null)).toBe('');
  });
});

describe('prettyStage', () => {
  it('tidies the stage without inventing meaning', () => {
    expect(prettyStage('in_conversation')).toBe('In conversation');
    expect(prettyStage('committed')).toBe('Committed');
    expect(prettyStage(null)).toBeNull();
  });
});

describe('sourceLabel', () => {
  it('names each system', () => {
    expect(sourceLabel('ghl')).toBe('GoHighLevel');
    expect(sourceLabel('xero')).toBe('Xero');
    expect(sourceLabel('record')).toBe('Public record');
  });
});

describe('buildTimeline', () => {
  it('fuses GHL + Xero + public record, newest first, and lists distinct sources', () => {
    const life: TimelineLifeEvent[] = [
      { kind: 'acnc_filing', eventDate: '2025-11-25', eventFy: '2024', amount: 8_000_000, label: null },
      { kind: 'gov_contract', eventDate: '2026-03-01', eventFy: null, amount: 1_200_000, label: 'AGD' },
    ];
    const xero: TimelineXeroInvoice[] = [
      { invoiceNumber: 'INV-0207', date: '2026-04-10', total: 40000, status: 'AUTHORISED' },
    ];
    const t = buildTimeline(supporter(), life, xero, ASOF);
    expect(t.events.map((e) => e.date)).toEqual(['2026-05-20', '2026-04-10', '2026-03-01', '2025-11-25']);
    expect(t.events[0]).toMatchObject({ source: 'ghl', label: 'Last contact', detail: 'Logged in GoHighLevel, now Committed' });
    expect(t.events[1]).toMatchObject({ source: 'xero', label: 'Invoice INV-0207', detail: '$40K issued, authorised' });
    expect(t.events[2]).toMatchObject({ source: 'record', label: 'Government contract', detail: '$1.2M from AGD' });
    expect(t.sources.sort()).toEqual(['ghl', 'record', 'xero']);
  });

  it('never invents a first touch from the bulk-seed created_at (only last_touch_at appears)', () => {
    const t = buildTimeline(supporter({ lastTouchAt: null }), [], [], ASOF);
    expect(t.events).toHaveLength(0); // no GHL event without a real last touch
  });

  it('says "issued" for Xero, never "paid" (no paid date in the sync)', () => {
    const t = buildTimeline(supporter({ lastTouchAt: null }), [], [
      { invoiceNumber: null, date: '2026-02-02', total: 15000, status: null },
    ], ASOF);
    expect(t.events[0].detail).toBe('$15K issued');
    expect(t.events[0].label).toBe('Invoice issued');
  });

  it('dates justice funding to FY end and flags it as FY-grained', () => {
    const t = buildTimeline(supporter({ lastTouchAt: null }), [
      { kind: 'justice_funding', eventDate: null, eventFy: '2024-25', amount: 120000, label: 'Diversion' },
    ], [], ASOF);
    expect(t.events[0]).toMatchObject({ date: '2025-06-30', fyGrained: true, detail: 'FY2024-25, $120K, Diversion' });
  });

  it('drops undated events (a timeline needs a date)', () => {
    const t = buildTimeline(supporter({ lastTouchAt: null }), [
      { kind: 'acnc_filing', eventDate: null, eventFy: '2024', amount: 1000, label: null },
    ], [], ASOF);
    expect(t.events).toHaveLength(0);
  });
});

describe('rankTimelines', () => {
  it('puts the most fused (most distinct sources) first', () => {
    const fused = buildTimeline(supporter({ relId: 'a', name: 'A' }), [
      { kind: 'acnc_filing', eventDate: '2025-11-25', eventFy: '2024', amount: 1, label: null },
    ], [{ invoiceNumber: 'X', date: '2026-01-01', total: 1, status: 'PAID' }], ASOF); // 3 sources
    const single = buildTimeline(supporter({ relId: 'b', name: 'B', lastTouchAt: '2026-06-01T00:00:00Z' }), [], [], ASOF); // 1 source
    const ranked = rankTimelines([single, fused]);
    expect(ranked[0].relId).toBe('a');
  });
});

describe('assembleTimelines', () => {
  const supporters: SupporterInput[] = [
    supporter({ relId: 'a', name: 'A', lastTouchAt: '2026-05-01T00:00:00Z' }),
    supporter({ relId: 'b', name: 'B', lastTouchAt: null, stage: null }), // no events -> dropped
    supporter({ relId: 'c', name: 'C', lastTouchAt: '2026-04-01T00:00:00Z' }),
  ];
  const lifeByRel = new Map<string, TimelineLifeEvent[]>([
    ['a', [{ kind: 'gov_contract', eventDate: '2026-02-01', eventFy: null, amount: 500000, label: 'Buyer' }]],
  ]);
  const xeroByRel = new Map<string, TimelineXeroInvoice[]>();

  it('keeps supporters with >=1 dated event, ranks fused first, caps, summary is the full set', () => {
    const feed = assembleTimelines(supporters, lifeByRel, xeroByRel, ASOF, 5, 8);
    expect(feed.timelines.map((t) => t.relId)).toEqual(['a', 'c']); // b dropped (no events)
    expect(feed.timelines[0].relId).toBe('a'); // 2 sources beats C's 1
    expect(feed.summary).toEqual({ shown: 2, withFusion: 1, total: 2 });
  });

  it('minEvents drops single-event supporters (Timeline is for multi-event histories)', () => {
    // a has 2 events (touch + contract), c has 1 (touch only) -> only a survives at minEvents=2.
    const feed = assembleTimelines(supporters, lifeByRel, xeroByRel, ASOF, 5, 8, 2);
    expect(feed.timelines.map((t) => t.relId)).toEqual(['a']);
    expect(feed.summary).toEqual({ shown: 1, withFusion: 1, total: 1 });
  });

  it('respects the per-supporter event cap', () => {
    const many: TimelineLifeEvent[] = Array.from({ length: 10 }, (_, i) => ({
      kind: 'gov_contract' as const,
      eventDate: `2026-0${(i % 9) + 1}-01`,
      eventFy: null,
      amount: 1000 * i,
      label: 'B',
    }));
    const feed = assembleTimelines(
      [supporter({ relId: 'a', name: 'A' })],
      new Map([['a', many]]),
      new Map(),
      ASOF,
      15,
      3,
    );
    expect(feed.timelines[0].events.length).toBe(3);
  });
});

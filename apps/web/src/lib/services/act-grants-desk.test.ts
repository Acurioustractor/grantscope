import { describe, expect, it } from 'vitest';
import { buildDesk, type DeskSourceRow } from './act-grants-desk';

const today = new Date('2026-09-14T03:00:00Z');

function row(p: Partial<DeskSourceRow>): DeskSourceRow {
  return {
    id: p.id ?? 'x', name: p.name ?? 'Grant', provider: null, status: 'open', closes_at: null, deadline: null,
    amount_min: null, amount_max: null, geography: null, url: null, source: 'test', ...p,
  };
}

describe('buildDesk', () => {
  it('keeps only live statuses', () => {
    const desk = buildDesk([row({ id: 'a' }), row({ id: 'b', status: 'closed' }), row({ id: 'c', status: null })], [], today);
    expect(desk.map((g) => g.id)).toEqual(['a']);
  });

  it('drops rows whose close date has passed but keeps today', () => {
    const desk = buildDesk([row({ id: 'past', closes_at: '2026-09-13' }), row({ id: 'today', closes_at: '2026-09-14' })], [], today);
    expect(desk.map((g) => [g.id, g.daysToClose])).toEqual([['today', 0]]);
  });

  it('falls back to deadline when closes_at is null', () => {
    const [g] = buildDesk([row({ deadline: '2026-09-24' })], [], today);
    expect(g.closeDate).toBe('2026-09-24');
    expect(g.daysToClose).toBe(10);
  });

  it('sorts soonest close first, undated last', () => {
    const desk = buildDesk(
      [row({ id: 'undated' }), row({ id: 'late', closes_at: '2026-12-01' })],
      [row({ id: 'soon', closes_at: '2026-09-20' })],
      today,
    );
    expect(desk.map((g) => g.id)).toEqual(['soon', 'late', 'undated']);
  });

  it('dedupes by URL and prefers the public row', () => {
    const desk = buildDesk(
      [row({ id: 'pub', url: 'https://x.smartygrants.com.au/r1/' })],
      [row({ id: 'priv', url: 'http://X.smartygrants.com.au/r1' }), row({ id: 'priv2', url: 'https://y/r2' })],
      today,
    );
    expect(desk.map((g) => [g.id, g.origin])).toEqual([['pub', 'public'], ['priv2', 'act-private']]);
  });
});

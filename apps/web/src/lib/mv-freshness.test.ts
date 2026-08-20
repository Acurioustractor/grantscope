import { describe, expect, it } from 'vitest';
import {
  freshnessLabel,
  isActionable,
  shouldWarnReader,
  summariseFreshness,
  type MvFreshness,
  type MvFreshnessRow,
} from './mv-freshness';

const row = (over: Partial<MvFreshnessRow> = {}): MvFreshnessRow => ({
  mv_name: 'mv_thing',
  tier: 'nightly',
  freshness: 'fresh',
  age_hours: 8,
  max_age_hours: 36,
  last_success_at: '2026-08-20T01:30:00Z',
  last_attempt_status: 'success',
  notes: null,
  ...over,
});

describe('what counts as a fault', () => {
  it.each<MvFreshness>(['stale', 'never', 'orphan', 'unregistered'])(
    '%s is actionable',
    f => expect(isActionable(f)).toBe(true),
  );

  it.each<MvFreshness>(['fresh', 'unmanaged', 'retired', 'disabled'])(
    '%s is not',
    f => expect(isActionable(f)).toBe(false),
  );

  // The whole point of the 'unlogged' verdict. 16 on_demand matviews are refreshed by paths that
  // do not write to mv_refresh_log — refresh_alma_dashboards(), the youth-justice report scripts —
  // and each names its owner in notes. Alerting on them would cry wolf 16 times a night until
  // nobody read the alert, which is worse than the staleness it was meant to catch.
  it('unlogged is a known unknown, not a fault', () => {
    expect(isActionable('unlogged')).toBe(false);
    expect(freshnessLabel(row({ freshness: 'unlogged', last_success_at: null }))).toBe(
      'Refreshed outside the schedule — date not recorded',
    );
  });

  // A visitor reading a number needs to know it is old. They do not need to know the registry
  // has an orphaned row — that is an ops problem, not a caveat on the figure.
  it('the reader is warned about age, not about registry bookkeeping', () => {
    expect(shouldWarnReader('stale')).toBe(true);
    expect(shouldWarnReader('never')).toBe(true);
    expect(shouldWarnReader('orphan')).toBe(false);
    expect(shouldWarnReader('unregistered')).toBe(false);
    expect(shouldWarnReader('fresh')).toBe(false);
  });
});

describe('the words beside the figure', () => {
  it('dates a fresh figure', () => {
    expect(freshnessLabel(row())).toBe('As at 20 Aug 2026');
  });

  it('says overdue as well as the date, so the number is still traceable', () => {
    expect(freshnessLabel(row({ freshness: 'stale', last_success_at: '2026-08-01T01:30:00Z' }))).toBe(
      'As at 1 Aug 2026 — overdue a refresh',
    );
  });

  // Never invent freshness the log cannot support. Omitting the date entirely would read as
  // "current"; saying it is not recorded is the honest form.
  it('says the date is missing rather than omitting it', () => {
    expect(freshnessLabel(row({ freshness: 'fresh', last_success_at: null }))).toBe(
      'Last refresh not recorded',
    );
  });

  it('a retired matview is frozen, not broken', () => {
    expect(freshnessLabel(row({ freshness: 'retired', last_success_at: '2026-08-15T03:55:00Z' }))).toBe(
      'Retired, frozen at 15 Aug 2026',
    );
  });

  it('every verdict produces words — no silent empty label', () => {
    const all: MvFreshness[] = [
      'fresh', 'unmanaged', 'unlogged', 'retired', 'disabled', 'stale', 'never', 'orphan', 'unregistered',
    ];
    for (const f of all) {
      expect(freshnessLabel(row({ freshness: f })).length, f).toBeGreaterThan(8);
    }
  });
});

describe('the ops summary', () => {
  // Measured against production 2026-08-20 immediately after the view shipped: 76 fresh,
  // 16 unlogged, 9 retired, 3 unmanaged, and nothing stale, never, orphaned or unregistered.
  it('counts faults and known-unknowns separately', () => {
    const rows = [
      ...Array.from({ length: 76 }, (_, i) => row({ mv_name: `f${i}` })),
      ...Array.from({ length: 16 }, (_, i) => row({ mv_name: `u${i}`, freshness: 'unlogged', last_success_at: null, age_hours: null })),
      ...Array.from({ length: 9 }, (_, i) => row({ mv_name: `r${i}`, freshness: 'retired' })),
      ...Array.from({ length: 3 }, (_, i) => row({ mv_name: `m${i}`, freshness: 'unmanaged' })),
    ];
    const s = summariseFreshness(rows);
    expect(s.total).toBe(104);
    expect(s.fresh).toBe(76);
    expect(s.actionable).toBe(0);
    expect(s.unknown).toBe(19);
    expect(s.worst).toEqual([]);
  });

  it('puts the oldest fault first, and a never-refreshed one ahead of a merely stale one', () => {
    const s = summariseFreshness([
      row({ mv_name: 'mv_stale', freshness: 'stale', age_hours: 200 }),
      row({ mv_name: 'mv_never', freshness: 'never', age_hours: null, last_success_at: null }),
      row({ mv_name: 'mv_ok' }),
    ]);
    expect(s.actionable).toBe(2);
    // A null age sorts as infinitely old: never-refreshed is the worst case, not the mildest.
    expect(s.worst.map(r => r.mv_name)).toEqual(['mv_never', 'mv_stale']);
  });
});

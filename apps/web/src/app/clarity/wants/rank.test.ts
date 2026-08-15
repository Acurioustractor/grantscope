import { describe, expect, it } from 'vitest';
import {
  isImproving,
  movement,
  movementLabel,
  rankWants,
  targetLabel,
  type WantRow,
} from './types';

function want(over: Partial<WantRow> = {}): WantRow {
  return {
    slug: 'house-x',
    stub: 'X',
    question: 'q?',
    subject: 'HOUSE',
    state: 'contested',
    blocked_by: ['metric:x'],
    blocked_by_metric: 'x',
    unlock_effort: 'M',
    unlock_note: null,
    unlock_dollars: null,
    licence_note: null,
    blocker_objects: [],
    also_blocks: 0,
    unlocks_named: 0,
    metric_now: 50,
    metric_target: 95,
    metric_unit: 'pct',
    metric_direction: 'higher_better',
    metric_numerator: null,
    metric_denominator: null,
    metric_measured_at: null,
    metric_gap: 45,
    rate_per_week: null,
    eta_weeks: null,
    metric_samples: 1,
    effort_known: true,
    rank_score: 0.33,
    ...over,
  };
}

describe('movement', () => {
  it('calls a single measurement unmeasured, not stalled', () => {
    expect(movement(want({ metric_samples: 1, rate_per_week: null }))).toBe('unmeasured');
    expect(movementLabel(want({ metric_samples: 1, rate_per_week: null }))).toBe('no trend yet');
  });

  it('only says +0/wk once we have watched it twice', () => {
    const w = want({ metric_samples: 4, rate_per_week: 0 });
    expect(movement(w)).toBe('stalled');
    expect(movementLabel(w)).toBe('+0pp/wk');
  });

  it('reads direction against the metric, not the sign', () => {
    expect(isImproving(want({ metric_samples: 3, rate_per_week: 2 }))).toBe(true);
    expect(
      isImproving(want({ metric_samples: 3, rate_per_week: 2, metric_direction: 'lower_better' })),
    ).toBe(false);
    expect(isImproving(want({ metric_samples: 1, rate_per_week: null }))).toBeNull();
  });
});

describe('rankWants', () => {
  it('ranks by score, then by how far short, then stably by slug', () => {
    const rows = [
      want({ slug: 'b', rank_score: 0.33, metric_gap: 10 }),
      want({ slug: 'a', rank_score: 1, metric_gap: 1 }),
      want({ slug: 'c', rank_score: 0.33, metric_gap: 90 }),
      want({ slug: 'd', rank_score: 0.33, metric_gap: 90 }),
    ];
    expect(rankWants(rows).map((r) => r.slug)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('does not treat a missing gap as a gap of zero when ordering', () => {
    const rows = [
      want({ slug: 'nogap', rank_score: 1, metric_gap: null }),
      want({ slug: 'zero', rank_score: 1, metric_gap: 0 }),
    ];
    expect(rankWants(rows).map((r) => r.slug)).toEqual(['zero', 'nogap']);
  });
});

describe('targetLabel', () => {
  it('flips the comparator with the metric direction', () => {
    expect(targetLabel(want())).toBe('target ≥ 95.0%');
    expect(targetLabel(want({ metric_direction: 'lower_better', metric_unit: 'count' }))).toBe(
      'target ≤ 95',
    );
    expect(targetLabel(want({ metric_target: null }))).toBe('no target set');
  });
});

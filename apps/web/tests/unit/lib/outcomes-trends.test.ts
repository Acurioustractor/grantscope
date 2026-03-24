import { describe, it, expect } from 'vitest';
import { computeTrendSignals, pickTopTrends } from '@/lib/outcomes-trends';
import type { OutcomeMetric, TrendSignal } from '@/lib/outcomes-trends';

function makeMetric(overrides: Partial<OutcomeMetric> = {}): OutcomeMetric {
  return {
    metric_name: 'detention_rate_per_10k',
    metric_value: 5.0,
    metric_unit: 'per_10k',
    period: '2022-23',
    cohort: 'all',
    source: 'AIHW',
    notes: null,
    ...overrides,
  };
}

describe('computeTrendSignals', () => {
  it('returns empty array when no metrics provided', () => {
    expect(computeTrendSignals([], 'QLD')).toEqual([]);
  });

  it('returns empty array when only one period exists for a metric', () => {
    const metrics = [makeMetric({ period: '2022-23', metric_value: 5 })];
    expect(computeTrendSignals(metrics, 'QLD')).toEqual([]);
  });

  it('computes positive pct_change when value increases', () => {
    const metrics = [
      makeMetric({ period: '2019-20', metric_value: 3.0 }),
      makeMetric({ period: '2023-24', metric_value: 4.5 }),
    ];
    const signals = computeTrendSignals(metrics, 'QLD');
    expect(signals).toHaveLength(1);
    expect(signals[0].pct_change).toBeCloseTo(50, 0);
    expect(signals[0].latest_value).toBe(4.5);
    expect(signals[0].earliest_value).toBe(3.0);
  });

  it('marks detention_rate_per_10k increase as worsening', () => {
    const metrics = [
      makeMetric({ metric_name: 'detention_rate_per_10k', period: '2019-20', metric_value: 3.0 }),
      makeMetric({ metric_name: 'detention_rate_per_10k', period: '2023-24', metric_value: 4.6 }),
    ];
    const signals = computeTrendSignals(metrics, 'QLD');
    expect(signals[0].direction).toBe('worsening');
  });

  it('marks detention_rate_per_10k decrease as improving', () => {
    const metrics = [
      makeMetric({ metric_name: 'detention_rate_per_10k', period: '2019-20', metric_value: 5.0 }),
      makeMetric({ metric_name: 'detention_rate_per_10k', period: '2023-24', metric_value: 3.0 }),
    ];
    const signals = computeTrendSignals(metrics, 'QLD');
    expect(signals[0].direction).toBe('improving');
  });

  it('marks cost_per_day_community increase as improving (not in WORSE_WHEN_HIGHER)', () => {
    // cost_per_day_community is NOT in WORSE_WHEN_HIGHER set, so increase = improving
    const metrics = [
      makeMetric({ metric_name: 'cost_per_day_community', period: '2019-20', metric_value: 100 }),
      makeMetric({ metric_name: 'cost_per_day_community', period: '2023-24', metric_value: 150 }),
    ];
    const signals = computeTrendSignals(metrics, 'NSW');
    expect(signals[0].direction).toBe('improving');
  });

  it('marks small changes (<3%) as stable', () => {
    const metrics = [
      makeMetric({ period: '2019-20', metric_value: 5.0 }),
      makeMetric({ period: '2023-24', metric_value: 5.1 }),
    ];
    const signals = computeTrendSignals(metrics, 'VIC');
    expect(signals[0].direction).toBe('stable');
  });

  it('filters by cohort (default: all)', () => {
    const metrics = [
      makeMetric({ period: '2019-20', metric_value: 3.0, cohort: 'all' }),
      makeMetric({ period: '2023-24', metric_value: 5.0, cohort: 'all' }),
      makeMetric({ period: '2019-20', metric_value: 10.0, cohort: 'indigenous' }),
      makeMetric({ period: '2023-24', metric_value: 20.0, cohort: 'indigenous' }),
    ];
    const signals = computeTrendSignals(metrics, 'QLD', 'all');
    expect(signals).toHaveLength(1);
    expect(signals[0].pct_change).toBeCloseTo(66.7, 0);
  });

  it('can compute trends for indigenous cohort', () => {
    const metrics = [
      makeMetric({ period: '2019-20', metric_value: 10.0, cohort: 'indigenous' }),
      makeMetric({ period: '2023-24', metric_value: 20.0, cohort: 'indigenous' }),
    ];
    const signals = computeTrendSignals(metrics, 'NT', 'indigenous');
    expect(signals).toHaveLength(1);
    expect(signals[0].pct_change).toBeCloseTo(100, 0);
  });

  it('handles multiple metrics and sorts by absolute pct_change desc', () => {
    const metrics = [
      // detention_rate: +50%
      makeMetric({ metric_name: 'detention_rate_per_10k', period: '2019-20', metric_value: 2 }),
      makeMetric({ metric_name: 'detention_rate_per_10k', period: '2023-24', metric_value: 3 }),
      // overrep: +100%
      makeMetric({ metric_name: 'indigenous_overrepresentation_ratio', period: '2019-20', metric_value: 10 }),
      makeMetric({ metric_name: 'indigenous_overrepresentation_ratio', period: '2023-24', metric_value: 20 }),
    ];
    const signals = computeTrendSignals(metrics, 'QLD');
    expect(signals).toHaveLength(2);
    expect(signals[0].metric_name).toBe('indigenous_overrepresentation_ratio');
    expect(signals[1].metric_name).toBe('detention_rate_per_10k');
  });

  it('skips metrics where earliest value is 0', () => {
    const metrics = [
      makeMetric({ period: '2019-20', metric_value: 0 }),
      makeMetric({ period: '2023-24', metric_value: 5 }),
    ];
    expect(computeTrendSignals(metrics, 'SA')).toEqual([]);
  });

  it('formats the trend string with jurisdiction and year span', () => {
    const metrics = [
      makeMetric({ metric_name: 'detention_rate_per_10k', period: '2019-20', metric_value: 3 }),
      makeMetric({ metric_name: 'detention_rate_per_10k', period: '2023-24', metric_value: 4.59 }),
    ];
    const signals = computeTrendSignals(metrics, 'QLD');
    expect(signals[0].formatted).toBe('QLD detention rates +53% over 4 years');
    expect(signals[0].period_span).toBe('2019-20 to 2023-24');
  });

  it('uses latest and earliest periods regardless of input order', () => {
    const metrics = [
      makeMetric({ period: '2023-24', metric_value: 6 }),
      makeMetric({ period: '2019-20', metric_value: 3 }),
      makeMetric({ period: '2021-22', metric_value: 4 }),
    ];
    const signals = computeTrendSignals(metrics, 'WA');
    expect(signals[0].earliest_value).toBe(3);
    expect(signals[0].latest_value).toBe(6);
  });
});

describe('pickTopTrends', () => {
  function makeTrend(overrides: Partial<TrendSignal> = {}): TrendSignal {
    return {
      metric_name: 'detention_rate_per_10k',
      label: 'detention rates',
      latest_value: 5,
      earliest_value: 3,
      pct_change: 50,
      direction: 'worsening',
      period_span: '2019-20 to 2023-24',
      formatted: 'QLD detention rates +50% over 4 years',
      ...overrides,
    };
  }

  it('returns at most limit signals', () => {
    const signals = [
      makeTrend({ pct_change: 50 }),
      makeTrend({ pct_change: 30 }),
      makeTrend({ pct_change: 10 }),
    ];
    expect(pickTopTrends(signals, 2)).toHaveLength(2);
  });

  it('prioritizes worsening over improving', () => {
    const signals = [
      makeTrend({ metric_name: 'a', direction: 'improving', pct_change: -80 }),
      makeTrend({ metric_name: 'b', direction: 'worsening', pct_change: 10 }),
    ];
    const top = pickTopTrends(signals, 1);
    expect(top[0].metric_name).toBe('b');
  });

  it('among same direction, picks larger absolute change first', () => {
    const signals = [
      makeTrend({ metric_name: 'small', direction: 'worsening', pct_change: 10 }),
      makeTrend({ metric_name: 'big', direction: 'worsening', pct_change: 80 }),
    ];
    const top = pickTopTrends(signals, 1);
    expect(top[0].metric_name).toBe('big');
  });

  it('returns empty when given empty input', () => {
    expect(pickTopTrends([])).toEqual([]);
  });

  it('defaults to limit of 2', () => {
    const signals = [
      makeTrend({ pct_change: 50 }),
      makeTrend({ pct_change: 30 }),
      makeTrend({ pct_change: 10 }),
    ];
    expect(pickTopTrends(signals)).toHaveLength(2);
  });
});

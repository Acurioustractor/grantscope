/**
 * Pure utility functions for computing outcome metric trends.
 * Extracted from entity page to enable testing.
 */

export interface OutcomeMetric {
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  period: string;
  cohort: string | null;
  source: string;
  notes: string | null;
}

export interface TrendSignal {
  metric_name: string;
  label: string;
  latest_value: number;
  earliest_value: number;
  pct_change: number;
  direction: 'worsening' | 'improving' | 'stable';
  period_span: string; // e.g. "2019-20 to 2023-24"
  formatted: string; // e.g. "QLD detention rates +53% over 5 years"
}

/** Metrics where a higher value means worse outcomes */
const WORSE_WHEN_HIGHER = new Set([
  'detention_rate_per_10k',
  'aihw_detention_rate_per_10k',
  'aihw_avg_nightly_detention',
  'indigenous_overrepresentation_ratio',
  'cost_per_day_detention',
  'pct_unsentenced',
  'avg_daily_detention',
  'avg_days_in_detention',
  'ctg_target11_indigenous_detention_rate',
]);

const METRIC_LABELS: Record<string, string> = {
  detention_rate_per_10k: 'detention rates',
  aihw_detention_rate_per_10k: 'detention rates',
  aihw_avg_nightly_detention: 'nightly detention population',
  indigenous_overrepresentation_ratio: 'Indigenous overrepresentation',
  cost_per_day_detention: 'detention costs',
  pct_unsentenced: 'remand rates',
  avg_daily_detention: 'daily detention',
  avg_days_in_detention: 'avg detention stay',
  ctg_target11_indigenous_detention_rate: 'Indigenous detention rate',
  cost_per_day_community: 'community supervision costs',
};

/**
 * Compute trend signals from a set of outcome metrics for a jurisdiction.
 * Requires at least 2 periods for a given metric to compute a trend.
 * Returns trends sorted by absolute pct_change descending.
 */
export function computeTrendSignals(
  metrics: OutcomeMetric[],
  jurisdiction: string,
  cohort?: string,
): TrendSignal[] {
  // Group metrics by name+cohort (if cohort specified, filter; otherwise group all)
  const byKey = new Map<string, OutcomeMetric[]>();
  for (const m of metrics) {
    if (cohort && m.cohort !== cohort) continue;
    // Key by metric_name + cohort to keep cohorts separate
    const key = `${m.metric_name}::${m.cohort ?? 'all'}`;
    const existing = byKey.get(key) ?? [];
    existing.push(m);
    byKey.set(key, existing);
  }

  // Deduplicate: prefer 'indigenous' cohort trends for CTG metrics, 'all' for others
  const byName = new Map<string, OutcomeMetric[]>();
  for (const [key, rows] of byKey) {
    const name = key.split('::')[0];
    if (!byName.has(name) || rows.length > (byName.get(name)?.length ?? 0)) {
      byName.set(name, rows);
    }
  }

  const signals: TrendSignal[] = [];

  for (const [name, rows] of byName) {
    if (rows.length < 2) continue;

    // Sort by period ascending
    const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];

    if (earliest.metric_value === 0) continue; // can't compute pct change from 0

    const pctChange = ((latest.metric_value - earliest.metric_value) / earliest.metric_value) * 100;
    const worseWhenHigher = WORSE_WHEN_HIGHER.has(name);

    let direction: TrendSignal['direction'];
    if (Math.abs(pctChange) < 3) {
      direction = 'stable';
    } else if (worseWhenHigher) {
      direction = pctChange > 0 ? 'worsening' : 'improving';
    } else {
      direction = pctChange > 0 ? 'improving' : 'worsening';
    }

    const label = METRIC_LABELS[name] ?? name.replace(/_/g, ' ');
    const sign = pctChange > 0 ? '+' : '';
    const rounded = Math.round(pctChange);

    // Estimate year span from period strings (e.g. "2019-20" to "2023-24" = ~4 years)
    const startYear = parseInt(earliest.period.slice(0, 4), 10);
    const endYear = parseInt(latest.period.slice(0, 4), 10);
    const yearSpan = endYear - startYear;

    signals.push({
      metric_name: name,
      label,
      latest_value: latest.metric_value,
      earliest_value: earliest.metric_value,
      pct_change: pctChange,
      direction,
      period_span: `${earliest.period} to ${latest.period}`,
      formatted: `${jurisdiction} ${label} ${sign}${rounded}% over ${yearSpan > 0 ? `${yearSpan} years` : '1 year'}`,
    });
  }

  // Sort by absolute change descending — most dramatic trends first
  signals.sort((a, b) => Math.abs(b.pct_change) - Math.abs(a.pct_change));

  return signals;
}

/**
 * Pick the most newsworthy trend signals for compact display.
 * Prioritizes worsening trends, then largest absolute change.
 * Returns at most `limit` signals.
 */
export function pickTopTrends(signals: TrendSignal[], limit = 2): TrendSignal[] {
  // Worsening first, then by absolute pct_change
  const sorted = [...signals].sort((a, b) => {
    if (a.direction === 'worsening' && b.direction !== 'worsening') return -1;
    if (b.direction === 'worsening' && a.direction !== 'worsening') return 1;
    return Math.abs(b.pct_change) - Math.abs(a.pct_change);
  });
  return sorted.slice(0, limit);
}

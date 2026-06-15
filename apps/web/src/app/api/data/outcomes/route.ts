import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

const VALID_JURISDICTIONS = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT', 'National'];
const VALID_DOMAINS = ['youth-justice', 'child-protection', 'disability', 'education', 'ndis', 'family-services', 'indigenous'];
const TREND_METRICS = [
  'detention_rate_per_10k',
  'avg_daily_detention',
  'indigenous_overrepresentation_ratio',
  'pct_unsentenced',
  'cost_per_day_detention',
  'ctg_target11_indigenous_detention_rate',
];
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' };
const OUTCOME_PAGE_SIZE = 500;
const OUTCOME_MAX_ROWS = 5000;

type OutcomeMetricRow = {
  jurisdiction: string;
  domain?: string;
  metric_name: string;
  metric_value: number | string | null;
  metric_unit?: string | null;
  period: string;
  cohort?: string | null;
  source?: string | null;
  notes?: string | null;
};
type OutcomeRangeQuery = {
  range: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
};

async function fetchOutcomeRows<T>(
  buildQuery: () => OutcomeRangeQuery,
  maxRows = OUTCOME_MAX_ROWS,
): Promise<T[]> {
  const rows: T[] = [];

  for (let offset = 0; offset < maxRows; offset += OUTCOME_PAGE_SIZE) {
    const end = Math.min(offset + OUTCOME_PAGE_SIZE, maxRows) - 1;
    const { data, error } = await buildQuery().range(offset, end);
    if (error) throw error;

    const pageRows = ((data || []) as unknown) as T[];
    rows.push(...pageRows);
    if (pageRows.length < end - offset + 1) break;
  }

  return rows;
}

function numberValue(value: number | string | null): number {
  return Number(value ?? 0);
}

function cohortPriority(row: Pick<OutcomeMetricRow, 'cohort'>): number {
  return row.cohort === 'all' ? 0 : row.cohort == null ? 1 : 2;
}

function sortLatestPreferred(a: OutcomeMetricRow, b: OutcomeMetricRow): number {
  return (
    a.jurisdiction.localeCompare(b.jurisdiction) ||
    cohortPriority(a) - cohortPriority(b) ||
    b.period.localeCompare(a.period)
  );
}

export async function GET(req: NextRequest) {
  let supabase: ReturnType<typeof getServiceSupabase>;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  const { searchParams } = req.nextUrl;
  const jurisdiction = searchParams.get('jurisdiction');
  const domain = searchParams.get('domain') || 'youth-justice';
  const metric = searchParams.get('metric');
  const trend = searchParams.get('trend'); // 'worsening' | 'improving'

  if (!VALID_DOMAINS.includes(domain)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
  }

  try {
    // Mode 1: All metrics for a jurisdiction
    if (jurisdiction) {
      if (!VALID_JURISDICTIONS.includes(jurisdiction)) {
        return NextResponse.json({ error: 'Invalid jurisdiction' }, { status: 400 });
      }
      const metrics = await fetchOutcomeRows<OutcomeMetricRow>(() => supabase
        .from('outcomes_metrics')
        .select('metric_name, metric_value, metric_unit, period, cohort, source, notes')
        .eq('jurisdiction', jurisdiction)
        .eq('domain', domain)
        .order('metric_name', { ascending: true })
        .order('period', { ascending: true }) as unknown as OutcomeRangeQuery);
      return NextResponse.json({ jurisdiction, domain, metrics }, { headers: CACHE_HEADERS });
    }

    // Mode 2: Cross-state comparison for one metric
    if (metric) {
      const metricRows = await fetchOutcomeRows<OutcomeMetricRow>(() => supabase
        .from('outcomes_metrics')
        .select('jurisdiction, metric_name, metric_value, metric_unit, period, cohort')
        .eq('metric_name', metric)
        .eq('domain', domain) as unknown as OutcomeRangeQuery);

      const latestByJurisdiction = new Map<string, OutcomeMetricRow>();
      for (const row of metricRows.sort(sortLatestPreferred)) {
        if (!latestByJurisdiction.has(row.jurisdiction)) {
          latestByJurisdiction.set(row.jurisdiction, row);
        }
      }

      return NextResponse.json(
        { metric, domain, comparison: Array.from(latestByJurisdiction.values()) },
        { headers: CACHE_HEADERS },
      );
    }

    // Mode 3: Worsening/improving trends
    if (trend === 'worsening' || trend === 'improving') {
      const trendRows = await fetchOutcomeRows<OutcomeMetricRow>(() => supabase
        .from('outcomes_metrics')
        .select('jurisdiction, metric_name, metric_value, period')
        .eq('domain', domain)
        .in('metric_name', TREND_METRICS) as unknown as OutcomeRangeQuery);

      const grouped = new Map<string, OutcomeMetricRow[]>();
      for (const row of trendRows) {
        const key = `${row.jurisdiction}::${row.metric_name}`;
        grouped.set(key, [...(grouped.get(key) || []), row]);
      }

      const results = Array.from(grouped.values())
        .map((rows) => rows.sort((a, b) => a.period.localeCompare(b.period)))
        .flatMap((rows) => {
          const first = rows[0];
          const latest = rows[rows.length - 1];
          if (!first || !latest || first.period === latest.period) return [];
          const firstValue = numberValue(first.metric_value);
          if (firstValue === 0) return [];
          const latestValue = numberValue(latest.metric_value);
          const changePct = Math.round(((latestValue - firstValue) / firstValue) * 1000) / 10;
          if ((trend === 'worsening' && changePct <= 0) || (trend === 'improving' && changePct >= 0)) return [];
          return [{
            jurisdiction: first.jurisdiction,
            metric_name: first.metric_name,
            first_value: firstValue,
            first_period: first.period,
            latest_value: latestValue,
            latest_period: latest.period,
            change_pct: changePct,
          }];
        })
        .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))
        .slice(0, 50);

      return NextResponse.json({ trend, domain, results }, { headers: CACHE_HEADERS });
    }

    // Default: summary of available data
    const summaryRows = await fetchOutcomeRows<{ jurisdiction: string; domain: string; metric_name: string }>(() => supabase
      .from('outcomes_metrics')
      .select('jurisdiction, domain, metric_name') as unknown as OutcomeRangeQuery);

    const summaryMap = new Map<string, { jurisdiction: string; domain: string; metrics: number; metricNames: Set<string> }>();
    for (const row of summaryRows) {
      const key = `${row.jurisdiction}::${row.domain}`;
      const current = summaryMap.get(key) || {
        jurisdiction: row.jurisdiction,
        domain: row.domain,
        metrics: 0,
        metricNames: new Set<string>(),
      };
      current.metrics++;
      current.metricNames.add(row.metric_name);
      summaryMap.set(key, current);
    }

    const summary = Array.from(summaryMap.values())
      .map((row) => ({
        jurisdiction: row.jurisdiction,
        domain: row.domain,
        metrics: row.metrics,
        unique_metrics: row.metricNames.size,
      }))
      .sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction) || a.domain.localeCompare(b.domain));

    return NextResponse.json({ summary }, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error('Outcomes API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

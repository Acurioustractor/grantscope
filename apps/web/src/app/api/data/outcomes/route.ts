import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VALID_JURISDICTIONS = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT', 'National'];
const VALID_DOMAINS = ['youth-justice', 'child-protection', 'disability', 'education', 'ndis', 'family-services', 'indigenous'];

function getOutcomesSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey);
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

export async function GET(req: NextRequest) {
  const supabase = getOutcomesSupabase();
  if (!supabase) {
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
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `SELECT metric_name, metric_value, metric_unit, period, cohort, source, notes
                FROM outcomes_metrics
                WHERE jurisdiction = '${esc(jurisdiction)}' AND domain = '${esc(domain)}'
                ORDER BY metric_name, period`,
      });
      if (error) throw error;
      return NextResponse.json({ jurisdiction, domain, metrics: data }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    }

    // Mode 2: Cross-state comparison for one metric
    if (metric) {
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `SELECT DISTINCT ON (jurisdiction)
                  jurisdiction, metric_name, metric_value, metric_unit, period, cohort
                FROM outcomes_metrics
                WHERE metric_name = '${esc(metric)}' AND domain = '${esc(domain)}'
                ORDER BY jurisdiction, CASE WHEN cohort = 'all' THEN 0 ELSE 1 END, period DESC`,
      });
      if (error) throw error;
      return NextResponse.json({ metric, domain, comparison: data }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    }

    // Mode 3: Worsening/improving trends
    if (trend === 'worsening' || trend === 'improving') {
      const op = trend === 'worsening' ? '>' : '<';
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `WITH ranked AS (
                  SELECT jurisdiction, metric_name, metric_value, period,
                         ROW_NUMBER() OVER (PARTITION BY jurisdiction, metric_name ORDER BY period ASC) as rn_first,
                         ROW_NUMBER() OVER (PARTITION BY jurisdiction, metric_name ORDER BY period DESC) as rn_last
                  FROM outcomes_metrics
                  WHERE domain = '${esc(domain)}'
                    AND metric_name IN ('detention_rate_per_10k','avg_daily_detention','indigenous_overrepresentation_ratio','pct_unsentenced','cost_per_day_detention','ctg_target11_indigenous_detention_rate')
                ),
                trends AS (
                  SELECT r1.jurisdiction, r1.metric_name,
                         r1.metric_value as first_value, r1.period as first_period,
                         r2.metric_value as latest_value, r2.period as latest_period,
                         ROUND(((r2.metric_value - r1.metric_value) / NULLIF(r1.metric_value, 0)) * 100, 1) as change_pct
                  FROM ranked r1
                  JOIN ranked r2 ON r1.jurisdiction = r2.jurisdiction AND r1.metric_name = r2.metric_name
                  WHERE r1.rn_first = 1 AND r2.rn_last = 1 AND r1.period != r2.period
                )
                SELECT * FROM trends
                WHERE change_pct ${op} 0
                ORDER BY ABS(change_pct) DESC
                LIMIT 50`,
      });
      if (error) throw error;
      return NextResponse.json({ trend, domain, results: data }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    }

    // Default: summary of available data
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `SELECT jurisdiction, domain, COUNT(*) as metrics, COUNT(DISTINCT metric_name) as unique_metrics
              FROM outcomes_metrics
              GROUP BY jurisdiction, domain
              ORDER BY jurisdiction, domain`,
    });
    if (error) throw error;
    return NextResponse.json({ summary: data }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (err) {
    console.error('Outcomes API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Youth Justice Summary API — aggregates for the 5 storytelling views
 * (cityscape, money-river, tree-rings, drain, tanks).
 *
 * Returns:
 *   - top_recipients: top N orgs by total $ (with lane, year range, state)
 *   - by_year_lane:   year × lane × total $ (for tanks, river, rings)
 *   - by_state_lane:  state × lane × total $ (for cityscape grouping)
 *   - totals:         overall + per-lane summary
 *
 * GET /api/data/youth-justice-summary
 *   ?state=NSW|...    (optional state filter)
 *   &min_amount=50000 (default 50000)
 *   &top_n=400        (default 400 recipients for cityscape towers)
 */

type Lane = 'reactive' | 'prevention' | 'community-led' | 'unclassified';

type FundingRow = {
  recipient_name: string;
  gs_entity_id: string | null;
  total_amount: number;
  grant_count: number;
  state: string | null;
  first_year: number | null;
  last_year: number | null;
  lane: Lane;
};

type YearLaneRow = {
  year: number;
  lane: string;
  total: number;
  grant_count: number;
};

type SupabaseClient = ReturnType<typeof getServiceSupabase>;

async function paginatedRpc<T>(supabase: SupabaseClient, sql: string, maxRows = 10000): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let offset = 0; offset < maxRows; offset += PAGE) {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql }).range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (data) all.push(...(data as T[]));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

// Single lane classifier — reused across recipient, year, and state queries.
// Uses recipient_name patterns BEFORE topic flags so state Justice ministries
// (whose grants leak prevention/community sub-topics) classify as reactive.
const LANE_SQL = `
  CASE
    WHEN jf.recipient_name ~* '(department of (justice|home affairs|community safety|youth justice|corrective)|community correctional|corrective services|youth justice (agency|services|nsw|qld|wa|sa|vic|nt|act)|detention|correctional facility|police|custody|court services|attorney.general|magistrates)' THEN 'reactive'
    WHEN jf.topics @> ARRAY['community-led']
      OR jf.topics @> ARRAY['indigenous']
      OR jf.recipient_name ~* '(aboriginal|torres strait|first nations|koori|murri|nyoongar|noongar|yolngu|tiwi|warlpiri|community.controlled|land council|indigenous corporation|aborig\\.|atsi)' THEN 'community-led'
    WHEN jf.topics @> ARRAY['detention']
      OR jf.topics @> ARRAY['policing']
      OR jf.topics @> ARRAY['courts']
      OR jf.topics @> ARRAY['corrections'] THEN 'reactive'
    WHEN jf.topics @> ARRAY['prevention']
      OR jf.topics @> ARRAY['diversion']
      OR jf.topics @> ARRAY['wraparound']
      OR jf.topics @> ARRAY['early-intervention']
      OR jf.recipient_name ~* '(diversion|prevention|early.intervention|family support|conferencing|mentoring|wraparound|on country|justice reinvestment)'
      OR jf.program_name ~* '(diversion|prevention|early.intervention|family support|conferencing|mentoring|wraparound|on country|justice reinvestment)' THEN 'prevention'
    ELSE 'unclassified'
  END
`;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const minAmount = Math.max(0, parseInt(searchParams.get('min_amount') || '50000', 10));
    const topN = Math.min(parseInt(searchParams.get('top_n') || '400', 10), 1500);

    const supabase = getServiceSupabase();
    const stateFilter = state ? `AND jf.state = '${state.toUpperCase()}'` : '';

    // Common WHERE clause used by both queries
    const baseWhere = `
      jf.topics @> ARRAY['youth-justice']
      AND jf.amount_dollars > ${minAmount}
      AND jf.program_name IS NOT NULL
      AND jf.program_name NOT LIKE 'ROGS%'
      AND jf.program_name NOT LIKE 'Total%'
      AND COALESCE(jf.is_aggregate, false) = false
      ${stateFilter}
    `;

    // Query 1: top recipients (lane classified per row, then majority-lane per recipient)
    const recipRows = await paginatedRpc<FundingRow>(supabase,
      `WITH classified AS (
         SELECT
           jf.recipient_name,
           jf.gs_entity_id,
           jf.amount_dollars,
           jf.state,
           CASE WHEN jf.financial_year ~ '^[0-9]{4}' THEN LEFT(jf.financial_year, 4)::int END AS year,
           ${LANE_SQL} AS lane
         FROM justice_funding jf
         WHERE ${baseWhere}
       ),
       per_recipient_lane AS (
         SELECT recipient_name, gs_entity_id, lane,
                SUM(amount_dollars)::numeric AS lane_amount
         FROM classified
         GROUP BY recipient_name, gs_entity_id, lane
       ),
       dominant AS (
         SELECT DISTINCT ON (recipient_name, gs_entity_id)
           recipient_name, gs_entity_id, lane
         FROM per_recipient_lane
         ORDER BY recipient_name, gs_entity_id, lane_amount DESC
       )
       SELECT
         c.recipient_name,
         c.gs_entity_id,
         SUM(c.amount_dollars)::numeric AS total_amount,
         COUNT(*)::int AS grant_count,
         MAX(c.state) AS state,
         MIN(c.year) AS first_year,
         MAX(c.year) AS last_year,
         d.lane
       FROM classified c
       JOIN dominant d
         ON d.recipient_name = c.recipient_name
         AND COALESCE(d.gs_entity_id::text, '∅') = COALESCE(c.gs_entity_id::text, '∅')
       GROUP BY c.recipient_name, c.gs_entity_id, d.lane
       ORDER BY total_amount DESC
       LIMIT ${topN}`,
      topN
    );

    // Resolve gs_id for entity links
    const entityIds = [...new Set(recipRows.filter(r => r.gs_entity_id).map(r => r.gs_entity_id!))];
    const gsIdMap = new Map<string, string>();
    if (entityIds.length > 0) {
      const idList = entityIds.map(id => `'${id}'`).join(',');
      const entities = await paginatedRpc<{ id: string; gs_id: string }>(supabase,
        `SELECT id, gs_id FROM gs_entities WHERE id IN (${idList})`,
        entityIds.length + 100
      );
      for (const e of entities) gsIdMap.set(e.id, e.gs_id);
    }

    const top_recipients = recipRows.map(r => ({
      name: r.recipient_name,
      gs_id: r.gs_entity_id ? gsIdMap.get(r.gs_entity_id) || null : null,
      entity_id: r.gs_entity_id,
      lane: r.lane,
      total: Number(r.total_amount || 0),
      grant_count: Number(r.grant_count || 0),
      state: r.state,
      first_year: r.first_year,
      last_year: r.last_year,
    }));

    // Query 2: year × lane breakdown (one row per row, classified, then aggregated)
    // Using CASE expression for lane classification at SQL level
    const yearLaneRows = await paginatedRpc<YearLaneRow>(supabase,
      `WITH classified AS (
         SELECT
           CASE WHEN jf.financial_year ~ '^[0-9]{4}' THEN LEFT(jf.financial_year, 4)::int END AS year,
           jf.amount_dollars,
           ${LANE_SQL} AS lane
         FROM justice_funding jf
         WHERE ${baseWhere}
       )
       SELECT
         year,
         lane,
         SUM(amount_dollars)::numeric AS total,
         COUNT(*)::int AS grant_count
       FROM classified
       WHERE year IS NOT NULL
       GROUP BY year, lane
       ORDER BY year, lane`,
      2000
    );

    const by_year_lane = yearLaneRows.map(r => ({
      year: Number(r.year),
      lane: r.lane,
      total: Number(r.total),
      grant_count: Number(r.grant_count),
    }));

    // Query 3: state × lane breakdown
    const stateLaneRows = await paginatedRpc<{ state: string; lane: string; total: number; recipient_count: number }>(supabase,
      `WITH classified AS (
         SELECT
           jf.state,
           jf.recipient_name,
           jf.amount_dollars,
           ${LANE_SQL} AS lane
         FROM justice_funding jf
         WHERE ${baseWhere}
       )
       SELECT
         COALESCE(state, 'UNK') AS state,
         lane,
         SUM(amount_dollars)::numeric AS total,
         COUNT(DISTINCT recipient_name)::int AS recipient_count
       FROM classified
       GROUP BY state, lane
       ORDER BY total DESC`,
      500
    );

    const by_state_lane = stateLaneRows.map(r => ({
      state: r.state,
      lane: r.lane,
      total: Number(r.total),
      recipient_count: Number(r.recipient_count),
    }));

    // Totals
    const totals = { reactive: 0, prevention: 0, 'community-led': 0, unclassified: 0, all: 0 };
    for (const r of by_year_lane) {
      const l = r.lane as keyof typeof totals;
      if (l in totals) totals[l] += r.total;
      totals.all += r.total;
    }

    let yearMin = Infinity;
    let yearMax = -Infinity;
    for (const r of by_year_lane) {
      yearMin = Math.min(yearMin, r.year);
      yearMax = Math.max(yearMax, r.year);
    }
    if (!isFinite(yearMin)) yearMin = 2008;
    if (!isFinite(yearMax)) yearMax = new Date().getFullYear();

    const response = NextResponse.json({
      top_recipients,
      by_year_lane,
      by_state_lane,
      totals,
      meta: {
        recipient_count: top_recipients.length,
        year_range: { min: yearMin, max: yearMax },
        filters: { state, minAmount, topN },
      },
    });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

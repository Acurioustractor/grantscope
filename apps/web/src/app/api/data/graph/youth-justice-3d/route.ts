import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Youth Justice 3D Graph — temporal force-directed dataset for /graph/youth-justice-3d.
 *
 * Returns program → recipient nodes/edges with:
 *   - first_year and last_year per node (used for Z-axis depth)
 *   - reactive vs prevention vs community-led classification
 *   - log-scaled funding for node sizing
 *
 * GET /api/data/graph/youth-justice-3d
 *   ?state=NSW|VIC|QLD|...    (optional state filter)
 *   &min_amount=50000          (default 50000 — drops noise)
 *   &limit=2500                (default 2500 program×recipient×year edges)
 */

type FundingRow = {
  program_name: string;
  recipient_name: string;
  gs_entity_id: string | null;
  total_amount: number;
  grant_count: number;
  state: string | null;
  first_year: number | null;
  last_year: number | null;
  has_community_led: boolean;
  has_prevention: boolean;
  has_reactive: boolean;
  has_indigenous: boolean;
};

type EntityRow = {
  id: string;
  gs_id: string;
  canonical_name: string;
  entity_type: string | null;
  state: string | null;
  is_community_controlled: boolean | null;
  remoteness: string | null;
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

function classifyLane(row: FundingRow): 'reactive' | 'prevention' | 'community-led' | 'unclassified' {
  if (row.has_community_led) return 'community-led';
  if (row.has_prevention) return 'prevention';
  if (row.has_reactive) return 'reactive';

  const p = (row.program_name || '').toLowerCase();
  if (/(detention|custod|watch[\s-]?house|police|court|corrections|punitive|secure)/i.test(p)) return 'reactive';
  if (/(diversion|prevention|early\s*intervention|wraparound|family\s*support|youth\s*services)/i.test(p)) return 'prevention';
  if (/(aboriginal|indigenous|first\s*nations|community[-\s]controlled|atsi)/i.test(p)) return 'community-led';
  return 'unclassified';
}

function shortenProgram(name: string): string {
  const lower = name.toLowerCase();

  // Pattern-match known ROGS rollups to short labels
  if (/government real recurrent expenditure/.test(lower) && /detention/.test(lower)) {
    return 'Detention spend (ROGS)';
  }
  if (/government real recurrent expenditure/.test(lower) && /community.based/.test(lower)) {
    return 'Community-based supervision spend (ROGS)';
  }
  if (/government real recurrent expenditure/.test(lower) && /(group conferencing|conferencing)/.test(lower)) {
    return 'Group conferencing spend (ROGS)';
  }
  if (/cost per young person.*detention/.test(lower)) return 'Cost per youth · detention (ROGS)';
  if (/cost per young person.*community/.test(lower)) return 'Cost per youth · community supervision (ROGS)';
  if (/net capital expenditure.*detention/.test(lower)) return 'Capital spend · detention (ROGS)';
  if (/net capital expenditure.*community/.test(lower)) return 'Capital spend · community (ROGS)';
  if (/^real recurrent expenditure$/i.test(name.trim())) return 'Recurrent expenditure (ROGS)';
  if (/^government real recurrent expenditure/i.test(name.trim())) return 'Total recurrent expenditure (ROGS)';

  let s = name
    .replace(/Community[\s,&]+(?:and\s+)?Youth Justice Services[\s,&]+(?:and\s+)?Aboriginal[\s,&]+(?:and\s+)?Torres Strait Islander Services/i, 'Youth Justice & ATSI Services')
    .replace(/Community[\s,&]+(?:and\s+)?Youth Justice Services[\s,&]+(?:and\s+)?Women/i, 'Youth Justice & Women')
    .replace(/Community[\s,&]+(?:and\s+)?Youth Justice\s+/i, 'Youth Justice ')
    .replace(/ Incorporated| Inc\.?| Pty Ltd| Ltd/gi, '')
    .replace(/\s+-\s+/g, ' · ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (s.length > 80) s = s.slice(0, 77) + '…';
  return s || name;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const minAmount = Math.max(0, parseInt(searchParams.get('min_amount') || '50000', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '2500', 10), 8000);

    const supabase = getServiceSupabase();

    const stateFilter = state ? `AND jf.state = '${state.toUpperCase()}'` : '';

    // Aggregate program × recipient with first/last year + lane signal flags
    const rows = await paginatedRpc<FundingRow>(supabase,
      `SELECT
         jf.program_name,
         jf.recipient_name,
         jf.gs_entity_id,
         SUM(jf.amount_dollars)::numeric AS total_amount,
         COUNT(*)::int AS grant_count,
         MAX(jf.state) AS state,
         MIN(CASE WHEN jf.financial_year ~ '^[0-9]{4}' THEN LEFT(jf.financial_year, 4)::int END) AS first_year,
         MAX(CASE WHEN jf.financial_year ~ '^[0-9]{4}' THEN LEFT(jf.financial_year, 4)::int END) AS last_year,
         bool_or(jf.topics @> ARRAY['community-led']) AS has_community_led,
         bool_or(jf.topics @> ARRAY['prevention']
              OR jf.topics @> ARRAY['diversion']
              OR jf.topics @> ARRAY['wraparound']
              OR jf.topics @> ARRAY['early-intervention']) AS has_prevention,
         bool_or(jf.topics @> ARRAY['detention']
              OR jf.topics @> ARRAY['policing']
              OR jf.topics @> ARRAY['courts']
              OR jf.topics @> ARRAY['corrections']) AS has_reactive,
         bool_or(jf.topics @> ARRAY['indigenous']) AS has_indigenous
       FROM justice_funding jf
       WHERE jf.topics @> ARRAY['youth-justice']
         AND jf.amount_dollars > ${minAmount}
         AND jf.program_name IS NOT NULL
         AND jf.program_name NOT LIKE 'ROGS%'
         AND jf.program_name NOT LIKE 'Total%'
         AND COALESCE(jf.is_aggregate, false) = false
         ${stateFilter}
       GROUP BY jf.program_name, jf.recipient_name, jf.gs_entity_id
       ORDER BY total_amount DESC
       LIMIT ${limit}`,
      limit
    );

    if (rows.length === 0) {
      return NextResponse.json({ nodes: [], edges: [], meta: { total_nodes: 0, total_edges: 0 } });
    }

    // Resolve linked entity details for nicer labels + community-controlled flag
    const entityIds = [...new Set(rows.filter(r => r.gs_entity_id).map(r => r.gs_entity_id!))];
    const entityMap = new Map<string, EntityRow>();
    if (entityIds.length > 0) {
      const idList = entityIds.map(id => `'${id}'`).join(',');
      const entities = await paginatedRpc<EntityRow>(supabase,
        `SELECT id, gs_id, canonical_name, entity_type, state, is_community_controlled, remoteness
         FROM gs_entities
         WHERE id IN (${idList})`,
        entityIds.length + 100
      );
      for (const e of entities) entityMap.set(e.id, e);
    }

    // Aggregate to program nodes + recipient nodes
    type ProgNode = {
      id: string; label: string; rawName: string;
      total: number; recipients: number;
      firstYear: number | null; lastYear: number | null;
      laneCounts: Record<string, number>;
    };
    type RecipNode = {
      id: string; label: string; gsId: string | null; entityId: string | null;
      entityType: string | null; state: string | null; communityControlled: boolean;
      total: number; programs: number; grantCount: number;
      firstYear: number | null; lastYear: number | null;
      lane: 'reactive' | 'prevention' | 'community-led' | 'unclassified';
    };

    const programs = new Map<string, ProgNode>();
    const recipients = new Map<string, RecipNode>();
    const edges: Array<{ source: string; target: string; amount: number; grants: number; first_year: number | null; last_year: number | null; lane: string }> = [];

    for (const row of rows) {
      const progKey = `prog:${row.program_name}`;
      const recipKey = row.gs_entity_id ? `entity:${row.gs_entity_id}` : `name:${row.recipient_name}`;
      const lane = classifyLane(row);
      const entity = row.gs_entity_id ? entityMap.get(row.gs_entity_id) : null;

      const prog = programs.get(progKey) || {
        id: progKey, label: shortenProgram(row.program_name), rawName: row.program_name,
        total: 0, recipients: 0, firstYear: null, lastYear: null,
        laneCounts: { reactive: 0, prevention: 0, 'community-led': 0, unclassified: 0 },
      };
      prog.total += Number(row.total_amount || 0);
      prog.recipients++;
      prog.firstYear = prog.firstYear == null ? row.first_year : Math.min(prog.firstYear, row.first_year ?? prog.firstYear);
      prog.lastYear = prog.lastYear == null ? row.last_year : Math.max(prog.lastYear, row.last_year ?? prog.lastYear);
      prog.laneCounts[lane]++;
      programs.set(progKey, prog);

      const recip = recipients.get(recipKey) || {
        id: recipKey,
        label: entity?.canonical_name || row.recipient_name,
        gsId: entity?.gs_id || null,
        entityId: row.gs_entity_id,
        entityType: entity?.entity_type || null,
        state: entity?.state || row.state,
        communityControlled: entity?.is_community_controlled || false,
        total: 0, programs: 0, grantCount: 0,
        firstYear: null, lastYear: null,
        lane,
      };
      recip.total += Number(row.total_amount || 0);
      recip.programs++;
      recip.grantCount += Number(row.grant_count || 0);
      recip.firstYear = recip.firstYear == null ? row.first_year : Math.min(recip.firstYear, row.first_year ?? recip.firstYear);
      recip.lastYear = recip.lastYear == null ? row.last_year : Math.max(recip.lastYear, row.last_year ?? recip.lastYear);
      // Community-controlled overrides lane classification
      if (recip.communityControlled) recip.lane = 'community-led';
      // Otherwise keep the strongest lane signal we've seen
      else if (recip.lane === 'unclassified' && lane !== 'unclassified') recip.lane = lane;
      recipients.set(recipKey, recip);

      edges.push({
        source: progKey,
        target: recipKey,
        amount: Number(row.total_amount || 0),
        grants: Number(row.grant_count || 0),
        first_year: row.first_year,
        last_year: row.last_year,
        lane,
      });
    }

    // Compute year range for normalization (used by client for Z-axis)
    let minYear = Infinity;
    let maxYear = -Infinity;
    for (const r of [...programs.values(), ...recipients.values()]) {
      if (r.firstYear != null) minYear = Math.min(minYear, r.firstYear);
      if (r.lastYear != null) maxYear = Math.max(maxYear, r.lastYear);
    }
    if (!isFinite(minYear)) minYear = 2008;
    if (!isFinite(maxYear)) maxYear = new Date().getFullYear();

    // Compute degree
    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) || 0) + 1);
      degree.set(e.target, (degree.get(e.target) || 0) + 1);
    }

    const dominantLane = (counts: Record<string, number>) => {
      let best: string = 'unclassified';
      let bestN = -1;
      for (const [k, v] of Object.entries(counts)) {
        if (k !== 'unclassified' && v > bestN) { best = k; bestN = v; }
      }
      return best;
    };

    const nodes = [
      ...[...programs.values()].map(p => ({
        id: p.id,
        label: p.label,
        kind: 'program' as const,
        lane: dominantLane(p.laneCounts),
        funding: p.total,
        recipients: p.recipients,
        first_year: p.firstYear,
        last_year: p.lastYear,
        degree: degree.get(p.id) || 0,
        rawName: p.rawName,
      })),
      ...[...recipients.values()].map(r => ({
        id: r.id,
        label: r.label,
        kind: 'recipient' as const,
        lane: r.lane,
        funding: r.total,
        programs: r.programs,
        grant_count: r.grantCount,
        first_year: r.firstYear,
        last_year: r.lastYear,
        gs_id: r.gsId,
        entity_id: r.entityId,
        entity_type: r.entityType,
        state: r.state,
        community_controlled: r.communityControlled,
        degree: degree.get(r.id) || 0,
      })),
    ];

    // Lane totals for the legend
    const laneTotals: Record<string, { funding: number; nodes: number }> = {
      reactive: { funding: 0, nodes: 0 },
      prevention: { funding: 0, nodes: 0 },
      'community-led': { funding: 0, nodes: 0 },
      unclassified: { funding: 0, nodes: 0 },
    };
    for (const r of recipients.values()) {
      laneTotals[r.lane].funding += r.total;
      laneTotals[r.lane].nodes += 1;
    }

    const response = NextResponse.json({
      nodes,
      edges: edges.map(e => ({ ...e, type: 'grant' })),
      meta: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        program_count: programs.size,
        recipient_count: recipients.size,
        year_range: { min: minYear, max: maxYear },
        lane_totals: laneTotals,
        filters: { state, minAmount, limit },
      },
    });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

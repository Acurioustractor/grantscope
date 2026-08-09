import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

// One council's live joins, keyed by ABS LGA code — the id, not the name.
//
// This is the place panel's substrate: who is placed here (with the stamp
// that placed each of them), the money our records can see reaching them
// (GrantConnect awards, justice programs, AusTender contracts — each joined
// by entity id, contracts by ABN), what the Australian Living Map of
// Alternatives links here, and the how-sure breakdown of the placements
// themselves. One SQL round trip; the client never loops.
//
// Everything here is public-register data at council grain, so the route
// carries no consent gate. Zero rows is a real answer throughout: the joins
// ran and found none, which each layer's caveat knows how to say.

const LGA_CODE = /^\d{4,5}$/;

interface MoneyBlock {
  records: number;
  total: number;
}

function moneyBlock(records: unknown, total: unknown): MoneyBlock {
  const n = Number(records);
  const t = Number(total);
  return {
    records: Number.isFinite(n) ? n : 0,
    total: Number.isFinite(t) ? t : 0,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const limited = limiter(request);
  if (limited) return limited;

  const { code } = await params;
  if (!LGA_CODE.test(code)) {
    return NextResponse.json({ error: 'Invalid LGA code' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    // `code` is regex-validated digits, safe to inline. The placed CTE is
    // MATERIALIZED so every block reads the one small scan; the big-table
    // joins are id-first (justice, grants, alma by gs_entities.id; AusTender
    // by ABN, the only key it carries). Verified against Ceduna (22 orgs,
    // 3.8s cold) and Brisbane (20K orgs, 2.1s) on 2026-08-10.
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `WITH placed AS MATERIALIZED (
        SELECT id, gs_id, canonical_name, entity_type, is_community_controlled, lga_source, abn
        FROM gs_entities
        WHERE lga_code = '${code}' AND lga_name IS NOT NULL
      ),
      justice AS (
        SELECT COUNT(*)::int AS records, COALESCE(SUM(jf.amount_dollars), 0)::numeric AS total
        FROM justice_funding jf JOIN placed p ON p.id = jf.gs_entity_id
      ),
      contracts AS (
        SELECT COUNT(*)::int AS records, COALESCE(SUM(ac.contract_value), 0)::numeric AS total
        FROM austender_contracts ac JOIN placed p ON p.abn = ac.supplier_abn
      ),
      grants AS (
        SELECT COUNT(*)::int AS records, COALESCE(SUM(ga.value_aud), 0)::numeric AS total
        FROM grantconnect_awards ga JOIN placed p ON p.id = ga.gs_entity_id
      ),
      alma AS (
        SELECT COUNT(*)::int AS linked
        FROM alma_interventions ai JOIN placed p ON p.id = ai.gs_entity_id
      ),
      stamps AS (
        SELECT COALESCE(jsonb_object_agg(lga_source, n), '{}'::jsonb) AS counts
        FROM (
          SELECT lga_source, COUNT(*)::int AS n
          FROM placed WHERE lga_source IS NOT NULL GROUP BY 1
        ) s
      ),
      top_orgs AS (
        SELECT COALESCE(jsonb_agg(row_data ORDER BY rank), '[]'::jsonb) AS orgs
        FROM (
          SELECT jsonb_build_object(
                   'gs_id', p.gs_id,
                   'canonical_name', p.canonical_name,
                   'entity_type', p.entity_type,
                   'is_community_controlled', p.is_community_controlled,
                   'lga_source', p.lga_source,
                   'power_score', pi.power_score
                 ) AS row_data,
                 ROW_NUMBER() OVER (ORDER BY pi.power_score DESC NULLS LAST, p.canonical_name) AS rank
          FROM placed p
          LEFT JOIN mv_entity_power_index pi ON pi.id = p.id
          ORDER BY pi.power_score DESC NULLS LAST, p.canonical_name
          LIMIT 12
        ) o
      )
      SELECT (SELECT COUNT(*) FROM placed)::int AS org_count,
             (SELECT COUNT(*) FROM placed WHERE is_community_controlled)::int AS cc_count,
             justice.records AS justice_records, justice.total AS justice_total,
             contracts.records AS contract_records, contracts.total AS contract_total,
             grants.records AS grant_records, grants.total AS grant_total,
             alma.linked AS alma_linked,
             stamps.counts AS stamps,
             top_orgs.orgs AS orgs
      FROM justice, contracts, grants, alma, stamps, top_orgs`,
    });

    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : null) as Record<string, unknown> | null;
    if (!row) throw new Error('Empty place payload');

    const response = NextResponse.json({
      lga_code: code,
      org_count: Number(row.org_count) || 0,
      cc_count: Number(row.cc_count) || 0,
      money: {
        grants: moneyBlock(row.grant_records, row.grant_total),
        justice: moneyBlock(row.justice_records, row.justice_total),
        contracts: moneyBlock(row.contract_records, row.contract_total),
      },
      alma_linked: Number(row.alma_linked) || 0,
      stamps: (row.stamps ?? {}) as Record<string, number>,
      orgs: (Array.isArray(row.orgs) ? row.orgs : []) as Array<{
        gs_id: string;
        canonical_name: string;
        entity_type: string;
        is_community_controlled: boolean | null;
        lga_source: string | null;
        power_score: number | null;
      }>,
    });
    response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
    return response;
  } catch (error) {
    console.error('Place data error:', error);
    return NextResponse.json({ error: 'Failed to fetch place data' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { safe, esc, validateAbn, validateGsId } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit({ windowMs: 60_000, max: 60 });

type EntityRow = {
  id: string;
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string | null;
  sector: string | null;
  state: string | null;
  lga_name: string | null;
  is_community_controlled: boolean | null;
  website: string | null;
  description: string | null;
};

type CardSummary = {
  total_government_funding: number;
  contract_count: number;
  donation_count: number;
  grant_count: number;
  alma_intervention_count: number;
  year_range: { first: number | null; last: number | null };
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonWithHeaders(data: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(data, init);
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Public entity card endpoint — lightweight entity summary for embedding
 * in Empathy Ledger stories, Goods supplier pages, partner sites, etc.
 *
 * Accepts ABN (11 digits) or gs_id as the {identifier} path segment.
 *
 * Response shape:
 *   { entity: {...}, summary: {...}, url: string }
 *
 * CORS: open (public data). Cache: 5min CDN + SWR.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const limited = limiter(request);
  if (limited) {
    for (const [k, v] of Object.entries(CORS_HEADERS)) limited.headers.set(k, v);
    return limited;
  }

  const { identifier } = await params;
  if (!identifier) {
    return jsonWithHeaders({ error: 'Missing identifier' }, { status: 400 });
  }

  const abn = validateAbn(identifier);
  const gsId = abn ? null : validateGsId(identifier);
  if (!abn && !gsId) {
    return jsonWithHeaders(
      { error: 'Invalid identifier. Provide an 11-digit ABN or a gs_id.' },
      { status: 400 }
    );
  }

  try {
    const supabase = getServiceSupabase();

    const where = abn
      ? `abn = '${esc(abn)}'`
      : `gs_id = '${esc(gsId as string)}'`;

    const entityRows = await safe(
      supabase.rpc('exec_sql', {
        query: `SELECT id, gs_id, canonical_name, abn, entity_type, sector, state, lga_name,
                       is_community_controlled, website, description
                  FROM gs_entities WHERE ${where} LIMIT 1`,
      })
    ) as EntityRow[] | null;

    const e = entityRows?.[0];
    if (!e) {
      return jsonWithHeaders({ error: 'Entity not found' }, { status: 404 });
    }

    const [contractStats, donationStats, grantStats, almaStats] = await Promise.all([
      e.abn
        ? safe(
            supabase.rpc('exec_sql', {
              query: `SELECT COALESCE(SUM(contract_value), 0)::bigint as total,
                             COUNT(*)::int as count,
                             EXTRACT(YEAR FROM MIN(contract_start))::int as first_year,
                             EXTRACT(YEAR FROM MAX(contract_start))::int as last_year
                        FROM austender_contracts WHERE supplier_abn = '${esc(e.abn)}'`,
            })
          )
        : Promise.resolve(null),
      e.abn
        ? safe(
            supabase.rpc('exec_sql', {
              query: `SELECT COALESCE(SUM(amount), 0)::bigint as total,
                             COUNT(*)::int as count
                        FROM political_donations WHERE donor_abn = '${esc(e.abn)}'`,
            })
          )
        : Promise.resolve(null),
      e.abn
        ? safe(
            supabase.rpc('exec_sql', {
              query: `SELECT COALESCE(SUM(amount_dollars), 0)::bigint as total,
                             COUNT(*)::int as count
                        FROM justice_funding WHERE recipient_abn = '${esc(e.abn)}'`,
            })
          )
        : Promise.resolve(null),
      safe(
        supabase.rpc('exec_sql', {
          query: `SELECT COUNT(*)::int as count
                    FROM alma_interventions WHERE gs_entity_id = '${esc(e.id)}'`,
        })
      ),
    ]);

    type ContractStat = { total: number | null; count: number | null; first_year: number | null; last_year: number | null };
    type SumCountStat = { total: number | null; count: number | null };
    type CountStat = { count: number | null };

    const contract = (contractStats as ContractStat[] | null)?.[0] ?? null;
    const donation = (donationStats as SumCountStat[] | null)?.[0] ?? null;
    const grant = (grantStats as SumCountStat[] | null)?.[0] ?? null;
    const alma = (almaStats as CountStat[] | null)?.[0] ?? null;

    const contractTotal = Number(contract?.total ?? 0);
    const grantTotal = Number(grant?.total ?? 0);

    const summary: CardSummary = {
      total_government_funding: contractTotal + grantTotal,
      contract_count: Number(contract?.count ?? 0),
      donation_count: Number(donation?.count ?? 0),
      grant_count: Number(grant?.count ?? 0),
      alma_intervention_count: Number(alma?.count ?? 0),
      year_range: {
        first: contract?.first_year ?? null,
        last: contract?.last_year ?? null,
      },
    };

    const origin = new URL(request.url).origin;

    return jsonWithHeaders({
      entity: {
        gs_id: e.gs_id,
        canonical_name: e.canonical_name,
        abn: e.abn,
        entity_type: e.entity_type,
        sector: e.sector,
        state: e.state,
        lga_name: e.lga_name,
        is_community_controlled: e.is_community_controlled ?? false,
        website: e.website,
        description: e.description,
      },
      summary,
      url: `${origin}/entities/${encodeURIComponent(e.gs_id)}`,
      embed_url: `${origin}/embed/entity/${encodeURIComponent(e.abn ?? e.gs_id)}`,
    });
  } catch (err) {
    console.error('[api/data/entity/identifier] error', err);
    return jsonWithHeaders({ error: 'Internal error' }, { status: 500 });
  }
}

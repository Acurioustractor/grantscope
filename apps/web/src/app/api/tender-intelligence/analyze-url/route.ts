import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * POST /api/tender-intelligence/analyze-url
 *
 * Paste a tender URL → get a market intelligence brief.
 * Searches our entity graph for relevant suppliers, incumbents,
 * contract history, and funding landscape.
 */

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;

  const { keywords, state, category } = await request.json() as {
    keywords: string;
    state?: string;
    category?: string;
  };

  if (!keywords || keywords.trim().length < 3) {
    return NextResponse.json({ error: 'Enter at least 3 characters of keywords describing the tender' }, { status: 400 });
  }

  const db = getServiceSupabase();
  const terms = keywords.trim().split(/\s+/).filter(Boolean);

  // Build ILIKE conditions for contract title search
  const titleWhere = terms.map(t => `title ILIKE '%${t.replace(/'/g, "''")}%'`).join(' AND ');
  const stateWhere = state ? `AND (buyer_name ILIKE '%${state}%' OR supplier_state = '${state}')` : '';

  // 1. Find relevant existing contracts
  const contractsPromise = db.rpc('exec_sql', {
    query: `SELECT buyer_name, supplier_name, supplier_abn, contract_value::bigint as value,
              EXTRACT(YEAR FROM contract_start)::int as year, title
       FROM austender_contracts
       WHERE ${titleWhere} ${stateWhere}
       ORDER BY contract_value DESC NULLS LAST
       LIMIT 20`,
  });

  // 2. Find entities in the space
  const entityNameWhere = terms.map(t => `canonical_name ILIKE '%${t.replace(/'/g, "''")}%'`).join(' OR ');
  const entitySectorWhere = terms.map(t => `sector ILIKE '%${t.replace(/'/g, "''")}%'`).join(' OR ');
  const entitiesPromise = db.rpc('exec_sql', {
    query: `SELECT gs_id, canonical_name, abn, entity_type, state, sector,
              is_community_controlled, seifa_irsd_decile
       FROM gs_entities
       WHERE (${entityNameWhere} OR ${entitySectorWhere})
         ${state ? `AND state = '${state}'` : ''}
       ORDER BY canonical_name
       LIMIT 30`,
  });

  // 3. Find ALMA interventions in the space
  const almaWhere = terms.map(t => `(name ILIKE '%${t.replace(/'/g, "''")}%' OR type ILIKE '%${t.replace(/'/g, "''")}%' OR description ILIKE '%${t.replace(/'/g, "''")}%')`).join(' OR ');
  const almaPromise = db.rpc('exec_sql', {
    query: `SELECT name, type, evidence_level, geography, portfolio_score::float
       FROM alma_interventions
       WHERE ${almaWhere}
       ORDER BY portfolio_score DESC NULLS LAST
       LIMIT 10`,
  });

  // 4. Aggregate market stats
  const marketPromise = db.rpc('exec_sql', {
    query: `SELECT COUNT(*)::int as total_contracts,
              SUM(contract_value)::bigint as total_value,
              COUNT(DISTINCT supplier_name)::int as unique_suppliers,
              COUNT(DISTINCT buyer_name)::int as unique_buyers,
              MIN(EXTRACT(YEAR FROM contract_start))::int as earliest_year,
              MAX(EXTRACT(YEAR FROM contract_start))::int as latest_year
       FROM austender_contracts
       WHERE ${titleWhere} ${stateWhere}`,
  });

  const [contractsRes, entitiesRes, almaRes, marketRes] = await Promise.all([
    contractsPromise, entitiesPromise, almaPromise, marketPromise,
  ]);

  // Extract top suppliers (incumbents)
  const contracts = (contractsRes.data || []) as Array<{
    buyer_name: string; supplier_name: string; supplier_abn: string | null;
    value: number; year: number; title: string;
  }>;

  const supplierTotals = new Map<string, { total: number; count: number; abn: string | null }>();
  for (const c of contracts) {
    const existing = supplierTotals.get(c.supplier_name) || { total: 0, count: 0, abn: null };
    existing.total += (c.value || 0);
    existing.count += 1;
    existing.abn = c.supplier_abn || existing.abn;
    supplierTotals.set(c.supplier_name, existing);
  }

  const incumbents = [...supplierTotals.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const market = ((marketRes.data || []) as Array<{
    total_contracts: number; total_value: number; unique_suppliers: number;
    unique_buyers: number; earliest_year: number; latest_year: number;
  }>)[0] || null;

  return NextResponse.json({
    keywords,
    state: state || null,
    generatedAt: new Date().toISOString(),
    market,
    incumbents,
    recentContracts: contracts.slice(0, 10),
    entities: (entitiesRes.data || []) as Array<{
      gs_id: string; canonical_name: string; abn: string | null;
      entity_type: string; state: string; sector: string;
      is_community_controlled: boolean; seifa_irsd_decile: number | null;
    }>,
    almaEvidence: (almaRes.data || []) as Array<{
      name: string; type: string; evidence_level: string;
      geography: string; portfolio_score: number | null;
    }>,
  });
}

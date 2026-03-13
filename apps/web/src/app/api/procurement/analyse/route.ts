import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';

/**
 * POST /api/procurement/analyse
 *
 * Procurement compliance analysis. Submit a list of supplier ABNs,
 * get back social impact breakdown: Indigenous %, social enterprise %,
 * community-controlled %, spend by remoteness and disadvantage.
 *
 * Body: { abns: string[], values?: Record<string, number> }
 *   abns   — array of ABN strings (11-digit)
 *   values — optional map of ABN → contract value for spend-weighted analysis
 *
 * Also accepts GET with ?abns=12345678901,98765432101 for quick lookups.
 */
export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;

  const body = await request.json();
  const abns: string[] = body.abns || [];
  const values: Record<string, number> = body.values || {};

  if (!abns.length) {
    return NextResponse.json({ error: 'Provide at least one ABN in the "abns" array' }, { status: 400 });
  }

  if (abns.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 ABNs per request' }, { status: 400 });
  }

  return analyseAbns(abns, values);
}

export async function GET(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;

  const abnParam = request.nextUrl.searchParams.get('abns') || '';
  const abns = abnParam.split(',').map(a => a.trim()).filter(a => /^\d{11}$/.test(a));

  if (!abns.length) {
    return NextResponse.json({ error: 'Provide ABNs as comma-separated query param: ?abns=12345678901,98765432101' }, { status: 400 });
  }

  return analyseAbns(abns, {});
}

async function analyseAbns(abns: string[], values: Record<string, number>) {
  const supabase = getServiceSupabase();
  const cleanAbns = [...new Set(abns.map(a => a.replace(/\s/g, '')).filter(a => /^\d{11}$/.test(a)))];

  // Parallel lookups
  const [entitiesResult, seResult] = await Promise.all([
    // Entity graph lookup
    supabase
      .from('gs_entities')
      .select('abn, canonical_name, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, sector')
      .in('abn', cleanAbns),
    // Social enterprise lookup
    supabase
      .from('social_enterprises')
      .select('abn, name, source_primary, certifications, sector, target_beneficiaries, org_type')
      .in('abn', cleanAbns)
      .not('abn', 'is', null),
  ]);

  const entities = entitiesResult.data || [];
  const socialEnterprises = seResult.data || [];

  const entityMap = new Map(entities.map(e => [e.abn, e]));
  const seMap = new Map(socialEnterprises.map(se => [se.abn, se]));

  // Build supplier analysis
  const suppliers = cleanAbns.map(abn => {
    const entity = entityMap.get(abn);
    const se = seMap.get(abn);
    const value = values[abn] || 0;

    const isIndigenous = entity?.entity_type === 'indigenous_corp' ||
      se?.source_primary === 'supply-nation' ||
      se?.source_primary === 'oric' ||
      se?.source_primary === 'kinaway';

    const isSocialEnterprise = !!se;
    const isCommunityControlled = entity?.is_community_controlled || false;
    const isCharity = entity?.entity_type === 'charity';

    return {
      abn,
      name: entity?.canonical_name || se?.name || null,
      matched: !!(entity || se),
      is_indigenous: isIndigenous,
      is_social_enterprise: isSocialEnterprise,
      is_community_controlled: isCommunityControlled,
      is_charity: isCharity,
      entity_type: entity?.entity_type || null,
      state: entity?.state || null,
      postcode: entity?.postcode || null,
      remoteness: entity?.remoteness || null,
      seifa_irsd_decile: entity?.seifa_irsd_decile || null,
      lga: entity?.lga_name || null,
      certifications: se?.certifications || null,
      source: se?.source_primary || null,
      contract_value: value || null,
    };
  });

  // Aggregate stats
  const matched = suppliers.filter(s => s.matched);
  const totalValue = Object.values(values).reduce((sum, v) => sum + v, 0);

  const indigenousSuppliers = suppliers.filter(s => s.is_indigenous);
  const seSuppliers = suppliers.filter(s => s.is_social_enterprise);
  const ccSuppliers = suppliers.filter(s => s.is_community_controlled);
  const charitySuppliers = suppliers.filter(s => s.is_charity);

  const indigenousValue = indigenousSuppliers.reduce((sum, s) => sum + (s.contract_value || 0), 0);
  const seValue = seSuppliers.reduce((sum, s) => sum + (s.contract_value || 0), 0);
  const ccValue = ccSuppliers.reduce((sum, s) => sum + (s.contract_value || 0), 0);

  // Remoteness breakdown
  const byRemoteness: Record<string, { count: number; value: number }> = {};
  for (const s of matched) {
    const r = s.remoteness || 'Unknown';
    if (!byRemoteness[r]) byRemoteness[r] = { count: 0, value: 0 };
    byRemoteness[r].count++;
    byRemoteness[r].value += s.contract_value || 0;
  }

  // State breakdown
  const byState: Record<string, { count: number; value: number }> = {};
  for (const s of matched) {
    const st = s.state || 'Unknown';
    if (!byState[st]) byState[st] = { count: 0, value: 0 };
    byState[st].count++;
    byState[st].value += s.contract_value || 0;
  }

  // Disadvantage breakdown (SEIFA quintiles)
  const byDisadvantage = {
    most_disadvantaged: { count: 0, value: 0, label: 'SEIFA Decile 1-2 (Most Disadvantaged)' },
    disadvantaged: { count: 0, value: 0, label: 'SEIFA Decile 3-4' },
    middle: { count: 0, value: 0, label: 'SEIFA Decile 5-6' },
    advantaged: { count: 0, value: 0, label: 'SEIFA Decile 7-8' },
    most_advantaged: { count: 0, value: 0, label: 'SEIFA Decile 9-10 (Most Advantaged)' },
    unknown: { count: 0, value: 0, label: 'Unknown' },
  };

  for (const s of matched) {
    const d = s.seifa_irsd_decile;
    const v = s.contract_value || 0;
    if (!d) { byDisadvantage.unknown.count++; byDisadvantage.unknown.value += v; }
    else if (d <= 2) { byDisadvantage.most_disadvantaged.count++; byDisadvantage.most_disadvantaged.value += v; }
    else if (d <= 4) { byDisadvantage.disadvantaged.count++; byDisadvantage.disadvantaged.value += v; }
    else if (d <= 6) { byDisadvantage.middle.count++; byDisadvantage.middle.value += v; }
    else if (d <= 8) { byDisadvantage.advantaged.count++; byDisadvantage.advantaged.value += v; }
    else { byDisadvantage.most_advantaged.count++; byDisadvantage.most_advantaged.value += v; }
  }

  const summary = {
    total_suppliers: cleanAbns.length,
    matched_suppliers: matched.length,
    match_rate: matched.length / cleanAbns.length,

    indigenous: {
      count: indigenousSuppliers.length,
      percentage: cleanAbns.length > 0 ? indigenousSuppliers.length / cleanAbns.length : 0,
      value: indigenousValue,
      value_percentage: totalValue > 0 ? indigenousValue / totalValue : 0,
    },

    social_enterprise: {
      count: seSuppliers.length,
      percentage: cleanAbns.length > 0 ? seSuppliers.length / cleanAbns.length : 0,
      value: seValue,
      value_percentage: totalValue > 0 ? seValue / totalValue : 0,
    },

    community_controlled: {
      count: ccSuppliers.length,
      percentage: cleanAbns.length > 0 ? ccSuppliers.length / cleanAbns.length : 0,
      value: ccValue,
      value_percentage: totalValue > 0 ? ccValue / totalValue : 0,
    },

    charity: {
      count: charitySuppliers.length,
      percentage: cleanAbns.length > 0 ? charitySuppliers.length / cleanAbns.length : 0,
    },

    by_remoteness: byRemoteness,
    by_state: byState,
    by_disadvantage: byDisadvantage,

    total_contract_value: totalValue || null,
  };

  return NextResponse.json({
    summary,
    suppliers,
    meta: {
      abns_submitted: cleanAbns.length,
      data_sources: ['gs_entities (99K entities)', 'social_enterprises (10K+)', 'postcode_geo', 'seifa_2021'],
      generated_at: new Date().toISOString(),
    },
  });
}

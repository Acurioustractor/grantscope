import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { logUsage } from '../_lib/log-usage';

/** Escape SQL LIKE wildcards in user input */
function sanitizeLike(s: string) {
  return s.replace(/[%_\\]/g, c => `\\${c}`);
}

/**
 * POST /api/tender-intelligence/pack
 *
 * Generate a full Tender Intelligence Pack — combines supplier discovery,
 * enrichment, compliance scoring, and gap analysis into one structured output.
 *
 * Input: geography + category + optional supplier list
 * Output: complete pack with 5 sections
 */

interface PackRequest {
  state?: string;
  postcode?: string;
  lga?: string;
  category?: string;
  remoteness?: string;
  supplier_types?: string[];
  existing_suppliers?: Array<{ name: string; abn?: string; contract_value?: number }>;
  total_contract_value?: number;
}

export async function POST(request: NextRequest) {
  const authSupabase = await createSupabaseServer();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json() as PackRequest;
  const supabase = getServiceSupabase();

  const {
    state,
    postcode,
    lga,
    category,
    remoteness,
    supplier_types = ['indigenous_corp', 'social_enterprise', 'charity', 'company'],
    existing_suppliers = [],
    total_contract_value,
  } = body;

  // ── Section 1: Market Capability Overview ──
  let entityQuery = supabase
    .from('gs_entities')
    .select('gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, latest_revenue, sector')
    .in('entity_type', supplier_types)
    .order('latest_revenue', { ascending: false, nullsFirst: false })
    .limit(200);

  if (state && typeof state === 'string') entityQuery = entityQuery.eq('state', state.slice(0, 10));
  if (postcode && typeof postcode === 'string') entityQuery = entityQuery.eq('postcode', postcode.slice(0, 10));
  if (lga && typeof lga === 'string') entityQuery = entityQuery.ilike('lga_name', `%${sanitizeLike(lga.slice(0, 100))}%`);
  if (remoteness && typeof remoteness === 'string') entityQuery = entityQuery.eq('remoteness', remoteness);

  const { data: entities } = await entityQuery;
  const allEntities = entities || [];

  // Get contract counts for all discovered entities
  const abns = allEntities.filter(e => e.abn).map(e => e.abn!);
  const contractMap: Record<string, { count: number; total_value: number; categories: string[] }> = {};

  if (abns.length > 0) {
    // Batch in chunks of 100
    for (let i = 0; i < abns.length; i += 100) {
      const batch = abns.slice(i, i + 100);
      const { data: contracts } = await supabase
        .from('austender_contracts')
        .select('supplier_abn, contract_value, category')
        .in('supplier_abn', batch);

      if (contracts) {
        for (const c of contracts) {
          if (!c.supplier_abn) continue;
          if (!contractMap[c.supplier_abn]) {
            contractMap[c.supplier_abn] = { count: 0, total_value: 0, categories: [] };
          }
          contractMap[c.supplier_abn].count++;
          contractMap[c.supplier_abn].total_value += c.contract_value || 0;
          if (c.category && !contractMap[c.supplier_abn].categories.includes(c.category)) {
            contractMap[c.supplier_abn].categories.push(c.category);
          }
        }
      }
    }
  }

  const marketOverview = {
    suppliers_identified: allEntities.length,
    indigenous_businesses: allEntities.filter(e => e.entity_type === 'indigenous_corp').length,
    social_enterprises: allEntities.filter(e => e.entity_type === 'social_enterprise').length,
    community_controlled: allEntities.filter(e => e.is_community_controlled).length,
    charities: allEntities.filter(e => e.entity_type === 'charity').length,
    with_federal_contracts: allEntities.filter(e => e.abn && contractMap[e.abn]).length,
    total_contract_value: Object.values(contractMap).reduce((sum, c) => sum + c.total_value, 0),
  };

  // ── Section 2: Compliance Analysis (if existing suppliers provided) ──
  let complianceAnalysis = null;
  if (existing_suppliers.length > 0) {
    // Bulk resolve: ABNs in one query, names in parallel batches
    const abnSuppliers = existing_suppliers.filter(s => s.abn);
    const abnEntityMap = new Map<string, { entity_type: string; is_community_controlled: boolean; remoteness: string | null; latest_revenue: number | null }>();

    if (abnSuppliers.length > 0) {
      const abns = abnSuppliers.map(s => s.abn!.replace(/\s/g, '').slice(0, 11));
      for (let i = 0; i < abns.length; i += 100) {
        const batch = abns.slice(i, i + 100);
        const { data } = await supabase
          .from('gs_entities')
          .select('abn, entity_type, is_community_controlled, remoteness, latest_revenue')
          .in('abn', batch);
        if (data) {
          for (const row of data) {
            if (row.abn) abnEntityMap.set(row.abn, row);
          }
        }
      }
    }

    const nameOnlySuppliers = existing_suppliers.filter(s => {
      if (s.abn) return !abnEntityMap.has(s.abn.replace(/\s/g, '').slice(0, 11));
      return !!s.name;
    });
    const nameEntityMap = new Map<string, { entity_type: string; is_community_controlled: boolean; remoteness: string | null; latest_revenue: number | null }>();

    if (nameOnlySuppliers.length > 0) {
      const BATCH = 10;
      for (let i = 0; i < nameOnlySuppliers.length; i += BATCH) {
        const batch = nameOnlySuppliers.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(s =>
            supabase
              .from('gs_entities')
              .select('entity_type, is_community_controlled, remoteness, latest_revenue')
              .ilike('canonical_name', `%${sanitizeLike((s.name || '').slice(0, 200))}%`)
              .limit(1)
              .single()
              .then(({ data }) => ({ name: s.name, entity: data }))
          )
        );
        for (const r of results) {
          if (r.entity) nameEntityMap.set(r.name, r.entity);
        }
      }
    }

    const resolved = existing_suppliers.map(s => {
      let entity = null;
      if (s.abn) {
        entity = abnEntityMap.get(s.abn.replace(/\s/g, '').slice(0, 11)) || null;
      }
      if (!entity && s.name) {
        entity = nameEntityMap.get(s.name) || null;
      }
      return { ...s, entity };
    });

    const totalVal = total_contract_value || resolved.reduce((sum, r) => sum + (r.contract_value || 0), 0) || 1;
    const indCount = resolved.filter(r => r.entity?.entity_type === 'indigenous_corp').length;
    const seCount = resolved.filter(r => r.entity?.entity_type === 'social_enterprise').length;
    const regionalCount = resolved.filter(r => r.entity?.remoteness && r.entity.remoteness !== 'Major Cities of Australia').length;

    const indVal = resolved.filter(r => r.entity?.entity_type === 'indigenous_corp').reduce((s, r) => s + (r.contract_value || 0), 0);

    complianceAnalysis = {
      indigenous: {
        count: indCount,
        pct: +(indCount / Math.max(existing_suppliers.length, 1) * 100).toFixed(1),
        value: indVal,
        pct_value: +(indVal / totalVal * 100).toFixed(1),
        target: 3.0,
        meets_target: (indVal / totalVal * 100) >= 3.0,
        shortfall_value: Math.max(0, (0.03 * totalVal) - indVal),
      },
      social_enterprise: {
        count: seCount,
        pct: +(seCount / Math.max(existing_suppliers.length, 1) * 100).toFixed(1),
      },
      regional: {
        count: regionalCount,
        pct: +(regionalCount / Math.max(existing_suppliers.length, 1) * 100).toFixed(1),
      },
      total_suppliers: existing_suppliers.length,
      total_resolved: resolved.filter(r => r.entity).length,
    };
  }

  // ── Section 3: Supplier Shortlist (top 20) ──
  const supplierShortlist = allEntities
    .map(e => ({
      gs_id: e.gs_id,
      name: e.canonical_name,
      abn: e.abn,
      entity_type: e.entity_type,
      state: e.state,
      postcode: e.postcode,
      remoteness: e.remoteness,
      seifa_decile: e.seifa_irsd_decile,
      is_community_controlled: e.is_community_controlled,
      lga: e.lga_name,
      revenue: e.latest_revenue,
      contracts: contractMap[e.abn || ''] || { count: 0, total_value: 0 },
    }))
    .sort((a, b) => b.contracts.count - a.contracts.count || (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 20);

  // ── Section 4: Bid Strength Analysis ──
  const bidStrength = {
    total_capable_suppliers: allEntities.length,
    suppliers_with_contract_history: Object.keys(contractMap).length,
    indigenous_capable: allEntities.filter(e => e.entity_type === 'indigenous_corp').length,
    se_capable: allEntities.filter(e => e.entity_type === 'social_enterprise').length,
    insights: [] as string[],
  };

  if (bidStrength.indigenous_capable > 0) {
    bidStrength.insights.push(
      `${bidStrength.indigenous_capable} Indigenous businesses identified in ${state || 'the target region'} — adding ${Math.min(3, bidStrength.indigenous_capable)} would strengthen Indigenous procurement compliance.`
    );
  }
  if (bidStrength.se_capable > 0) {
    bidStrength.insights.push(
      `${bidStrength.se_capable} social enterprises operate in the region — potential for social procurement targets.`
    );
  }
  if (complianceAnalysis && !complianceAnalysis.indigenous.meets_target) {
    const shortfall = complianceAnalysis.indigenous.shortfall_value;
    bidStrength.insights.push(
      `Current Indigenous participation is ${complianceAnalysis.indigenous.pct_value}% — ${shortfall > 0 ? `$${Math.round(shortfall).toLocaleString()} shortfall against 3% target` : 'below 3% target'}.`
    );
  }

  // ── Section 5: Recommended Partners ──
  const recommended = allEntities
    .filter(e => e.entity_type === 'indigenous_corp' || e.entity_type === 'social_enterprise' || e.is_community_controlled)
    .map(e => ({
      gs_id: e.gs_id,
      name: e.canonical_name,
      abn: e.abn,
      entity_type: e.entity_type,
      state: e.state,
      remoteness: e.remoteness,
      is_community_controlled: e.is_community_controlled,
      contracts: contractMap[e.abn || ''] || { count: 0, total_value: 0 },
      revenue: e.latest_revenue,
    }))
    .sort((a, b) => b.contracts.count - a.contracts.count || (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 10);

  logUsage({ user_id: user.id, endpoint: 'pack', filters: { state, lga, postcode, remoteness }, result_count: allEntities.length });

  return NextResponse.json({
    pack: {
      generated_at: new Date().toISOString(),
      filters: { state, postcode, lga, category, remoteness, supplier_types },
      sections: {
        market_overview: marketOverview,
        compliance_analysis: complianceAnalysis,
        supplier_shortlist: supplierShortlist,
        bid_strength: bidStrength,
        recommended_partners: recommended,
      },
    },
  });
}

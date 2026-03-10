import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { logUsage } from '../_lib/log-usage';

/**
 * POST /api/tender-intelligence/compliance
 *
 * Procurement compliance scoring — calculates Indigenous participation,
 * social enterprise %, SME %, and regional supplier % for a supplier list.
 *
 * Bulk-resolves suppliers in 2-3 queries instead of N+1.
 */

interface SupplierInput {
  name?: string;
  abn?: string;
  contract_value?: number;
}

const TARGETS = {
  indigenous_pct: 3.0,      // Commonwealth Indigenous Procurement Policy target
  social_enterprise_pct: 5.0, // Aspirational social procurement target
  sme_pct: 35.0,            // SME participation target
  regional_pct: 20.0,       // Regional supplier target
};

const ENTITY_FIELDS = 'gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, latest_revenue';

/** Escape SQL LIKE wildcards in user input */
function sanitizeLike(s: string) {
  return s.replace(/[%_\\]/g, c => `\\${c}`);
}

type EntityRow = { gs_id: string; canonical_name: string; abn: string | null; entity_type: string; state: string | null; postcode: string | null; remoteness: string | null; seifa_irsd_decile: number | null; is_community_controlled: boolean; lga_name: string | null; latest_revenue: number | null };

export async function POST(request: NextRequest) {
  const authSupabase = await createSupabaseServer();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const {
    suppliers: inputSuppliers,
    total_contract_value,
    state,
  } = body as {
    suppliers: SupplierInput[];
    total_contract_value?: number;
    state?: string;
    category?: string;
  };

  if (!inputSuppliers || !Array.isArray(inputSuppliers) || inputSuppliers.length === 0) {
    return NextResponse.json({ error: 'suppliers array is required' }, { status: 400 });
  }

  if (inputSuppliers.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 suppliers per request' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // ── Step 1: Bulk resolve by ABN ──
  const abnInputs = inputSuppliers.filter(s => s.abn);
  const abnMap = new Map<string, EntityRow>();

  if (abnInputs.length > 0) {
    const abns = abnInputs.map(s => s.abn!.replace(/\s/g, '').slice(0, 11));
    for (let i = 0; i < abns.length; i += 100) {
      const batch = abns.slice(i, i + 100);
      const { data } = await supabase
        .from('gs_entities')
        .select(ENTITY_FIELDS)
        .in('abn', batch);
      if (data) {
        for (const row of data) {
          if (row.abn) abnMap.set(row.abn, row);
        }
      }
    }
  }

  // ── Step 2: Name-only resolution (parallel batches of 10) ──
  const nameOnlyInputs = inputSuppliers.filter(s => {
    if (s.abn) {
      const clean = s.abn.replace(/\s/g, '').slice(0, 11);
      if (abnMap.has(clean)) return false;
    }
    return !!s.name;
  });

  const nameMap = new Map<string, EntityRow>();
  if (nameOnlyInputs.length > 0) {
    const BATCH = 10;
    for (let i = 0; i < nameOnlyInputs.length; i += BATCH) {
      const batch = nameOnlyInputs.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(input =>
          supabase
            .from('gs_entities')
            .select(ENTITY_FIELDS)
            .ilike('canonical_name', `%${sanitizeLike((input.name || '').slice(0, 200))}%`)
            .limit(1)
            .single()
            .then(({ data }) => ({ name: input.name!, entity: data }))
        )
      );
      for (const r of results) {
        if (r.entity) nameMap.set(r.name, r.entity);
      }
    }
  }

  // ── Step 3: Build resolved list ──
  function getEntity(input: SupplierInput): EntityRow | null {
    if (input.abn) {
      const clean = input.abn.replace(/\s/g, '').slice(0, 11);
      const byAbn = abnMap.get(clean);
      if (byAbn) return byAbn;
    }
    if (input.name) {
      const byName = nameMap.get(input.name);
      if (byName) return byName;
    }
    return null;
  }

  const resolved = inputSuppliers.map(input => ({
    ...input,
    entity: getEntity(input),
    value: input.contract_value || 0,
  }));

  const totalValue = total_contract_value || resolved.reduce((sum, r) => sum + r.value, 0) || 1;
  const resolvedEntities = resolved.filter(r => r.entity);

  // ── Step 4: Calculate compliance metrics ──
  const indigenous = resolvedEntities.filter(r => r.entity!.entity_type === 'indigenous_corp');
  const socialEnterprise = resolvedEntities.filter(r => r.entity!.entity_type === 'social_enterprise');
  const sme = resolvedEntities.filter(r => (r.entity!.latest_revenue || 0) < 10_000_000);
  const regional = resolvedEntities.filter(r =>
    r.entity!.remoteness && r.entity!.remoteness !== 'Major Cities of Australia'
  );
  const communityControlled = resolvedEntities.filter(r => r.entity!.is_community_controlled);

  const indigenousValue = indigenous.reduce((sum, r) => sum + r.value, 0);
  const seValue = socialEnterprise.reduce((sum, r) => sum + r.value, 0);
  const smeValue = sme.reduce((sum, r) => sum + r.value, 0);
  const regionalValue = regional.reduce((sum, r) => sum + r.value, 0);

  const metrics = {
    indigenous: {
      count: indigenous.length,
      pct_count: +(indigenous.length / Math.max(inputSuppliers.length, 1) * 100).toFixed(1),
      value: indigenousValue,
      pct_value: +(indigenousValue / totalValue * 100).toFixed(1),
      target: TARGETS.indigenous_pct,
      meets_target: (indigenousValue / totalValue * 100) >= TARGETS.indigenous_pct,
      shortfall_value: Math.max(0, (TARGETS.indigenous_pct / 100 * totalValue) - indigenousValue),
    },
    social_enterprise: {
      count: socialEnterprise.length,
      pct_count: +(socialEnterprise.length / Math.max(inputSuppliers.length, 1) * 100).toFixed(1),
      value: seValue,
      pct_value: +(seValue / totalValue * 100).toFixed(1),
      target: TARGETS.social_enterprise_pct,
      meets_target: (seValue / totalValue * 100) >= TARGETS.social_enterprise_pct,
    },
    sme: {
      count: sme.length,
      pct_count: +(sme.length / Math.max(inputSuppliers.length, 1) * 100).toFixed(1),
      value: smeValue,
      pct_value: +(smeValue / totalValue * 100).toFixed(1),
      target: TARGETS.sme_pct,
      meets_target: (smeValue / totalValue * 100) >= TARGETS.sme_pct,
    },
    regional: {
      count: regional.length,
      pct_count: +(regional.length / Math.max(inputSuppliers.length, 1) * 100).toFixed(1),
      value: regionalValue,
      pct_value: +(regionalValue / totalValue * 100).toFixed(1),
      target: TARGETS.regional_pct,
      meets_target: (regionalValue / totalValue * 100) >= TARGETS.regional_pct,
    },
    community_controlled: {
      count: communityControlled.length,
      pct_count: +(communityControlled.length / Math.max(inputSuppliers.length, 1) * 100).toFixed(1),
    },
  };

  // ── Step 5: Recommend suppliers to close gaps ──
  let recommendations: Array<{
    canonical_name: string;
    gs_id: string;
    abn: string | null;
    entity_type: string;
    state: string | null;
    remoteness: string | null;
    gap_type: string;
  }> = [];

  const recPromises: Promise<void>[] = [];

  if (!metrics.indigenous.meets_target) {
    recPromises.push((async () => {
      let recQuery = supabase
        .from('gs_entities')
        .select('gs_id, canonical_name, abn, entity_type, state, remoteness, latest_revenue')
        .eq('entity_type', 'indigenous_corp')
        .order('latest_revenue', { ascending: false, nullsFirst: false })
        .limit(10);
      if (state && typeof state === 'string') recQuery = recQuery.eq('state', state.slice(0, 10));
      const { data: recs } = await recQuery;
      if (recs) {
        recommendations.push(...recs.map(r => ({ ...r, gap_type: 'indigenous' })));
      }
    })());
  }

  if (!metrics.social_enterprise.meets_target) {
    recPromises.push((async () => {
      let recQuery = supabase
        .from('gs_entities')
        .select('gs_id, canonical_name, abn, entity_type, state, remoteness, latest_revenue')
        .eq('entity_type', 'social_enterprise')
        .order('latest_revenue', { ascending: false, nullsFirst: false })
        .limit(10);
      if (state && typeof state === 'string') recQuery = recQuery.eq('state', state.slice(0, 10));
      const { data: recs } = await recQuery;
      if (recs) {
        recommendations.push(...recs.map(r => ({ ...r, gap_type: 'social_enterprise' })));
      }
    })());
  }

  await Promise.all(recPromises);

  // Overall compliance score (0-100)
  const scores = [
    metrics.indigenous.meets_target ? 25 : (metrics.indigenous.pct_value / TARGETS.indigenous_pct) * 25,
    metrics.social_enterprise.meets_target ? 25 : (metrics.social_enterprise.pct_value / TARGETS.social_enterprise_pct) * 25,
    metrics.sme.meets_target ? 25 : (metrics.sme.pct_value / TARGETS.sme_pct) * 25,
    metrics.regional.meets_target ? 25 : (metrics.regional.pct_value / TARGETS.regional_pct) * 25,
  ];
  const complianceScore = Math.min(100, Math.round(scores.reduce((a, b) => a + b, 0)));

  logUsage({ user_id: user.id, endpoint: 'compliance', filters: { state, supplier_count: inputSuppliers.length }, result_count: resolvedEntities.length });

  return NextResponse.json({
    compliance_score: complianceScore,
    metrics,
    recommendations: recommendations.slice(0, 15),
    summary: {
      total_suppliers: inputSuppliers.length,
      resolved: resolvedEntities.length,
      total_contract_value: totalValue,
      targets: TARGETS,
    },
  });
}

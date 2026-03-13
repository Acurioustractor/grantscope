import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';
import { logUsage } from '../_lib/log-usage';
import { logProcurementWorkflowRun } from '../_lib/procurement-workspace';

/**
 * POST /api/tender-intelligence/enrich
 *
 * Supplier list enrichment — upload a list of supplier names/ABNs,
 * get back enriched data with entity type, contracts, compliance metadata.
 *
 * Bulk-resolves in 2-3 queries instead of N+1.
 */

interface SupplierInput {
  name: string;
  abn?: string;
  region?: string;
  category?: string;
}

const ENTITY_FIELDS = 'gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, latest_revenue, sector';

/** Escape SQL LIKE wildcards in user input */
function sanitizeLike(s: string) {
  return s.replace(/[%_\\]/g, c => `\\${c}`);
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const { suppliers: inputSuppliers, shortlist_id } = body as { suppliers: SupplierInput[]; shortlist_id?: string };

  if (!inputSuppliers || !Array.isArray(inputSuppliers) || inputSuppliers.length === 0) {
    return NextResponse.json({ error: 'suppliers array is required' }, { status: 400 });
  }

  if (inputSuppliers.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 suppliers per request' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const startedAt = new Date().toISOString();

  // ── Step 1: Bulk resolve by ABN (single query) ──
  const abnInputs = inputSuppliers
    .filter(s => s.abn)
    .map(s => ({ ...s, cleanAbn: s.abn!.replace(/\s/g, '').slice(0, 11) }));

  const abnMap = new Map<string, typeof abnByAbnResult[0]>();
  type EntityRow = { gs_id: string; canonical_name: string; abn: string | null; entity_type: string; state: string | null; postcode: string | null; remoteness: string | null; seifa_irsd_decile: number | null; is_community_controlled: boolean; lga_name: string | null; latest_revenue: number | null; sector: string | null };
  let abnByAbnResult: EntityRow[] = [];

  if (abnInputs.length > 0) {
    const abns = abnInputs.map(s => s.cleanAbn);
    // Batch in chunks of 100 for Supabase .in() limit
    for (let i = 0; i < abns.length; i += 100) {
      const batch = abns.slice(i, i + 100);
      const { data } = await supabase
        .from('gs_entities')
        .select(ENTITY_FIELDS)
        .in('abn', batch);
      if (data) abnByAbnResult.push(...data);
    }
    for (const row of abnByAbnResult) {
      if (row.abn) abnMap.set(row.abn, row);
    }
  }

  // ── Step 2: Name-only suppliers — batch with OR filter ──
  // For suppliers without ABN or whose ABN didn't resolve, try name match
  const nameOnlyInputs = inputSuppliers.filter(s => {
    if (s.abn) {
      const clean = s.abn.replace(/\s/g, '').slice(0, 11);
      if (abnMap.has(clean)) return false; // already resolved
    }
    return !!s.name;
  });

  const nameMap = new Map<string, EntityRow>();
  if (nameOnlyInputs.length > 0) {
    // Query each name individually but cap at reasonable batch
    // Supabase PostgREST doesn't support OR on ilike efficiently in bulk,
    // so we batch 10 at a time with Promise.all
    const BATCH = 10;
    for (let i = 0; i < nameOnlyInputs.length; i += BATCH) {
      const batch = nameOnlyInputs.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(input =>
          supabase
            .from('gs_entities')
            .select(ENTITY_FIELDS)
            .ilike('canonical_name', `%${sanitizeLike(input.name.slice(0, 200))}%`)
            .limit(1)
            .single()
            .then(({ data }) => ({ name: input.name, entity: data }))
        )
      );
      for (const r of results) {
        if (r.entity) nameMap.set(r.name, r.entity);
      }
    }
  }

  // ── Step 3: Bulk fetch contract history (single query) ──
  const resolvedAbns: string[] = [];
  for (const input of inputSuppliers) {
    const entity = getEntity(input);
    if (entity?.abn) resolvedAbns.push(entity.abn);
  }

  const contractMap: Record<string, { count: number; total_value: number }> = {};
  if (resolvedAbns.length > 0) {
    for (let i = 0; i < resolvedAbns.length; i += 100) {
      const batch = resolvedAbns.slice(i, i + 100);
      const { data: contracts } = await supabase
        .from('austender_contracts')
        .select('supplier_abn, contract_value')
        .in('supplier_abn', batch);

      if (contracts) {
        for (const c of contracts) {
          if (!c.supplier_abn) continue;
          if (!contractMap[c.supplier_abn]) {
            contractMap[c.supplier_abn] = { count: 0, total_value: 0 };
          }
          contractMap[c.supplier_abn].count++;
          contractMap[c.supplier_abn].total_value += c.contract_value || 0;
        }
      }
    }
  }

  // ── Step 4: Assemble results ──
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

  const enriched = inputSuppliers.map(input => {
    const entity = getEntity(input);
    const contracts = entity?.abn ? (contractMap[entity.abn] || { count: 0, total_value: 0 }) : { count: 0, total_value: 0 };

    return {
      input: { name: input.name, abn: input.abn },
      resolved: !!entity,
      entity: entity ? {
        gs_id: entity.gs_id,
        canonical_name: entity.canonical_name,
        abn: entity.abn,
        entity_type: entity.entity_type,
        state: entity.state,
        postcode: entity.postcode,
        remoteness: entity.remoteness,
        seifa_irsd_decile: entity.seifa_irsd_decile,
        is_community_controlled: entity.is_community_controlled,
        lga_name: entity.lga_name,
        latest_revenue: entity.latest_revenue,
        sector: entity.sector,
      } : null,
      contracts,
    };
  });

  // Calculate summary
  const resolved = enriched.filter(e => e.resolved);
  const summary = {
    total_input: inputSuppliers.length,
    resolved: resolved.length,
    unresolved: inputSuppliers.length - resolved.length,
    resolution_rate: +(resolved.length / inputSuppliers.length * 100).toFixed(1),
    indigenous: resolved.filter(e => e.entity?.entity_type === 'indigenous_corp').length,
    social_enterprise: resolved.filter(e => e.entity?.entity_type === 'social_enterprise').length,
    community_controlled: resolved.filter(e => e.entity?.is_community_controlled).length,
    with_contracts: resolved.filter(e => e.contracts.count > 0).length,
  };

  logUsage({ user_id: user.id, endpoint: 'enrich', filters: { supplier_count: inputSuppliers.length }, result_count: summary.resolved });
  await logProcurementWorkflowRun(supabase, {
    userId: user.id,
    workflowType: 'enrich',
    workflowStatus: 'completed',
    shortlistId: shortlist_id,
    inputPayload: { supplier_count: inputSuppliers.length },
    outputSummary: {
      resolved: summary.resolved,
      unresolved: summary.unresolved,
      with_contracts: summary.with_contracts,
    },
    recordsScanned: inputSuppliers.length,
    recordsChanged: summary.resolved,
    startedAt,
  });

  return NextResponse.json({ enriched, summary });
}

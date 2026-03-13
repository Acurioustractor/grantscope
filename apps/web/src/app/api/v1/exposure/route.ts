import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { hasModule } from '@/lib/subscription';

/**
 * Enterprise Exposure API — /api/v1/exposure
 *
 * Full entity dossier: entity profile, contracts, political donations,
 * financial transparency, and cross-references. Authenticated via API key.
 *
 * Query params:
 *   abn=12345678901           Single entity by ABN
 *   gs_id=GS-XXXXX            Single entity by GS ID
 *   abns=abn1,abn2,...         Batch lookup (max 50)
 *   include=contracts,donations,financials,relationships,interventions  (default: all)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (auth.error) return auth.error;

  if (!hasModule(auth.tier, 'api')) {
    return NextResponse.json(
      { error: 'API access requires Funder tier or above', upgrade_url: '/pricing' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const abn = searchParams.get('abn');
  const gsId = searchParams.get('gs_id');
  const abns = searchParams.get('abns');
  const includeParam = searchParams.get('include');

  const sections = new Set(
    includeParam
      ? includeParam.split(',').map(s => s.trim())
      : ['contracts', 'donations', 'financials', 'relationships', 'interventions']
  );

  const db = getServiceSupabase();

  // Batch lookup
  if (abns) {
    const abnList = abns.split(',').map(a => a.trim()).filter(Boolean).slice(0, 50);
    if (!abnList.length) {
      return NextResponse.json({ error: 'No valid ABNs provided' }, { status: 400 });
    }

    const { data: entities } = await db
      .from('gs_entities')
      .select('gs_id, canonical_name, abn, entity_type, sector, state, postcode, remoteness, seifa_irsd_decile, lga_name, is_community_controlled')
      .in('abn', abnList);

    const results = await Promise.all(
      (entities || []).map(entity => buildDossier(db, entity, sections))
    );

    const found = new Set((entities || []).map(e => e.abn));
    const missing = abnList.filter(a => !found.has(a));

    return NextResponse.json({
      results,
      meta: {
        requested: abnList.length,
        found: results.length,
        missing,
        queried_at: new Date().toISOString(),
      },
    });
  }

  // Single lookup
  if (!abn && !gsId) {
    return NextResponse.json({
      error: 'Provide abn, gs_id, or abns parameter',
      usage: {
        single_abn: '/api/v1/exposure?abn=12345678901',
        single_gs_id: '/api/v1/exposure?gs_id=GS-XXXXX',
        batch: '/api/v1/exposure?abns=abn1,abn2,abn3',
        include: '/api/v1/exposure?abn=X&include=contracts,donations',
      },
      sections: ['contracts', 'donations', 'financials', 'relationships', 'interventions'],
    }, { status: 400 });
  }

  let entityQuery = db
    .from('gs_entities')
    .select('gs_id, canonical_name, abn, entity_type, sector, state, postcode, remoteness, seifa_irsd_decile, lga_name, is_community_controlled, website, description');

  if (abn) entityQuery = entityQuery.eq('abn', abn);
  else if (gsId) entityQuery = entityQuery.eq('gs_id', gsId);

  const { data: entity } = await entityQuery.single();

  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  const dossier = await buildDossier(db, entity, sections);

  return NextResponse.json({
    ...dossier,
    meta: { queried_at: new Date().toISOString() },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildDossier(db: any, entity: any, sections: Set<string>) {
  const dossier: Record<string, unknown> = { entity };

  // Get internal entity ID for relationship queries
  const { data: fullEntity } = await db
    .from('gs_entities')
    .select('id')
    .eq('gs_id', entity.gs_id)
    .single();

  const entityId = fullEntity?.id;

  const promises: Promise<void>[] = [];

  if (sections.has('contracts') && entity.abn) {
    promises.push(
      db
        .from('austender_contracts')
        .select('title, contract_value, buyer_name, contract_start, contract_end, category, procurement_method')
        .eq('supplier_abn', entity.abn)
        .order('contract_value', { ascending: false })
        .limit(100)
        .then(({ data }: { data: unknown }) => {
          dossier.contracts = data || [];
        })
    );
  }

  if (sections.has('donations') && entity.abn) {
    promises.push(
      db
        .from('political_donations')
        .select('donation_to, amount, financial_year, donor_type')
        .eq('donor_abn', entity.abn)
        .order('amount', { ascending: false })
        .limit(200)
        .then(({ data }: { data: unknown }) => {
          dossier.donations = data || [];
        })
    );
  }

  if (sections.has('financials') && entity.abn) {
    promises.push(
      db
        .from('ato_tax_transparency')
        .select('total_income, taxable_income, tax_payable, report_year')
        .eq('abn', entity.abn)
        .order('report_year', { ascending: false })
        .limit(10)
        .then(({ data }: { data: unknown }) => {
          dossier.financials = data || [];
        })
    );
  }

  if (sections.has('interventions') && entityId) {
    promises.push(
      db
        .from('alma_interventions')
        .select('id, name, type, description, evidence_level, cultural_authority, target_cohort, geography, operating_organization, years_operating, portfolio_score, review_status')
        .eq('gs_entity_id', entityId)
        .order('portfolio_score', { ascending: false, nullsFirst: false })
        .limit(50)
        .then(({ data }: { data: unknown }) => {
          dossier.interventions = data || [];
        })
    );
  }

  if (sections.has('relationships') && entityId) {
    promises.push(
      Promise.all([
        db
          .from('gs_relationships')
          .select('target_entity_id, relationship_type, amount, year, dataset')
          .eq('source_entity_id', entityId)
          .order('amount', { ascending: false, nullsFirst: false })
          .limit(100),
        db
          .from('gs_relationships')
          .select('source_entity_id, relationship_type, amount, year, dataset')
          .eq('target_entity_id', entityId)
          .order('amount', { ascending: false, nullsFirst: false })
          .limit(100),
      ]).then(([outbound, inbound]) => {
        dossier.relationships = {
          outbound: outbound.data || [],
          inbound: inbound.data || [],
        };
      })
    );
  }

  await Promise.all(promises);

  // Compute summary stats
  const contracts = dossier.contracts as { contract_value?: number }[] | undefined;
  const donations = dossier.donations as { amount?: number }[] | undefined;
  const interventions = dossier.interventions as unknown[] | undefined;

  if (contracts?.length || donations?.length || interventions?.length) {
    dossier.summary = {
      total_contract_value: contracts?.reduce((s, c) => s + (Number(c.contract_value) || 0), 0) ?? 0,
      contract_count: contracts?.length ?? 0,
      total_donated: donations?.reduce((s, d) => s + (Number(d.amount) || 0), 0) ?? 0,
      donation_count: donations?.length ?? 0,
      intervention_count: interventions?.length ?? 0,
    };
  }

  return dossier;
}

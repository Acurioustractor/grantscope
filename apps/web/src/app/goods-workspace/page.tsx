import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import GoodsWorkspaceClient, {
  type GoodsBuyerGhlContactRow,
  type GoodsBuyerGhlOpportunityRow,
  type GoodsCommunityRow,
  type GoodsCommunityPipelineRow,
  type GoodsGhlOpportunityRow,
  type GoodsGhlPipelineStageRow,
  type GoodsGhlSyncRow,
  type GoodsProcurementEntityRow,
  type GoodsProcurementSignalRow,
  type GoodsFoundationRow,
  type GoodsGrantRow,
  type NtCommunityCoverageRow,
} from './goods-workspace-client';

type OrgProfileSummary = {
  id: string;
  name: string | null;
  abn: string | null;
  subscription_plan: string | null;
} | null;

async function runSql<T>(query: string): Promise<T[]> {
  const db = getServiceSupabase();
  const { data, error } = await db.rpc('exec_sql', { query });
  if (error) {
    console.error('goods-workspace SQL failed:', error.message);
    return [];
  }
  return (data as T[]) || [];
}

export const dynamic = 'force-dynamic';

export default async function GoodsWorkspacePage() {
  const authDb = await createSupabaseServer();
  const {
    data: { user },
  } = await authDb.auth.getUser();

  if (!user) {
    redirect('/login?next=%2Fgoods-workspace');
  }

  const db = getServiceSupabase();

  const { data: orgProfile } = await db
    .from('org_profiles')
    .select('id, name, abn, subscription_plan')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: communitiesData } = await db
    .from('goods_communities')
    .select(`
      id, community_name, state, postcode, lga_name, region_label, service_region, land_council,
      remoteness, latitude, longitude, priority, signal_type, signal_source,
      demand_beds, demand_washers, demand_fridges, demand_mattresses,
      assets_deployed, assets_active, assets_overdue, latest_checkin_date,
      known_buyer_name, buyer_entity_count, store_count, health_service_count, housing_org_count,
      council_count, community_controlled_org_count, total_local_entities,
      total_govt_contract_value, total_justice_funding, total_foundation_grants, ndis_provider_count,
      ndis_thin_market, proof_line, story, youth_employment_angle, data_quality_score, updated_at
    `)
    .in('state', ['NT', 'QLD'])
    .order('state', { ascending: true })
    .order('community_name', { ascending: true })
    .limit(2500);

  const { data: buyersData } = await db
    .from('goods_procurement_entities')
    .select(`
      id, community_id, gs_id, entity_name, abn, entity_type, buyer_role, procurement_method,
      estimated_annual_spend, current_supplier, contract_cycle, relationship_status, contact_surface,
      product_fit, fit_score, next_action, govt_contract_count, govt_contract_value,
      is_community_controlled, website, updated_at
    `)
    .order('fit_score', { ascending: false, nullsFirst: false })
    .limit(6000);

  const { data: signalsData } = await db
    .from('goods_procurement_signals')
    .select(`
      id, signal_type, priority, community_id, title, description, estimated_value, estimated_units,
      products_needed, funding_confidence, status, action_notes, source_agent, updated_at, created_at
    `)
    .order('created_at', { ascending: false })
    .limit(1200);

  const foundations = await runSql<GoodsFoundationRow>(`
    SELECT
      id::text as id,
      name,
      type,
      website,
      description,
      total_giving_annual,
      avg_grant_size,
      thematic_focus,
      geographic_focus,
      profile_confidence,
      open_programs
    FROM foundations
    WHERE
      LOWER(COALESCE(name, '')) LIKE ANY (ARRAY[
        '%indigenous%', '%community%', '%remote%', '%social%', '%manufacturing%'
      ])
      OR LOWER(COALESCE(description, '')) LIKE ANY (ARRAY[
        '%indigenous%', '%community%', '%remote%', '%social enterprise%', '%catalytic%', '%loan%',
        '%manufacturing%', '%circular%', '%youth%', '%housing%'
      ])
      OR LOWER(array_to_string(COALESCE(thematic_focus, '{}'::text[]), ',')) LIKE ANY (ARRAY[
        '%indigenous%', '%community%', '%remote%', '%manufacturing%', '%social enterprise%',
        '%youth%', '%housing%', '%circular%'
      ])
      OR LOWER(array_to_string(COALESCE(geographic_focus, '{}'::text[]), ',')) LIKE ANY (ARRAY[
        '%nt%', '%northern territory%', '%qld%', '%queensland%', '%remote%', '%regional%'
      ])
    ORDER BY total_giving_annual DESC NULLS LAST, updated_at DESC
    LIMIT 400
  `);

  const grants = await runSql<GoodsGrantRow>(`
    SELECT
      id::text as id,
      name,
      provider,
      url,
      amount_min,
      amount_max,
      closes_at,
      categories,
      focus_areas,
      geography,
      status,
      grant_type,
      program_type,
      last_verified_at
    FROM grant_opportunities
    WHERE
      (status IS NULL OR LOWER(status) NOT IN ('closed', 'archived'))
      AND (closes_at IS NULL OR closes_at >= CURRENT_DATE - INTERVAL '14 days')
      AND (
        LOWER(COALESCE(name, '')) LIKE ANY (ARRAY[
          '%indigenous%', '%community%', '%remote%', '%housing%', '%manufacturing%',
          '%social enterprise%', '%circular%', '%youth%', '%employment%'
        ])
        OR LOWER(COALESCE(provider, '')) LIKE ANY (ARRAY[
          '%foundation%', '%indigenous%', '%community%', '%territory%', '%queensland%'
        ])
        OR LOWER(array_to_string(COALESCE(categories, '{}'::text[]), ',')) LIKE ANY (ARRAY[
          '%indigenous%', '%community%', '%remote%', '%housing%', '%manufacturing%', '%youth%'
        ])
        OR LOWER(array_to_string(COALESCE(focus_areas, '{}'::text[]), ',')) LIKE ANY (ARRAY[
          '%indigenous%', '%community%', '%remote%', '%housing%', '%manufacturing%', '%youth%'
        ])
      )
    ORDER BY COALESCE(closes_at, CURRENT_DATE + INTERVAL '365 days') ASC,
             COALESCE(amount_max, amount_min, 0) DESC
    LIMIT 500
  `);

  const ntCoverageRows = await runSql<NtCommunityCoverageRow>(`
    SELECT
      community_name,
      region_label,
      postcode,
      goods_focus_priority,
      known_buyer_name,
      entity_match_count,
      buyer_match_count,
      store_count,
      health_count,
      housing_count,
      council_count,
      community_controlled_match_count,
      needs_postcode_enrichment
    FROM v_nt_community_procurement_summary
    ORDER BY
      CASE WHEN needs_postcode_enrichment THEN 0 ELSE 1 END,
      buyer_match_count ASC,
      entity_match_count ASC,
      community_name ASC
    LIMIT 250
  `);

  const goodsPipelineStages = await runSql<GoodsGhlPipelineStageRow>(`
    SELECT
      COALESCE(stage_name, 'Unknown') as stage_name,
      COUNT(*)::int as stage_count,
      COALESCE(SUM(COALESCE(monetary_value, 0)), 0)::numeric as stage_value
    FROM ghl_opportunities
    WHERE pipeline_name = 'Goods'
    GROUP BY COALESCE(stage_name, 'Unknown')
    ORDER BY stage_count DESC, stage_value DESC
  `);

  const goodsPipelineOpportunities = await runSql<GoodsGhlOpportunityRow>(`
    SELECT
      ghl_id,
      name,
      stage_name,
      status,
      monetary_value,
      assigned_to,
      ghl_contact_id,
      COALESCE(ghl_updated_at, updated_at, created_at) as updated_at
    FROM ghl_opportunities
    WHERE pipeline_name = 'Goods'
    ORDER BY COALESCE(ghl_updated_at, updated_at, created_at) DESC
    LIMIT 24
  `);

  const goodsBuyerPipelineOpportunities = await runSql<GoodsBuyerGhlOpportunityRow>(`
    SELECT
      name,
      stage_name,
      status,
      monetary_value,
      assigned_to,
      ghl_contact_id,
      COALESCE(ghl_updated_at, updated_at, created_at) as updated_at
    FROM ghl_opportunities
    WHERE pipeline_name = 'Goods'
      AND name LIKE '[Buyer] %'
    ORDER BY COALESCE(ghl_updated_at, updated_at, created_at) DESC
    LIMIT 400
  `);

  const goodsBuyerContacts = await runSql<GoodsBuyerGhlContactRow>(`
    SELECT
      ghl_id,
      company_name,
      engagement_status,
      last_contact_date,
      website,
      COALESCE(ghl_updated_at, updated_at, created_at) as updated_at
    FROM ghl_contacts
    WHERE source = 'CivicGraph Goods Workspace'
      OR 'goods-workspace' = ANY(COALESCE(projects, ARRAY[]::text[]))
    ORDER BY COALESCE(ghl_updated_at, updated_at, created_at) DESC
    LIMIT 400
  `);

  const goodsCommunityPipelineRows = await runSql<GoodsCommunityPipelineRow>(`
    SELECT
      name,
      stage_name,
      status,
      monetary_value,
      assigned_to,
      COALESCE(ghl_updated_at, updated_at, created_at) as updated_at
    FROM ghl_opportunities
    WHERE pipeline_name = 'Goods'
      AND name NOT LIKE '[%] %'
    ORDER BY COALESCE(ghl_updated_at, updated_at, created_at) DESC
    LIMIT 300
  `);

  const goodsPushLog = await runSql<GoodsGhlSyncRow>(`
    SELECT
      id::text as id,
      operation,
      status,
      records_processed,
      records_created,
      records_updated,
      records_failed,
      triggered_by,
      started_at,
      completed_at,
      metadata
    FROM ghl_sync_log
    WHERE operation = 'GoodsWorkspacePush'
    ORDER BY started_at DESC
    LIMIT 20
  `);

  return (
    <GoodsWorkspaceClient
      userEmail={user.email ?? null}
      orgProfile={orgProfile as OrgProfileSummary}
      ghlDefaultOwnerConfigured={Boolean(process.env.GHL_GOODS_DEFAULT_ASSIGNED_TO)}
      ghlDefaultOwnerLabel={process.env.GHL_GOODS_DEFAULT_OWNER_LABEL || null}
      communities={(communitiesData as GoodsCommunityRow[] | null) || []}
      buyers={(buyersData as GoodsProcurementEntityRow[] | null) || []}
      signals={(signalsData as GoodsProcurementSignalRow[] | null) || []}
      foundations={foundations}
      grants={grants}
      ntCoverageRows={ntCoverageRows}
      goodsPipelineStages={goodsPipelineStages}
      goodsPipelineOpportunities={goodsPipelineOpportunities}
      goodsBuyerPipelineOpportunities={goodsBuyerPipelineOpportunities}
      goodsBuyerContacts={goodsBuyerContacts}
      goodsCommunityPipelineRows={goodsCommunityPipelineRows}
      goodsPushLog={goodsPushLog}
    />
  );
}

import { getLiveReportSupabase } from '@/lib/report-supabase';

export type InventoryMetric = {
  metric: string;
  value: number;
};

export type StateCoverage = {
  state: string;
  contracts: number;
  suppliers_with_abn: number;
  recorded_value: number;
};

export type JusticeSource = {
  source: string;
  records: number;
  with_abn: number;
  recorded_value: number;
};

export type AlmaQuality = {
  verification_status: string;
  review_status: string;
  records: number;
  entity_linked: number;
};

export type AccoCoverage = {
  organisations: number;
  with_abn: number;
  with_website: number;
  with_lga: number;
  with_sector: number;
  with_description: number;
  multisource: number;
};

export type FederalContractCoverage = {
  contracts: number;
  organisations: number;
  recorded_value: number;
  active_or_future: number;
  ending_24m: number;
};

export type FrontierStatus = {
  source_name: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_http_status: number | null;
  failure_count: number;
  window_contracts: number;
  historical_complete_days: number;
  historical_blocked_days: number;
  historical_coverage_from: string | null;
  historical_coverage_to: string | null;
};

export type AerCoverage = {
  artifacts: number;
  programs: number;
  kimberley_programs: number;
  justice_programs: number;
  aboriginal_org_or_acco_rows: number;
  source_sha256: string | null;
  fetched_at: string | null;
};

export type WaRegionCoverage = {
  region: string;
  contracts: number;
  recorded_value: number;
  aer_programs: number;
};

export type AppReportCoverage = {
  publication_pages: number;
  pdf_artifacts: number;
  content_hash: string | null;
  last_success_at: string | null;
};

export type TransitionDecision = {
  candidate_status: string;
  records: number;
  recorded_value: number;
};

export type TransitionFamily = {
  service_family: string;
  records: number;
  recorded_value: number;
};

export type EntityResolutionCoverage = {
  supplier_components: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  registry_backed: number;
  sourced_alias: number;
  transition_queue_linked: number;
  transition_queue_community_signals: number;
  kimberley_linked: number;
  kimberley_community_signals: number;
};

export type KimberleyTransitionCandidate = {
  source_contract_id: string;
  title: string;
  supplier_name: string | null;
  contract_value: number;
  expiry_date: string | null;
  source_url: string;
  service_family: string;
  candidate_status: string;
  relevance_score: number;
  transition_window: string;
  entity_match_status: string;
  matched_entity_name: string | null;
  supplier_is_community_controlled: boolean | null;
};

export type KimberleyForwardProcurement = {
  source_ref: string;
  parent_agency: string;
  title: string;
  procurement_type: string | null;
  unspsc_title: string | null;
  release_financial_year: string | null;
  review_classification: string;
  review_reason: string | null;
  existing_contract_number: string | null;
  existing_contract_match_status: string;
  source_report_url: string;
  source_refreshed_on: string | null;
};

export type WaTransitionReport = {
  inventory: InventoryMetric[];
  stateCoverage: StateCoverage[];
  justiceSources: JusticeSource[];
  almaQuality: AlmaQuality[];
  accoCoverage: AccoCoverage;
  federalContracts: FederalContractCoverage;
  frontier: FrontierStatus | null;
  aerCoverage: AerCoverage;
  appReportCoverage: AppReportCoverage;
  regionCoverage: WaRegionCoverage[];
  transitionDecisions: TransitionDecision[];
  transitionFamilies: TransitionFamily[];
  entityResolution: EntityResolutionCoverage;
  kimberleyCandidates: KimberleyTransitionCandidate[];
  kimberleyForwardProcurements: KimberleyForwardProcurement[];
  error: string | null;
};

function rows<T>(result: { data: unknown; error: { message?: string } | null }): T[] {
  if (result.error || !Array.isArray(result.data)) return [];
  return result.data as T[];
}

function numeric<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
        ? Number(value)
        : value,
    ]),
  ) as T;
}

export async function getWaTransitionReport(): Promise<WaTransitionReport> {
  const db = getLiveReportSupabase();

  const [inventoryResult, stateResult, justiceResult, almaResult, accoResult, contractsResult, frontierResult, aerResult, appReportResult, regionResult, transitionDecisionResult, transitionFamilyResult, entityResolutionResult, kimberleyCandidateResult, forwardProcurementResult] =
    await Promise.all([
      db.rpc('exec_sql', {
        query: `
          SELECT 'entities' AS metric, COUNT(*)::bigint AS value
          FROM gs_entities WHERE state = 'WA'
          UNION ALL
          SELECT 'community_controlled', COUNT(*)::bigint
          FROM gs_entities WHERE state = 'WA' AND is_community_controlled = true
          UNION ALL
          SELECT 'oric', COUNT(*)::bigint FROM oric_corporations WHERE state = 'WA'
          UNION ALL
          SELECT 'charities_registered', COUNT(*)::bigint FROM acnc_charities WHERE state = 'WA'
          UNION ALL
          SELECT 'social_enterprises', COUNT(*)::bigint FROM social_enterprises WHERE state = 'WA'
          UNION ALL
          SELECT 'justice_funding_rows', COUNT(*)::bigint FROM justice_funding WHERE state = 'WA'
          UNION ALL
          SELECT 'alma_interventions', COUNT(*)::bigint
          FROM alma_interventions_valid
          WHERE 'WA' = ANY(geography) OR array_to_string(geography, ' ') ILIKE '%Western Australia%'
          UNION ALL
          SELECT 'goods_places', COUNT(*)::bigint FROM goods_communities WHERE state = 'WA'
          UNION ALL
          SELECT 'state_contracts', COUNT(*)::bigint FROM state_tenders WHERE state = 'WA'
          UNION ALL
          SELECT 'portal_contracts', COUNT(*)::bigint FROM state_tenders WHERE state = 'WA' AND source = 'tenders-wa'
          UNION ALL
          SELECT 'data_wa_contracts', COUNT(*)::bigint FROM state_tenders WHERE state = 'WA' AND source = 'data-wa-tenders'
          UNION ALL
          SELECT 'dcsp_contracts', COUNT(*)::bigint FROM state_tenders WHERE state = 'WA' AND dcsp_policy_applicable = true
          UNION ALL
          SELECT 'aboriginal_participation_contracts', COUNT(*)::bigint FROM state_tenders WHERE state = 'WA' AND aboriginal_participation_requirements IS NOT NULL
          UNION ALL
          SELECT 'aer_programs', COUNT(*)::bigint FROM wa_aer_programs
          UNION ALL
          SELECT 'wa_source_frontier', COUNT(*)::bigint
          FROM source_frontier WHERE source_key LIKE 'wa-transition:%'
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT state,
                 COUNT(*)::bigint AS contracts,
                 COUNT(*) FILTER (WHERE supplier_abn IS NOT NULL)::bigint AS suppliers_with_abn,
                 COALESCE(SUM(contract_value), 0)::bigint AS recorded_value
          FROM state_tenders
          GROUP BY state
          ORDER BY contracts DESC
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT source,
                 COUNT(*)::bigint AS records,
                 COUNT(*) FILTER (WHERE recipient_abn IS NOT NULL)::bigint AS with_abn,
                 COALESCE(SUM(amount_dollars), 0)::bigint AS recorded_value
          FROM justice_funding
          WHERE state = 'WA'
          GROUP BY source
          ORDER BY records DESC
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT COALESCE(verification_status, 'unknown') AS verification_status,
                 COALESCE(review_status, 'unknown') AS review_status,
                 COUNT(*)::bigint AS records,
                 COUNT(*) FILTER (WHERE gs_entity_id IS NOT NULL)::bigint AS entity_linked
          FROM alma_interventions_valid
          WHERE 'WA' = ANY(geography) OR array_to_string(geography, ' ') ILIKE '%Western Australia%'
          GROUP BY verification_status, review_status
          ORDER BY records DESC
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT COUNT(*)::bigint AS organisations,
                 COUNT(*) FILTER (WHERE abn IS NOT NULL)::bigint AS with_abn,
                 COUNT(*) FILTER (WHERE website IS NOT NULL)::bigint AS with_website,
                 COUNT(*) FILTER (WHERE lga_name IS NOT NULL)::bigint AS with_lga,
                 COUNT(*) FILTER (WHERE sector IS NOT NULL)::bigint AS with_sector,
                 COUNT(*) FILTER (WHERE description IS NOT NULL)::bigint AS with_description,
                 COUNT(*) FILTER (WHERE source_count >= 2)::bigint AS multisource
          FROM gs_entities
          WHERE state = 'WA' AND is_community_controlled = true
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT COUNT(c.id)::bigint AS contracts,
                 COUNT(DISTINCT e.id)::bigint AS organisations,
                 COALESCE(SUM(c.contract_value), 0)::bigint AS recorded_value,
                 COUNT(*) FILTER (WHERE c.contract_end >= CURRENT_DATE)::bigint AS active_or_future,
                 COUNT(*) FILTER (
                   WHERE c.contract_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '24 months'
                 )::bigint AS ending_24m
          FROM gs_entities e
          JOIN austender_contracts c ON c.supplier_abn = e.abn
          WHERE e.state = 'WA' AND e.is_community_controlled = true
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT source_name, last_checked_at, last_success_at, last_http_status, failure_count,
                 COALESCE((metadata->>'window_contracts')::bigint, 0) AS window_contracts,
                 COALESCE((metadata->>'historical_complete_days')::bigint, 0) AS historical_complete_days,
                 COALESCE((metadata->>'historical_blocked_days')::bigint, 0) AS historical_blocked_days,
                 metadata->>'historical_coverage_from' AS historical_coverage_from,
                 metadata->>'historical_coverage_to' AS historical_coverage_to
          FROM source_frontier
          WHERE source_key = 'wa-transition:tenders-wa'
          LIMIT 1
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT COUNT(DISTINCT a.id)::bigint AS artifacts,
                 COUNT(p.id)::bigint AS programs,
                 COUNT(*) FILTER (WHERE p.kimberley)::bigint AS kimberley_programs,
                 COUNT(*) FILTER (WHERE p.agency = 'Justice')::bigint AS justice_programs,
                 COUNT(*) FILTER (
                   WHERE p.aboriginal_organisation_or_acco OR p.aboriginal_organisation_or_acco_only
                 )::bigint AS aboriginal_org_or_acco_rows,
                 MAX(a.source_sha256) AS source_sha256,
                 MAX(a.fetched_at)::text AS fetched_at
          FROM wa_aer_source_artifacts a
          LEFT JOIN wa_aer_programs p ON p.source_artifact_id = a.id
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT COALESCE((metadata->>'publication_pages')::bigint, 0) AS publication_pages,
                 COALESCE((metadata->>'pdf_artifacts')::bigint, 0) AS pdf_artifacts,
                 content_hash,
                 last_success_at::text
          FROM source_frontier
          WHERE source_key = 'wa-transition:app-performance'
          LIMIT 1
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          WITH current_window AS (
            SELECT COALESCE((metadata->>'window_awarded_from')::timestamptz, '-infinity'::timestamptz) AS starts_at
            FROM source_frontier
            WHERE source_key = 'wa-transition:tenders-wa'
          ), contract_regions AS (
            SELECT region,
                   COUNT(*)::bigint AS contracts,
                   COALESCE(SUM(contract_value), 0)::bigint AS recorded_value
            FROM state_tenders
            CROSS JOIN current_window
            CROSS JOIN LATERAL unnest(regions) AS region
            WHERE source = 'tenders-wa' AND awarded_date >= current_window.starts_at
            GROUP BY region
          ), aer_regions AS (
            SELECT region, COUNT(*)::bigint AS aer_programs
            FROM wa_aer_programs p
            CROSS JOIN LATERAL (VALUES
              ('Statewide', p.statewide),
              ('Perth Metropolitan', p.metro_perth_peel),
              ('South West', p.south_west_great_southern),
              ('Great Southern', p.south_west_great_southern),
              ('Kimberley', p.kimberley),
              ('Pilbara', p.pilbara),
              ('Mid West', p.mid_west_gascoyne),
              ('Gascoyne', p.mid_west_gascoyne),
              ('Goldfields-Esperance', p.goldfields_esperance),
              ('Wheatbelt', p.wheatbelt)
            ) AS r(region, included)
            WHERE included
            GROUP BY region
          )
          SELECT COALESCE(c.region, a.region) AS region,
                 COALESCE(c.contracts, 0)::bigint AS contracts,
                 COALESCE(c.recorded_value, 0)::bigint AS recorded_value,
                 COALESCE(a.aer_programs, 0)::bigint AS aer_programs
          FROM contract_regions c
          FULL OUTER JOIN aer_regions a ON a.region = c.region
          WHERE COALESCE(c.region, a.region) <> 'Statewide'
          ORDER BY COALESCE(c.contracts, 0) DESC
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT c.candidate_status,
                 COUNT(*)::bigint AS records,
                 COALESCE(SUM(t.contract_value), 0)::bigint AS recorded_value
          FROM wa_transition_candidates c
          JOIN state_tenders t ON t.id = c.state_tender_id
          GROUP BY c.candidate_status
          ORDER BY CASE c.candidate_status WHEN 'candidate' THEN 1 WHEN 'review' THEN 2 ELSE 3 END
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT c.service_family,
                 COUNT(*)::bigint AS records,
                 COALESCE(SUM(t.contract_value), 0)::bigint AS recorded_value
          FROM wa_transition_candidates c
          JOIN state_tenders t ON t.id = c.state_tender_id
          WHERE c.candidate_status IN ('candidate', 'review')
          GROUP BY c.service_family
          ORDER BY records DESC, c.service_family
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT
            (SELECT COUNT(*) FROM wa_supplier_entity_matches)::bigint AS supplier_components,
            (SELECT COUNT(*) FROM wa_supplier_entity_matches WHERE match_status = 'matched')::bigint AS matched,
            (SELECT COUNT(*) FROM wa_supplier_entity_matches WHERE match_status = 'ambiguous')::bigint AS ambiguous,
            (SELECT COUNT(*) FROM wa_supplier_entity_matches WHERE match_status = 'unmatched')::bigint AS unmatched,
            (SELECT COUNT(*) FROM wa_supplier_entity_matches WHERE match_method = 'exact_registry_name')::bigint AS registry_backed,
            (SELECT COUNT(*) FROM wa_supplier_entity_matches WHERE match_method = 'exact_sourced_alias')::bigint AS sourced_alias,
            COUNT(*) FILTER (WHERE c.matched_entity_id IS NOT NULL)::bigint AS transition_queue_linked,
            COUNT(*) FILTER (WHERE c.supplier_is_community_controlled = true)::bigint AS transition_queue_community_signals,
            COUNT(*) FILTER (WHERE c.is_kimberley AND c.matched_entity_id IS NOT NULL)::bigint AS kimberley_linked,
            COUNT(*) FILTER (WHERE c.is_kimberley AND c.supplier_is_community_controlled = true)::bigint AS kimberley_community_signals
          FROM wa_transition_candidates c
          WHERE c.candidate_status IN ('candidate', 'review')
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT c.source_contract_id, t.title, t.supplier_name,
                 COALESCE(t.contract_value, 0)::bigint AS contract_value,
                 t.expiry_date::text, t.source_url,
                 c.service_family, c.candidate_status, c.relevance_score,
                 c.transition_window, c.entity_match_status,
                 e.canonical_name AS matched_entity_name,
                 c.supplier_is_community_controlled
          FROM wa_transition_candidates c
          JOIN state_tenders t ON t.id = c.state_tender_id
          LEFT JOIN gs_entities e ON e.id = c.matched_entity_id
          WHERE c.is_kimberley AND c.candidate_status IN ('candidate', 'review')
          ORDER BY c.relevance_score DESC, t.contract_value DESC NULLS LAST
        `,
      }),
      db.rpc('exec_sql', {
        query: `
          SELECT source_ref, parent_agency, title, procurement_type, unspsc_title,
                 release_financial_year, review_classification, review_reason,
                 existing_contract_number, existing_contract_match_status,
                 source_report_url, source_refreshed_on::text
          FROM wa_forward_procurements
          WHERE delivery_point = 'Kimberley'
            AND procurement_type = 'Community Services'
            AND source_refreshed_on = (SELECT MAX(source_refreshed_on) FROM wa_forward_procurements)
          ORDER BY CASE review_classification
            WHEN 'human_services_review' THEN 1
            WHEN 'source_classification_anomaly' THEN 2
            ELSE 3
          END, source_ref
        `,
      }),
    ]);

  const allResults = [inventoryResult, stateResult, justiceResult, almaResult, accoResult, contractsResult, frontierResult, aerResult, appReportResult, regionResult, transitionDecisionResult, transitionFamilyResult, entityResolutionResult, kimberleyCandidateResult, forwardProcurementResult];
  const firstError = allResults.find((result) => result.error)?.error;

  const inventory = rows<Record<string, unknown>>(inventoryResult).map(numeric) as unknown as InventoryMetric[];
  const stateCoverage = rows<Record<string, unknown>>(stateResult).map(numeric) as unknown as StateCoverage[];
  const justiceSources = rows<Record<string, unknown>>(justiceResult).map(numeric) as unknown as JusticeSource[];
  const almaQuality = rows<Record<string, unknown>>(almaResult).map(numeric) as unknown as AlmaQuality[];
  const accoRows = rows<Record<string, unknown>>(accoResult).map(numeric) as unknown as AccoCoverage[];
  const contractRows = rows<Record<string, unknown>>(contractsResult).map(numeric) as unknown as FederalContractCoverage[];
  const frontierRows = rows<Record<string, unknown>>(frontierResult).map(numeric) as unknown as FrontierStatus[];
  const aerRows = rows<Record<string, unknown>>(aerResult).map(numeric) as unknown as AerCoverage[];
  const appReportRows = rows<Record<string, unknown>>(appReportResult).map(numeric) as unknown as AppReportCoverage[];
  const regionCoverage = rows<Record<string, unknown>>(regionResult).map(numeric) as unknown as WaRegionCoverage[];
  const transitionDecisions = rows<Record<string, unknown>>(transitionDecisionResult).map(numeric) as unknown as TransitionDecision[];
  const transitionFamilies = rows<Record<string, unknown>>(transitionFamilyResult).map(numeric) as unknown as TransitionFamily[];
  const entityResolutionRows = rows<Record<string, unknown>>(entityResolutionResult).map(numeric) as unknown as EntityResolutionCoverage[];
  const kimberleyCandidates = rows<Record<string, unknown>>(kimberleyCandidateResult).map(numeric) as unknown as KimberleyTransitionCandidate[];
  const kimberleyForwardProcurements = rows<Record<string, unknown>>(forwardProcurementResult).map(numeric) as unknown as KimberleyForwardProcurement[];

  return {
    inventory,
    stateCoverage,
    justiceSources,
    almaQuality,
    accoCoverage: accoRows[0] ?? {
      organisations: 0,
      with_abn: 0,
      with_website: 0,
      with_lga: 0,
      with_sector: 0,
      with_description: 0,
      multisource: 0,
    },
    federalContracts: contractRows[0] ?? {
      contracts: 0,
      organisations: 0,
      recorded_value: 0,
      active_or_future: 0,
      ending_24m: 0,
    },
    frontier: frontierRows[0] ?? null,
    aerCoverage: aerRows[0] ?? {
      artifacts: 0,
      programs: 0,
      kimberley_programs: 0,
      justice_programs: 0,
      aboriginal_org_or_acco_rows: 0,
      source_sha256: null,
      fetched_at: null,
    },
    appReportCoverage: appReportRows[0] ?? {
      publication_pages: 0,
      pdf_artifacts: 0,
      content_hash: null,
      last_success_at: null,
    },
    regionCoverage,
    transitionDecisions,
    transitionFamilies,
    entityResolution: entityResolutionRows[0] ?? {
      supplier_components: 0,
      matched: 0,
      ambiguous: 0,
      unmatched: 0,
      registry_backed: 0,
      sourced_alias: 0,
      transition_queue_linked: 0,
      transition_queue_community_signals: 0,
      kimberley_linked: 0,
      kimberley_community_signals: 0,
    },
    kimberleyCandidates,
    kimberleyForwardProcurements,
    error: firstError?.message ?? null,
  };
}

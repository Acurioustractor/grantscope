import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { classifySourceHealth, type SourceRun } from '@grant-engine/source-health';
import { classifyPipelineHealth } from '@grant-engine/pipeline-health';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function canonicalSourceSql(): string {
  return `COALESCE(
    NULLIF(discovery_method, ''),
    CASE
      WHEN source = 'foundation_program' THEN NULL
      WHEN COALESCE(source_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN NULL
      ELSE NULLIF(source_id, '')
    END,
    source,
    'unknown'
  )`;
}

// Wrap a promise with a timeout — returns fallback instead of hanging forever
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe(p: PromiseLike<any>, ms = 15000): Promise<any> {
  const fallback = { count: null, data: null, error: 'timeout', status: 0, statusText: 'timeout' };
  return Promise.race([
    Promise.resolve(p),
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const db = getServiceSupabase();
  const grantCanonicalSource = canonicalSourceSql();

  try {
    // All queries in one parallel batch — RPCs are instant, filtered counts are best-effort
    const [
      // Fast RPCs (instant)
      tableCountsResult,
      freshnessResult,
      // Filtered counts (may timeout — wrapped in safe)
      grantsWithDesc, grantsEnriched, grantsEmbedded, grantsOpen,
      foundationsProfiled, foundationsWithWebsite,
      seEnriched,
      grantSemanticsSummary,
      grantSemanticsSources,
      grantSourceIdentitySummary,
      grantSourceIdentitySources,
      // Breakdowns + recent runs
      sourceBreakdownResult, confidenceBreakdownResult,
      recentRuns,
      newestAgentRun, recentDiscoveryRuns,
      sourceHealthRuns,
      pipelineSchedules, pipelineTasks, pipelineRuns,
      // Entity graph
      entityTypeBreakdown, relationshipTypeBreakdown,
      donorContractorStats,
      entityCoverageResult,
    ] = await Promise.all([
      // Estimated counts for exactly the tables this page reads. The unfiltered pg_class scan
      // silently lost most app tables to PostgREST's 1,000-row cap (pg_class holds ~4K relations),
      // which zeroed every count on /ops/health.
      safe(db.rpc('exec_sql', {
        query: `
          SELECT c.relname, greatest(coalesce(c.reltuples, 0), 0) AS count
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind IN ('r', 'p', 'm')
            AND c.relname IN (
              'grant_opportunities','foundations','foundation_programs','acnc_charities',
              'community_orgs','social_enterprises','oric_corporations','austender_contracts',
              'political_donations','gs_entities','gs_relationships','asic_companies',
              'ato_tax_transparency','rogs_justice_spending','asx_companies','money_flows',
              'seifa_2021','justice_funding','alma_interventions','alma_outcomes','alma_evidence'
            )
        `
      }), 8000),
      safe(db.rpc('get_table_freshness'), 12000),
      // Filtered counts — each wrapped in safe() so pool saturation doesn't block response
      safe(db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('description', 'is', null).gt('description', ''), 10000),
      safe(db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('enriched_at', 'is', null), 10000),
      safe(db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null), 10000),
      safe(db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .gt('closes_at', new Date().toISOString()), 10000),
      // Admin audit A4: this counted `description IS NOT NULL` (919) and labelled it PROFILED,
      // while /ops counted `last_scraped_at IS NOT NULL` (598) under the same word. Only 597 have
      // both, so 321 descriptions never came from the profiler at all. "Profiled" means the
      // profiler ran, which is last_scraped_at — so this now agrees with /ops.
      safe(db.from('foundations').select('*', { count: 'exact', head: true })
        .not('last_scraped_at', 'is', null), 10000),
      safe(db.from('foundations').select('*', { count: 'exact', head: true })
        .not('website', 'is', null), 10000),
      safe(db.from('social_enterprises').select('*', { count: 'exact', head: true })
        .not('enriched_at', 'is', null), 10000),
      safe(db.rpc('exec_sql', { query: `
        SELECT
          COUNT(*) FILTER (WHERE status IS NULL) AS status_null_total,
          COUNT(*) FILTER (WHERE application_status IS NULL) AS application_status_null_total,
          COUNT(*) FILTER (WHERE status = 'open' AND closes_at < CURRENT_DATE) AS open_past_deadline_total,
          COUNT(*) FILTER (WHERE source = 'ghl_sync' AND status = 'unknown') AS ghl_sync_unknown_total
        FROM grant_opportunities
      ` }), 10000),
      safe(db.rpc('exec_sql', { query: `
        SELECT
          ${grantCanonicalSource} AS source,
          COUNT(*) FILTER (WHERE status IS NULL) AS status_null,
          COUNT(*) FILTER (WHERE application_status IS NULL) AS application_status_null,
          COUNT(*) FILTER (WHERE status = 'open' AND closes_at < CURRENT_DATE) AS open_past_deadline,
          (
            COUNT(*) FILTER (WHERE status IS NULL)
            + COUNT(*) FILTER (WHERE application_status IS NULL)
            + COUNT(*) FILTER (WHERE status = 'open' AND closes_at < CURRENT_DATE)
          ) AS total_issues
        FROM grant_opportunities
        GROUP BY ${grantCanonicalSource}
        HAVING (
          COUNT(*) FILTER (WHERE status IS NULL)
          + COUNT(*) FILTER (WHERE application_status IS NULL)
          + COUNT(*) FILTER (WHERE status = 'open' AND closes_at < CURRENT_DATE)
        ) > 0
        ORDER BY total_issues DESC, source ASC
        LIMIT 10
      ` }), 10000),
      safe(db.rpc('exec_sql', { query: `
        SELECT
          COUNT(*) FILTER (
            WHERE discovered_by = 'grant_engine'
              AND COALESCE(discovery_method, '') <> ''
              AND COALESCE(source_id, '') = ''
          ) AS blank_source_id_total,
          COUNT(*) FILTER (
            WHERE discovered_by = 'grant_engine'
              AND COALESCE(discovery_method, '') <> ''
              AND COALESCE(source_id, '') <> ''
              AND source_id NOT LIKE '%::duplicate::%'
              AND source_id <> discovery_method
          ) AS canonical_mismatch_total,
          COUNT(*) FILTER (
            WHERE discovered_by = 'grant_engine'
              AND source_id LIKE '%::duplicate::%'
              AND status = 'duplicate'
          ) AS duplicate_shadow_total
        FROM grant_opportunities
      ` }), 10000),
      safe(db.rpc('exec_sql', { query: `
        SELECT
          discovery_method AS source,
          COUNT(*) FILTER (WHERE COALESCE(source_id, '') = '') AS blank_source_id,
          COUNT(*) FILTER (
            WHERE COALESCE(source_id, '') <> ''
              AND source_id NOT LIKE '%::duplicate::%'
              AND source_id <> discovery_method
          ) AS canonical_mismatch,
          (
            COUNT(*) FILTER (WHERE COALESCE(source_id, '') = '')
            + COUNT(*) FILTER (
              WHERE COALESCE(source_id, '') <> ''
                AND source_id NOT LIKE '%::duplicate::%'
                AND source_id <> discovery_method
            )
          ) AS total_issues
        FROM grant_opportunities
        WHERE discovered_by = 'grant_engine'
          AND COALESCE(discovery_method, '') <> ''
        GROUP BY discovery_method
        HAVING (
          COUNT(*) FILTER (WHERE COALESCE(source_id, '') = '')
          + COUNT(*) FILTER (
            WHERE COALESCE(source_id, '') <> ''
              AND source_id NOT LIKE '%::duplicate::%'
              AND source_id <> discovery_method
          )
        ) > 0
        ORDER BY total_issues DESC, source ASC
        LIMIT 10
      ` }), 10000),
      // Breakdowns
      safe(db.rpc('get_grant_source_breakdown'), 8000),
      safe(db.rpc('get_foundation_confidence_breakdown'), 8000),
      safe(db.from('agent_runs').select('*').order('completed_at', { ascending: false }).limit(20), 8000),
      // Orchestrator heartbeat. The pm2 orchestrator daemon was found stopped on 2026-08-18 having
      // been down ~2 days: 86 scheduled tasks had fired into nothing, verified_at stopped being
      // refreshed, and the entire opportunity feed quarantined. NOTHING reported it — it was found
      // by hand. The newest agent_run of ANY kind is the cheapest proof the scheduler is alive.
      safe(db.from('agent_runs').select('started_at').order('started_at', { ascending: false }).limit(1), 8000),
      safe(db.from('grant_discovery_runs').select('*').order('started_at', { ascending: false }).limit(10), 8000),
      // Per-source ingest health — latest run per source:* agent
      safe(db.from('agent_runs')
        .select('agent_id, agent_name, items_found, status, started_at')
        .like('agent_id', 'source:%')
        .order('started_at', { ascending: false })
        .limit(300), 8000),
      safe(db.from('agent_schedules')
        .select('agent_id, enabled, interval_hours, last_run_at')
        .in('agent_id', ['nightly-grant-pipeline-ingest', 'nightly-grant-pipeline-enrich', 'nightly-grant-pipeline-finalize']), 8000),
      safe(db.from('agent_tasks')
        .select('agent_id, status, created_at, started_at, error')
        .in('agent_id', ['nightly-grant-pipeline-ingest', 'nightly-grant-pipeline-enrich', 'nightly-grant-pipeline-finalize'])
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false })
        .limit(100), 8000),
      safe(db.from('agent_runs')
        .select('agent_id, status, started_at, completed_at')
        .in('agent_id', ['nightly-grant-pipeline-ingest', 'nightly-grant-pipeline-enrich', 'nightly-grant-pipeline-finalize'])
        .order('started_at', { ascending: false })
        .limit(30), 8000),
      // Entity graph
      safe(db.rpc('get_entity_type_breakdown'), 8000),
      safe(db.rpc('get_relationship_type_breakdown'), 8000),
      safe(db.from('mv_gs_donor_contractors').select('total_donated, total_contract_value').order('total_donated', { ascending: false }).limit(1000), 8000),
      // Entity coverage — geo enrichment stats
      safe(db.rpc('exec_sql', { query: `
        SELECT
          COUNT(*) as total,
          COUNT(postcode) as with_postcode,
          COUNT(remoteness) as with_remoteness,
          COUNT(lga_name) as with_lga,
          COUNT(seifa_irsd_decile) as with_seifa,
          COUNT(abn) as with_abn,
          COUNT(website) as with_website,
          COUNT(description) as with_description,
          COUNT(CASE WHEN is_community_controlled THEN 1 END) as community_controlled
        FROM gs_entities
      ` }), 8000),
    ]);

    // Extract counts from single RPC result (pg_stat_user_tables estimated counts)
    const tc: Record<string, number> = {};
    if (Array.isArray(tableCountsResult.data)) {
      for (const row of tableCountsResult.data) {
        if (row.relname) tc[row.relname] = Number(row.count) || 0;
      }
    } else if (tableCountsResult.data) {
       Object.assign(tc, tableCountsResult.data);
    }
    const tcount = (table: string) => tc[table] ?? 0;

    // Extract freshness timestamps from single RPC result
    const tf: Record<string, string | null> = freshnessResult.data ?? {};
    const tfresh = (table: string): string | null => tf[table] ?? null;

    // Aggregate donor-contractor stats
    const dcData = donorContractorStats.data ?? [];
    const dcTotalDonated = dcData.reduce((s: number, r: { total_donated: number }) => s + (r.total_donated || 0), 0);
    const dcTotalContracts = dcData.reduce((s: number, r: { total_contract_value: number }) => s + (r.total_contract_value || 0), 0);
    const gsRows = grantSemanticsSummary.data ?? [];
    const gs = Array.isArray(gsRows) && gsRows.length > 0 ? gsRows[0] : {};
    const grantSemantics = {
      statusNull: Number(gs.status_null_total ?? 0),
      applicationStatusNull: Number(gs.application_status_null_total ?? 0),
      openPastDeadline: Number(gs.open_past_deadline_total ?? 0),
      ghlUnknown: Number(gs.ghl_sync_unknown_total ?? 0),
      topIssueSources: (grantSemanticsSources.data ?? []).map((row: {
        source: string;
        status_null: number | string;
        application_status_null: number | string;
        open_past_deadline: number | string;
        total_issues: number | string;
      }) => ({
        source: row.source,
        statusNull: Number(row.status_null ?? 0),
        applicationStatusNull: Number(row.application_status_null ?? 0),
        openPastDeadline: Number(row.open_past_deadline ?? 0),
        totalIssues: Number(row.total_issues ?? 0),
      })),
    };
    const gsiRows = grantSourceIdentitySummary.data ?? [];
    const gsi = Array.isArray(gsiRows) && gsiRows.length > 0 ? gsiRows[0] : {};
    const sourceIdentity = {
      blankSourceId: Number(gsi.blank_source_id_total ?? 0),
      canonicalMismatch: Number(gsi.canonical_mismatch_total ?? 0),
      duplicateShadows: Number(gsi.duplicate_shadow_total ?? 0),
      topIssueSources: (grantSourceIdentitySources.data ?? []).map((row: {
        source: string;
        blank_source_id: number | string;
        canonical_mismatch: number | string;
        total_issues: number | string;
      }) => ({
        source: row.source,
        blankSourceId: Number(row.blank_source_id ?? 0),
        canonicalMismatch: Number(row.canonical_mismatch ?? 0),
        totalIssues: Number(row.total_issues ?? 0),
      })),
    };

    const dataFreshness = [
      { dataset: 'Grants', table: 'grant_opportunities', count: tcount('grant_opportunities'), lastUpdated: tfresh('grant_opportunities') },
      { dataset: 'Foundations', table: 'foundations', count: tcount('foundations'), lastUpdated: tfresh('foundations') },
      { dataset: 'Foundation Programs', table: 'foundation_programs', count: tcount('foundation_programs'), lastUpdated: tfresh('foundation_programs') },
      { dataset: 'ACNC Charities', table: 'acnc_charities', count: tcount('acnc_charities'), lastUpdated: tfresh('acnc_charities') },
      { dataset: 'Community Orgs', table: 'community_orgs', count: tcount('community_orgs'), lastUpdated: tfresh('community_orgs') },
      { dataset: 'Social Enterprises', table: 'social_enterprises', count: tcount('social_enterprises'), lastUpdated: tfresh('social_enterprises') },
      { dataset: 'ORIC Corporations', table: 'oric_corporations', count: tcount('oric_corporations'), lastUpdated: tfresh('oric_corporations') },
      { dataset: 'AusTender Contracts', table: 'austender_contracts', count: tcount('austender_contracts'), lastUpdated: tfresh('austender_contracts') },
      { dataset: 'Political Donations (AEC)', table: 'political_donations', count: tcount('political_donations'), lastUpdated: tfresh('political_donations') },
      { dataset: 'Entities', table: 'gs_entities', count: tcount('gs_entities'), lastUpdated: tfresh('gs_entities') },
      { dataset: 'Relationships', table: 'gs_relationships', count: tcount('gs_relationships'), lastUpdated: tfresh('gs_relationships') },
      { dataset: 'ASIC Companies', table: 'asic_companies', count: tcount('asic_companies'), lastUpdated: tfresh('asic_companies') },
      { dataset: 'ATO Tax Transparency', table: 'ato_tax_transparency', count: tcount('ato_tax_transparency'), lastUpdated: tfresh('ato_tax_transparency') },
      { dataset: 'ROGS Justice Spending', table: 'rogs_justice_spending', count: tcount('rogs_justice_spending'), lastUpdated: tfresh('rogs_justice_spending') },
      { dataset: 'ASX Companies', table: 'asx_companies', count: tcount('asx_companies'), lastUpdated: tfresh('asx_companies') },
      { dataset: 'Money Flows', table: 'money_flows', count: tcount('money_flows'), lastUpdated: null },
      { dataset: 'SEIFA Postcodes', table: 'seifa_2021', count: tcount('seifa_2021'), lastUpdated: null, static: true },
      { dataset: 'Justice Funding', table: 'justice_funding', count: tcount('justice_funding'), lastUpdated: tfresh('justice_funding') },
      { dataset: 'ALMA Interventions', table: 'alma_interventions', count: tcount('alma_interventions'), lastUpdated: tfresh('alma_interventions') },
      { dataset: 'ALMA Outcomes', table: 'alma_outcomes', count: tcount('alma_outcomes'), lastUpdated: tfresh('alma_outcomes') },
      { dataset: 'ALMA Evidence', table: 'alma_evidence', count: tcount('alma_evidence'), lastUpdated: tfresh('alma_evidence') },
    ];

    // Per-source ingest health — map agent_runs rows to SourceRun then classify
    const sourceHealthRows = (sourceHealthRuns.data ?? []) as Array<{
      agent_id: string;
      agent_name: string | null;
      items_found: number | null;
      status: string | null;
      started_at: string;
    }>;
    const sourceRuns: SourceRun[] = sourceHealthRows.map((row) => ({
      source: row.agent_id.replace(/^source:/, ''),
      startedAt: row.started_at,
      itemsFound: Number(row.items_found ?? 0),
      status: row.status ?? undefined,
    }));
    const sourceHealth = classifySourceHealth(sourceRuns);
    const pipelineHealth = classifyPipelineHealth(
      (pipelineSchedules.data ?? []).map((row: Record<string, unknown>) => ({
        agentId: String(row.agent_id), enabled: Boolean(row.enabled), intervalHours: Number(row.interval_hours ?? 24),
        lastScheduledAt: typeof row.last_run_at === 'string' ? row.last_run_at : null,
      })),
      (pipelineTasks.data ?? []).map((row: Record<string, unknown>) => ({
        agentId: String(row.agent_id), status: String(row.status), createdAt: String(row.created_at),
        startedAt: typeof row.started_at === 'string' ? row.started_at : null,
        error: typeof row.error === 'string' ? row.error : null,
      })),
      (pipelineRuns.data ?? []).map((row: Record<string, unknown>) => ({
        agentId: String(row.agent_id), status: String(row.status), startedAt: String(row.started_at),
        completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
      })),
    );

    const entityTypes = (entityTypeBreakdown as { data: Array<{ entity_type: string; count: number }> }).data ?? [];
    const relTypes = (relationshipTypeBreakdown as { data: Array<{ relationship_type: string; count: number }> }).data ?? [];
    const totalRecords = dataFreshness.reduce((s, d) => s + d.count, 0);

    // Parse entity coverage from exec_sql result (returns array of rows)
    const ecRows = entityCoverageResult.data ?? [];
    const ec = Array.isArray(ecRows) && ecRows.length > 0 ? ecRows[0] : {};
    const entityCoverage = {
      total: Number(ec.total ?? 0),
      withPostcode: Number(ec.with_postcode ?? 0),
      withRemoteness: Number(ec.with_remoteness ?? 0),
      withLga: Number(ec.with_lga ?? 0),
      withSeifa: Number(ec.with_seifa ?? 0),
      withAbn: Number(ec.with_abn ?? 0),
      withWebsite: Number(ec.with_website ?? 0),
      withDescription: Number(ec.with_description ?? 0),
      communityControlled: Number(ec.community_controlled ?? 0),
    };

    const response = NextResponse.json({
      stats: {
        // Admin audit A13: these were `count ?? 0`. safe() returns count:null when a query blows
        // its timeout, so a question we FAILED TO ASK rendered as a confident measurement of zero
        // — /ops/health showed "HAVE WEBSITE 0" while the table held 5,903, because the pooler was
        // busy. On the one screen whose job is saying whether the data is healthy, that is the
        // worst possible failure mode. null now travels to the UI, which renders it as unknown.
        grants: {
          total: tcount('grant_opportunities'),
          withDescription: grantsWithDesc.count ?? null,
          enriched: grantsEnriched.count ?? null,
          embedded: grantsEmbedded.count ?? null,
          open: grantsOpen.count ?? null,
        },
        foundations: {
          total: tcount('foundations'),
          profiled: foundationsProfiled.count ?? null,
          withWebsite: foundationsWithWebsite.count ?? null,
          programs: tcount('foundation_programs'),
        },
        community: { orgs: tcount('community_orgs') },
        socialEnterprises: {
          total: tcount('social_enterprises'),
          enriched: seEnriched.count ?? null,
        },
      },
      grantSemantics,
      sourceIdentity,
      entityGraph: {
        totalEntities: tcount('gs_entities'),
        totalRelationships: tcount('gs_relationships'),
        entityTypes,
        relationshipTypes: relTypes,
        donorContractors: {
          count: dcData.length,
          totalDonated: dcTotalDonated,
          totalContractValue: dcTotalContracts,
        },
        coverage: entityCoverage,
      },
      tableCounts: {
        acncCharities: tcount('acnc_charities'),
        politicalDonations: tcount('political_donations'),
        austenderContracts: tcount('austender_contracts'),
        oricCorporations: tcount('oric_corporations'),
        seifaPostcodes: tcount('seifa_2021'),
        asicCompanies: tcount('asic_companies'),
        atoTaxTransparency: tcount('ato_tax_transparency'),
        rogsJusticeSpending: tcount('rogs_justice_spending'),
        asxCompanies: tcount('asx_companies'),
        moneyFlows: tcount('money_flows'),
        justiceFunding: tcount('justice_funding'),
        almaInterventions: tcount('alma_interventions'),
        almaOutcomes: tcount('alma_outcomes'),
        almaEvidence: tcount('alma_evidence'),
      },
      totalRecords,
      dataFreshness,
      sourceBreakdown: sourceBreakdownResult.data ?? [],
      confidenceBreakdown: confidenceBreakdownResult.data ?? [],
      recentRuns: recentRuns.data ?? [],
      // See the heartbeat query above. Null lastRunAt means we could not read it, which is NOT the
      // same as "no runs" — the UI must not turn an unreadable heartbeat into a dead one.
      orchestrator: (() => {
        const at = newestAgentRun.data?.[0]?.started_at ?? null;
        if (!at) return { lastRunAt: null, hoursSince: null, stale: false, unknown: true };
        const hours = (Date.now() - new Date(at).getTime()) / 3_600_000;
        return { lastRunAt: at, hoursSince: Math.round(hours * 10) / 10, stale: hours > 6, unknown: false };
      })(),
      discoveryRuns: recentDiscoveryRuns.data ?? [],
      sourceHealth,
      pipelineHealth,
      lastUpdated: new Date().toISOString(),
    });

    // Prevent browser/CDN caching stale health data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  } catch (err) {
    console.error('[ops/health]', err);
    return NextResponse.json({ error: 'Failed to load health data' }, { status: 500 });
  }
}

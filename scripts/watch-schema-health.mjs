#!/usr/bin/env node
/**
 * watch-schema-health.mjs — Schema Health Watcher
 *
 * Continuously audits the data model for:
 *   1. Tables with ABN columns not linked to gs_entities
 *   2. Tables with entity_id columns without FK constraints
 *   3. Tables with >100 rows not classified into a domain
 *   4. New tables created since last run (scraper outputs)
 *   5. Orphaned MVs (source tables empty/dropped)
 *   6. ABN columns with low match rates to abr_registry
 *
 * Writes findings to the `discoveries` table for Mission Control.
 *
 * Usage:
 *   node --env-file=.env scripts/watch-schema-health.mjs
 *   node --env-file=.env scripts/watch-schema-health.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { psql } from './lib/psql.mjs';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const AGENT_ID = 'watch-schema-health';
const STATE_FILE = '/tmp/schema-health-last-tables.json';

// Tables classified in the clarity page's DOMAINS constant
const CLASSIFIED_TABLES = new Set([
  // Entity Graph
  'gs_entities', 'gs_relationships', 'entity_xref', 'gs_entity_aliases', 'entity_identifiers',
  // Registries
  'abr_registry', 'asic_companies', 'acnc_charities', 'acnc_ais', 'acnc_programs',
  'oric_corporations', 'asx_companies', 'asic_name_lookup',
  // Procurement
  'austender_contracts', 'state_tenders', 'ndis_registered_providers', 'ndis_active_providers',
  // Funding
  'justice_funding', 'grant_opportunities', 'foundations', 'foundation_programs', 'research_grants',
  'opportunities_unified',
  // Influence
  'political_donations', 'ato_tax_transparency', 'civic_hansard', 'civic_ministerial_diaries',
  'civic_ministerial_statements', 'oversight_recommendations', 'civic_alerts',
  'civic_charter_commitments', 'policy_events',
  // People
  'person_roles', 'person_identity_map', 'person_entity_links',
  'campaign_alignment_entities', 'donor_entity_matches',
  // Evidence
  'alma_interventions', 'alma_evidence', 'alma_outcomes', 'alma_research_findings',
  'alma_program_interventions', 'alma_government_programs', 'alma_intervention_outcomes',
  'outcomes_metrics', 'aihw_child_protection',
  // Social
  'ndis_utilisation', 'ndis_participants', 'ndis_participants_lga', 'ndis_market_concentration',
  'ndis_first_nations', 'dss_payment_demographics', 'social_enterprises', 'acara_schools',
  'crime_stats_lga', 'charity_impact_reports',
  // Geography
  'postcode_geo', 'lga_cross_system_stats', 'seifa_2021',
]);

// Operational/internal tables — not data, skip them
const OPERATIONAL_TABLES = new Set([
  'agent_runs', 'agent_schedules', 'agent_audit_log', 'agent_actions', 'agent_proposals',
  'agent_runtime_state', 'agent_task_queue', 'agent_tasks', 'agents', 'discoveries', 'pm2_cron_status',
  'pilot_participants',
  'validation_reviews',
  'foundation_people', 'foundation_grantees', 'foundation_relationship_signals',
  'webhook_delivery_log', 'integration_events', 'site_health_checks', 'pipeline_runs',
  'sync_status', 'ghl_sync_log', 'api_usage', 'page_views', 'privacy_audit_log',
  'api_keys', 'users', 'user_identities', 'org_profiles', 'org_contacts', 'org_members',
  'org_programs', 'org_projects', 'org_leadership', 'org_pipeline', 'org_contacts',
  'organizations', 'communications_history', 'communication_project_links',
  'communication_user_actions', 'knowledge_chunks', 'knowledge_edges', 'knowledge_links',
  'knowledge_sources', 'knowledge_extraction_queue',
  'notion_projects', 'notion_actions', 'notion_calendar', 'notion_meetings',
  'notion_grants', 'notion_decisions', 'notion_organizations', 'notion_opportunities',
  'ghl_contacts', 'ghl_opportunities', 'ghl_pipelines',
  'calendar_events', 'memory_episodes', 'linkedin_imports', 'linkedin_contacts',
  'receipt_matches', 'receipt_emails', 'xero_transactions', 'xero_invoices',
  'xero_bank_transactions', 'xero_bank_accounts', 'xero_tokens', 'xero_sync_log',
  'bookkeeping_transactions', 'invoice_project_map', 'vendor_project_rules',
  'project_knowledge', 'project_health', 'project_health_analysis', 'project_health_history',
  'project_intelligence_snapshots', 'project_summaries', 'project_budgets',
  'project_monthly_financials', 'project_profiles', 'project_strategic_profile',
  'project_salary_allocations', 'project_contact_alignment',
  'sprint_suggestions', 'sprint_snapshots', 'strategic_objectives',
  'relationship_health', 'contact_entity_links', 'intelligence_insights',
  'founder_intakes', 'founder_intake_messages', 'saved_foundations', 'report_leads',
  'pending_subscriptions', 'site_config', 'financial_overview_cache',
  'reminders', 'imessage_attachments', 'media_assets', 'media_collections', 'media_items',
  'grant_feedback', 'grant_answer_bank', 'wiki_pages', 'articles', 'transcripts',
  'synced_stories', 'canonical_entities', 'entity_potential_matches', 'entity_merge_log',
  'sector_map_cache', 'act_entities', 'civic_digests', 'nz_charities',
  'blog_posts', 'blog_posts_profiles', 'public_profiles', 'authors',
  'alert_preferences', 'alert_notifications', 'alert_events', 'product_events', 'health_alerts',
  'storytellers', 'el_storytellers', 'el_transcripts',
  'agentic_projects', 'agentic_tasks', 'agentic_chat', 'agentic_work_log',
  'ai_discoveries', 'analysis_jobs',
  'bgfit_grants', 'bgfit_budget_items', 'bgfit_transactions', 'bgfit_deadlines',
  'bgfit_suppliers', 'bgfit_financial_periods',
  'goods_content_library', 'goods_communities', 'goods_procurement_entities',
  'collection_media', 'content_link_suggestions', 'content_placements',
  'campaign_tracked_posts', 'collections_actions',
  'cross_system_stats', 'contact_intelligence_scores', 'contact_votes',
  'discrimination_reports', 'sa3_regions',
  'alma_ingestion_jobs', 'alma_media_articles', 'alma_daily_sentiment',
  'alma_sentiment_program_correlation', 'alma_dashboard_interventions',
  'alma_dashboard_queue', 'alma_tags', 'alma_extraction_patterns',
  'alma_entity_sources', 'alma_source_documents', 'alma_discovered_links',
  'alma_funding_opportunities', 'alma_funding_applications',
  'alma_locations', 'alma_raw_content', 'alma_research_sessions', 'alma_research_tool_logs',
  'services', 'services_unified', 'registered_services',
  'team_members', 'coe_key_people',
  'art_innovation', 'art_innovation_profiles',
  'article_locations', 'article_related_programs',
  'email_financial_documents', 'discovered_subscriptions', 'subscription_discovery_events',
  'pipeline_changes', 'procurement_alerts', 'procurement_shortlist_items',
  'mmr_unspsc_categories', 'anao_mmr_exemptions', 'anao_mmr_compliance',
  'youth_opportunities', 'youth_detention_facilities',
  'justice_reinvestment_sites', 'nt_communities', 'historical_inquiries',
  'postcode_sa2_concordance',
]);


async function writeDiscovery(discovery) {
  if (DRY_RUN) {
    console.log(`    [DRY RUN] ${discovery.severity}: ${discovery.title}`);
    return;
  }
  const { error } = await supabase.from('discoveries').insert({
    agent_id: AGENT_ID,
    discovery_type: 'data_quality',
    severity: discovery.severity,
    title: discovery.title,
    description: discovery.description,
    metadata: discovery.metadata || {},
  });
  if (error) console.error('    Failed to write discovery:', error.message);
}

async function main() {
  const t0 = Date.now();
  console.log('Schema Health Watcher');
  console.log('═'.repeat(50));

  const runId = DRY_RUN ? null : (await logStart(supabase, AGENT_ID, 'Schema Health Watcher'))?.id;

  try {
    const discoveries = [];

    // ══════════════════════════════════════════════════
    // 1. Tables with ABN columns not linked to gs_entities
    // ══════════════════════════════════════════════════
    console.log('\n  [1] Checking ABN columns without entity linkage...');
    const abnTables = psql(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name IN ('abn', 'supplier_abn', 'donor_abn', 'recipient_abn', 'acnc_abn')
      ORDER BY table_name
    `);

    const tablesWithEntityId = new Set(psql(`
      SELECT DISTINCT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (column_name = 'gs_entity_id' OR column_name = 'entity_id')
    `).map(r => r.table_name));

    const unlinkableAbnTables = abnTables.filter(r =>
      !tablesWithEntityId.has(r.table_name) &&
      !OPERATIONAL_TABLES.has(r.table_name) &&
      r.table_name !== 'abr_registry' &&
      r.table_name !== 'gs_entities' &&
      !r.table_name.startsWith('mv_') &&
      !r.table_name.startsWith('v_') &&
      !r.table_name.startsWith('v_')
    );

    if (unlinkableAbnTables.length > 0) {
      console.log(`    Found ${unlinkableAbnTables.length} tables with ABN but no entity_id:`);
      for (const t of unlinkableAbnTables) {
        console.log(`      ${t.table_name}.${t.column_name}`);
      }
      discoveries.push({
        severity: 'notable',
        title: `${unlinkableAbnTables.length} tables have ABN columns but no entity linkage`,
        description: `Tables with ABN data that could be linked to gs_entities but lack a gs_entity_id column: ${unlinkableAbnTables.map(t => t.table_name).join(', ')}`,
        metadata: { tables: unlinkableAbnTables },
      });
    } else {
      console.log('    All ABN tables have entity linkage ✓');
    }

    // ══════════════════════════════════════════════════
    // 2. entity_id columns without FK constraints
    // ══════════════════════════════════════════════════
    console.log('\n  [2] Checking entity_id columns without FK constraints...');
    const entityIdCols = psql(`
      SELECT c.table_name, c.column_name
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.column_name IN ('gs_entity_id', 'entity_id', 'source_entity_id', 'target_entity_id')
        AND c.data_type = 'uuid'
      ORDER BY c.table_name
    `);

    const fkColumns = new Set(psql(`
      SELECT DISTINCT kcu.table_name || '.' || kcu.column_name as col
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    `).map(r => r.col));

    const unfkEntityCols = entityIdCols.filter(r =>
      !fkColumns.has(`${r.table_name}.${r.column_name}`) &&
      !OPERATIONAL_TABLES.has(r.table_name) &&
      !r.table_name.startsWith('mv_') &&
      !r.table_name.startsWith('v_')
    );

    if (unfkEntityCols.length > 0) {
      console.log(`    Found ${unfkEntityCols.length} entity_id columns without FK:`);
      for (const c of unfkEntityCols) {
        console.log(`      ${c.table_name}.${c.column_name}`);
      }
      // Check for orphaned references
      for (const c of unfkEntityCols.slice(0, 5)) {
        const orphans = psql(`
          SELECT COUNT(*) as orphaned
          FROM ${c.table_name} t
          WHERE t.${c.column_name} IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM gs_entities e WHERE e.id = t.${c.column_name})
        `);
        const orphanCount = parseInt(orphans[0]?.orphaned || '0');
        if (orphanCount > 0) {
          console.log(`      ⚠ ${c.table_name}.${c.column_name}: ${orphanCount} orphaned references`);
          discoveries.push({
            severity: 'significant',
            title: `${c.table_name}.${c.column_name} has ${orphanCount} orphaned entity references`,
            description: `Column references gs_entities.id but has no FK constraint. ${orphanCount} rows point to non-existent entities.`,
            metadata: { table: c.table_name, column: c.column_name, orphaned: orphanCount },
          });
        }
      }
    } else {
      console.log('    All entity_id columns have FK constraints ✓');
    }

    // ══════════════════════════════════════════════════
    // 3. Unclassified tables with >100 rows
    // ══════════════════════════════════════════════════
    console.log('\n  [3] Checking for unclassified data tables...');
    const allTables = psql(`
      SELECT relname as table_name, n_live_tup as est_rows
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND n_live_tup > 100
        AND relname NOT LIKE 'mv_%'
        AND relname NOT LIKE 'v_%'
        AND relname NOT LIKE 'vw_%'
      ORDER BY n_live_tup DESC
    `);

    const unclassified = allTables.filter(t =>
      !CLASSIFIED_TABLES.has(t.table_name) &&
      !OPERATIONAL_TABLES.has(t.table_name)
    );

    if (unclassified.length > 0) {
      console.log(`    Found ${unclassified.length} unclassified tables with >100 rows:`);
      for (const t of unclassified) {
        console.log(`      ${t.table_name} (${parseInt(t.est_rows).toLocaleString()} rows)`);
      }
      discoveries.push({
        severity: 'info',
        title: `${unclassified.length} data tables not classified in Clarity page`,
        description: `Tables with >100 rows not shown on /clarity: ${unclassified.map(t => `${t.table_name} (${parseInt(t.est_rows).toLocaleString()})`).join(', ')}`,
        metadata: { tables: unclassified },
      });
    } else {
      console.log('    All significant tables are classified ✓');
    }

    // ══════════════════════════════════════════════════
    // 4. New tables since last run
    // ══════════════════════════════════════════════════
    console.log('\n  [4] Checking for new tables...');
    const currentTables = new Set(allTables.map(t => t.table_name));
    let newTables = [];

    if (existsSync(STATE_FILE)) {
      try {
        const lastTables = new Set(JSON.parse(readFileSync(STATE_FILE, 'utf-8')));
        newTables = [...currentTables].filter(t => !lastTables.has(t));
      } catch {}
    }

    // Save current state for next run
    writeFileSync(STATE_FILE, JSON.stringify([...currentTables]));

    if (newTables.length > 0) {
      console.log(`    Found ${newTables.length} new tables since last run:`);
      for (const t of newTables) {
        const rows = allTables.find(r => r.table_name === t)?.est_rows || '?';
        console.log(`      ${t} (${parseInt(rows).toLocaleString()} rows)`);
      }
      discoveries.push({
        severity: 'notable',
        title: `${newTables.length} new tables detected: ${newTables.join(', ')}`,
        description: `New tables appeared since last schema health check. Review for classification and linkage opportunities.`,
        metadata: { tables: newTables },
      });
    } else {
      console.log('    No new tables ✓');
    }

    // ══════════════════════════════════════════════════
    // 5. ABN match rates — find low-linkage tables
    // ══════════════════════════════════════════════════
    console.log('\n  [5] Checking ABN match rates against registry...');
    const abnMatchTargets = abnTables.filter(r =>
      CLASSIFIED_TABLES.has(r.table_name) &&
      r.table_name !== 'abr_registry' &&
      r.table_name !== 'gs_entities'
    );

    for (const t of abnMatchTargets.slice(0, 8)) {
      const result = psql(`
        SELECT
          COUNT(*) as total,
          COUNT(${t.column_name}) as has_abn,
          COUNT(CASE WHEN ${t.column_name} IS NOT NULL AND EXISTS (
            SELECT 1 FROM abr_registry a WHERE a.abn = ${t.table_name}.${t.column_name}
          ) THEN 1 END) as matched
        FROM ${t.table_name}
        LIMIT 1
      `);
      if (result.length > 0) {
        const r = result[0];
        const total = parseInt(r.total);
        const hasAbn = parseInt(r.has_abn);
        const matched = parseInt(r.matched);
        const matchPct = hasAbn > 0 ? Math.round(matched / hasAbn * 100) : 0;
        const abnPct = total > 0 ? Math.round(hasAbn / total * 100) : 0;

        console.log(`    ${t.table_name}.${t.column_name}: ${abnPct}% have ABN, ${matchPct}% valid in ABR`);

        if (hasAbn > 100 && matchPct < 80) {
          discoveries.push({
            severity: 'notable',
            title: `${t.table_name}: only ${matchPct}% of ABNs match registry`,
            description: `${hasAbn.toLocaleString()} records have ABN but only ${matched.toLocaleString()} (${matchPct}%) match abr_registry. ${(hasAbn - matched).toLocaleString()} may be invalid or formatted incorrectly.`,
            metadata: { table: t.table_name, column: t.column_name, total, has_abn: hasAbn, matched, match_pct: matchPct },
          });
        }
      }
    }

    // ══════════════════════════════════════════════════
    // 6. MV freshness — check for stale materialized views
    // ══════════════════════════════════════════════════
    console.log('\n  [6] Checking materialized view freshness...');
    const mvRows = psql(`
      SELECT relname as view_name, n_live_tup as est_rows
      FROM pg_stat_user_tables
      WHERE schemaname = 'public' AND relname LIKE 'mv_%'
      ORDER BY relname
    `);

    const emptyMvs = mvRows.filter(r => parseInt(r.est_rows) === 0);
    if (emptyMvs.length > 0) {
      console.log(`    ${emptyMvs.length} empty materialized views:`);
      for (const mv of emptyMvs) {
        console.log(`      ${mv.view_name}`);
      }
      discoveries.push({
        severity: 'info',
        title: `${emptyMvs.length} materialized views are empty`,
        description: `Empty MVs: ${emptyMvs.map(m => m.view_name).join(', ')}. May need REFRESH MATERIALIZED VIEW.`,
        metadata: { views: emptyMvs.map(m => m.view_name) },
      });
    }

    // ══════════════════════════════════════════════════
    // Summary
    // ══════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(50));
    console.log(`  Schema Health Check Complete`);
    console.log(`  Tables scanned: ${allTables.length}`);
    console.log(`  Classified: ${allTables.filter(t => CLASSIFIED_TABLES.has(t.table_name)).length}`);
    console.log(`  Unclassified: ${unclassified.length}`);
    console.log(`  Discoveries: ${discoveries.length}`);
    console.log(`  Duration: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    // Write discoveries
    for (const d of discoveries) {
      await writeDiscovery(d);
    }

    if (!DRY_RUN && runId) {
      await logComplete(supabase, runId, discoveries.length, discoveries.filter(d => d.severity !== 'info').length);
    }

    console.log(`\n  Done. ${discoveries.length} discoveries written.`);
  } catch (err) {
    console.error('Fatal error:', err);
    if (!DRY_RUN && runId) {
      await logFailed(supabase, runId, err.message);
    }
    process.exit(1);
  }
}

main();

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/data/schema-graph
 *
 * Returns the full data model as a graph: tables as nodes, foreign keys + ABN joins as edges.
 * Powers the interactive Obsidian-style schema visualization on /clarity.
 */

interface TableNode {
  id: string;
  label: string;
  records: number;
  domain: string;
  size: number; // visual size
}

interface TableEdge {
  source: string;
  target: string;
  type: 'fk' | 'abn' | 'entity_id' | 'postcode';
  column: string;
}

// Domain classification for every significant table
const TABLE_DOMAIN: Record<string, string> = {
  // Entity Graph
  gs_entities: 'Entity Graph', gs_relationships: 'Entity Graph', entity_xref: 'Entity Graph',
  gs_entity_aliases: 'Entity Graph', entity_identifiers: 'Entity Graph',
  // Registries
  abr_registry: 'Registries', asic_companies: 'Registries', acnc_charities: 'Registries',
  acnc_ais: 'Registries', acnc_programs: 'Registries', oric_corporations: 'Registries',
  asx_companies: 'Registries', asic_name_lookup: 'Registries',
  // Procurement
  austender_contracts: 'Procurement', state_tenders: 'Procurement',
  ndis_registered_providers: 'Procurement', ndis_active_providers: 'Procurement',
  // Funding
  justice_funding: 'Funding', grant_opportunities: 'Funding', foundations: 'Funding',
  foundation_programs: 'Funding', research_grants: 'Funding', opportunities_unified: 'Funding',
  // Influence
  political_donations: 'Influence', ato_tax_transparency: 'Influence',
  civic_hansard: 'Influence', civic_ministerial_diaries: 'Influence',
  civic_ministerial_statements: 'Influence', oversight_recommendations: 'Influence',
  civic_alerts: 'Influence', civic_charter_commitments: 'Influence', policy_events: 'Influence',
  // People
  person_roles: 'People', person_identity_map: 'People', person_entity_links: 'People',
  campaign_alignment_entities: 'People', donor_entity_matches: 'People',
  // Evidence
  alma_interventions: 'Evidence', alma_evidence: 'Evidence', alma_outcomes: 'Evidence',
  alma_research_findings: 'Evidence', alma_program_interventions: 'Evidence',
  alma_government_programs: 'Evidence', alma_intervention_outcomes: 'Evidence',
  outcomes_metrics: 'Evidence', aihw_child_protection: 'Evidence',
  // Social
  ndis_utilisation: 'Social', ndis_participants: 'Social', ndis_participants_lga: 'Social',
  ndis_market_concentration: 'Social', ndis_first_nations: 'Social',
  dss_payment_demographics: 'Social', social_enterprises: 'Social', acara_schools: 'Social',
  crime_stats_lga: 'Social', charity_impact_reports: 'Social',
  // Geography
  postcode_geo: 'Geography', lga_cross_system_stats: 'Geography', seifa_2021: 'Geography',
  // Analysis (MVs)
  mv_entity_power_index: 'Analysis', mv_funding_deserts: 'Analysis',
  mv_revolving_door: 'Analysis', mv_board_interlocks: 'Analysis',
  mv_person_influence: 'Analysis', mv_gs_donor_contractors: 'Analysis',
  mv_evidence_backed_funding: 'Analysis', mv_disability_landscape: 'Analysis',
  mv_foundation_scores: 'Analysis', mv_org_justice_signals: 'Analysis',
  mv_gs_entity_stats: 'Analysis', mv_person_entity_network: 'Analysis',
  mv_funding_by_postcode: 'Analysis', mv_donor_contract_crossref: 'Analysis',
  mv_trustee_grantee_chain: 'Analysis', mv_foundation_trends: 'Analysis',
  mv_foundation_regranting: 'Analysis', mv_foundation_grantees: 'Analysis',
  mv_person_directory: 'Analysis', mv_person_network: 'Analysis',
  mv_person_cross_system: 'Analysis', mv_crossref_quality: 'Analysis',
  mv_data_quality: 'Analysis',
};

const DOMAIN_COLORS: Record<string, string> = {
  'Entity Graph': '#1a1a1a',
  Registries: '#10B981',
  Procurement: '#3B82F6',
  Funding: '#F59E0B',
  Influence: '#EF4444',
  People: '#8B5CF6',
  Evidence: '#EC4899',
  Social: '#14B8A6',
  Geography: '#F97316',
  Analysis: '#6B7280',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe<T = any>(p: PromiseLike<T>, ms = 15000): Promise<T | { data: null; error: string }> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<{ data: null; error: string }>(resolve => setTimeout(() => resolve({ data: null, error: 'timeout' }), ms)),
  ]);
}

export async function GET() {
  const db = getServiceSupabase();

  try {
    // Get table row counts and FK relationships in parallel
    const [rowCountsResult, fkResult, abnColumnsResult] = await Promise.all([
      safe(db.rpc('exec_sql', {
        query: `SELECT relname as table_name, n_live_tup as est_rows
                FROM pg_stat_user_tables
                WHERE schemaname = 'public' AND n_live_tup > 0
                ORDER BY n_live_tup DESC`,
      })),
      safe(db.rpc('exec_sql', {
        query: `SELECT DISTINCT
                  cl1.relname as from_table,
                  att1.attname as from_column,
                  cl2.relname as to_table,
                  att2.attname as to_column
                FROM pg_constraint con
                JOIN pg_class cl1 ON con.conrelid = cl1.oid
                JOIN pg_class cl2 ON con.confrelid = cl2.oid
                JOIN pg_attribute att1 ON att1.attrelid = cl1.oid AND att1.attnum = ANY(con.conkey)
                JOIN pg_attribute att2 ON att2.attrelid = cl2.oid AND att2.attnum = ANY(con.confkey)
                JOIN pg_namespace ns ON cl1.relnamespace = ns.oid
                WHERE con.contype = 'f' AND ns.nspname = 'public'
                ORDER BY from_table, from_column
                LIMIT 500`,
      })),
      safe(db.rpc('exec_sql', {
        query: `SELECT DISTINCT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND column_name IN ('abn', 'supplier_abn', 'donor_abn', 'recipient_abn', 'acnc_abn')
                ORDER BY table_name`,
      })),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowCounts = (rowCountsResult as any)?.data ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fks = (fkResult as any)?.data ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const abnCols = (abnColumnsResult as any)?.data ?? [];

    // Build nodes — only include tables we've classified
    const nodes: TableNode[] = [];
    const tableSet = new Set<string>();

    for (const row of rowCounts) {
      const name = row.table_name;
      const domain = TABLE_DOMAIN[name];
      if (!domain) continue; // skip unclassified tables

      const records = Number(row.est_rows);
      tableSet.add(name);
      nodes.push({
        id: name,
        label: name,
        records,
        domain,
        size: Math.max(4, Math.min(30, Math.log10(Math.max(records, 1)) * 6)),
      });
    }

    // Build edges from FKs
    const edges: TableEdge[] = [];
    const edgeSet = new Set<string>();

    for (const fk of fks) {
      const from = fk.from_table;
      const to = fk.to_table;
      if (!tableSet.has(from) || !tableSet.has(to)) continue;
      if (from === to) continue; // skip self-references

      const key = `${from}->${to}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);

      const col = fk.from_column;
      const type = col.includes('entity_id') || col.includes('gs_entity') ? 'entity_id' as const :
                   col.includes('postcode') ? 'postcode' as const : 'fk' as const;

      edges.push({ source: from, target: to, type, column: col });
    }

    // Add implicit ABN edges (tables with ABN columns → gs_entities)
    for (const row of abnCols) {
      const table = row.table_name;
      if (!tableSet.has(table)) continue;
      if (table === 'abr_registry' || table === 'gs_entities') continue;

      const key = `${table}->gs_entities`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: table, target: 'gs_entities', type: 'abn', column: row.column_name });
      }
    }

    // Add known implicit connections not captured by FKs
    const implicitEdges: [string, string, 'entity_id' | 'abn' | 'fk' | 'postcode', string][] = [
      // Entity ID columns without FK constraints
      ['justice_funding', 'gs_entities', 'entity_id', 'gs_entity_id'],
      ['alma_interventions', 'gs_entities', 'entity_id', 'gs_entity_id'],
      ['person_entity_links', 'gs_entities', 'entity_id', 'entity_id'],
      ['contact_entity_links', 'gs_entities', 'entity_id', 'entity_id'],
      ['donor_entity_matches', 'gs_entities', 'entity_id', 'entity_id'],
      ['oversight_recommendations', 'gs_entities', 'entity_id', 'target_entity_ids'],
      // Relationship edges
      ['gs_relationships', 'gs_entities', 'entity_id', 'source_entity_id'],
      // Registry cross-links
      ['acnc_programs', 'acnc_charities', 'fk', 'abn'],
      ['acnc_ais', 'acnc_charities', 'abn', 'abn'],
      ['foundations', 'acnc_charities', 'abn', 'acnc_abn'],
      ['oric_corporations', 'acnc_charities', 'abn', 'abn'],
      // ALMA sub-tables
      ['alma_evidence', 'alma_interventions', 'fk', 'intervention_id'],
      ['alma_outcomes', 'alma_interventions', 'fk', 'intervention_id'],
      ['alma_research_findings', 'alma_interventions', 'fk', 'intervention_id'],
      ['alma_program_interventions', 'alma_interventions', 'fk', 'intervention_id'],
      ['alma_program_interventions', 'alma_government_programs', 'fk', 'program_id'],
      ['alma_intervention_outcomes', 'alma_interventions', 'fk', 'intervention_id'],
      // Person network
      ['person_roles', 'gs_entities', 'entity_id', 'entity_id'],
      ['campaign_alignment_entities', 'person_identity_map', 'fk', 'person_id'],
      // Postcode joins
      ['gs_entities', 'postcode_geo', 'postcode', 'postcode'],
      ['acnc_charities', 'postcode_geo', 'postcode', 'postcode'],
      ['ndis_registered_providers', 'postcode_geo', 'postcode', 'postcode'],
      ['acara_schools', 'postcode_geo', 'postcode', 'postcode'],
      ['postcode_geo', 'seifa_2021', 'postcode', 'postcode'],
      // Funding to entity xref
      ['entity_xref', 'gs_entities', 'entity_id', 'entity_id'],
      // MV sources
      ['mv_entity_power_index', 'gs_entities', 'entity_id', 'entity_id'],
      ['mv_revolving_door', 'gs_entities', 'entity_id', 'entity_id'],
      ['mv_board_interlocks', 'person_roles', 'fk', 'person_name'],
      ['mv_person_influence', 'person_roles', 'fk', 'person_name'],
      ['mv_funding_deserts', 'postcode_geo', 'postcode', 'lga_code'],
      ['mv_evidence_backed_funding', 'alma_interventions', 'fk', 'intervention_id'],
      ['mv_evidence_backed_funding', 'justice_funding', 'fk', 'funding_id'],
      ['mv_gs_donor_contractors', 'gs_entities', 'entity_id', 'entity_id'],
      ['mv_org_justice_signals', 'gs_entities', 'entity_id', 'entity_id'],
      ['mv_disability_landscape', 'ndis_participants', 'fk', 'lga'],
      ['mv_foundation_scores', 'foundations', 'fk', 'foundation_id'],
      ['mv_foundation_trends', 'foundations', 'fk', 'foundation_id'],
      ['lga_cross_system_stats', 'postcode_geo', 'fk', 'lga_code'],
      ['crime_stats_lga', 'postcode_geo', 'fk', 'lga_code'],
      ['ndis_participants_lga', 'postcode_geo', 'fk', 'lga_code'],
      // Social data to geography
      ['dss_payment_demographics', 'postcode_geo', 'postcode', 'sa2_code'],
    ];

    for (const [from, to, type, col] of implicitEdges) {
      if (!tableSet.has(from) || !tableSet.has(to)) continue;
      if (from === to) continue;
      const key = `${from}->${to}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: from, target: to, type, column: col });
      }
    }

    const response = NextResponse.json({
      nodes,
      edges,
      domains: DOMAIN_COLORS,
      stats: {
        tables: nodes.length,
        edges: edges.length,
        total_records: nodes.reduce((s, n) => s + n.records, 0),
      },
    });

    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (err) {
    console.error('[schema-graph]', err);
    return NextResponse.json({ error: 'Failed to build schema graph' }, { status: 500 });
  }
}

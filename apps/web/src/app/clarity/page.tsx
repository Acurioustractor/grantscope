import type { Metadata } from 'next';
import { BriefingLoopBar } from '@/app/components/briefing-loop-bar';
import { buildClarityPageState } from '@/app/components/briefing-page-params';
import { getServiceSupabase } from '@/lib/supabase';
import SchemaGraph from './schema-graph';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Clarity | CivicGraph',
  description: 'How CivicGraph connects public data to make government spending, influence, and outcomes visible.',
};

/* ─── Types ───────────────────────────────────────── */

interface TopicCoverage {
  topic: string;
  state: string;
  records: number;
  total_dollars: number;
}

interface SystemLink {
  name: string;
  table: string;
  records: number;
  linkage_pct: number;
  description: string;
}

interface Finding {
  severity: 'strength' | 'gap' | 'insight';
  claim: string;
  evidence: string;
}

interface DataCatalogLatest {
  table_name: string;
  domain: string;
  owner_team: string;
  source_of_truth: boolean;
  pii_level: string;
  sla_hours: number;
  row_count: number | null;
  freshness_hours: number | null;
  provenance_coverage_pct: number | null;
  confidence_coverage_pct: number | null;
  snapshot_at: string | null;
}

type SearchParams = {
  subject?: string;
  state?: string;
  lanes?: string;
  output?: string;
};

/* ─── Helpers ─────────────────────────────────────── */

function fmt(n: number): string { return n.toLocaleString(); }
function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}
function pct(n: number): string { return `${Math.round(n)}%`; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe<T = any>(p: PromiseLike<T>, ms = 12000): Promise<T | { data: null; error: string }> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<{ data: null; error: string }>(resolve => setTimeout(() => resolve({ data: null, error: 'timeout' }), ms)),
  ]);
}

/* ─── Coverage heatmap color ──────────────────────── */

function heatColor(records: number): string {
  if (records === 0) return 'bg-gray-100 text-gray-400';
  if (records < 10) return 'bg-red-100 text-red-700';
  if (records < 100) return 'bg-orange-100 text-orange-700';
  if (records < 500) return 'bg-yellow-100 text-yellow-700';
  if (records < 1000) return 'bg-blue-100 text-blue-700';
  return 'bg-green-100 text-green-700';
}

function linkageColor(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 50) return 'text-yellow-600';
  return 'text-bauhaus-red';
}

function linkageBg(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-bauhaus-red';
}

/* ─── Data fetching ───────────────────────────────── */

async function getData() {
  const db = getServiceSupabase();

  // Batch 1: heavy table scans (max 7 concurrent to stay under pool limit)
  const [
    topicMatrixResult,
    almaMatrixResult,
    justiceResult,
    almaLinkResult,
    contractResult,
    donationResult,
    foundationResult,
  ] = await Promise.all([
    safe(db.rpc('exec_sql', {
      query: `SELECT unnest(topics) as topic, state, COUNT(*) as records, COALESCE(SUM(amount_dollars), 0) as total_dollars
              FROM justice_funding WHERE source != 'austender-direct' AND cardinality(topics) > 0
              GROUP BY topic, state ORDER BY topic, total_dollars DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT unnest(topics) as topic, unnest(geography) as state, COUNT(*) as records
              FROM alma_interventions WHERE cardinality(topics) > 0
              GROUP BY topic, state ORDER BY topic, records DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(gs_entity_id) as linked,
              ROUND(COUNT(gs_entity_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct
              FROM justice_funding`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(gs_entity_id) as linked,
              ROUND(COUNT(gs_entity_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct
              FROM alma_interventions WHERE data_quality = 'valid'`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(supplier_abn) as with_abn,
              ROUND(COUNT(supplier_abn)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct
              FROM austender_contracts`,
    }), 20000),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(donor_abn) as with_abn,
              ROUND(COUNT(donor_abn)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct
              FROM political_donations`,
    }), 20000),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as total, COUNT(gs_entity_id) as linked,
              ROUND(COUNT(gs_entity_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pct
              FROM foundations`,
    })),
  ]);

  // Batch 2: use estimated counts (instant) + smaller queries
  const [
    estCountsResult,
    allTablesResult,
    outcomesResult,
    untaggedResult,
    crossSystemResult,
    desertResult,
    catalogResult,
  ] = await Promise.all([
    // Fast estimated row counts from pg_stat (no table scan!)
    safe(db.rpc('exec_sql', {
      query: `SELECT relname as table_name, n_live_tup as est_rows
              FROM pg_stat_user_tables
              WHERE schemaname = 'public'
                AND relname IN ('gs_entities', 'gs_relationships')`,
    })),
    // ALL tables with estimated row counts
    safe(db.rpc('exec_sql', {
      query: `SELECT
                c.relname as table_name,
                GREATEST(
                  COALESCE(s.n_live_tup, 0)::bigint,
                  COALESCE(c.reltuples, 0)::bigint
                ) as est_rows
              FROM pg_class c
              LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
              WHERE c.relkind = 'r'
                AND c.relnamespace = 'public'::regnamespace
                AND GREATEST(
                  COALESCE(s.n_live_tup, 0)::bigint,
                  COALESCE(c.reltuples, 0)::bigint
                ) > 0
              ORDER BY est_rows DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT jurisdiction as state, COUNT(DISTINCT metric_name) as metric_types, COUNT(*) as total
              FROM outcomes_metrics GROUP BY jurisdiction ORDER BY total DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT state, COUNT(*) as untagged FROM justice_funding
              WHERE (topics IS NULL OR cardinality(topics) = 0) AND source != 'austender-direct'
              GROUP BY state ORDER BY untagged DESC LIMIT 10`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT system_count, COUNT(*) as entities FROM mv_entity_power_index
              GROUP BY system_count ORDER BY system_count DESC`,
    })),
    safe(db.rpc('exec_sql', {
      query: `SELECT COUNT(*) as deserts FROM mv_funding_deserts WHERE desert_score >= 70`,
    })),
    safe(db.from('v_data_catalog_latest')
      .select('table_name, domain, owner_team, source_of_truth, pii_level, sla_hours, row_count, freshness_hours, provenance_coverage_pct, confidence_coverage_pct, snapshot_at')
      .order('domain', { ascending: true })
      .order('table_name', { ascending: true })),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parse = (r: any) => r?.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseFirst = (r: any) => (r?.data ?? [])[0] ?? {};

  // Parse estimated counts into entity/relationship totals
  const estCounts = parse(estCountsResult) as { table_name: string; est_rows: number }[];
  const entityCountResult = { data: [{ total: estCounts.find(r => r.table_name === 'gs_entities')?.est_rows ?? 0 }] };
  const relCountResult = { data: [{ total: estCounts.find(r => r.table_name === 'gs_relationships')?.est_rows ?? 0 }] };

  return {
    topicMatrix: parse(topicMatrixResult) as TopicCoverage[],
    almaMatrix: parse(almaMatrixResult) as { topic: string; state: string; records: number }[],
    justice: parseFirst(justiceResult),
    almaLink: parseFirst(almaLinkResult),
    contracts: parseFirst(contractResult),
    donations: parseFirst(donationResult),
    foundations: parseFirst(foundationResult),
    entities: parseFirst(entityCountResult),
    relationships: parseFirst(relCountResult),
    allTables: parse(allTablesResult) as { table_name: string; est_rows: number }[],
    outcomes: parse(outcomesResult) as { state: string; metric_types: number; total: number }[],
    untagged: parse(untaggedResult) as { state: string; untagged: number }[],
    crossSystem: parse(crossSystemResult) as { system_count: number; entities: number }[],
    deserts: parseFirst(desertResult),
    dataCatalog: parse(catalogResult) as DataCatalogLatest[],
  };
}

/* ─── Auto-generate findings ──────────────────────── */

function generateFindings(data: Awaited<ReturnType<typeof getData>>): Finding[] {
  const findings: Finding[] = [];

  // Entity graph scale
  const entityTotal = Number(data.entities.total ?? 0);
  const relTotal = Number(data.relationships.total ?? 0);
  if (entityTotal > 0) {
    findings.push({
      severity: 'strength',
      claim: `${fmt(entityTotal)} entities connected by ${fmt(relTotal)} relationships`,
      evidence: 'Entity graph spans procurement, charities, donations, justice funding, lobbying, boards, and tax data.',
    });
  }

  // Justice funding linkage
  const jPct = Number(data.justice.pct ?? 0);
  if (jPct > 80) {
    findings.push({
      severity: 'strength',
      claim: `${pct(jPct)} of justice funding records linked to known entities`,
      evidence: `${fmt(Number(data.justice.linked))} of ${fmt(Number(data.justice.total))} records resolved to gs_entities via ABN + name matching.`,
    });
  }

  // ALMA evidence coverage
  const aPct = Number(data.almaLink.pct ?? 0);
  findings.push({
    severity: aPct >= 60 ? 'strength' : 'gap',
    claim: `${pct(aPct)} of Australian Living Map of Alternatives (ALMA) interventions linked to CivicGraph entities`,
    evidence: `Evidence database connects to the funding graph — see which orgs have evidence-backed programs.`,
  });

  // Cross-system entities
  const multiSystem = data.crossSystem.filter(c => Number(c.system_count) >= 3);
  const multiCount = multiSystem.reduce((s, c) => s + Number(c.entities), 0);
  if (multiCount > 0) {
    findings.push({
      severity: 'insight',
      claim: `${fmt(multiCount)} entities appear in 3+ government systems`,
      evidence: 'Cross-system presence reveals influence concentration — who gets contracts AND donates AND receives justice funding.',
    });
  }

  // Coverage gaps
  const topicMatrix = data.topicMatrix;
  const states = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
  const topics = [...new Set(topicMatrix.map(t => t.topic))];
  const statesWithOrgData = new Set(
    topicMatrix.filter(t => Number(t.records) > 200).map(t => t.state)
  );
  const missingStates = states.filter(s => !statesWithOrgData.has(s));
  if (missingStates.length > 0) {
    findings.push({
      severity: 'gap',
      claim: `${missingStates.join(', ')} still have thin org-level funding coverage`,
      evidence: 'QLD is the only dense per-recipient funding lane. Other states now have some org-level records, but the coverage is still much thinner and often needs to be read alongside aggregate ROGS and AIHW layers.',
    });
  }

  // Untagged records
  const totalUntagged = data.untagged.reduce((s, u) => s + Number(u.untagged), 0);
  if (totalUntagged > 1000) {
    findings.push({
      severity: 'gap',
      claim: `${fmt(totalUntagged)} funding records still unclassified by topic`,
      evidence: 'These are mostly general-purpose QLD government grants (gambling, sport, small business) that don\'t map to social sector topics.',
    });
  }

  // Funding deserts
  const desertCount = Number(data.deserts.deserts ?? 0);
  if (desertCount > 0) {
    findings.push({
      severity: 'insight',
      claim: `${fmt(desertCount)} LGAs identified as funding deserts`,
      evidence: 'High disadvantage (SEIFA + remoteness) combined with low per-capita funding. Methodology: desert_score = disadvantage × (1 / funding intensity).',
    });
  }

  // Topics coverage
  if (topics.length > 0) {
    findings.push({
      severity: 'strength',
      claim: `${topics.length} topic domains tracked across ${fmt(topicMatrix.length)} state-topic combinations`,
      evidence: `Topics: ${topics.join(', ')}. Each auto-classified by program name via database triggers.`,
    });
  }

  return findings;
}

/* ─── Domain classifier — auto-classifies ALL tables ─── */

interface TableEntry {
  table: string;
  records: number;
}

const DOMAIN_RULES: { domain: string; color: string; patterns: RegExp[] }[] = [
  { domain: 'Entity Graph', color: 'bg-bauhaus-black', patterns: [
    /^gs_entit/, /^gs_relationship/, /^entity_/, /^canonical_entit/, /^donor_entity/,
    /^name_alias/, /^cross_system_stat/,
  ]},
  { domain: 'Registries', color: 'bg-green-500', patterns: [
    /^abr_/, /^asic_/, /^acnc_/, /^oric_/, /^asx_/, /^nz_charit/,
  ]},
  { domain: 'Procurement', color: 'bg-bauhaus-blue', patterns: [
    /^austender/, /^state_tender/, /^procurement_/, /^goods_/,
  ]},
  { domain: 'Funding & Grants', color: 'bg-yellow-500', patterns: [
    /^justice_fund/, /^grant_/, /^foundation/, /^research_grant/, /^funding_/,
    /^saved_grant/, /^saved_found/, /^money_flow/, /^opportunities_unified/,
    /^source_frontier/, /^government_program/,
  ]},
  { domain: 'Influence & Accountability', color: 'bg-bauhaus-red', patterns: [
    /^political_/, /^ato_/, /^civic_/, /^oversight_/, /^lobbying/,
    /^discrimination/, /^policy_event/,
  ]},
  { domain: 'People & Governance', color: 'bg-purple-500', patterns: [
    /^person_/, /^linkedin_/, /^ghl_/, /^contact_/, /^org_contact/,
    /^enrichment_ready/, /^fellows/,
  ]},
  { domain: 'Evidence & Outcomes', color: 'bg-pink-500', patterns: [
    /^alma_/, /^outcomes_/, /^aihw_/, /^crime_stat/, /^rogs_/,
    /^justicehub/, /^justice_matrix/, /^international_prog/, /^governed_proof_/,
    /^tracker_evidence_/,
  ]},
  { domain: 'Social & Disability', color: 'bg-teal-500', patterns: [
    /^ndis_/, /^dss_/, /^social_enter/, /^acara_/, /^community_/,
    /^nt_communit/, /^youth_deten/, /^disability/,
  ]},
  { domain: 'Geography', color: 'bg-orange-500', patterns: [
    /^postcode_/, /^seifa_/, /^sa[23]_/, /^lga_/, /^agil_/,
  ]},
  { domain: 'Platform & Ops', color: 'bg-gray-400', patterns: [
    /^agent_/, /^webhook/, /^privacy_/, /^api_/, /^pm2_/, /^sync_/,
    /^site_health/, /^health_alert/, /^discover/, /^page_view/,
    /^app_/, /^user_/, /^users$/, /^ce_/, /^integration_/,
    /^processing_/, /^migration_/, /^subscription/, /^pending_sub/,
    /^alert_event/, /^data_catalog/, /^analysis_job/,
  ]},
  { domain: 'Content & Knowledge', color: 'bg-indigo-400', patterns: [
    /^knowledge_/, /^project_/, /^notion_/, /^blog_/, /^article/,
    /^media_/, /^cms_/, /^wiki_/, /^story/, /^content_/, /^transcript/,
    /^sprint_/, /^idea_/, /^exa_/, /^intelligence_/, /^signal_/,
    /^review_/, /^pulse_/, /^campaign_/, /^el_/, /^portrait/, /^photo/,
    /^quote/, /^ralph_/, /^agentic_/, /^daily_reflect/, /^research_item/,
    /^ai_discover/,
  ]},
  { domain: 'Finance & Ops', color: 'bg-amber-500', patterns: [
    /^xero_/, /^receipt_/, /^bookkeeping/, /^dext_/, /^email_/,
    /^gmail_/, /^bgfit_/, /^financial_/, /^revenue_/, /^cashflow/,
    /^vendor_/, /^fundrais/, /^calendar_/, /^remind/, /^message/,
    /^communication/, /^org_/, /^organization/, /^team_/, /^services/,
    /^registered_service/, /^tour_/, /^studio_/, /^telegram_/,
    /^charity_claim/, /^credential/, /^token/, /^public_/,
    /^imessage_/, /^memo/, /^data_source/, /^goal/, /^metric/,
    /^location/, /^event/, /^facility/, /^resource_alloc/, /^compliance/,
    /^role_tax/, /^repo_/, /^ecosystem_/, /^art_innov/, /^gov_prog/,
    /^clearinghouse/, /^partner_/, /^pmpp/, /^recommend/,
    /^scraped_/, /^coe_/, /^learned_/, /^collection_/, /^author/,
    /^org_profile/, /^org_member/, /^org_grant/, /^org_program/,
    /^org_milestone/, /^org_leader/, /^org_referral/, /^org_session/,
    /^org_pipeline/, /^org_compliance/, /^org_action/, /^org_participant/,
    /^public_spend/, /^platform_/, /^profile/, /^tab_/, /^relationship_health/,
    /^relationship_pipeline/, /^touchpoint/, /^bank_statement_line/,
  ]},
];

function classifyTable(name: string): string {
  for (const rule of DOMAIN_RULES) {
    if (rule.patterns.some(p => p.test(name))) return rule.domain;
  }
  return 'Other';
}

// Tables from other projects/products that share this Supabase instance
const EXCLUDED_TABLES = [
  // ACT (A Curious Tractor) business ops
  /^xero_/, /^receipt/, /^bookkeeping/, /^dext_/, /^ghl_/, /^bgfit_/, /^cashflow/,
  /^vendor_/, /^financial_/, /^revenue_/, /^email_financial/, /^email_response/,
  // Empathy Ledger
  /^el_/, /^story/, /^portrait/, /^photo/, /^fellow/, /^tour_/, /^partner_/,
  /^review_video/, /^review_media/, /^review_curated/, /^review_project/, /^review_year/,
  /^storyteller_/, /^synced_stor/,
  // Personal productivity / other apps
  /^telegram_/, /^imessage_/, /^gmail_/, /^calendar_event/, /^reminder/,
  /^notion_/, /^sprint_/, /^daily_reflect/, /^idea_board/, /^agentic_/,
  /^ralph_/, /^studio_/, /^cms_/, /^wiki_/, /^blog_/, /^memory_episode/,
  // Legacy CRM / comms
  /^linkedin_/, /^communication/, /^contact_intel/, /^contact_cadence/,
  /^contact_enrichment/, /^contact_project/, /^contact_support/, /^contact_vote/,
  /^contact_entity/, /^enrichment_rev/, /^profile_sync/, /^profile_appear/,
  /^org_session/, /^org_participant/, /^org_pipeline/, /^org_action/,
  /^org_compliance/, /^org_referral/, /^org_leadership/, /^org_milestone/,
  /^org_member/, /^org_grant_budget/, /^org_program/, /^org_profile/,
  /^organization_member/, /^organization_cap/, /^organizations_prof/,
  // Platform internals
  /^privacy_/, /^webhook_delivery/, /^pm2_/, /^sync_/, /^processing_job/,
  /^migration_/, /^app_config/, /^app_user/, /^user_identity/, /^user_profile/,
  /^user_gamif/, /^ce_user/, /^ce_metric/, /^auth/, /^token/,
];

function isExcluded(name: string): boolean {
  return EXCLUDED_TABLES.some(p => p.test(name));
}

function buildDomains(tables: { table_name: string; est_rows: number }[]): Record<string, TableEntry[]> {
  const domains: Record<string, TableEntry[]> = {};
  for (const t of tables) {
    if (isExcluded(t.table_name)) continue;
    const domain = classifyTable(t.table_name);
    if (!domains[domain]) domains[domain] = [];
    domains[domain].push({ table: t.table_name, records: Number(t.est_rows) });
  }
  // Sort each domain by records descending
  for (const entries of Object.values(domains)) {
    entries.sort((a, b) => b.records - a.records);
  }
  return domains;
}

function domainColor(domain: string): string {
  return DOMAIN_RULES.find(r => r.domain === domain)?.color ?? 'bg-gray-300';
}

function fmtRows(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function catalogStatus(row: DataCatalogLatest): 'fresh' | 'warning' | 'stale' | 'unknown' | 'no_snapshot' {
  if (!row.snapshot_at) return 'no_snapshot';
  if (row.freshness_hours === null || Number.isNaN(Number(row.freshness_hours))) return 'unknown';
  if (row.freshness_hours <= Number(row.sla_hours ?? 0)) return 'fresh';
  if (row.freshness_hours <= Number(row.sla_hours ?? 0) * 1.5) return 'warning';
  return 'stale';
}

function catalogStatusStyles(status: ReturnType<typeof catalogStatus>): string {
  if (status === 'fresh') return 'bg-green-100 text-green-700';
  if (status === 'warning') return 'bg-yellow-100 text-yellow-700';
  if (status === 'stale') return 'bg-bauhaus-red text-white';
  if (status === 'unknown') return 'bg-gray-200 text-bauhaus-black';
  return 'bg-gray-100 text-bauhaus-muted';
}

/* ─── Page ────────────────────────────────────────── */

export default async function ClarityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const {
    briefingComposeHref,
    hasBriefingContext,
    loop,
  } = buildClarityPageState(params);
  const data = await getData();
  const findings = generateFindings(data);
  const catalogRows = data.dataCatalog.map((row) => ({
    ...row,
    status: catalogStatus(row),
  }));
  const catalogSummary = {
    total: catalogRows.length,
    fresh: catalogRows.filter((row) => row.status === 'fresh').length,
    warning: catalogRows.filter((row) => row.status === 'warning').length,
    stale: catalogRows.filter((row) => row.status === 'stale').length,
    unknown: catalogRows.filter((row) => row.status === 'unknown').length,
    noSnapshot: catalogRows.filter((row) => row.status === 'no_snapshot').length,
  };

  // Build full inventory from live data
  const domains = buildDomains(data.allTables);
  const inventoryTableCount = Object.values(domains).reduce((s, t) => s + t.length, 0);
  const inventoryEstimatedRows = Object.values(domains).reduce((s, ts) => s + ts.reduce((a, t) => a + t.records, 0), 0);

  // Build topic × state matrix
  const topics = [...new Set(data.topicMatrix.map(t => t.topic))].sort();
  const states = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

  const topicMap = new Map<string, number>();
  for (const row of data.topicMatrix) {
    topicMap.set(`${row.topic}:${row.state}`, Number(row.records));
  }

  // Build ALMA topic × state matrix
  const almaTopics = [...new Set(data.almaMatrix.map(t => t.topic))].sort();
  const almaMap = new Map<string, number>();
  for (const row of data.almaMatrix) {
    almaMap.set(`${row.topic}:${row.state}`, Number(row.records));
  }

  // System linkage data
  const systems: SystemLink[] = [
    {
      name: 'Justice Funding',
      table: 'justice_funding',
      records: Number(data.justice.total ?? 0),
      linkage_pct: Number(data.justice.pct ?? 0),
      description: 'State & federal justice program grants linked to entities via ABN',
    },
    {
      name: 'Australian Living Map of Alternatives (ALMA)',
      table: 'alma_interventions',
      records: Number(data.almaLink.total ?? 0),
      linkage_pct: Number(data.almaLink.pct ?? 0),
      description: 'Evidence-based program database linked to delivering organisations',
    },
    {
      name: 'Federal Contracts',
      table: 'austender_contracts',
      records: Number(data.contracts.total ?? 0),
      linkage_pct: Number(data.contracts.pct ?? 0),
      description: 'AusTender procurement records linked to suppliers via ABN',
    },
    {
      name: 'Political Donations',
      table: 'political_donations',
      records: Number(data.donations.total ?? 0),
      linkage_pct: Number(data.donations.pct ?? 0),
      description: 'AEC donation disclosures linked to donor entities via ABN',
    },
    {
      name: 'Foundations',
      table: 'foundations',
      records: Number(data.foundations.total ?? 0),
      linkage_pct: Number(data.foundations.pct ?? 0),
      description: 'Philanthropic foundations linked to entity graph via ABN',
    },
  ];

  // Outcomes coverage
  const outcomesMap = new Map<string, { metric_types: number; total: number }>();
  for (const row of data.outcomes) {
    outcomesMap.set(row.state, { metric_types: Number(row.metric_types), total: Number(row.total) });
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-blue mt-6 mb-1 uppercase tracking-widest">Transparency</div>
        <h1 className="text-3xl sm:text-5xl font-black text-bauhaus-black mb-4">
          Data Clarity
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          How CivicGraph connects public data to make government spending, influence, and outcomes visible.
          Every claim we make is traceable to data. Here is what we have, where it connects, and where gaps remain.
        </p>
        {hasBriefingContext && loop && (
          <BriefingLoopBar
            refineHref={briefingComposeHref}
            output={loop.output}
            subject={loop.subject}
            state={loop.state}
            lanes={loop.lanes}
            className="mt-6 max-w-4xl"
            message={loop.message}
          />
        )}
      </div>

      {/* ─── Section 1: Full Platform Inventory ─────── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">The Full Platform</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          {fmt(Number(data.entities.total ?? 0))} entities connected by {fmt(Number(data.relationships.total ?? 0))} relationships
          across {inventoryTableCount} included tables and ~{fmt(inventoryEstimatedRows)} estimated rows.
          Inventory totals are live database estimates for speed; linkage and coverage sections below use direct live queries.
        </p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-0 mb-8">
          {Object.entries(domains).map(([domain, tables], i) => {
            const totalRows = tables.reduce((s, t) => s + t.records, 0);
            return (
              <div key={domain} className={`border-4 border-bauhaus-black p-3 bg-white ${i > 0 ? 'border-l-0' : ''} ${i >= 6 ? 'border-t-0' : i >= 4 ? 'sm:border-t-0' : i >= 2 ? 'max-sm:border-t-0' : ''}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${domainColor(domain)}`} />
                  <span className="text-[10px] font-black text-bauhaus-black uppercase tracking-widest leading-tight">{domain}</span>
                </div>
                <div className="text-lg font-black text-bauhaus-black">{fmtRows(totalRows)}</div>
                <div className="text-[10px] text-bauhaus-muted">{tables.length} tables</div>
              </div>
            );
          })}
        </div>

        {/* Full table listing per domain */}
        {Object.entries(domains).map(([domain, tables]) => (
          <details key={domain} className="mb-4 group" open={['Entity Graph', 'Registries', 'Procurement', 'Funding & Grants', 'Influence & Accountability', 'People & Governance', 'Evidence & Outcomes', 'Social & Disability', 'Geography'].includes(domain)}>
            <summary className="text-sm font-black text-bauhaus-black uppercase tracking-widest mb-2 flex items-center gap-2 cursor-pointer list-none">
              <span className={`inline-block w-3 h-3 rounded-full ${domainColor(domain)}`} />
              {domain}
              <span className="text-bauhaus-muted font-mono text-xs font-normal ml-1">
                {tables.length} tables &middot; ~{fmtRows(tables.reduce((s, t) => s + t.records, 0))} rows
              </span>
              <span className="text-bauhaus-muted text-xs ml-auto group-open:rotate-90 transition-transform">&#9654;</span>
            </summary>
            <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left p-2 font-black uppercase tracking-widest">Table</th>
                    <th className="text-right p-2 font-black uppercase tracking-widest">Est. Records</th>
                    <th className="text-right p-2 font-black uppercase tracking-widest">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t, i) => (
                    <tr key={t.table} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2 font-mono font-bold text-bauhaus-black">{t.table}</td>
                      <td className="p-2 text-right font-mono">{fmt(t.records)}</td>
                      <td className="p-2 text-right font-mono text-bauhaus-muted">{fmtRows(t.records)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </section>

      {/* ─── Section 1B: Data Catalog Snapshot ───────── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Data Catalog Snapshot</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Daily snapshots track table freshness against SLA, plus provenance/confidence coverage where fields exist.
          This is the trust operations view for what is fresh, stale, and weak.
        </p>

        {catalogRows.length === 0 ? (
          <div className="border-4 border-bauhaus-black p-5 bg-white text-sm text-bauhaus-muted">
            No snapshots found yet. Apply migration <span className="font-mono">20260409000001_data_catalog_and_snapshots.sql</span> and run
            <span className="font-mono"> snapshot_data_catalog()</span>.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0 mb-6">
              {[
                { label: 'Tracked', value: catalogSummary.total, tone: 'text-bauhaus-black' },
                { label: 'Fresh', value: catalogSummary.fresh, tone: 'text-green-700' },
                { label: 'Warning', value: catalogSummary.warning, tone: 'text-yellow-700' },
                { label: 'Stale', value: catalogSummary.stale, tone: 'text-bauhaus-red' },
                { label: 'Unknown', value: catalogSummary.unknown, tone: 'text-bauhaus-black' },
                { label: 'No Snapshot', value: catalogSummary.noSnapshot, tone: 'text-bauhaus-muted' },
              ].map((item, idx) => (
                <div key={item.label} className={`border-4 border-bauhaus-black p-3 bg-white ${idx > 0 ? 'border-l-0' : ''} ${idx >= 2 ? 'max-sm:border-t-0' : ''} ${idx >= 3 ? 'sm:border-t-0 lg:border-t-4' : ''} ${idx >= 6 ? 'lg:border-t-0' : ''}`}>
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">{item.label}</div>
                  <div className={`text-2xl font-black ${item.tone}`}>{fmt(item.value)}</div>
                </div>
              ))}
            </div>

            <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left p-2 font-black uppercase tracking-widest">Table</th>
                    <th className="text-left p-2 font-black uppercase tracking-widest">Domain</th>
                    <th className="text-right p-2 font-black uppercase tracking-widest">Rows</th>
                    <th className="text-right p-2 font-black uppercase tracking-widest">Freshness (h)</th>
                    <th className="text-right p-2 font-black uppercase tracking-widest">SLA (h)</th>
                    <th className="text-right p-2 font-black uppercase tracking-widest">Prov (%)</th>
                    <th className="text-right p-2 font-black uppercase tracking-widest">Conf (%)</th>
                    <th className="text-center p-2 font-black uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogRows.map((row, idx) => (
                    <tr key={row.table_name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2 font-mono font-bold text-bauhaus-black">{row.table_name}</td>
                      <td className="p-2 text-bauhaus-muted font-semibold">{row.domain}</td>
                      <td className="p-2 text-right font-mono">{fmt(Number(row.row_count ?? 0))}</td>
                      <td className="p-2 text-right font-mono">{row.freshness_hours === null ? '—' : Number(row.freshness_hours).toFixed(1)}</td>
                      <td className="p-2 text-right font-mono">{fmt(Number(row.sla_hours ?? 0))}</td>
                      <td className="p-2 text-right font-mono">{row.provenance_coverage_pct === null ? '—' : Number(row.provenance_coverage_pct).toFixed(1)}</td>
                      <td className="p-2 text-right font-mono">{row.confidence_coverage_pct === null ? '—' : Number(row.confidence_coverage_pct).toFixed(1)}</td>
                      <td className="p-2 text-center">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${catalogStatusStyles(row.status)}`}>
                          {row.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ─── Section 2: Interactive Schema Graph ──────── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">How It Connects</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Interactive data model graph. Each node is a table, sized by record count.
          Edges show how tables connect — via ABN, entity ID, or foreign key.
          Click a domain to filter. Drag to explore. Scroll to zoom.
        </p>
        <SchemaGraph />
      </section>

      {/* ─── Section 3: System Linkage ─────────────── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Entity Linkage</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          How well each major data system connects to the central entity graph.
          Higher linkage = more cross-system queries possible.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
          {systems.map((sys, i) => (
            <div key={sys.table} className={`border-4 border-bauhaus-black p-5 bg-white
              ${i % 3 !== 0 ? 'lg:border-l-0' : ''}
              ${i % 2 !== 0 && i % 3 !== 0 ? '' : i % 2 !== 0 ? 'sm:border-l-0 lg:border-l-4' : ''}
              ${i >= 3 ? 'border-t-0' : i >= 2 ? 'sm:border-t-0' : ''}
            `}>
              <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">{sys.name}</div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className={`text-3xl font-black ${linkageColor(sys.linkage_pct)}`}>
                  {pct(sys.linkage_pct)}
                </span>
                <span className="text-sm text-bauhaus-muted font-mono">{fmt(sys.records)}</span>
              </div>
              <div className="w-full bg-gray-100 h-2 mb-2">
                <div className={`h-2 ${linkageBg(sys.linkage_pct)}`} style={{ width: `${Math.min(sys.linkage_pct, 100)}%` }} />
              </div>
              <p className="text-xs text-bauhaus-muted">{sys.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Section 3: Coverage Heatmap ───────────── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Funding Coverage</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          State-by-topic matrix showing how many org-level funding records exist.
          Dark green = rich data. Red = thin. Grey = no data. Excludes aggregate ROGS rows.
        </p>

        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-2 font-black uppercase tracking-widest">Topic</th>
                {states.map(s => (
                  <th key={s} className="text-center p-2 font-black uppercase tracking-widest w-16">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topics.map((topic, i) => (
                <tr key={topic} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-2 font-bold text-bauhaus-black whitespace-nowrap">{topic}</td>
                  {states.map(state => {
                    const count = topicMap.get(`${topic}:${state}`) ?? 0;
                    return (
                      <td key={state} className={`p-2 text-center font-mono font-bold ${heatColor(count)}`}>
                        {count === 0 ? '—' : fmt(count)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-bauhaus-muted mt-2">
          <span className="inline-block w-3 h-3 bg-green-100 border border-green-300 mr-1 align-middle" /> 1000+{' '}
          <span className="inline-block w-3 h-3 bg-blue-100 border border-blue-300 mr-1 ml-2 align-middle" /> 500-999{' '}
          <span className="inline-block w-3 h-3 bg-yellow-100 border border-yellow-300 mr-1 ml-2 align-middle" /> 100-499{' '}
          <span className="inline-block w-3 h-3 bg-orange-100 border border-orange-300 mr-1 ml-2 align-middle" /> 10-99{' '}
          <span className="inline-block w-3 h-3 bg-red-100 border border-red-300 mr-1 ml-2 align-middle" /> 1-9{' '}
          <span className="inline-block w-3 h-3 bg-gray-100 border border-gray-300 mr-1 ml-2 align-middle" /> None
        </p>
      </section>

      {/* ─── Section 4: Evidence Coverage (ALMA) ───── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Evidence Coverage</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Australian Living Map of Alternatives (ALMA) — evidence-based interventions mapped by topic and geography.
          This is the &ldquo;what works&rdquo; layer that sits on top of the funding data.
        </p>

        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-2 font-black uppercase tracking-widest">Topic</th>
                {[...states, 'National'].map(s => (
                  <th key={s} className="text-center p-2 font-black uppercase tracking-widest w-14">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {almaTopics.map((topic, i) => (
                <tr key={topic} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-2 font-bold text-bauhaus-black whitespace-nowrap">{topic}</td>
                  {[...states, 'National'].map(state => {
                    const count = almaMap.get(`${topic}:${state}`) ?? 0;
                    return (
                      <td key={state} className={`p-2 text-center font-mono font-bold ${heatColor(count)}`}>
                        {count === 0 ? '—' : count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Section 5: Outcomes Metrics Coverage ──── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Outcomes Metrics</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          ROGS + AIHW structured indicators: detention rates, costs, recidivism, self-harm, staffing.
          This is the most uniform dataset — all states have comparable coverage.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-0">
          {states.map((state, i) => {
            const d = outcomesMap.get(state);
            return (
              <div key={state} className={`border-4 border-bauhaus-black p-4 bg-white text-center
                ${i > 0 ? 'border-l-0' : ''}
              `}>
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">{state}</div>
                <div className="text-2xl font-black text-bauhaus-black">{d ? fmt(d.total) : '—'}</div>
                <div className="text-xs text-bauhaus-muted">{d ? `${d.metric_types} types` : ''}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Section 6: Findings ───────────────────── */}
      <section className="mb-14">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">What the Data Shows</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Auto-generated findings from live data. Every claim links to evidence.
        </p>

        <div className="space-y-0">
          {findings.map((f, i) => (
            <div key={i} className={`border-4 border-bauhaus-black p-5 bg-white ${i > 0 ? 'border-t-0' : ''}`}>
              <div className="flex items-start gap-3">
                <span className={`inline-block mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${
                  f.severity === 'strength' ? 'bg-green-500' :
                  f.severity === 'gap' ? 'bg-bauhaus-red' :
                  'bg-bauhaus-blue'
                }`} />
                <div>
                  <div className="font-black text-bauhaus-black text-sm">{f.claim}</div>
                  <div className="text-xs text-bauhaus-muted mt-1">{f.evidence}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-bauhaus-muted mt-3">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1 align-middle" /> Strength{' '}
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-bauhaus-red mr-1 ml-3 align-middle" /> Gap{' '}
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-bauhaus-blue mr-1 ml-3 align-middle" /> Insight
        </p>
      </section>

      {/* ─── Section 7: Methodology ────────────────── */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black text-bauhaus-yellow mb-4 uppercase tracking-widest">How This Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-black text-white mb-2">Entity Resolution</h3>
              <p className="text-white/70 leading-relaxed">
                The Australian Business Number (ABN) is the universal join key.
                We resolve {fmt(Number(data.entities.total ?? 0))}+ entities across multiple public data systems using ABN matching
                and normalised name fuzzy-matching against ASIC + ACNC registers.
              </p>
            </div>
            <div>
              <h3 className="font-black text-white mb-2">Topic Classification</h3>
              <p className="text-white/70 leading-relaxed">
                Database triggers auto-classify records into {topics.length} topic domains
                based on program name keywords. No ML — deterministic pattern matching
                that can be audited. Triggers fire on INSERT and UPDATE.
              </p>
            </div>
            <div>
              <h3 className="font-black text-white mb-2">Open Data Sources</h3>
              <p className="text-white/70 leading-relaxed">
                All data is from public government sources: AusTender, AEC, ACNC, ATO,
                ROGS, AIHW, state grant portals, parliamentary hansard, and lobbying registers.
                No proprietary data. Fully reproducible.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

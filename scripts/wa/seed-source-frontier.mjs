#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const source = (key, name, url, lane, fit, cadence, priority, proves, cannotProve, extra = {}) => ({
  source_key: `wa-transition:${key}`,
  source_kind: 'wa_transition_evidence',
  source_name: name,
  target_url: url,
  domain: new URL(url).hostname.replace(/^www\./, ''),
  parser_hint: fit,
  owning_agent_id: 'wa-acco-transition-frontier',
  discovery_source: 'wa-transition-primary-source-research',
  cadence_hours: cadence,
  priority,
  enabled: true,
  change_detection: fit === 'direct-ingestion' ? 'file' : 'html',
  confidence: 'high',
  metadata: {
    geography: 'AU-WA',
    lane,
    data_fit: fit,
    evidence_status: 'primary-source',
    proves,
    cannot_prove: cannotProve,
    jev_policy: 'public-text-review-queue-only',
    ...extra,
  },
});

const SOURCES = [
  source('aer-2023-24', 'WA Aboriginal Expenditure Review 2023-24',
    'https://www.wa.gov.au/government/publications/western-australian-aboriginal-expenditure-review-2023-24',
    'expenditure', 'direct-ingestion', 720, 10,
    'Program inventory, agency, broad delivery region, CTG alignment and reported Aboriginal organisation involvement.',
    'Named providers, contracts, expenditure values, ACCO verification or transition readiness.',
    { ingested_table: 'wa_aer_programs', source_sha256: '643cb152cac3c18f31edebb82d69960c89b71e6447f43d170f2083917b3a07b9' }),
  source('tenders-wa', 'Tenders WA', 'https://www.tenders.wa.gov.au/',
    'procurement', 'portal-feasibility', 12, 10,
    'Advertised opportunities and published awards at or above applicable publication thresholds.',
    'Complete spend, contracts below publication thresholds, ACCO status or community outcomes.'),
  source('procurement-bi', 'WA Government Procurement Business Intelligence Reports',
    'https://www.wa.gov.au/organisation/department-of-treasury-and-finance/government-procurement-business-intelligence-reports',
    'procurement', 'dashboard-validation', 168, 9,
    'Annual public procurement patterns and forward procurement plans.',
    'A stable bulk award feed or daily complete contract history.'),
  source('sfpp', 'Strategic Forward Procurement Plan Public Report',
    'https://www.wa.gov.au/government/publications/strategic-forward-procurement-plan-public-report',
    'procurement-forward', 'dashboard-validation', 168, 10,
    'Planned procurements valued at $250,000 or more across two financial years.',
    'That a tender will be released, a contract awarded or an ACCO engaged.'),
  source('pipeline-of-works', 'WA Pipeline of Works',
    'https://www.wa.gov.au/service/government-financial-management/procurement/pipeline-of-works',
    'procurement-forward', 'dashboard-validation', 720, 7,
    'Current and planned non-residential infrastructure projects.',
    'Transport portfolio completeness, supplier selection or local authority.'),
  source('app-performance', 'Aboriginal Procurement Policy Performance Reports',
    'https://www.wa.gov.au/government/document-collections/aboriginal-procurement-policy-performance-reports',
    'aboriginal-procurement', 'document-extraction', 720, 10,
    'Annual aggregate contract counts, value, agency and regional performance under the APP.',
    'Individual award detail, full supplier list, spend realised or community outcomes.'),
  source('app-policy', 'WA Aboriginal Procurement Policy 2025',
    'https://www.wa.gov.au/government/publications/general-procurement-direction-202503-aboriginal-procurement-policy',
    'aboriginal-procurement', 'document-extraction', 720, 9,
    'Current procurement targets, covered purchases and policy definitions.',
    'Whether an organisation qualifies, wants to supply or is ready for a contract.'),
  source('app-audit', 'OAG Implementation of the Aboriginal Procurement Policy',
    'https://audit.wa.gov.au/reports-and-publications/reports/implementation-of-the-aboriginal-procurement-policy/',
    'accountability', 'document-extraction', 2160, 9,
    'Policy implementation gaps, concentration, sector skew and measurement limitations.',
    'Current individual contract status or causal community outcomes.'),
  source('wa-budget-aboriginal', 'WA State Budget Aboriginal wellbeing',
    'https://www.ourstatebudget.wa.gov.au/2026-27/aboriginal-wellbeing.html',
    'budget', 'document-extraction', 168, 9,
    'Budget commitments and named initiatives for Aboriginal Western Australians.',
    'Expenditure, delivery, recipient identity or outcomes.'),
  source('ctg-plan', 'WA Closing the Gap Implementation Plan',
    'https://www.wa.gov.au/organisation/department-of-the-premier-and-cabinet/closing-the-gap',
    'closing-the-gap', 'document-extraction', 168, 10,
    'Government commitments, targets, actions and ACCO Transition Pipeline framing.',
    'Implementation completion, local authority or service-level contract status.'),
  source('kjjs', 'Kimberley Juvenile Justice Strategy',
    'https://www.wa.gov.au/organisation/department-of-justice/kimberley-juvenile-justice-strategy',
    'justice', 'document-extraction', 168, 10,
    'Named KJJS initiatives, public commitments, delivery framing and published updates.',
    'Complete contracts, private governance decisions or authority to engage.'),
  source('justice-annual-reports', 'WA Department of Justice annual reports',
    'https://www.wa.gov.au/organisation/department-of-justice/annual-reports',
    'justice', 'document-extraction', 720, 8,
    'Agency expenditure, service activity, performance indicators and major initiatives.',
    'Program-level causal outcomes or complete supplier detail.'),
  source('oics-reports', 'Office of the Inspector of Custodial Services reports',
    'https://www.oics.wa.gov.au/reports/',
    'justice-oversight', 'document-extraction', 168, 9,
    'Independent custodial inspections, reviews, recommendations and agency responses.',
    'Community consent, transition readiness or procurement awards.'),
  source('ombudsman-child-deaths', 'WA Ombudsman child death review reports',
    'https://www.ombudsman.wa.gov.au/Publications/Annual_Reports.htm',
    'outcomes-oversight', 'document-extraction', 720, 8,
    'Systemic issues and recommendations from child death reviews and investigations.',
    'Service-level attribution or current local operating authority.'),
  source('data-wa', 'Data WA catalogue', 'https://catalogue.data.wa.gov.au/dataset/',
    'open-data', 'catalogue-discovery', 168, 8,
    'Discoverable WA Government geospatial and administrative datasets with metadata.',
    'That catalogue records are current, complete or suitable without field-level profiling.'),
  source('wa-communities-map', 'WA Aboriginal communities maps and services',
    'https://www.wa.gov.au/service/aboriginal-affairs/aboriginal-communities',
    'place', 'relationship-governed', 720, 8,
    'Official public place and service context.',
    'Permission to publish community-level analysis, demand or representative authority.'),
  source('oric-register', 'ORIC public register', 'https://register.oric.gov.au/',
    'organisations', 'direct-ingestion', 168, 9,
    'Registered Aboriginal and Torres Strait Islander corporations and public filings.',
    'ACCO service status, community control in practice, quality or readiness.'),
  source('acnc-register', 'ACNC Charity Register data',
    'https://www.acnc.gov.au/tools/data', 'organisations', 'direct-ingestion', 168, 8,
    'Registered charities, ABNs, purposes, locations and public reporting.',
    'ACCO status, authority, service quality or willingness to engage.'),
  source('abs-census-aboriginal', 'ABS Census Aboriginal and Torres Strait Islander peoples data',
    'https://www.abs.gov.au/statistics/people/aboriginal-and-torres-strait-islander-peoples',
    'population-place', 'direct-ingestion', 2160, 8,
    'Population, household, housing, education, employment and geography statistics.',
    'Current demand, individual need, consent or program effectiveness.'),
  source('pc-ctg-dashboard', 'Closing the Gap Information Repository',
    'https://www.pc.gov.au/closing-the-gap-data/dashboard',
    'outcomes', 'direct-ingestion', 720, 9,
    'Official CTG target and indicator data by available geography and population cohort.',
    'Program attribution, contract performance or local causal impact.'),
  source('aihw-indigenous', 'AIHW Indigenous Australians data',
    'https://www.aihw.gov.au/reports-data/population-groups/indigenous-australians',
    'outcomes', 'document-extraction', 720, 8,
    'National and jurisdictional health, welfare, housing and justice indicators.',
    'Local program attribution or current community authority.'),
  source('productivity-services', 'Report on Government Services',
    'https://www.pc.gov.au/ongoing/report-on-government-services',
    'outcomes-spend', 'direct-ingestion', 720, 9,
    'Comparable jurisdictional expenditure, service and outcome indicators.',
    'ACCO investment, named recipients or program-level outcomes.'),
  source('goods-evidence-contract', 'Goods on Country evidence and decision contract',
    'https://www.goodsoncountry.com/', 'goods-relationship', 'relationship-governed', 168, 10,
    'Public Goods context linked to separately governed internal evidence.',
    'Private relationship state, consent, demand, authority or permission to contact.',
    { local_contract: '/Users/benknight/Code/Goods Asset Register/GRANTSCOPE.md', public_ingestion: false }),
];

async function main() {
  const laneCounts = Object.groupBy(SOURCES, (item) => item.metadata.lane);
  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    sources: SOURCES.length,
    lanes: Object.fromEntries(Object.entries(laneCounts).map(([lane, rows]) => [lane, rows.length])),
    direct_ingestion: SOURCES.filter((item) => item.metadata.data_fit === 'direct-ingestion').length,
    relationship_governed: SOURCES.filter((item) => item.metadata.data_fit === 'relationship-governed').length,
  };
  if (!APPLY) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  const now = new Date().toISOString();
  const { error } = await db.from('source_frontier').upsert(
    SOURCES.map((item) => ({ ...item, updated_at: now })),
    { onConflict: 'source_key' },
  );
  if (error) throw error;
  const { count, error: countError } = await db
    .from('source_frontier')
    .select('id', { count: 'exact', head: true })
    .like('source_key', 'wa-transition:%');
  if (countError) throw countError;
  console.log(JSON.stringify({ ...summary, verified_frontier_rows: count }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : JSON.stringify(error, null, 2));
  process.exit(1);
});

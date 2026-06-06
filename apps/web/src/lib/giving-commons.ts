export const GIVING_SCHEMA_VERSION = 'agdc-0.1';
export const PUBLIC_SNAPSHOT_DATE = '2026-06-01';
export const CORRECTION_PATH = '/giving/corrections';

export type PublicDataset = {
  key: string;
  label: string;
  table: string;
  domain: string;
  description: string;
  select: string;
  orderBy?: string;
  orderAscending?: boolean;
  licence: string;
  source: string;
  sourceUrl: string;
  sourceOwner: string;
  collectionMethod: string;
  updateCadence: string;
  caveats: string[];
  piiLevel: 'none' | 'low';
};

export const PUBLIC_DATASETS = {
  entities: {
    key: 'entities',
    label: 'Entities',
    table: 'gs_entities',
    domain: 'entity_graph',
    description: 'Canonical public-record organisations and public-record people where already present in source datasets.',
    select: 'id, gs_id, canonical_name, abn, acn, entity_type, description, website, state, postcode, remoteness, seifa_irsd_decile, lga_name, sector, sub_sector, tags, source_datasets, source_count, confidence, is_community_controlled, first_seen, last_seen, created_at, updated_at',
    orderBy: 'canonical_name',
    orderAscending: true,
    licence: 'Mixed public-source licences. Check source record before reuse.',
    source: 'CivicGraph entity resolver from ACNC, ABR, ORIC, AEC, AusTender, foundation and grants sources',
    sourceUrl: 'https://www.civicgraph.au/giving/sources',
    sourceOwner: 'Source agencies and CivicGraph resolution layer',
    collectionMethod: 'Public registers, public datasets, source crawling and deterministic entity resolution',
    updateCadence: 'Daily to weekly by source',
    caveats: [
      'Entity resolution is probabilistic when no ABN or source identifier is available.',
      'Public-record individual names appear only where a source dataset already publishes them.',
    ],
    piiLevel: 'low',
  },
  relationships: {
    key: 'relationships',
    label: 'Relationships',
    table: 'gs_relationships',
    domain: 'entity_graph',
    description: 'Public-record links between entities, including donations, contracts, grants and registry relationships.',
    select: 'id, source_entity_id, target_entity_id, relationship_type, amount, currency, year, start_date, end_date, dataset, source_record_id, source_url, confidence, first_seen, last_seen, created_at',
    orderBy: 'amount',
    orderAscending: false,
    licence: 'Mixed public-source licences. Check source record before reuse.',
    source: 'CivicGraph relationship graph built from public source datasets',
    sourceUrl: 'https://www.civicgraph.au/giving/sources',
    sourceOwner: 'Source agencies and CivicGraph resolution layer',
    collectionMethod: 'Cross-source joins, ABN matching and public-source graph construction',
    updateCadence: 'Daily to weekly by source',
    caveats: [
      'Edges inherit the quality of their source dataset and matching method.',
      'Absence of an edge does not prove absence of a relationship.',
    ],
    piiLevel: 'low',
  },
  foundations: {
    key: 'foundations',
    label: 'Foundations',
    table: 'foundations',
    domain: 'funding',
    description: 'Australian philanthropic foundations and capital-holder profiles built from public records and public websites.',
    select: 'id, acnc_abn, name, type, website, description, total_giving_annual, avg_grant_size, grant_range_min, grant_range_max, thematic_focus, geographic_focus, target_recipients, endowment_size, giving_ratio, revenue_sources, parent_company, asx_code, open_programs, last_scraped_at, profile_confidence, created_at, updated_at',
    orderBy: 'total_giving_annual',
    orderAscending: false,
    licence: 'Mixed public-source licences. Check foundation source page before reuse.',
    source: 'ACNC register, annual reports, foundation websites and CivicGraph profiling',
    sourceUrl: 'https://www.acnc.gov.au/charity/charities',
    sourceOwner: 'ACNC, foundation publishers and CivicGraph profiling layer',
    collectionMethod: 'Public register import plus public website/profile enrichment',
    updateCadence: 'Weekly crawl, manual correction queue',
    caveats: [
      'Giving values are annual estimates where a foundation does not publish a clean current figure.',
      'Foundation openness is a public-signal measure, not a judgement of private grantmaking quality.',
    ],
    piiLevel: 'none',
  },
  'foundation-programs': {
    key: 'foundation-programs',
    label: 'Foundation Programs',
    table: 'foundation_programs',
    domain: 'funding',
    description: 'Public foundation programs and application pathways found on foundation websites.',
    select: 'id, foundation_id, name, url, description, amount_min, amount_max, deadline, status, categories, eligibility, application_process, scraped_at, created_at',
    orderBy: 'deadline',
    orderAscending: true,
    licence: 'Publisher website terms and CivicGraph compiled metadata.',
    source: 'Foundation websites and public grant program pages',
    sourceUrl: 'https://www.civicgraph.au/foundations',
    sourceOwner: 'Foundation publishers and CivicGraph extraction layer',
    collectionMethod: 'Public website crawl and program extraction',
    updateCadence: 'Daily to weekly during active crawl windows',
    caveats: [
      'Open status can lag publisher changes.',
      'Program eligibility summaries are not a substitute for the publisher page.',
    ],
    piiLevel: 'none',
  },
  grants: {
    key: 'grants',
    label: 'Grants',
    table: 'grant_opportunities',
    domain: 'funding',
    description: 'Open and historical public grant opportunities across government, philanthropy and civic-sector sources.',
    select: 'id, name, provider, program, description, amount_min, amount_max, closes_at, url, categories, geography, discovery_method, source, created_at, updated_at',
    orderBy: 'created_at',
    orderAscending: false,
    licence: 'Mixed source licences. Check the source URL before reuse.',
    source: 'Government grant portals, foundation programs and public source crawlers',
    sourceUrl: 'https://www.civicgraph.au/grants',
    sourceOwner: 'Grant publishers and CivicGraph extraction layer',
    collectionMethod: 'Public source crawl, normalisation and deduplication',
    updateCadence: 'Daily to weekly by source',
    caveats: [
      'Deadlines and eligibility can change after capture.',
      'Use publisher URLs as the decision record for applications.',
    ],
    piiLevel: 'none',
  },
  places: {
    key: 'places',
    label: 'Places',
    table: 'mv_funding_by_postcode',
    domain: 'place',
    description: 'Postcode-level public funding coverage, place disadvantage and community-controlled organisation signals.',
    select: 'postcode, state, remoteness, seifa_irsd_decile, locality, entity_count, community_controlled_count, total_funding, community_controlled_funding, relationship_count',
    orderBy: 'total_funding',
    orderAscending: false,
    licence: 'Mixed public-source licences. Geographic references include public ABS-style reference data.',
    source: 'CivicGraph place aggregation from entity graph, relationships, postcode geography and SEIFA data',
    sourceUrl: 'https://www.civicgraph.au/places',
    sourceOwner: 'ABS-style reference sources, public funder datasets and CivicGraph aggregation layer',
    collectionMethod: 'Public source aggregation by postcode',
    updateCadence: 'Weekly after graph refresh',
    caveats: [
      'Postcode is a coarse proxy for community and service geography.',
      'Funding totals depend on how well source records can be geocoded and linked.',
    ],
    piiLevel: 'none',
  },
  'political-donations': {
    key: 'political-donations',
    label: 'Political Donations',
    table: 'political_donations',
    domain: 'influence',
    description: 'AEC political donations published as public records.',
    select: 'id, financial_year, donor_name, donor_abn, donation_to, donation_date, amount, return_type, receipt_type, created_at',
    orderBy: 'amount',
    orderAscending: false,
    licence: 'AEC public disclosure data. Check AEC terms before reuse.',
    source: 'Australian Electoral Commission annual returns',
    sourceUrl: 'https://www.aec.gov.au/parties_and_representatives/financial_disclosure/',
    sourceOwner: 'Australian Electoral Commission',
    collectionMethod: 'Public disclosure import and normalisation',
    updateCadence: 'Annual disclosure cycle, refreshed after releases',
    caveats: [
      'Donation records reflect disclosure rules and thresholds for the period.',
      'Donor names are public-record names from AEC disclosures and are not enriched beyond the source record.',
    ],
    piiLevel: 'low',
  },
  contracts: {
    key: 'contracts',
    label: 'Contracts',
    table: 'austender_contracts',
    domain: 'procurement',
    description: 'Federal procurement contracts published through AusTender/OCDS-style releases.',
    select: 'id, ocid, release_id, title, description, contract_value, currency, procurement_method, category, contract_start, contract_end, date_published, date_modified, buyer_name, buyer_id, supplier_name, supplier_abn, supplier_id, supplier_acnc_match, supplier_oric_match, supplier_entity_type, source_url, created_at, updated_at',
    orderBy: 'contract_value',
    orderAscending: false,
    licence: 'AusTender public data terms. Check source URL before reuse.',
    source: 'AusTender public contract notices',
    sourceUrl: 'https://www.tenders.gov.au/',
    sourceOwner: 'Australian Government AusTender',
    collectionMethod: 'Public procurement data import and normalisation',
    updateCadence: 'Daily to weekly',
    caveats: [
      'Contract values can include amendments and may not equal cash paid in a single year.',
      'Supplier matching to charities or entities depends on ABN availability and source quality.',
    ],
    piiLevel: 'none',
  },
  'social-enterprises': {
    key: 'social-enterprises',
    label: 'Social & Indigenous Enterprises',
    table: 'social_enterprises',
    domain: 'supply_base',
    description: 'Federated national registry of social and Indigenous enterprises drawn from certifiers, registries and state network directories.',
    select: 'id, name, abn, acn, icn, website, description, org_type, legal_structure, sector, state, city, postcode, geographic_focus, certifications, source_primary, target_beneficiaries, business_model, profile_confidence, enriched_at, created_at, updated_at',
    orderBy: 'name',
    orderAscending: true,
    licence: 'Mixed registry and public-source licences. Some source registries restrict reuse of authored descriptions — check source_primary before republishing.',
    source: 'Federated from Supply Nation, ORIC, Social Traders, BuyAbility, ACNC classification, B Corp and state network directories (SASEC, WASEC, QSEC, Kinaway)',
    sourceUrl: 'https://www.civicgraph.au/social-enterprises',
    sourceOwner: 'Source registries, certifiers, state networks and CivicGraph federation layer',
    collectionMethod: 'Public registry and directory federation, ABN matching and deduplication',
    updateCadence: 'Source-dependent, re-crawled during active windows',
    caveats: [
      'Supply Nation and ORIC records are Indigenous businesses and corporations — not every record is a social enterprise in the certified sense. Read source_primary before classifying.',
      'Certification and membership marks belong to their issuing bodies. CivicGraph aggregates marks and does not verify enterprises itself.',
      'Records without an ABN cannot yet be joined to contract or grant evidence.',
    ],
    piiLevel: 'none',
  },
  'data-catalog': {
    key: 'data-catalog',
    label: 'Data Catalog',
    table: 'v_data_catalog_latest',
    domain: 'quality',
    description: 'Public dataset catalogue with freshness, provenance and quality snapshot fields.',
    select: 'table_name, domain, owner_team, description, source_of_truth, pii_level, sla_hours, freshness_key, provenance_field, confidence_field, active, snapshot_at, row_count, freshness_hours, provenance_coverage_pct, confidence_coverage_pct',
    orderBy: 'table_name',
    orderAscending: true,
    licence: 'CivicGraph compiled metadata, CC BY 4.0 unless source rows say otherwise.',
    source: 'CivicGraph data catalog and nightly snapshots',
    sourceUrl: 'https://www.civicgraph.au/api/data/catalog',
    sourceOwner: 'CivicGraph',
    collectionMethod: 'Automated table snapshots and maintained dataset metadata',
    updateCadence: 'Nightly',
    caveats: [
      'Snapshot counts can lag live table counts.',
      'Quality metrics are diagnostics and should be read with dataset caveats.',
    ],
    piiLevel: 'none',
  },
} as const satisfies Record<string, PublicDataset>;

export type PublicDatasetKey = keyof typeof PUBLIC_DATASETS;

export const PUBLIC_DATASET_KEYS = Object.keys(PUBLIC_DATASETS) as PublicDatasetKey[];

export function isPublicDatasetKey(type: string | null): type is PublicDatasetKey {
  return !!type && Object.prototype.hasOwnProperty.call(PUBLIC_DATASETS, type);
}

export function getPublicDataset(type: string | null): PublicDataset | null {
  return isPublicDatasetKey(type) ? PUBLIC_DATASETS[type] : null;
}

export function correctionUrl(origin?: string) {
  if (!origin) return CORRECTION_PATH;
  return `${origin.replace(/\/$/, '')}${CORRECTION_PATH}`;
}

export function withCorsHeaders(headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  return headers;
}

export const COMMONS_NAV = [
  { href: '/giving', label: 'Search' },
  { href: '/giving/downloads', label: 'Downloads' },
  { href: '/giving/api', label: 'API' },
  { href: '/giving/standard', label: 'Standard' },
  { href: '/giving/sources', label: 'Sources' },
  { href: '/giving/quality', label: 'Quality' },
  { href: '/giving/corrections', label: 'Corrections' },
] as const;

export const COMMONS_INSIGHTS = [
  {
    id: 'closed-doors',
    title: 'Closed Doors',
    kicker: 'Public approachability',
    summary: 'Most tracked capital holders still do not publish enough practical signals for a community organisation to know whether to apply, ask for a meeting or move on.',
    source: 'foundations, foundation_programs, grant_opportunities',
    datasetType: 'foundations',
    caveat: 'The signal measures public approachability. It cannot see private invitations, relationship-first giving or unpublished board decisions.',
  },
  {
    id: 'concentration',
    title: 'Concentration',
    kicker: 'Who holds giving power',
    summary: 'Giving is concentrated enough that a small number of foundations can shape which issues, places and organisation types get practical access to capital.',
    source: 'foundations, gs_relationships',
    datasetType: 'foundations',
    caveat: 'Giving estimates depend on published annual reports, ACNC records and profile confidence. Values should be treated as directional.',
  },
  {
    id: 'missing-receipts',
    title: 'Missing Receipts',
    kicker: 'Traceable grants',
    summary: 'The public can see many funders but far fewer clean recipient-level receipts. The result is a sector where money is discussed more often than it is traceable.',
    source: 'gs_relationships, foundations, grant_opportunities',
    datasetType: 'relationships',
    caveat: 'Absence of a public receipt does not mean no grant was made. It means the receipt was not traceable in the public sources captured.',
  },
  {
    id: 'still-capital',
    title: 'Still Capital',
    kicker: 'Assets and payout signals',
    summary: 'Some foundations appear asset-rich but publicly quiet. That matters when community organisations need to know where patient, flexible and place-based capital could move.',
    source: 'foundations',
    datasetType: 'foundations',
    caveat: 'Asset and payout signals are incomplete and can be old. They should start questions, not end them.',
  },
  {
    id: 'donor-contractor-loop',
    title: 'Donor-Contractor Loop',
    kicker: 'Influence and procurement',
    summary: 'Political donations and procurement data can be read together to spot suppliers that donate into the political system while holding public contracts.',
    source: 'political_donations, austender_contracts, gs_entities',
    datasetType: 'political-donations',
    caveat: 'A matched donor and contractor pattern is not evidence of improper conduct. It is a public-interest transparency lead.',
  },
  {
    id: 'place-gaps',
    title: 'Place Gaps',
    kicker: 'Where funding does not reach',
    summary: 'Postcode-level funding, remoteness and community-controlled organisation signals show where public money is visible and where the graph still has blind spots.',
    source: 'mv_funding_by_postcode, gs_entities, gs_relationships',
    datasetType: 'places',
    caveat: 'Postcodes are blunt geography. Place analysis needs local interpretation before decisions are made.',
  },
] as const;

export const GIVING_STANDARD = {
  schema_version: GIVING_SCHEMA_VERSION,
  name: 'Australian Giving Data Standard v0.1',
  snapshot_date: PUBLIC_SNAPSHOT_DATE,
  purpose: 'A practical public schema for publishing searchable, downloadable and attributable Australian giving data.',
  principles: [
    'Public source first',
    'Clear provenance on every dataset',
    'No private workspace or CRM records',
    'Correction and right-of-reply from day one',
    'Machine-readable downloads and API responses',
  ],
  required_dataset_fields: [
    'dataset_key',
    'record_id',
    'title_or_name',
    'source',
    'source_url',
    'licence',
    'generated_at',
    'caveats',
    'correction_url',
  ],
  record_types: [
    { type: 'entity', description: 'Organisation, public body, foundation, public-record person or other named actor.' },
    { type: 'relationship', description: 'Grant, donation, contract, directorship, ownership or source-linked relationship between entities.' },
    { type: 'opportunity', description: 'Grant or foundation program with provider, amount, timing and source URL where available.' },
    { type: 'place', description: 'Geographic aggregate with funding, remoteness, disadvantage and community-control signals.' },
    { type: 'source', description: 'Dataset-level provenance, licence, collection method, cadence and caveats.' },
    { type: 'correction', description: 'Submitted correction or right-of-reply linked to a public claim or record.' },
  ],
} as const;

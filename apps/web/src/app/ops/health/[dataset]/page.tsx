import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface DatasetConfig {
  table: string;
  label: string;
  description: string;
  source: string;
  columns: { key: string; label: string }[];
  connections: { slug: string; label: string; rel: string }[];
  refreshCmd: string | null;
  freshnessCol: string;
  notes?: string;
}

const DATASETS: Record<string, DatasetConfig> = {
  'grant-opportunities': {
    table: 'grant_opportunities',
    label: 'Grant Opportunities',
    description: 'Open and closed grant opportunities scraped from 15 state government portals, research councils, and web search. The core dataset that powers GrantScope\'s grant matching engine.',
    source: '15 state portals + web search + foundation programs',
    columns: [
      { key: 'name', label: 'Title' },
      { key: 'source', label: 'Source' },
      { key: 'amount_max', label: 'Max Amount' },
      { key: 'closes_at', label: 'Closes' },
      { key: 'enriched_at', label: 'Enriched' },
    ],
    connections: [
      { slug: 'foundations', label: 'Foundations', rel: 'Funder profiles linked via foundation_id' },
      { slug: 'foundation-programs', label: 'Foundation Programs', rel: 'Programs synced as grant opportunities' },
    ],
    refreshCmd: 'node scripts/pipeline-runner.mjs --once',
    freshnessCol: 'updated_at',
  },
  'foundations': {
    table: 'foundations',
    label: 'Foundations',
    description: 'Australian philanthropic foundations profiled by scraping their websites and enriching with LLM providers. Includes giving philosophy, wealth source, board members, and program details.',
    source: 'Web scraping + 9-provider LLM profiling',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'website', label: 'Website' },
      { key: 'wealth_source', label: 'Wealth Source' },
      { key: 'profile_confidence', label: 'Confidence' },
      { key: 'updated_at', label: 'Updated' },
    ],
    connections: [
      { slug: 'foundation-programs', label: 'Foundation Programs', rel: 'Programs offered by each foundation' },
      { slug: 'grant-opportunities', label: 'Grant Opportunities', rel: 'Grants linked to this foundation' },
    ],
    refreshCmd: 'npx tsx scripts/build-foundation-profiles.mjs --limit=100',
    freshnessCol: 'updated_at',
  },
  'foundation-programs': {
    table: 'foundation_programs',
    label: 'Foundation Programs',
    description: 'Specific grant programs offered by foundations, scraped from foundation websites. These get synced into grant_opportunities so private grants appear alongside government ones.',
    source: 'Foundation website scraping',
    columns: [
      { key: 'name', label: 'Program Name' },
      { key: 'amount_max', label: 'Max Amount' },
      { key: 'deadline', label: 'Deadline' },
      { key: 'program_type', label: 'Type' },
      { key: 'scraped_at', label: 'Scraped' },
    ],
    connections: [
      { slug: 'foundations', label: 'Foundations', rel: 'Parent foundation for each program' },
      { slug: 'grant-opportunities', label: 'Grant Opportunities', rel: 'Synced as searchable grants' },
    ],
    refreshCmd: 'node scripts/sync-foundation-programs.mjs',
    freshnessCol: 'scraped_at',
  },
  'acnc-charities': {
    table: 'acnc_charities',
    label: 'ACNC Charities',
    description: 'The complete Australian Charities and Not-for-profits Commission register. 360K+ registered charities with purpose codes, beneficiary categories, and operating states.',
    source: 'ACNC public register (bulk CSV)',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'abn', label: 'ABN' },
      { key: 'state', label: 'State' },
      { key: 'charity_size', label: 'Size' },
      { key: 'registration_date', label: 'Registered' },
    ],
    connections: [
      { slug: 'gs-entities', label: 'Entities', rel: 'Matched into unified entity graph' },
      { slug: 'oric-corporations', label: 'ORIC Corporations', rel: 'Cross-matched via ABN' },
    ],
    refreshCmd: 'node scripts/sync-acnc-charities.mjs',
    freshnessCol: 'updated_at',
  },
  'community-orgs': {
    table: 'community_orgs',
    label: 'Community Orgs',
    description: 'Community-based organisations that GrantScope serves directly. Includes profile data, funding sources, and admin burden metrics. Curated from ACNC flagging and manual entry.',
    source: 'Manual + GHL CRM + ACNC flagging',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'domain', label: 'Domain' },
      { key: 'geographic_focus', label: 'Location' },
      { key: 'annual_revenue', label: 'Revenue' },
      { key: 'updated_at', label: 'Updated' },
    ],
    connections: [
      { slug: 'grant-opportunities', label: 'Grant Opportunities', rel: 'Matched grants for these orgs' },
    ],
    refreshCmd: null,
    freshnessCol: 'updated_at',
  },
  'social-enterprises': {
    table: 'social_enterprises',
    label: 'Social Enterprises',
    description: 'Australian social enterprises identified from ACNC flagging and enriched with sector, certification, and impact data. A growing dataset as Australia lacks a unified SE register.',
    source: 'ACNC flagging + enrichment',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'abn', label: 'ABN' },
      { key: 'sector', label: 'Sector' },
      { key: 'state', label: 'State' },
      { key: 'enriched_at', label: 'Enriched' },
    ],
    connections: [
      { slug: 'acnc-charities', label: 'ACNC Charities', rel: 'Source ACNC records' },
    ],
    refreshCmd: null,
    freshnessCol: 'updated_at',
  },
  'oric-corporations': {
    table: 'oric_corporations',
    label: 'ORIC Corporations',
    description: 'Aboriginal and Torres Strait Islander corporations from the Office of the Registrar of Indigenous Corporations. Includes financial data, industry sectors, and ACNC cross-matches.',
    source: 'ORIC public register',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'icn', label: 'ICN' },
      { key: 'state', label: 'State' },
      { key: 'status', label: 'Status' },
      { key: 'updated_at', label: 'Updated' },
    ],
    connections: [
      { slug: 'acnc-charities', label: 'ACNC Charities', rel: 'Cross-matched via ABN' },
      { slug: 'gs-entities', label: 'Entities', rel: 'Matched into unified entity graph' },
    ],
    refreshCmd: 'node scripts/import-oric-register.mjs',
    freshnessCol: 'updated_at',
  },
  'austender-contracts': {
    table: 'austender_contracts',
    label: 'AusTender Contracts',
    description: 'Federal government procurement contracts from AusTender. Shows who wins government contracts, contract values, and agency spending patterns. Key dataset for follow-the-money analysis.',
    source: 'AusTender API (OCDS format)',
    columns: [
      { key: 'supplier_name', label: 'Supplier' },
      { key: 'buyer_name', label: 'Agency' },
      { key: 'contract_value', label: 'Value' },
      { key: 'contract_start', label: 'Start' },
      { key: 'category', label: 'Category' },
    ],
    connections: [
      { slug: 'gs-entities', label: 'Entities', rel: 'Suppliers matched into entity graph' },
      { slug: 'gs-relationships', label: 'Relationships', rel: 'Contract relationships between entities' },
    ],
    refreshCmd: 'node scripts/sync-austender-contracts.mjs',
    freshnessCol: 'updated_at',
  },
  'political-donations': {
    table: 'political_donations',
    label: 'Political Donations (AEC)',
    description: 'Political donation disclosures from the Australian Electoral Commission. Tracks who donates to political parties, enabling cross-referencing with government contract winners.',
    source: 'AEC annual disclosure returns',
    columns: [
      { key: 'donor_name', label: 'Donor' },
      { key: 'donation_to', label: 'Recipient' },
      { key: 'amount', label: 'Amount' },
      { key: 'financial_year', label: 'FY' },
      { key: 'return_type', label: 'Type' },
    ],
    connections: [
      { slug: 'gs-entities', label: 'Entities', rel: 'Donors matched into entity graph' },
      { slug: 'gs-relationships', label: 'Relationships', rel: 'Donation relationships' },
    ],
    refreshCmd: 'node scripts/import-aec-donations.mjs',
    freshnessCol: 'created_at',
    notes: '188K+ records use created_at for freshness (no updated_at column).',
  },
  'gs-entities': {
    table: 'gs_entities',
    label: 'Entities (Unified Graph)',
    description: 'The unified entity graph — deduplicated organisations built from ACNC, ASIC, ORIC, AusTender, AEC, and ATO datasets. Each entity has a canonical name, type, and cross-dataset links.',
    source: 'Built from all source datasets',
    columns: [
      { key: 'canonical_name', label: 'Name' },
      { key: 'entity_type', label: 'Type' },
      { key: 'abn', label: 'ABN' },
      { key: 'latest_revenue', label: 'Revenue' },
      { key: 'source_count', label: 'Sources' },
    ],
    connections: [
      { slug: 'gs-relationships', label: 'Relationships', rel: 'Connections between entities' },
      { slug: 'acnc-charities', label: 'ACNC Charities', rel: 'Source charity records' },
      { slug: 'asic-companies', label: 'ASIC Companies', rel: 'Source company records' },
      { slug: 'oric-corporations', label: 'ORIC Corporations', rel: 'Source indigenous corp records' },
    ],
    refreshCmd: 'node scripts/build-entity-graph.mjs',
    freshnessCol: 'updated_at',
  },
  'gs-relationships': {
    table: 'gs_relationships',
    label: 'Relationships',
    description: 'Connections between entities — donations, contracts, grants, subsidiaries, and lobbying links. The edges of the entity graph that make follow-the-money analysis possible.',
    source: 'Built from donations, contracts, grants',
    columns: [
      { key: 'relationship_type', label: 'Type' },
      { key: 'amount', label: 'Amount' },
      { key: 'year', label: 'Year' },
      { key: 'dataset', label: 'Source' },
      { key: 'confidence', label: 'Confidence' },
    ],
    connections: [
      { slug: 'gs-entities', label: 'Entities', rel: 'Source and target entities' },
    ],
    refreshCmd: 'node scripts/build-entity-graph.mjs',
    freshnessCol: 'created_at',
  },
  'asic-companies': {
    table: 'asic_companies',
    label: 'ASIC Companies',
    description: 'Australian Securities and Investments Commission company register. All registered companies with ACN, ABN, type, status, and registration dates.',
    source: 'ASIC company register (bulk)',
    columns: [
      { key: 'company_name', label: 'Name' },
      { key: 'acn', label: 'ACN' },
      { key: 'company_type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'date_of_registration', label: 'Registered' },
    ],
    connections: [
      { slug: 'gs-entities', label: 'Entities', rel: 'Matched into entity graph' },
      { slug: 'asx-companies', label: 'ASX Companies', rel: 'Listed companies cross-matched' },
    ],
    refreshCmd: null,
    freshnessCol: 'updated_at',
  },
  'ato-tax-transparency': {
    table: 'ato_tax_transparency',
    label: 'ATO Tax Transparency',
    description: 'Australian Tax Office transparency reports showing total income, taxable income, and tax payable for large entities. Reveals effective tax rates and who pays what.',
    source: 'ATO public reports',
    columns: [
      { key: 'entity_name', label: 'Entity' },
      { key: 'total_income', label: 'Total Income' },
      { key: 'taxable_income', label: 'Taxable Income' },
      { key: 'tax_payable', label: 'Tax Payable' },
      { key: 'report_year', label: 'Year' },
    ],
    connections: [],
    refreshCmd: null,
    freshnessCol: 'created_at',
  },
  'rogs-justice-spending': {
    table: 'rogs_justice_spending',
    label: 'ROGS Justice Spending',
    description: 'Report on Government Services justice spending data. State and territory expenditure on courts, policing, and corrections — foundational for JusticeHub analysis.',
    source: 'Productivity Commission ROGS reports',
    columns: [
      { key: 'financial_year', label: 'FY' },
      { key: 'measure', label: 'Measure' },
      { key: 'service_type', label: 'Service' },
      { key: 'nsw', label: 'NSW' },
      { key: 'qld', label: 'QLD' },
    ],
    connections: [],
    refreshCmd: null,
    freshnessCol: 'created_at',
  },
  'asx-companies': {
    table: 'asx_companies',
    label: 'ASX Companies',
    description: 'Australian Securities Exchange listed companies. Cross-referenced with ASIC for corporate structure analysis and foundation wealth-source tracing.',
    source: 'ASX listings',
    columns: [
      { key: 'company_name', label: 'Name' },
      { key: 'asx_code', label: 'Ticker' },
      { key: 'gics_industry_group', label: 'Industry' },
      { key: 'abn', label: 'ABN' },
      { key: 'created_at', label: 'Added' },
    ],
    connections: [
      { slug: 'asic-companies', label: 'ASIC Companies', rel: 'Cross-matched company records' },
    ],
    refreshCmd: null,
    freshnessCol: 'created_at',
  },
  'money-flows': {
    table: 'money_flows',
    label: 'Money Flows',
    description: 'Manual budget tracking of money flows through the system — from extraction (mining, finance) through foundations to community impact. Curated for follow-the-money narratives.',
    source: 'Manual budget tracking',
    columns: [
      { key: 'source_name', label: 'Source' },
      { key: 'destination_name', label: 'Destination' },
      { key: 'amount', label: 'Amount' },
      { key: 'flow_type', label: 'Type' },
      { key: 'year', label: 'Year' },
    ],
    connections: [],
    refreshCmd: null,
    freshnessCol: 'created_at',
  },
  'seifa-2021': {
    table: 'seifa_2021',
    label: 'SEIFA 2021',
    description: 'Socio-Economic Indexes for Areas from the 2021 Census. IRSD (disadvantage) and IRSAD (advantage/disadvantage) scores by postcode. Used to overlay grant data with community need.',
    source: 'ABS Census 2021',
    columns: [
      { key: 'postcode', label: 'Postcode' },
      { key: 'index_type', label: 'Index' },
      { key: 'score', label: 'Score' },
      { key: 'decile_national', label: 'Decile' },
      { key: 'rank_national', label: 'Rank' },
    ],
    connections: [],
    refreshCmd: 'node scripts/import-seifa-postcodes.mjs',
    freshnessCol: 'score', // static dataset, no timestamp
    notes: 'Static dataset from Census 2021. Does not update.',
  },
  'justice-funding': {
    table: 'justice_funding',
    label: 'Justice Funding',
    description: 'Government justice funding grants scraped from QLD ministerial statements and other sources. Shows exactly who receives youth justice, corrections, and community safety funding — the micro view of where justice dollars land.',
    source: 'QLD ministerial statements + federal sources',
    columns: [
      { key: 'recipient_name', label: 'Recipient' },
      { key: 'program_name', label: 'Program' },
      { key: 'amount_dollars', label: 'Amount' },
      { key: 'location', label: 'Location' },
      { key: 'sector', label: 'Sector' },
    ],
    connections: [
      { slug: 'rogs-justice-spending', label: 'ROGS Justice Spending', rel: 'Macro state-level spending context' },
      { slug: 'alma-interventions', label: 'ALMA Interventions', rel: 'Linked intervention programs' },
      { slug: 'acnc-charities', label: 'ACNC Charities', rel: 'Recipient org verification' },
    ],
    refreshCmd: null,
    freshnessCol: 'updated_at',
  },
  'alma-interventions': {
    table: 'alma_interventions',
    label: 'ALMA Interventions',
    description: 'JusticeHub intervention programs — community-led justice initiatives with evidence levels, cultural authority ratings, harm risk assessments, and implementation capability scores. The core of what-works-in-justice knowledge.',
    source: 'JusticeHub ALMA system',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'target_cohort', label: 'Cohort' },
      { key: 'evidence_level', label: 'Evidence' },
      { key: 'geography', label: 'Location' },
    ],
    connections: [
      { slug: 'alma-outcomes', label: 'ALMA Outcomes', rel: 'Measured outcomes for interventions' },
      { slug: 'alma-evidence', label: 'ALMA Evidence', rel: 'Research evidence base' },
      { slug: 'justice-funding', label: 'Justice Funding', rel: 'Funding linked to interventions' },
    ],
    refreshCmd: null,
    freshnessCol: 'updated_at',
  },
  'alma-outcomes': {
    table: 'alma_outcomes',
    label: 'ALMA Outcomes',
    description: 'Measurable outcomes from justice interventions — recidivism reduction, community safety, wellbeing indicators. Each outcome has measurement methods, indicators, and time horizons.',
    source: 'JusticeHub ALMA system',
    columns: [
      { key: 'name', label: 'Outcome' },
      { key: 'outcome_type', label: 'Type' },
      { key: 'measurement_method', label: 'Method' },
      { key: 'time_horizon', label: 'Horizon' },
      { key: 'beneficiary', label: 'Beneficiary' },
    ],
    connections: [
      { slug: 'alma-interventions', label: 'ALMA Interventions', rel: 'Interventions producing these outcomes' },
      { slug: 'alma-evidence', label: 'ALMA Evidence', rel: 'Evidence supporting outcomes' },
    ],
    refreshCmd: null,
    freshnessCol: 'updated_at',
  },
  'alma-evidence': {
    table: 'alma_evidence',
    label: 'ALMA Evidence',
    description: 'Research evidence base for justice interventions — academic papers, evaluations, and program reports with methodology, sample sizes, effect sizes, and cultural safety assessments.',
    source: 'JusticeHub ALMA system',
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'evidence_type', label: 'Type' },
      { key: 'methodology', label: 'Method' },
      { key: 'sample_size', label: 'Sample' },
      { key: 'organization', label: 'Org' },
    ],
    connections: [
      { slug: 'alma-interventions', label: 'ALMA Interventions', rel: 'Interventions this evidence supports' },
      { slug: 'alma-outcomes', label: 'ALMA Outcomes', rel: 'Outcomes this evidence measures' },
    ],
    refreshCmd: null,
    freshnessCol: 'updated_at',
  },
};

function slugToTable(slug: string): string {
  return slug.replace(/-/g, '_');
}

function formatValue(value: unknown, key: string): string {
  if (value === null || value === undefined) return '\u2014';
  if (key.includes('amount') || key.includes('revenue') || key.includes('income') || key.includes('tax_payable') || key === 'contract_value') {
    const n = Number(value);
    if (isNaN(n)) return String(value);
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  }
  if (key.includes('_at') || key === 'closes_at' || key === 'deadline' || key === 'registration_date' || key === 'contract_start' || key === 'date_of_registration') {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const s = String(value);
  return s.length > 80 ? s.slice(0, 77) + '...' : s;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function freshnessStatus(iso: string | null): { label: string; color: string } {
  if (!iso) return { label: 'UNKNOWN', color: 'bg-gray-300 text-bauhaus-black' };
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return { label: 'FRESH', color: 'bg-green-600 text-white' };
  if (days < 7) return { label: 'OK', color: 'bg-gray-200 text-bauhaus-black' };
  if (days < 30) return { label: 'STALE', color: 'bg-yellow-500 text-bauhaus-black' };
  return { label: 'CRITICAL', color: 'bg-red-500 text-white' };
}

export default async function DatasetDetailPage({
  params,
}: {
  params: Promise<{ dataset: string }>;
}) {
  const { dataset: slug } = await params;
  const config = DATASETS[slug];
  if (!config) notFound();

  const db = getServiceSupabase();
  const selectCols = config.columns.map(c => c.key).join(',');

  // Parallel queries: count, sample rows, freshness, connected dataset counts
  const isStatic = config.table === 'seifa_2021' || config.table === 'money_flows';
  const useEstimated = ['acnc_charities', 'political_donations', 'austender_contracts', 'asic_companies', 'gs_entities', 'gs_relationships'].includes(config.table);

  const [countResult, sampleResult, freshnessResult, ...connectionCounts] = await Promise.all([
    db.from(config.table).select('*', { count: useEstimated ? 'estimated' : 'exact', head: true }),
    db.from(config.table).select(selectCols).order(config.freshnessCol, { ascending: false }).limit(10),
    isStatic
      ? Promise.resolve({ data: null })
      : db.from(config.table).select(config.freshnessCol).order(config.freshnessCol, { ascending: false }).limit(1),
    ...config.connections.map(conn => {
      const connConfig = DATASETS[conn.slug];
      if (!connConfig) return Promise.resolve({ count: 0 });
      const useEst = ['acnc_charities', 'political_donations', 'austender_contracts', 'asic_companies', 'gs_entities', 'gs_relationships'].includes(connConfig.table);
      return db.from(connConfig.table).select('*', { count: useEst ? 'estimated' : 'exact', head: true });
    }),
  ]);

  const count = countResult.count ?? 0;
  const samples = ((sampleResult.data ?? []) as unknown) as Record<string, unknown>[];
  const lastUpdatedRaw = freshnessResult.data?.[0]
    ? Object.values(freshnessResult.data[0] as unknown as Record<string, unknown>)[0] as string | null
    : null;
  const lastUpdated = isStatic ? null : lastUpdatedRaw;
  const status = isStatic
    ? { label: 'STATIC', color: 'bg-blue-100 text-blue-700' }
    : freshnessStatus(lastUpdated);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/ops/health"
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black transition-colors"
        >
          Pipeline Health
        </Link>
        <span className="text-bauhaus-muted mx-2">/</span>
        <span className="text-xs font-black uppercase tracking-widest text-bauhaus-black">
          {config.label}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">
            {config.label}
          </h1>
          <p className="text-xs text-bauhaus-muted mt-1 max-w-2xl leading-relaxed">
            {config.description}
          </p>
        </div>
        <span className={`px-3 py-1 text-xs font-black uppercase tracking-wider ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Sample Records */}
          <section>
            <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-3 border-b-2 border-bauhaus-black pb-2">
              Sample Records
            </h2>
            {samples.length === 0 ? (
              <div className="border-4 border-dashed border-bauhaus-black/20 p-8 text-center">
                <div className="text-sm text-bauhaus-muted">No records found</div>
              </div>
            ) : (
              <div className="border-4 border-bauhaus-black overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bauhaus-black text-white">
                      {config.columns.map(col => (
                        <th key={col.key} className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {samples.map((row, i) => (
                      <tr key={i} className="border-t-2 border-bauhaus-black/10 hover:bg-gray-50">
                        {config.columns.map(col => (
                          <td key={col.key} className="px-4 py-2 text-xs font-mono truncate max-w-[200px]">
                            {formatValue(row[col.key], col.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-bauhaus-muted mt-2">
              Showing {samples.length} most recent of {count.toLocaleString()} total records
            </p>
          </section>

          {/* Connections */}
          {config.connections.length > 0 && (
            <section>
              <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-3 border-b-2 border-bauhaus-black pb-2">
                Connected Datasets
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {config.connections.map((conn, i) => {
                  const connCount = (connectionCounts[i] as { count: number | null })?.count ?? 0;
                  return (
                    <Link
                      key={conn.slug}
                      href={`/ops/health/${conn.slug}`}
                      className="border-4 border-bauhaus-black/30 p-4 hover:border-bauhaus-black transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-black uppercase tracking-wider group-hover:text-bauhaus-red transition-colors">
                          {conn.label}
                        </span>
                        <span className="text-lg font-black font-mono">
                          {connCount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-bauhaus-muted">{conn.rel}</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <section className="border-4 border-bauhaus-black p-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">Stats</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-bauhaus-muted uppercase tracking-wider">Records</div>
                <div className="text-2xl font-black">{count.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-bauhaus-muted uppercase tracking-wider">Last Updated</div>
                <div className="text-sm font-black">
                  {isStatic ? 'Census 2021' : lastUpdated ? timeAgo(lastUpdated) : 'Unknown'}
                </div>
                {lastUpdated && (
                  <div className="text-xs text-bauhaus-muted font-mono">
                    {new Date(lastUpdated).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-bauhaus-muted uppercase tracking-wider">Source</div>
                <div className="text-xs font-mono">{config.source}</div>
              </div>
              <div>
                <div className="text-xs text-bauhaus-muted uppercase tracking-wider">Table</div>
                <code className="text-xs font-mono bg-gray-100 px-1 py-0.5 border border-bauhaus-black/10">
                  {config.table}
                </code>
              </div>
            </div>
          </section>

          {/* Refresh */}
          {config.refreshCmd && (
            <section className="border-4 border-bauhaus-black/30 p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">Refresh Command</h3>
              <code className="text-xs font-mono text-bauhaus-black/70 break-all block bg-gray-100 p-2 border border-bauhaus-black/10">
                {config.refreshCmd}
              </code>
            </section>
          )}

          {/* Notes */}
          {config.notes && (
            <section className="border-4 border-yellow-500/30 bg-yellow-50 p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Note</h3>
              <p className="text-xs text-bauhaus-muted leading-relaxed">{config.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

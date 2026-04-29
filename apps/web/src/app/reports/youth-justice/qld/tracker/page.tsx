import Link from 'next/link';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import { fmt, money } from '@/lib/services/report-service';

export const revalidate = 3600;

export function generateMetadata() {
  return {
    title: 'QLD Crime Prevention Schools Tracker — CivicGraph',
    description:
      'Live CivicGraph accountability chain for Queensland crime prevention schools: promise, named providers, tender/process trace, award/payment trace, and local alternatives.',
  };
}

type Row = Record<string, unknown>;

type NamedProviderRow = {
  recipient_name: string;
  program_name: string | null;
  amount_dollars: number | null;
  source: string | null;
  source_url: string | null;
  project_description: string | null;
};

type ProcurementGapRow = {
  direct_cps_rows: number;
  youth_justice_school_rows: number;
  special_assistance_school_rows: number;
  men_of_business_rows: number;
  ohana_rows: number;
};

type SupplierTraceRow = {
  supplier_name: string;
  buyer_department: string | null;
  status: string | null;
  rows: number;
  total: number | null;
  source_url: string | null;
};

type BuyerDepartmentRow = {
  buyer_department: string | null;
  rows: number;
  total: number | null;
};

type SiteProviderProfileRow = {
  recipient_name: string;
  locations: string | null;
  local_rows: number;
  local_total: number | null;
  is_community_controlled: boolean | null;
  contract_rows: number;
  contract_total: number | null;
  latest_financial_year: string | null;
};

type CommunityAlternativeRow = {
  canonical_name: string;
  entity_type: string | null;
  lga_name: string | null;
  rows: number;
  total: number | null;
};

type EvidenceEventRow = {
  stage: string;
  event_date: string;
  title: string;
  summary: string | null;
  source_kind: string;
  source_name: string | null;
  source_url: string | null;
  provider_name: string | null;
  site_names: string[] | null;
  evidence_strength: string;
  mirror_status: string;
  source_doc_title: string | null;
  source_excerpt: string | null;
  source_html_title: string | null;
  source_fetch_status: string | null;
  source_fetch_error: string | null;
  source_render_hint: string | null;
  source_page_shell_only: string | null;
  source_cf_mitigated: string | null;
  source_fetch_via: string | null;
  trace_source_id: string | null;
  trace_issued_by: string | null;
  trace_unspsc: string | null;
  trace_released_at: string | null;
  trace_closing_at: string | null;
  trace_notice_type: string | null;
  trace_basis: string | null;
};

const SITE_FILTERS = [
  { label: 'Gold Coast', keywords: ['gold coast', 'southport', 'coomera', 'helensvale', 'labrador', 'pimpama', 'upper coomera'] },
  { label: 'Logan', keywords: ['logan', 'beenleigh', 'browns plains', 'crestmead', 'hillcrest', 'kingston', 'logan central', 'marsden', 'shailer park', 'slacks creek', 'springwood', 'waterford'] },
  { label: 'Ipswich', keywords: ['ipswich', 'leichhardt', 'raceview', 'silkstone'] },
  { label: 'Rockhampton', keywords: ['rockhampton', 'rockhampton city'] },
  { label: 'Townsville', keywords: ['townsville', 'currajong', 'douglas'] },
  { label: 'Cairns / Yarrabah', keywords: ['cairns', 'yarrabah', 'cairns north', 'bentley park', 'manoora', 'manunda', 'mooroobool', 'westcourt', 'mount sheridan', 'holloways beach'] },
] as const;

function num(v: unknown): number {
  return Number(v) || 0;
}

function statusTone(kind: 'strong' | 'partial' | 'weak') {
  const styles = {
    strong: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    partial: 'bg-amber-100 text-amber-700 border-amber-200',
    weak: 'bg-red-100 text-red-700 border-red-200',
  } as const;
  return styles[kind];
}

function sourceLabel(v: string | null | undefined) {
  if (!v) return 'Unspecified';
  return v.replaceAll('-', ' ');
}

function stageLabel(v: string) {
  return v.replaceAll('_', ' ');
}

function strengthTone(v: string) {
  const styles: Record<string, string> = {
    official: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    mirror: 'bg-blue-100 text-blue-700 border-blue-200',
    public_trace: 'bg-amber-100 text-amber-700 border-amber-200',
    mirror_gap: 'bg-red-100 text-red-700 border-red-200',
  };
  return styles[v] || 'bg-gray-100 text-gray-700 border-gray-200';
}

function mirrorLabel(v: string) {
  return v.replaceAll('_', ' ');
}

function formatEventDateTime(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function matchesSite(site: string | null, text: string | string[] | null | undefined) {
  if (!site) return true;
  const rule = SITE_FILTERS.find((item) => item.label === site);
  const haystack = Array.isArray(text) ? text.join(' ') : text || '';
  const lower = haystack.toLowerCase();
  if (lower.includes('queensland')) return true;
  return (rule?.keywords || [site.toLowerCase()]).some((keyword) => lower.includes(keyword));
}

function normaliseName(value: string | null | undefined) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function getData() {
  const supabase = getLiveReportSupabase();
  const q = <T,>(query: string, context: string) =>
    safe<T[] | null>(
      supabase.rpc('exec_sql', { query }) as PromiseLike<{ data: T[] | null; error: unknown }>,
      context,
    ) as Promise<T[] | null>;

  const [
    evidenceEvents,
    namedProviders,
    procurementGapRows,
    supplierTraceRows,
    youthJusticeBuyerDepartments,
    targetRegionProviders,
    communityAlternatives,
  ] = await Promise.all([
    q<EvidenceEventRow>(
      `
      SELECT
        stage,
        event_date::text,
        title,
        summary,
        source_kind,
        source_name,
        source_url,
        provider_name,
        site_names,
        evidence_strength,
        mirror_status,
        metadata->'source_fetch'->>'doc_title' AS source_doc_title,
        COALESCE(metadata->'source_fetch'->>'doc_excerpt', metadata->'source_fetch'->>'page_excerpt') AS source_excerpt,
        metadata->'source_fetch'->>'html_title' AS source_html_title,
        metadata->'source_fetch'->>'fetch_status' AS source_fetch_status,
        metadata->'source_fetch'->>'fetch_error' AS source_fetch_error,
        metadata->'source_fetch'->>'render_hint' AS source_render_hint,
        metadata->'source_fetch'->>'page_shell_only' AS source_page_shell_only,
        metadata->'source_fetch'->>'cf_mitigated' AS source_cf_mitigated,
        metadata->'source_fetch'->>'fetch_via' AS source_fetch_via,
        metadata->>'source_id' AS trace_source_id,
        metadata->>'issued_by' AS trace_issued_by,
        metadata->>'unspsc' AS trace_unspsc,
        metadata->>'released_at' AS trace_released_at,
        metadata->>'closing_at' AS trace_closing_at,
        metadata->>'notice_type' AS trace_notice_type,
        metadata->>'trace_basis' AS trace_basis
      FROM tracker_evidence_events
      WHERE domain = 'youth-justice'
        AND jurisdiction = 'QLD'
        AND tracker_key = 'crime-prevention-schools'
      ORDER BY event_date ASC, created_at ASC
      `,
      'qld cps tracker evidence events',
    ),
    q<NamedProviderRow>(
      `
      SELECT recipient_name, program_name, amount_dollars, source, source_url, project_description
      FROM justice_funding
      WHERE state = 'QLD'
        AND topics @> ARRAY['youth-justice']::text[]
        AND recipient_name IN (
          'Men of Business Academy',
          'OHANA EDUCATION LTD',
          'The Ted Noffs Foundation',
          'Shine For Kids Limited',
          'Gallang Place Aboriginal and Torres Strait Islanders Corporation',
          'Yabun Panjoo Aboriginal Corporation'
        )
      ORDER BY recipient_name, amount_dollars DESC NULLS LAST
      `,
      'qld cps tracker named providers',
    ),
    q<ProcurementGapRow>(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE title ILIKE '%Crime Prevention Schools%'
             OR description ILIKE '%Crime Prevention Schools%'
             OR source_id ILIKE '%VP476087%'
        )::int AS direct_cps_rows,
        COUNT(*) FILTER (
          WHERE title ILIKE '%Youth Justice School%'
             OR description ILIKE '%Youth Justice School%'
        )::int AS youth_justice_school_rows,
        COUNT(*) FILTER (
          WHERE title ILIKE '%Special Assistance School%'
             OR description ILIKE '%Special Assistance School%'
        )::int AS special_assistance_school_rows,
        COUNT(*) FILTER (
          WHERE supplier_name ILIKE '%Men of Business%'
        )::int AS men_of_business_rows,
        COUNT(*) FILTER (
          WHERE supplier_name ILIKE '%OHANA EDUCATION%'
        )::int AS ohana_rows
      FROM state_tenders
      WHERE state = 'QLD'
      `,
      'qld cps tracker procurement gap',
    ),
    q<SupplierTraceRow>(
      `
      SELECT
        supplier_name,
        buyer_department,
        status,
        COUNT(*)::int AS rows,
        COALESCE(SUM(contract_value), 0)::numeric AS total,
        MIN(source_url) AS source_url
      FROM state_tenders
      WHERE state = 'QLD'
        AND (
          supplier_name ILIKE '%OHANA EDUCATION%'
          OR supplier_name ILIKE '%MEN OF BUSINESS%'
          OR supplier_name ILIKE '%TED NOFFS%'
          OR supplier_name ILIKE '%YABUN PANJOO%'
          OR supplier_name ILIKE '%GALLANG PLACE%'
        )
      GROUP BY supplier_name, buyer_department, status
      ORDER BY total DESC NULLS LAST, supplier_name
      LIMIT 16
      `,
      'qld cps tracker supplier trace',
    ),
    q<BuyerDepartmentRow>(
      `
      SELECT
        buyer_department,
        COUNT(*)::int AS rows,
        COALESCE(SUM(contract_value), 0)::numeric AS total
      FROM state_tenders
      WHERE state = 'QLD'
        AND buyer_department ILIKE '%Youth Justice%'
      GROUP BY buyer_department
      ORDER BY total DESC NULLS LAST
      LIMIT 6
      `,
      'qld cps tracker buyer departments',
    ),
    q<SiteProviderProfileRow>(
      `
      WITH target_rows AS MATERIALIZED (
        SELECT
          jf.recipient_name,
          jf.recipient_abn,
          jf.gs_entity_id::text AS gs_entity_id,
          jf.location,
          jf.amount_dollars,
          e.is_community_controlled
        FROM justice_funding jf
        LEFT JOIN gs_entities e ON e.id = jf.gs_entity_id
        WHERE jf.state = 'QLD'
          AND jf.topics @> ARRAY['youth-justice']::text[]
          AND COALESCE(jf.is_aggregate, false) = false
          AND (
            jf.location ILIKE '%Ipswich%'
            OR jf.location ILIKE '%Rockhampton%'
            OR jf.location ILIKE '%Townsville%'
            OR jf.location ILIKE '%Gold Coast%'
            OR jf.location ILIKE '%Logan%'
            OR jf.location ILIKE '%Cairns%'
            OR jf.location ILIKE '%Yarrabah%'
          )
      ),
      site_providers AS (
        SELECT
          recipient_name,
          MAX(recipient_abn) AS recipient_abn,
          MAX(gs_entity_id) AS gs_entity_id,
          STRING_AGG(DISTINCT location, '; ' ORDER BY location) AS locations,
          COUNT(*)::int AS local_rows,
          COALESCE(SUM(amount_dollars), 0)::numeric AS local_total,
          BOOL_OR(COALESCE(is_community_controlled, false)) AS is_community_controlled
        FROM target_rows
        GROUP BY recipient_name
        ORDER BY COALESCE(SUM(amount_dollars), 0) DESC NULLS LAST
        LIMIT 80
      ),
      provider_contracts AS MATERIALIZED (
        SELECT
          sp.recipient_name,
          COUNT(qcd.*)::int AS contract_rows,
          COALESCE(SUM(qcd.amount_dollars), 0)::numeric AS contract_total,
          MAX(qcd.financial_year) AS latest_financial_year
        FROM site_providers sp
        LEFT JOIN justice_funding qcd
          ON qcd.source = 'qld_contract_disclosure'
         AND LOWER(qcd.recipient_name) = LOWER(sp.recipient_name)
        GROUP BY sp.recipient_name
      )
      SELECT
        sp.recipient_name,
        sp.locations,
        sp.local_rows,
        sp.local_total,
        sp.is_community_controlled,
        COALESCE(cf.contract_rows, 0)::int AS contract_rows,
        COALESCE(cf.contract_total, 0)::numeric AS contract_total,
        cf.latest_financial_year
      FROM site_providers sp
      LEFT JOIN provider_contracts cf ON cf.recipient_name = sp.recipient_name
      ORDER BY sp.local_total DESC NULLS LAST
      LIMIT 12
      `,
      'qld cps tracker target region field',
    ),
    q<CommunityAlternativeRow>(
      `
      SELECT
        e.canonical_name,
        e.entity_type,
        e.lga_name,
        COUNT(*)::int AS rows,
        COALESCE(SUM(jf.amount_dollars), 0)::numeric AS total
      FROM justice_funding jf
      JOIN gs_entities e ON e.id = jf.gs_entity_id
      WHERE jf.state = 'QLD'
        AND jf.topics @> ARRAY['youth-justice']::text[]
        AND COALESCE(jf.is_aggregate, false) = false
        AND e.is_community_controlled = true
        AND (
          jf.location ILIKE '%Ipswich%'
          OR jf.location ILIKE '%Rockhampton%'
          OR jf.location ILIKE '%Townsville%'
          OR jf.location ILIKE '%Gold Coast%'
          OR jf.location ILIKE '%Logan%'
          OR jf.location ILIKE '%Cairns%'
          OR jf.location ILIKE '%Yarrabah%'
        )
      GROUP BY e.canonical_name, e.entity_type, e.lga_name
      ORDER BY total DESC NULLS LAST
      LIMIT 12
      `,
      'qld cps tracker local alternatives',
    ),
  ]);

  return {
    evidenceEvents: evidenceEvents ?? [],
    namedProviders: namedProviders ?? [],
    procurementGap: procurementGapRows?.[0] ?? null,
    supplierTraceRows: supplierTraceRows ?? [],
    youthJusticeBuyerDepartments: youthJusticeBuyerDepartments ?? [],
    targetRegionProviders: targetRegionProviders ?? [],
    communityAlternatives: communityAlternatives ?? [],
  };
}

export default async function QldCrimePreventionSchoolsTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  const data = await getData();
  const gap = data.procurementGap;
  const providerSiteMap = new Map<string, string[]>();
  for (const event of data.evidenceEvents) {
    if (!event.provider_name || !event.site_names?.length) continue;
    providerSiteMap.set(normaliseName(event.provider_name), event.site_names);
  }
  const selectedSite = SITE_FILTERS.some((item) => item.label === site) ? (site as string) : null;
  const providerSitesForName = (name: string | null | undefined) => {
    const normalized = normaliseName(name);
    if (!normalized) return null;
    for (const [key, sites] of providerSiteMap.entries()) {
      if (normalized.includes(key) || key.includes(normalized)) return sites;
    }
    return null;
  };
  const filteredEvidenceEvents = data.evidenceEvents.filter((row) => matchesSite(selectedSite, row.site_names));
  const filteredNamedProviders = data.namedProviders.filter((row) => {
    const providerSites = providerSitesForName(row.recipient_name);
    if (!selectedSite || !providerSites) return true;
    return matchesSite(selectedSite, providerSites);
  });
  const filteredSupplierTraceRows = data.supplierTraceRows.filter((row) => {
    const providerSites = providerSitesForName(row.supplier_name);
    if (!selectedSite || !providerSites) return true;
    return matchesSite(selectedSite, providerSites);
  });
  const filteredTargetRegionProviders = data.targetRegionProviders.filter((row) => matchesSite(selectedSite, row.locations));
  const filteredCommunityAlternatives = data.communityAlternatives.filter((row) => matchesSite(selectedSite, row.lga_name));
  const communityAlternativeTotal = filteredCommunityAlternatives.reduce((sum, row) => sum + num(row.total), 0);
  const visibleProviderCount = filteredTargetRegionProviders.length;
  const visibleCommunityControlledCount = filteredTargetRegionProviders.filter((row) => row.is_community_controlled).length;
  const contractLinkedProviderCount = filteredTargetRegionProviders.filter((row) => num(row.contract_rows) > 0).length;
  const siteContractExposureTotal = filteredTargetRegionProviders.reduce((sum, row) => sum + num(row.contract_total), 0);
  const siteLocalExposureTotal = filteredTargetRegionProviders.reduce((sum, row) => sum + num(row.local_total), 0);
  const rankedProviderStack = [...filteredTargetRegionProviders]
    .sort((a, b) => num(b.local_total) - num(a.local_total) || num(b.contract_total) - num(a.contract_total))
    .slice(0, 8);
  const rankedContractIncumbents = [...filteredTargetRegionProviders]
    .filter((row) => num(row.contract_rows) > 0)
    .sort((a, b) => num(b.contract_total) - num(a.contract_total) || num(b.local_total) - num(a.local_total))
    .slice(0, 8);
  const rankedCommunityAlternatives = [...filteredCommunityAlternatives]
    .sort((a, b) => num(b.total) - num(a.total))
    .slice(0, 8);
  const siteStoryProviders = Array.from(
    new Set(
      filteredEvidenceEvents
        .map((row) => row.provider_name)
        .filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, 6);
  const namedProviderMirrorCount = filteredNamedProviders.length;
  const awardLinkedCount = filteredSupplierTraceRows.length;
  const tenderTraceEvent = filteredEvidenceEvents.find((row) => row.stage === 'tender_trace');
  const awardTraceEvent = filteredEvidenceEvents.find((row) => row.stage === 'award_trace');
  const processGapLabel =
    num(gap?.direct_cps_rows) > 0
      ? 'Structured tender row mirrored'
      : tenderTraceEvent
        ? `Public trace only • ${mirrorLabel(tenderTraceEvent.mirror_status)}`
        : 'No tender/process trace filtered to this site';
  const topIncumbentShare = siteContractExposureTotal
    ? num(rankedContractIncumbents[0]?.contract_total) / siteContractExposureTotal
    : 0;
  const topThreeIncumbentShare = siteContractExposureTotal
    ? rankedContractIncumbents.slice(0, 3).reduce((sum, row) => sum + num(row.contract_total), 0) / siteContractExposureTotal
    : 0;
  const topProviderLocalShare = siteLocalExposureTotal
    ? num(rankedProviderStack[0]?.local_total) / siteLocalExposureTotal
    : 0;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <Link
          href="/reports/youth-justice/qld"
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          &larr; Queensland Youth Justice
        </Link>
        <div className="mb-1 mt-4 flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Live Tracker</span>
          <span className="rounded-sm bg-bauhaus-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            QLD Crime Prevention Schools
          </span>
        </div>
        <h1 className="mb-3 text-3xl font-black text-bauhaus-black sm:text-4xl">
          Promise → Provider → Process → Award → Local Alternative
        </h1>
        <p className="max-w-4xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
          This is the live CivicGraph chain for Queensland crime prevention schools. It combines official public sources,
          the local justice funding mirror, the local state tender mirror, and the already-visible provider field in the target regions.
        </p>
        {selectedSite ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-sm border-2 border-bauhaus-black bg-bauhaus-black px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white">
            Site focus
            <span className="text-bauhaus-red">{selectedSite}</span>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/reports/youth-justice/qld/tracker"
            className={`rounded-sm border-2 px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${
              selectedSite
                ? 'border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white'
                : 'border-bauhaus-black bg-bauhaus-black text-white'
            }`}
          >
            All package sites
          </Link>
          {SITE_FILTERS.map((site) => (
            <Link
              key={site.label}
              href={`/reports/youth-justice/qld/tracker?site=${encodeURIComponent(site.label)}`}
              className={`rounded-sm border-2 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${
                selectedSite === site.label
                  ? 'border-bauhaus-black bg-bauhaus-red text-white'
                  : 'border-bauhaus-black/15 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black'
              }`}
            >
              {site.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-2xl font-black text-emerald-700 sm:text-3xl">{fmt(filteredEvidenceEvents.length)}</div>
          <div className="mt-1 text-xs text-gray-500">Official public chain sources</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <div className="text-2xl font-black text-red-700 sm:text-3xl">{fmt(num(gap?.direct_cps_rows))}</div>
          <div className="mt-1 text-xs text-gray-500">Direct CPS tender rows in local mirror</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
          <div className="text-2xl font-black text-blue-700 sm:text-3xl">{fmt(num(gap?.ohana_rows))}</div>
          <div className="mt-1 text-xs text-gray-500">Ohana supplier rows in local tender mirror</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="text-2xl font-black text-amber-700 sm:text-3xl">{money(communityAlternativeTotal)}</div>
          <div className="mt-1 text-xs text-gray-500">Community-controlled target-region field</div>
        </div>
      </div>

      {selectedSite ? (
        <section className="mb-12 grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div className="rounded-sm border-2 border-bauhaus-black bg-white p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Named story at this site</div>
            <div className="mt-3 text-lg font-black text-bauhaus-black">{siteStoryProviders.length > 0 ? siteStoryProviders.join(', ') : 'No named provider in filtered public chain yet'}</div>
            <div className="mt-2 text-xs leading-relaxed text-bauhaus-muted">
              {namedProviderMirrorCount} mirrored named-provider row{namedProviderMirrorCount === 1 ? '' : 's'} tied to this site filter.
            </div>
          </div>

          <div className="rounded-sm border-2 border-blue-200 bg-blue-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">Top local incumbent</div>
            <div className="mt-3 text-lg font-black text-bauhaus-black">
              {rankedContractIncumbents[0]?.recipient_name || 'No contract-linked incumbent visible'}
            </div>
            <div className="mt-2 text-xs leading-relaxed text-bauhaus-muted">
              {rankedContractIncumbents[0]
                ? `${money(num(rankedContractIncumbents[0].contract_total))} • ${fmt(num(rankedContractIncumbents[0].contract_rows))} contract rows`
                : 'No matched contract exposure in the repaired QLD disclosure mirror yet.'}
            </div>
          </div>

          <div className="rounded-sm border-2 border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Top community-led alternative</div>
            <div className="mt-3 text-lg font-black text-bauhaus-black">
              {rankedCommunityAlternatives[0]?.canonical_name || 'No community-controlled alternative visible'}
            </div>
            <div className="mt-2 text-xs leading-relaxed text-bauhaus-muted">
              {rankedCommunityAlternatives[0]
                ? `${money(num(rankedCommunityAlternatives[0].total))} • ${fmt(num(rankedCommunityAlternatives[0].rows))} mirrored rows`
                : 'No community-controlled row currently visible in this site catchment.'}
            </div>
          </div>

          <div className="rounded-sm border-2 border-amber-200 bg-amber-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Process gap status</div>
            <div className="mt-3 text-lg font-black text-bauhaus-black">{processGapLabel}</div>
            <div className="mt-2 text-xs leading-relaxed text-bauhaus-muted">
              {awardTraceEvent
                ? `Award trace is ${mirrorLabel(awardTraceEvent.mirror_status)}. ${awardLinkedCount} supplier trace row${awardLinkedCount === 1 ? '' : 's'} visible for this site filter.`
                : `${awardLinkedCount} supplier trace row${awardLinkedCount === 1 ? '' : 's'} visible. The missing link is still the site-specific tender-to-award chain.`}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-12 rounded-sm border-4 border-bauhaus-black bg-white p-6">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">
          {selectedSite ? `${selectedSite} shortlist` : 'Package-wide shortlist'}
        </div>
        <h2 className="text-2xl font-black text-bauhaus-black">
          {selectedSite ? `What the ${selectedSite} provider field looks like right now` : 'What the visible provider field looks like across the full package'}
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-bauhaus-muted">
          This turns the site filter into an operator view: who is most visible on the ground, who already has contract-linked exposure in the Queensland system, and where the community-controlled alternatives sit relative to that stack.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <div className="border-2 border-bauhaus-black/10 bg-bauhaus-muted/5 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Top provider local share</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">{pct(topProviderLocalShare)}</div>
            <div className="mt-1 text-xs text-bauhaus-muted">
              {rankedProviderStack[0]?.recipient_name || 'No visible provider'} of current local mirrored field
            </div>
          </div>
          <div className="border-2 border-red-200 bg-red-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-red-700">Top incumbent contract share</div>
            <div className="mt-2 text-2xl font-black text-red-700">{pct(topIncumbentShare)}</div>
            <div className="mt-1 text-xs text-bauhaus-muted">
              {rankedContractIncumbents[0]?.recipient_name || 'No matched contract trace'} of visible contract exposure
            </div>
          </div>
          <div className="border-2 border-amber-200 bg-amber-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Top 3 incumbent share</div>
            <div className="mt-2 text-2xl font-black text-amber-700">{pct(topThreeIncumbentShare)}</div>
            <div className="mt-1 text-xs text-bauhaus-muted">how concentrated the visible contract-linked stack already is</div>
          </div>
          <div className="border-2 border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Community-controlled alternatives</div>
            <div className="mt-2 text-2xl font-black text-emerald-700">{fmt(rankedCommunityAlternatives.length)}</div>
            <div className="mt-1 text-xs text-bauhaus-muted">already visible in the same site catchment</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-5">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Dominant visible providers</div>
            <p className="mb-4 text-sm text-bauhaus-muted">
              Highest local mirrored presence in the selected site field.
            </p>
            <div className="space-y-3">
              {rankedProviderStack.map((row) => (
                <div key={`provider-${row.recipient_name}`} className="border-b border-bauhaus-black/10 pb-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-black text-bauhaus-black">{row.recipient_name}</div>
                        {row.is_community_controlled ? (
                          <span className="rounded-sm bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                            Community-controlled
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-bauhaus-muted">{row.locations || 'Location not mirrored'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-bauhaus-black">{money(num(row.local_total))}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">{fmt(num(row.local_rows))} rows</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-5">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-blue">Contract-linked incumbents</div>
            <p className="mb-4 text-sm text-bauhaus-muted">
              Providers in the site field that already have visible QLD contract-disclosure exposure.
            </p>
            <div className="space-y-3">
              {rankedContractIncumbents.length > 0 ? rankedContractIncumbents.map((row) => (
                <div key={`incumbent-${row.recipient_name}`} className="border-b border-bauhaus-black/10 pb-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-black text-bauhaus-black">{row.recipient_name}</div>
                      <div className="mt-1 text-sm text-bauhaus-muted">{row.locations || 'Location not mirrored'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-bauhaus-black">{money(num(row.contract_total))}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">
                        {fmt(num(row.contract_rows))} rows{row.latest_financial_year ? ` • ${row.latest_financial_year}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-sm leading-relaxed text-bauhaus-muted">
                  No matched contract-linked incumbents are visible for this site yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-5">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-700">Community-controlled alternatives</div>
            <p className="mb-4 text-sm text-bauhaus-muted">
              Community-controlled organisations already visible in the same catchment.
            </p>
            <div className="space-y-3">
              {rankedCommunityAlternatives.length > 0 ? rankedCommunityAlternatives.map((row) => (
                <div key={`community-${row.canonical_name}`} className="border-b border-bauhaus-black/10 pb-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-black text-bauhaus-black">{row.canonical_name}</div>
                      <div className="mt-1 text-sm text-bauhaus-muted">
                        {(row.entity_type || 'entity').replaceAll('_', ' ')}
                        {row.lga_name ? ` • ${row.lga_name}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-bauhaus-black">{money(num(row.total))}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">{fmt(num(row.rows))} rows</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-sm leading-relaxed text-bauhaus-muted">
                  No community-controlled alternative rows are visible for this site filter yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Chain health</div>
          <h2 className="text-2xl font-black text-bauhaus-black">What is strong, what is weak, what is still hidden</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              ['Promise layer', 'strong', 'Hansard + statements + budget framing are explicit.'],
              ['Named providers', 'strong', 'Men of Business and Ohana are both visible in the public record.'],
              ['Tender process', 'partial', 'Public EOI trace exists, but CivicGraph does not yet mirror that tender row.'],
              ['Award / payment', 'partial', 'Ohana has a mirrored awarded row; Men of Business does not yet.'],
              ['Local alternatives', 'strong', 'Target regions already contain community-controlled and non-aggregate providers.'],
            ].map(([title, kind, note]) => (
              <div key={title} className="border-2 border-bauhaus-black/10 p-4">
                <div className={`inline-flex rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${statusTone(kind as 'strong' | 'partial' | 'weak')}`}>
                  {kind}
                </div>
                <h3 className="mt-3 text-sm font-black uppercase tracking-wide text-bauhaus-black">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">{note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-5">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-blue">Immediate read</div>
            <p className="text-lg font-black leading-tight text-bauhaus-black">
              Queensland has a visible promise chain and a visible provider market, but not yet a fully visible tender-to-award chain.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-bauhaus-muted">
              That means the right accountability question is no longer “was this promised?” It is “who actually got selected, under what process, and compared to which local alternatives?”
            </p>
          </div>

          <div className="rounded-sm border-2 border-bauhaus-black bg-bauhaus-black p-5 text-white">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Missing piece</div>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              The largest current gap is the missing local mirror row for the Crime Prevention Schools EOI / tender process, even though the public QTenders / VendorPanel trace is visible.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <div className="mb-4">
          <h2 className="border-b-4 border-bauhaus-red pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            Official Source Chain
          </h2>
          <p className="mt-2 text-sm text-bauhaus-muted">
            These are the official or official-adjacent public sources that form the current chain.
          </p>
        </div>
        <div className="space-y-4">
          {filteredEvidenceEvents.map((item) => (
            <div key={`${item.event_date}-${item.stage}-${item.title}`} className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">{item.event_date}</span>
                <span className="rounded-sm bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">
                  {stageLabel(item.stage)}
                </span>
                <span className={`rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${strengthTone(item.evidence_strength)}`}>
                  {item.evidence_strength.replaceAll('_', ' ')}
                </span>
                <span className="rounded-sm bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">
                  {mirrorLabel(item.mirror_status)}
                </span>
              </div>
              <h3 className="text-lg font-black text-bauhaus-black">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">{item.summary}</p>
              {item.source_excerpt || item.trace_source_id || item.trace_issued_by || item.source_fetch_error || item.source_render_hint || item.source_cf_mitigated ? (
                <div className="mt-4 grid gap-3 xl:grid-cols-[1.1fr,0.9fr]">
                  <div className="rounded-sm border border-bauhaus-black/10 bg-bauhaus-muted/5 p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Source extraction</div>
                    {item.source_doc_title || item.source_html_title ? (
                      <div className="mt-2 text-xs font-black uppercase tracking-wider text-bauhaus-black">
                        {item.source_doc_title || item.source_html_title}
                      </div>
                    ) : null}
                    {item.source_cf_mitigated ? (
                      <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                        Direct source fetch is blocked by a challenge page. This tracker is relying on the mirrored procurement row and the other public chain evidence instead of the raw CSV body.
                      </p>
                    ) : item.source_render_hint === 'client_rendered_page_shell' ? (
                      <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                        QTenders serves this record through a client-rendered shell, so the tracker uses the structured public trace fields and the existing CivicGraph mirror-gap check rather than a server-rendered tender detail page.
                      </p>
                    ) : item.source_excerpt ? (
                      <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">{item.source_excerpt}</p>
                    ) : (
                      <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                        No extractable passage captured for this source yet.
                      </p>
                    )}
                  </div>

                  <div className="rounded-sm border border-bauhaus-black/10 bg-white p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Source diagnostics</div>
                    <div className="mt-2 space-y-2 text-sm leading-relaxed text-bauhaus-muted">
                      {item.trace_source_id ? (
                        <div>
                          <span className="font-black text-bauhaus-black">Trace ID:</span> {item.trace_source_id}
                        </div>
                      ) : null}
                      {item.trace_notice_type ? (
                        <div>
                          <span className="font-black text-bauhaus-black">Notice type:</span> {item.trace_notice_type}
                        </div>
                      ) : null}
                      {item.trace_issued_by ? (
                        <div>
                          <span className="font-black text-bauhaus-black">Issued by:</span> {item.trace_issued_by}
                        </div>
                      ) : null}
                      {item.trace_unspsc ? (
                        <div>
                          <span className="font-black text-bauhaus-black">UNSPSC:</span> {item.trace_unspsc}
                        </div>
                      ) : null}
                      {item.trace_released_at ? (
                        <div>
                          <span className="font-black text-bauhaus-black">Released:</span> {formatEventDateTime(item.trace_released_at)}
                        </div>
                      ) : null}
                      {item.trace_closing_at ? (
                        <div>
                          <span className="font-black text-bauhaus-black">Closing:</span> {formatEventDateTime(item.trace_closing_at)}
                        </div>
                      ) : null}
                      {item.source_render_hint ? (
                        <div>
                          <span className="font-black text-bauhaus-black">Render:</span> {item.source_render_hint.replaceAll('_', ' ')}
                        </div>
                      ) : null}
                      {item.source_cf_mitigated ? (
                        <div>
                          <span className="font-black text-bauhaus-black">Access gate:</span> {item.source_cf_mitigated}
                        </div>
                      ) : null}
                      {item.source_fetch_error ? (
                        <div>
                          <span className="font-black text-bauhaus-black">Fetch note:</span> {item.source_fetch_error}
                        </div>
                      ) : null}
                      {item.source_fetch_status ? (
                        <div>
                          <span className="font-black text-bauhaus-black">Fetch status:</span> {item.source_fetch_status}
                          {item.source_fetch_via ? ` via ${item.source_fetch_via}` : ''}
                        </div>
                      ) : null}
                      {item.trace_basis ? (
                        <div className="border-t border-bauhaus-black/10 pt-2 text-xs font-medium uppercase tracking-wide text-bauhaus-muted">
                          {item.trace_basis}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">
                {item.source_name ? <span>{item.source_name}</span> : null}
                {item.provider_name ? <span>• Provider: {item.provider_name}</span> : null}
                {item.site_names && item.site_names.length > 0 ? <span>• Sites: {item.site_names.join(', ')}</span> : null}
              </div>
              {item.source_url ? (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
                >
                  Open source &rarr;
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-6">
          <h2 className="border-b-4 border-bauhaus-red pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            Named Providers In The Mirror
          </h2>
          <p className="mb-4 mt-2 text-sm text-bauhaus-muted">
            Direct rows already visible in the CivicGraph youth justice mirror for the organisations at the centre of the current story.
          </p>
          <div className="space-y-3">
            {filteredNamedProviders.map((row, idx) => (
              <div key={`${row.recipient_name}-${row.program_name}-${idx}`} className="border-b border-bauhaus-black/10 pb-3 last:border-b-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-black text-bauhaus-black">{row.recipient_name}</div>
                    <div className="mt-1 text-sm text-bauhaus-muted">
                      {row.program_name || 'Program not mirrored'} • {sourceLabel(row.source)}
                    </div>
                    {row.project_description ? (
                      <div className="mt-1 text-sm text-bauhaus-muted">{row.project_description}</div>
                    ) : null}
                  </div>
                  <div className="text-right text-lg font-black text-bauhaus-black">
                    {row.amount_dollars == null ? 'No amount mirrored' : money(num(row.amount_dollars))}
                  </div>
                </div>
                {row.source_url ? (
                  <a
                    href={row.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
                  >
                    Open source file &rarr;
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-6">
          <h2 className="border-b-4 border-bauhaus-blue pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            Tender / Process Gap
          </h2>
          <p className="mb-4 mt-2 text-sm text-bauhaus-muted">
            This is the critical break in the chain between public promise and structured procurement evidence.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="border-2 border-red-200 bg-red-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-red-700">Direct CPS rows</div>
              <div className="mt-2 text-2xl font-black text-red-700">{fmt(num(gap?.direct_cps_rows))}</div>
              <div className="mt-1 text-xs font-medium text-bauhaus-muted">No local tender row yet for Crime Prevention Schools / VP476087.</div>
            </div>
            <div className="border-2 border-red-200 bg-red-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-red-700">Men of Business supplier rows</div>
              <div className="mt-2 text-2xl font-black text-red-700">{fmt(num(gap?.men_of_business_rows))}</div>
              <div className="mt-1 text-xs font-medium text-bauhaus-muted">No local supplier trace yet in state tenders.</div>
            </div>
            <div className="border-2 border-blue-200 bg-blue-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">Ohana supplier rows</div>
              <div className="mt-2 text-2xl font-black text-blue-700">{fmt(num(gap?.ohana_rows))}</div>
              <div className="mt-1 text-xs font-medium text-bauhaus-muted">Awarded row exists via the DYJVS disclosure ingest.</div>
            </div>
            <div className="border-2 border-amber-200 bg-amber-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Special assistance school rows</div>
              <div className="mt-2 text-2xl font-black text-amber-700">{fmt(num(gap?.special_assistance_school_rows))}</div>
              <div className="mt-1 text-xs font-medium text-bauhaus-muted">No local structured school-process rows under that model name either.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-6">
          <h2 className="border-b-4 border-bauhaus-red pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            Award / Payment Trace That Is Visible
          </h2>
          <p className="mb-4 mt-2 text-sm text-bauhaus-muted">
            These rows exist now in the local QLD state tender mirror and are the current best structured procurement evidence around the named provider field.
          </p>
          <div className="space-y-3">
            {filteredSupplierTraceRows.map((row) => (
              <div key={`${row.supplier_name}-${row.buyer_department}-${row.status}`} className="border-b border-bauhaus-black/10 pb-3 last:border-b-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-black text-bauhaus-black">{row.supplier_name}</div>
                    <div className="mt-1 text-sm text-bauhaus-muted">
                      {row.buyer_department || 'Buyer department not mirrored'}
                      {row.status ? ` • ${row.status}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-bauhaus-black">{money(num(row.total))}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">{fmt(num(row.rows))} rows</div>
                  </div>
                </div>
                {row.source_url ? (
                  <a
                    href={row.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
                  >
                    Open source file &rarr;
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-6">
          <h2 className="border-b-4 border-bauhaus-blue pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            Youth Justice Buyer Departments
          </h2>
          <p className="mb-4 mt-2 text-sm text-bauhaus-muted">
            The underlying youth justice procurement field is large. That makes the missing structured Crime Prevention Schools row even more significant.
          </p>
          <div className="space-y-3">
            {data.youthJusticeBuyerDepartments.map((row) => (
              <div key={row.buyer_department || 'unknown-buyer'} className="flex items-start justify-between gap-4 border-b border-bauhaus-black/10 pb-3 last:border-b-0">
                <div>
                  <div className="font-black text-bauhaus-black">{row.buyer_department || 'Unknown buyer department'}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">{fmt(num(row.rows))} tender rows</div>
                </div>
                <div className="text-right text-lg font-black text-bauhaus-black">{money(num(row.total))}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-6">
          <h2 className="border-b-4 border-bauhaus-red pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            Existing Provider Field In The Target Regions
          </h2>
          <p className="mb-4 mt-2 text-sm text-bauhaus-muted">
            Non-aggregate youth-justice-linked providers already visible across Logan, Gold Coast, Ipswich, Rockhampton, Townsville, and Cairns/Yarrabah, now joined to the repaired QLD contract-disclosure mirror.
          </p>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="border-2 border-bauhaus-black/10 bg-bauhaus-muted/5 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Visible providers</div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{fmt(visibleProviderCount)}</div>
            </div>
            <div className="border-2 border-emerald-200 bg-emerald-50 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Community-controlled</div>
              <div className="mt-2 text-2xl font-black text-emerald-700">{fmt(visibleCommunityControlledCount)}</div>
            </div>
            <div className="border-2 border-blue-200 bg-blue-50 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">With contract trace</div>
              <div className="mt-2 text-2xl font-black text-blue-700">{fmt(contractLinkedProviderCount)}</div>
            </div>
            <div className="border-2 border-amber-200 bg-amber-50 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Matched contract exposure</div>
              <div className="mt-2 text-2xl font-black text-amber-700">{money(siteContractExposureTotal)}</div>
            </div>
          </div>
          <div className="space-y-3">
            {filteredTargetRegionProviders.map((row) => (
              <div key={row.recipient_name} className="grid gap-4 border-b border-bauhaus-black/10 pb-3 last:border-b-0 xl:grid-cols-[1.4fr,0.65fr,0.75fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-black text-bauhaus-black">{row.recipient_name}</div>
                    {row.is_community_controlled ? (
                      <span className="rounded-sm bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        Community-Controlled
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-bauhaus-muted">{row.locations || 'Location not mirrored'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Local field</div>
                  <div className="mt-1 text-lg font-black text-bauhaus-black">{money(num(row.local_total))}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">{fmt(num(row.local_rows))} rows</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">QLD contract trace</div>
                  <div className="mt-1 text-lg font-black text-bauhaus-black">
                    {num(row.contract_rows) > 0 ? money(num(row.contract_total)) : 'No trace yet'}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">
                    {fmt(num(row.contract_rows))} rows{row.latest_financial_year ? ` • ${row.latest_financial_year}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-6">
          <h2 className="border-b-4 border-bauhaus-blue pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            Community-Controlled Alternatives Already Visible
          </h2>
          <p className="mb-4 mt-2 text-sm text-bauhaus-muted">
            These are community-controlled organisations already visible in the same catchments through the local mirror.
          </p>
          <div className="space-y-3">
            {filteredCommunityAlternatives.map((row) => (
              <div key={row.canonical_name} className="flex items-start justify-between gap-4 border-b border-bauhaus-black/10 pb-3 last:border-b-0">
                <div>
                  <div className="font-black text-bauhaus-black">{row.canonical_name}</div>
                  <div className="mt-1 text-sm text-bauhaus-muted">
                    {(row.entity_type || 'entity').replaceAll('_', ' ')}
                    {row.lga_name ? ` • ${row.lga_name}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-bauhaus-black">{money(num(row.total))}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">{fmt(num(row.rows))} rows</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-12 rounded-sm border-2 border-bauhaus-black bg-bauhaus-black p-6 text-white">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Next build</div>
        <h2 className="text-2xl font-black">This should now become a true process tracker, not just a source chain.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-white/80">
          The next engineering move is to ingest the Crime Prevention Schools EOI metadata itself, then add QON and estimates rows into a structured evidence table so the chain can be filtered by site, provider, process step, and evidence depth.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/reports/youth-justice/qld/crime-prevention-schools"
            className="border-2 border-white bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-bauhaus-black transition-colors hover:bg-transparent hover:text-white"
          >
            Open investigation
          </Link>
          <Link
            href="/graph?query=Men%20of%20Business%20Academy"
            className="border-2 border-white px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-bauhaus-black"
          >
            Graph Men of Business
          </Link>
          <Link
            href="/graph?query=OHANA%20EDUCATION%20LTD"
            className="border-2 border-white px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-bauhaus-black"
          >
            Graph Ohana
          </Link>
        </div>
      </section>
    </div>
  );
}

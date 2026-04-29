import Link from 'next/link';
import { getServiceSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import { fmt, money } from '@/lib/services/report-service';

export const revalidate = 3600;

export function generateMetadata() {
  return {
    title: 'QLD Crime Prevention Schools Investigation — CivicGraph',
    description: 'A focused CivicGraph investigation into Queensland crime prevention schools: promises, named providers, tender trace, provider field, and evidence gaps.',
  };
}

type Row = Record<string, unknown>;

type SummaryRow = {
  total_rows: number;
  total_amount: number;
  provider_rows: number;
  provider_amount: number;
  dyjvs_rows: number;
  dyjvs_amount: number;
  community_controlled_rows: number;
  community_controlled_amount: number;
};

type NamedProviderRow = {
  recipient_name: string;
  program_name: string | null;
  amount_dollars: number | null;
  source: string | null;
  source_url: string | null;
  project_description: string | null;
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

type ContractFieldRow = {
  recipient_name: string;
  rows: number;
  total: number | null;
  is_community_controlled: boolean | null;
};

type CommunityControlledRow = {
  canonical_name: string;
  entity_type: string | null;
  lga_name: string | null;
  rows: number;
  total: number | null;
};

type EvidenceRow = {
  hansard_hits: number;
  media_hits: number;
  statement_hits: number;
  crime_prevention_rows: number;
  ohana_contract_rows: number;
};

type ProcurementGapRow = {
  direct_cps_rows: number;
  youth_justice_school_rows: number;
  special_assistance_school_rows: number;
  men_of_business_rows: number;
  ohana_rows: number;
};

type TenderTraceRow = {
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

type HansardRow = {
  sitting_date: string;
  speaker_name: string;
  subject: string | null;
  source_url: string | null;
  snippet: string;
};

const PUBLIC_TIMELINE = [
  {
    date: '10 Dec 2024',
    title: 'Parliamentary promise',
    status: 'validated',
    detail:
      'Hansard records $40M for four early intervention schools in Ipswich, Townsville, Gold Coast, and Rockhampton, alongside two youth justice schools.',
    href: 'https://documents.parliament.qld.gov.au/events/han/2024/2024_12_10_WEEKLY.pdf',
    source: 'QLD Hansard',
  },
  {
    date: '23 Jun 2025',
    title: 'Men of Business publicly singled out',
    status: 'validated',
    detail:
      'Official statement says $50M over five years for four crime prevention schools, with Men of Business first and tenders later for Townsville, Rockhampton, and Ipswich.',
    href: 'https://statements.qld.gov.au/statements/102828',
    source: 'QLD Ministerial Statement',
  },
  {
    date: '29 Aug 2025',
    title: 'EOI / tender trace appears',
    status: 'validated',
    detail:
      'QTenders / VendorPanel trace for Crime Prevention Schools EOI appears publicly as tender VP476087, showing an open provider process for remaining sites.',
    href: 'https://qtenders.epw.qld.gov.au/qtenders/tender/display/tender-details.do?action=display-tender-details&id=55096',
    source: 'QTenders / VendorPanel trace',
  },
  {
    date: '4 Feb 2026',
    title: 'Ohana rollout becomes concrete',
    status: 'validated',
    detail:
      'Official Logan statement names Ohana for Youth as Youth Justice School operator for Logan Central, with a second Cairns site under the $40M package.',
    href: 'https://statements.qld.gov.au/statements/104436',
    source: 'QLD Ministerial Statement',
  },
  {
    date: 'Apr 2026',
    title: 'Selection-process allegation',
    status: 'under-review',
    detail:
      'Fresh media reporting alleges provider-selection issues for remaining crime prevention schools. CivicGraph can test the spend and provider field now, but not yet prove panel composition from local data alone.',
    href: null,
    source: 'External media trigger',
  },
] as const;

function num(v: unknown): number {
  return Number(v) || 0;
}

function amountLabel(v: number | null | undefined) {
  if (v == null) return 'No amount mirrored';
  return money(v);
}

function sourceLabel(v: string | null | undefined) {
  if (!v) return 'Unspecified';
  return v.replaceAll('-', ' ');
}

function statusBadge(status: 'validated' | 'under-review') {
  if (status === 'validated') {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
        Validated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
      Under Review
    </span>
  );
}

function evidenceBadge(kind: 'strong' | 'partial' | 'weak') {
  const styles = {
    strong: 'bg-emerald-100 text-emerald-700',
    partial: 'bg-amber-100 text-amber-700',
    weak: 'bg-red-100 text-red-700',
  } as const;
  return (
    <span className={`inline-flex rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-wider ${styles[kind]}`}>
      {kind}
    </span>
  );
}

async function getData() {
  const supabase = getServiceSupabase();
  const q = <T,>(query: string, context: string) =>
    safe<T[] | null>(
      supabase.rpc('exec_sql', { query }) as PromiseLike<{ data: T[] | null; error: unknown }>,
      context,
    ) as Promise<T[] | null>;

  const [
    summaryRows,
    namedProviders,
    targetRegionProviders,
    contractField,
    communityControlledTop,
    evidenceRows,
    procurementGapRows,
    tenderTraceRows,
    youthJusticeBuyerDepartments,
    hansardRows,
  ] =
    await Promise.all([
      q<SummaryRow>(
        `
        WITH base AS (
          SELECT *
          FROM justice_funding
          WHERE state = 'QLD'
            AND topics @> ARRAY['youth-justice']::text[]
            AND COALESCE(source, '') <> 'austender-direct'
        ),
        provider_rows AS (
          SELECT *
          FROM base
          WHERE COALESCE(is_aggregate, false) = false
            AND recipient_name NOT ILIKE 'Department%'
            AND recipient_name NOT ILIKE 'Youth Justice%'
            AND recipient_name <> 'Total'
        ),
        cc_rows AS (
          SELECT p.*
          FROM provider_rows p
          JOIN gs_entities e ON e.id = p.gs_entity_id
          WHERE e.is_community_controlled = true
        )
        SELECT
          (SELECT COUNT(*)::int FROM base) AS total_rows,
          (SELECT COALESCE(SUM(amount_dollars), 0)::numeric FROM base) AS total_amount,
          (SELECT COUNT(*)::int FROM provider_rows) AS provider_rows,
          (SELECT COALESCE(SUM(amount_dollars), 0)::numeric FROM provider_rows) AS provider_amount,
          (SELECT COUNT(*)::int FROM base WHERE source = 'dyjvs-contracts') AS dyjvs_rows,
          (SELECT COALESCE(SUM(amount_dollars), 0)::numeric FROM base WHERE source = 'dyjvs-contracts') AS dyjvs_amount,
          (SELECT COUNT(*)::int FROM cc_rows) AS community_controlled_rows,
          (SELECT COALESCE(SUM(amount_dollars), 0)::numeric FROM cc_rows) AS community_controlled_amount
        `,
        'qld cps summary',
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
        'qld cps named providers',
      ),
      q<SiteProviderProfileRow>(
        `
        WITH target_rows AS (
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
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) AS contract_rows,
            COALESCE(SUM(amount_dollars), 0)::numeric AS contract_total,
            MAX(financial_year) AS latest_financial_year
          FROM justice_funding qcd
          WHERE qcd.source = 'qld_contract_disclosure'
            AND (
              (sp.gs_entity_id IS NOT NULL AND qcd.gs_entity_id::text = sp.gs_entity_id)
              OR (sp.recipient_abn IS NOT NULL AND qcd.recipient_abn = sp.recipient_abn)
              OR LOWER(qcd.recipient_name) = LOWER(sp.recipient_name)
            )
        ) cf ON TRUE
        ORDER BY sp.local_total DESC NULLS LAST
        LIMIT 24
        `,
        'qld cps target regions',
      ),
      q<ContractFieldRow>(
        `
        SELECT
          jf.recipient_name,
          COUNT(*)::int AS rows,
          COALESCE(SUM(jf.amount_dollars), 0)::numeric AS total,
          BOOL_OR(COALESCE(e.is_community_controlled, false)) AS is_community_controlled
        FROM justice_funding jf
        LEFT JOIN gs_entities e ON e.id = jf.gs_entity_id
        WHERE jf.state = 'QLD'
          AND jf.source = 'dyjvs-contracts'
          AND jf.topics @> ARRAY['youth-justice']::text[]
        GROUP BY jf.recipient_name
        ORDER BY total DESC NULLS LAST
        LIMIT 18
        `,
        'qld cps contract field',
      ),
      q<CommunityControlledRow>(
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
        GROUP BY e.canonical_name, e.entity_type, e.lga_name
        ORDER BY total DESC NULLS LAST
        LIMIT 16
        `,
        'qld cps community controlled',
      ),
      q<EvidenceRow>(
        `
        SELECT
          (SELECT COUNT(*)::int
           FROM civic_hansard
           WHERE jurisdiction = 'QLD'
             AND (body_text ILIKE '%youth justice school%'
               OR body_text ILIKE '%crime prevention school%'
               OR body_text ILIKE '%Men of Business%'
               OR body_text ILIKE '%Ohana%')) AS hansard_hits,
          (SELECT COUNT(*)::int
           FROM alma_media_articles
           WHERE headline ILIKE '%Youth Justice School%'
              OR headline ILIKE '%Crime Prevention School%'
              OR full_text ILIKE '%Men of Business Academy%'
              OR full_text ILIKE '%Ohana for Youth%') AS media_hits,
          (SELECT COUNT(*)::int
           FROM civic_ministerial_statements
           WHERE jurisdiction = 'QLD'
             AND (headline ILIKE '%Youth Justice School%'
               OR body_text ILIKE '%crime prevention school%'
               OR body_text ILIKE '%Men of Business%'
               OR body_text ILIKE '%Ohana%')) AS statement_hits,
          (SELECT COUNT(*)::int
           FROM justice_funding
           WHERE state = 'QLD'
             AND topics @> ARRAY['youth-justice']::text[]
             AND program_name ILIKE '%Crime Prevention Youth Justice Schools%') AS crime_prevention_rows,
          (SELECT COUNT(*)::int
           FROM justice_funding
           WHERE state = 'QLD'
             AND source = 'dyjvs-contracts'
             AND recipient_name ILIKE '%OHANA EDUCATION LTD%') AS ohana_contract_rows
        `,
        'qld cps evidence',
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
        'qld cps procurement gap',
      ),
      q<TenderTraceRow>(
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
        'qld cps tender trace',
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
        'qld cps youth justice buyer departments',
      ),
      q<HansardRow>(
        `
        SELECT sitting_date::text, speaker_name, subject, source_url, LEFT(body_text, 420) AS snippet
        FROM civic_hansard
        WHERE jurisdiction = 'QLD'
          AND (body_text ILIKE '%youth justice school%'
            OR body_text ILIKE '%crime prevention school%'
            OR body_text ILIKE '%Men of Business%'
            OR body_text ILIKE '%Ohana%')
        ORDER BY sitting_date DESC
        LIMIT 6
        `,
        'qld cps hansard rows',
      ),
    ]);

  return {
    summary: summaryRows?.[0] ?? null,
    namedProviders: namedProviders ?? [],
    targetRegionProviders: targetRegionProviders ?? [],
    contractField: contractField ?? [],
    communityControlledTop: communityControlledTop ?? [],
    evidence: evidenceRows?.[0] ?? null,
    procurementGap: procurementGapRows?.[0] ?? null,
    tenderTraceRows: tenderTraceRows ?? [],
    youthJusticeBuyerDepartments: youthJusticeBuyerDepartments ?? [],
    hansardRows: hansardRows ?? [],
  };
}

export default async function QldCrimePreventionSchoolsInvestigationPage() {
  const data = await getData();
  const s = data.summary;
  const e = data.evidence;
  const p = data.procurementGap;
  const visibleProviderCount = data.targetRegionProviders.length;
  const visibleCommunityControlledCount = data.targetRegionProviders.filter((row) => row.is_community_controlled).length;
  const contractLinkedProviderCount = data.targetRegionProviders.filter((row) => num(row.contract_rows) > 0).length;
  const siteContractExposureTotal = data.targetRegionProviders.reduce((sum, row) => sum + num(row.contract_total), 0);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <Link
          href="/reports/youth-justice/qld"
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          &larr; Queensland Youth Justice
        </Link>
        <div className="mt-4 mb-1 flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-widest text-bauhaus-red">
            Investigation
          </span>
          <span className="rounded-sm bg-bauhaus-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            QLD Crime Prevention Schools
          </span>
        </div>
        <h1 className="mb-3 text-3xl font-black text-bauhaus-black sm:text-4xl">
          Promise, Provider, Tender, Award
        </h1>
        <p className="max-w-4xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
          This page separates what Queensland publicly promised, which providers were publicly named,
          what is already visible in the youth justice delivery market, and where the auditable procurement
          trail still goes dark.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <div className="text-2xl font-black text-red-600 sm:text-3xl">{money(num(s?.total_amount))}</div>
          <div className="mt-1 text-xs text-gray-500">QLD youth justice mirror</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="text-2xl font-black text-amber-600 sm:text-3xl">{money(num(s?.provider_amount))}</div>
          <div className="mt-1 text-xs text-gray-500">Non-aggregate provider field</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
          <div className="text-2xl font-black text-blue-600 sm:text-3xl">{money(num(s?.dyjvs_amount))}</div>
          <div className="mt-1 text-xs text-gray-500">DYJVS contract-disclosure slice</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-2xl font-black text-emerald-600 sm:text-3xl">{money(num(s?.community_controlled_amount))}</div>
          <div className="mt-1 text-xs text-gray-500">Community-controlled slice</div>
        </div>
      </div>

      <section className="mb-10 grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr,0.9fr]">
        <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Trigger question</div>
          <h2 className="mb-3 text-2xl font-black text-bauhaus-black">Is this a real provider market or a politically pre-shaped pathway?</h2>
          <p className="mb-4 text-sm leading-relaxed text-bauhaus-muted">
            CivicGraph can already test the field around that question. The current record shows public commitments,
            named providers, a visible EOI trace, and a large existing youth justice provider ecosystem. It does not yet
            prove panel composition or final award mechanics for the disputed sites.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="border-2 border-bauhaus-black/15 p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">What is strong</div>
              <p className="text-sm font-medium text-bauhaus-black">Promises, provider naming, broad budget framing, and part of the contract field.</p>
            </div>
            <div className="border-2 border-bauhaus-black/15 p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">What is partial</div>
              <p className="text-sm font-medium text-bauhaus-black">Award trace for crime prevention schools and direct spend attribution for named operators.</p>
            </div>
            <div className="border-2 border-bauhaus-black/15 p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">What is missing</div>
              <p className="text-sm font-medium text-bauhaus-black">EOI evaluation docs, panel composition, shortlisted bidders, and final award basis.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Evidence status</div>
              {evidenceBadge('partial')}
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-bauhaus-black/10 pb-2">
                <span className="font-medium text-bauhaus-muted">Hansard hits</span>
                <span className="font-black text-bauhaus-black">{fmt(num(e?.hansard_hits))}</span>
              </div>
              <div className="flex items-center justify-between border-b border-bauhaus-black/10 pb-2">
                <span className="font-medium text-bauhaus-muted">Ministerial statement hits</span>
                <span className="font-black text-bauhaus-black">{fmt(num(e?.statement_hits))}</span>
              </div>
              <div className="flex items-center justify-between border-b border-bauhaus-black/10 pb-2">
                <span className="font-medium text-bauhaus-muted">Media hits in mirror</span>
                <span className="font-black text-bauhaus-black">{fmt(num(e?.media_hits))}</span>
              </div>
              <div className="flex items-center justify-between border-b border-bauhaus-black/10 pb-2">
                <span className="font-medium text-bauhaus-muted">Crime prevention rows in funding mirror</span>
                <span className="font-black text-bauhaus-black">{fmt(num(e?.crime_prevention_rows))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-bauhaus-muted">Ohana contract rows in DYJVS disclosure</span>
                <span className="font-black text-bauhaus-black">{fmt(num(e?.ohana_contract_rows))}</span>
              </div>
            </div>
          </div>

          <div className="rounded-sm border-2 border-bauhaus-black bg-bauhaus-black p-5 text-white">
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Current read</div>
            <p className="text-lg font-black leading-tight">
              The public commitment layer is clear. The final procurement-process layer is not.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              That is why this should be treated as a live investigation, not a settled verdict.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="border-b-4 border-bauhaus-red pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
              Public Record Timeline
            </h2>
            <p className="mt-2 text-sm text-bauhaus-muted">
              What has actually been stated publicly so far, separated from claims we still need to verify.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {PUBLIC_TIMELINE.map((item) => (
            <div key={`${item.date}-${item.title}`} className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">{item.date}</span>
                {statusBadge(item.status)}
                <span className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">{item.source}</span>
              </div>
              <h3 className="text-lg font-black text-bauhaus-black">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">{item.detail}</p>
              {item.href ? (
                <a
                  href={item.href}
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

      <section className="mb-12">
        <h2 className="border-b-4 border-bauhaus-red pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
          Named Providers In The Record
        </h2>
        <p className="mt-2 mb-4 text-sm text-bauhaus-muted">
          This distinguishes named operators that appear only in statements from operators that already show up in contract or spend layers.
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.namedProviders.map((row, idx) => (
            <div key={`${row.recipient_name}-${row.program_name}-${idx}`} className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="text-lg font-black text-bauhaus-black">{row.recipient_name}</h3>
                {row.source === 'qld_ministerial_statement'
                  ? evidenceBadge('partial')
                  : row.source === 'dyjvs-contracts'
                    ? evidenceBadge('strong')
                    : evidenceBadge('partial')}
              </div>
              <div className="text-sm font-medium text-bauhaus-muted">{row.program_name || 'Program not labelled'}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="border border-bauhaus-black/10 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Amount</div>
                  <div className="mt-1 text-lg font-black text-bauhaus-black">{amountLabel(row.amount_dollars)}</div>
                </div>
                <div className="border border-bauhaus-black/10 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Source</div>
                  <div className="mt-1 text-sm font-bold uppercase tracking-wide text-bauhaus-black">{sourceLabel(row.source)}</div>
                </div>
              </div>
              {row.project_description ? (
                <p className="mt-3 text-sm leading-relaxed text-bauhaus-muted">{row.project_description}</p>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-bauhaus-muted">
                  No structured project description is currently mirrored for this row.
                </p>
              )}
              {row.source_url ? (
                <a
                  href={row.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
                >
                  Open linked source &rarr;
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Procurement trace</div>
          <h2 className="text-2xl font-black text-bauhaus-black">Public EOI exists. Local tender mirror is still dark on the core school package.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-bauhaus-muted">
            We can now show the accountability gap directly. The public QTenders / VendorPanel trace for Crime Prevention Schools exists,
            but the local structured tender mirror does not currently carry a matching tender or award row for that package.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-sm border-2 border-emerald-200 bg-emerald-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Public EOI trace</div>
              <div className="mt-2 text-2xl font-black text-emerald-700">Yes</div>
              <div className="mt-1 text-xs font-medium text-bauhaus-muted">VP476087 appears publicly on QTenders / VendorPanel.</div>
            </div>
            <div className="rounded-sm border-2 border-red-200 bg-red-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-red-700">Direct CPS rows in mirror</div>
              <div className="mt-2 text-2xl font-black text-red-700">{fmt(num(p?.direct_cps_rows))}</div>
              <div className="mt-1 text-xs font-medium text-bauhaus-muted">No Crime Prevention Schools tender row is mirrored locally yet.</div>
            </div>
            <div className="rounded-sm border-2 border-red-200 bg-red-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-red-700">Men of Business supplier rows</div>
              <div className="mt-2 text-2xl font-black text-red-700">{fmt(num(p?.men_of_business_rows))}</div>
              <div className="mt-1 text-xs font-medium text-bauhaus-muted">No local supplier award trace found in the tender mirror.</div>
            </div>
            <div className="rounded-sm border-2 border-blue-200 bg-blue-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">Ohana supplier rows</div>
              <div className="mt-2 text-2xl font-black text-blue-700">{fmt(num(p?.ohana_rows))}</div>
              <div className="mt-1 text-xs font-medium text-bauhaus-muted">One awarded supplier row is visible via the DYJVS disclosure feed.</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="border-2 border-bauhaus-black/10 p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">What this proves</div>
              <p className="text-sm leading-relaxed text-bauhaus-muted">
                There was a public provider process signal. Ohana also has an awarded youth-justice supplier footprint in the mirror.
              </p>
            </div>
            <div className="border-2 border-bauhaus-black/10 p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">What this does not prove yet</div>
              <p className="text-sm leading-relaxed text-bauhaus-muted">
                It still does not prove who was shortlisted, who assessed the bids, or whether Men of Business or others were formally awarded through the same process.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-5">
            <h3 className="border-b-4 border-bauhaus-blue pb-2 text-lg font-black uppercase tracking-wider text-bauhaus-black">
              Supplier rows visible in the local tender mirror
            </h3>
            <div className="mt-4 space-y-3">
              {data.tenderTraceRows.map((row) => (
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

          <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-5">
            <h3 className="border-b-4 border-bauhaus-red pb-2 text-lg font-black uppercase tracking-wider text-bauhaus-black">
              Youth justice buyer departments in the tender mirror
            </h3>
            <div className="mt-4 space-y-3">
              {data.youthJusticeBuyerDepartments.map((row) => (
                <div key={row.buyer_department || 'unknown-buyer-dept'} className="flex items-start justify-between gap-4 border-b border-bauhaus-black/10 pb-3 last:border-b-0">
                  <div>
                    <div className="font-black text-bauhaus-black">{row.buyer_department || 'Unknown buyer department'}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">{fmt(num(row.rows))} tender rows</div>
                  </div>
                  <div className="text-right text-lg font-black text-bauhaus-black">{money(num(row.total))}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-6">
          <h2 className="border-b-4 border-bauhaus-red pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            Existing Provider Field Around Target Regions
          </h2>
          <p className="mt-2 mb-4 text-sm text-bauhaus-muted">
            Non-aggregate youth justice-linked providers already visible across Logan/Gold Coast, Ipswich, Rockhampton, Townsville, and Cairns/Yarrabah, joined to the repaired QLD contract-disclosure mirror.
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
            {data.targetRegionProviders.map((row) => (
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
            What This Means
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-bauhaus-muted">
            <p>
              The delivery field is already real. Queensland does not lack youth-justice-adjacent providers in the same geographies the schools target.
            </p>
            <p>
              That means the sharper question is not capacity. It is process: who got preferred, who got invited, and who was realistically in the frame when the state moved from promise to procurement.
            </p>
            <p>
              It also means community-controlled inclusion can be tested empirically against a known provider base, rather than treated as an abstract fairness issue.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-6">
          <h2 className="border-b-4 border-bauhaus-red pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            Direct DYJVS Contract Field
          </h2>
          <p className="mt-2 mb-4 text-sm text-bauhaus-muted">
            The visible contract-disclosure slice is dominated by specialised support, bail, rehabilitation, and service-delivery operators.
          </p>
          <div className="space-y-3">
            {data.contractField.map((row) => (
              <div key={row.recipient_name} className="flex items-start justify-between gap-4 border-b border-bauhaus-black/10 pb-3 last:border-b-0">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-black text-bauhaus-black">{row.recipient_name}</div>
                    {row.is_community_controlled ? (
                      <span className="rounded-sm bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        Community-Controlled
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">{fmt(num(row.rows))} contract rows</div>
                </div>
                <div className="text-right text-lg font-black text-bauhaus-black">{money(num(row.total))}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-6">
          <h2 className="border-b-4 border-bauhaus-blue pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            Community-Controlled Provider Base
          </h2>
          <p className="mt-2 mb-4 text-sm text-bauhaus-muted">
            Top community-controlled entities already visible in the QLD youth justice-linked funding mirror.
          </p>
          <div className="space-y-3">
            {data.communityControlledTop.map((row) => (
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

      <section className="mb-12 rounded-sm border-4 border-bauhaus-black bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="border-b-4 border-bauhaus-red pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
              Hansard Footprint
            </h2>
            <p className="mt-2 text-sm text-bauhaus-muted">
              The parliamentary mirror currently carries very little operational detail. Most hits are political framing, not process disclosure.
            </p>
          </div>
          {evidenceBadge(num(e?.hansard_hits) >= 4 ? 'partial' : 'weak')}
        </div>
        <div className="space-y-4">
          {data.hansardRows.map((row, idx) => (
            <div key={`${row.sitting_date}-${row.speaker_name}-${idx}`} className="border-2 border-bauhaus-black/10 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">
                <span>{row.sitting_date}</span>
                <span>•</span>
                <span>{row.speaker_name}</span>
                {row.subject ? (
                  <>
                    <span>•</span>
                    <span>{row.subject}</span>
                  </>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed text-bauhaus-muted">{row.snippet}…</p>
              {row.source_url ? (
                <a
                  href={row.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
                >
                  Open Hansard &rarr;
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-6">
          <h2 className="border-b-4 border-bauhaus-red pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            What We Can Say Now
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-bauhaus-muted">
            <li>The public commitment layer is clear: the schools were promised, costed publicly, and politically framed around early intervention.</li>
            <li>Men of Business was explicitly singled out early as the first crime prevention school operator with a public funding commitment.</li>
            <li>Ohana has both public political visibility and a concrete DYJVS contract-disclosure footprint.</li>
            <li>The state tender mirror currently shows a procurement evidence gap: the public Crime Prevention Schools EOI trace exists, but no matching tender row is mirrored locally.</li>
            <li>The wider QLD youth justice delivery market already contains many providers in the same target regions, including community-controlled entities.</li>
            <li>The current structured mirror does not yet show a clean awarded-spend trail for the full crime prevention school package.</li>
          </ul>
        </div>

        <div className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-6">
          <h2 className="border-b-4 border-bauhaus-blue pb-2 text-xl font-black uppercase tracking-wider text-bauhaus-black">
            What We Need Next
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-bauhaus-muted">
            <li>QTenders / VendorPanel ingest with tender metadata, amendments, Q&amp;A, shortlist, and award fields.</li>
            <li>Budget estimates, QON, and committee-answer ingestion for provider-selection detail.</li>
            <li>Direct contract award records for Men of Business, Ohana, and any selected providers for Ipswich, Rockhampton, Townsville, and Cairns.</li>
            <li>RTI-released evaluation or briefing documents if they surface publicly.</li>
            <li>A structured comparison of named providers against community-controlled/local providers already active in those catchments.</li>
          </ul>
        </div>
      </section>

      <section className="mb-12 rounded-sm border-2 border-bauhaus-black bg-bauhaus-black p-6 text-white">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Next move</div>
        <h2 className="text-2xl font-black">This should become a live procurement accountability tracker.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-white/80">
          The right CivicGraph product move is not another static memo. It is a live chain for
          <span className="font-black text-white"> promise → named provider → tender trace → award trace → payment trace → local alternative field</span>,
          so every future claim can be tested against evidence depth.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/reports/youth-justice/qld/tracker"
            className="border-2 border-white bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-bauhaus-black transition-colors hover:bg-transparent hover:text-white"
          >
            Open QLD tracker
          </Link>
          <Link
            href="/graph?query=Men%20of%20Business%20Australia%20Limited"
            className="border-2 border-white px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-bauhaus-black"
          >
            Graph Men of Business
          </Link>
          <Link
            href="/graph?query=Ohana%20Education%20Ltd"
            className="border-2 border-white px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-bauhaus-black"
          >
            Graph Ohana
          </Link>
        </div>
      </section>
    </div>
  );
}

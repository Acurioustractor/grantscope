import Link from 'next/link';
import { headers } from 'next/headers';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import {
 ReportSection, ReportToc, Finding, SourceLink, SourcesPanel, PullQuote, StatStrip, ModeToggle, RelatedReads,
} from '@/components/reports/long-read';

export const dynamic = 'force-dynamic';
export const metadata = {
 title: 'QLD Youth Justice, The Most-Sourced Report Ever Written · CivicGraph',
 description: "Seven volumes. Seventeen numbered findings. Live watchhouse data, the detention-vs-community spend ratio, the ACCO funding gap, multi-system providers, foundation landscape, director networks, place hotspots, policy moves, every claim sourced.",
};

function money(n: number | null | undefined): string {
 if (n == null || !Number.isFinite(Number(n))) return '—';
 const v = Number(n);
 if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
 if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
 if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
 return `$${v.toLocaleString()}`;
}
function fmt(n: number | null | undefined): string {
 if (n == null || !Number.isFinite(Number(n))) return '—';
 return Number(n).toLocaleString();
}

// Extract the "Policy objectives and the reasons for them" paragraph from a
// QLD parliament Explanatory Note. Returns the first ~360 chars of the
// objectives section, or null if the section header isn't present.
function extractPolicyObjective(text: string | null): string | null {
 if (!text) return null;
 const i = text.search(/policy\s+objectives?\s+and\s+(?:the\s+)?reasons?/i);
 if (i === -1) return null;
 const after = text.slice(i).split('\n').slice(1).join(' ');
 const stop = after.search(/\n\s*(achievement\s+of\s+(?:policy|the)|alternative\s+ways|estimated\s+cost|consistency\s+with)/i);
 const objective = (stop > 0 ? after.slice(0, stop) : after.slice(0, 800))
 .replace(/\s+/g, ' ').trim();
 if (objective.length < 40) return null;
 return objective.length > 360 ? objective.slice(0, 360).replace(/\s+\S*$/, '') + '…' : objective;
}

type LatestRow = {
 source_generated_at: string;
 total_people: number; total_adults: number; total_children: number;
 child_first_nations: number; child_3_7_days: number; child_over_7_days: number;
 child_longest_days: number; child_watchhouse_count: number;
 adult_first_nations: number; adult_over_7_days: number; adult_longest_days: number;
};
type SpendRow = { recipient_name: string; total: number };
type AccoRow = { org_type: string; total_funding: number; funding_share_pct: number; orgs: number };
type FoundationRow = { name: string; total_giving_annual: number; thematic_focus: string };
type CrossSectorRow = { recipient_name: string; sectors: number; total: number };
type CtgRow = { financial_year: string; actual_rate: number; gap_from_target: number };
type UnfundedRow = { name: string; type: string; evidence_level: string | null };
type ContractRow = { supplier_name: string; total: number; contracts: number };
type LgaRow = { lga_name: string; youth_offender_rate: number | null; indigenous_pct: number | null };
type DirectorRow = { person_name: string; board_count: number; total_justice: number };
type NdisRow = { state: string; youth_participants: number };
type YearTotalRow = { financial_year: string; total: number };
type OfficialBill = { bill_name: string; sponsor: string | null; sponsor_party: string | null; introduced_date: string | null; status: string | null; status_date: string | null; source_url: string; explanatory_note_url: string | null; statement_of_compatibility_url: string | null; explanatory_note_text: string | null };
type CoronerFinding = { title: string; deceased_identifier: string | null; finding_date: string | null; coroner_name: string | null; recommendations_count: number | null; topics: string[] | null; source_url: string };

async function getNumbers() {
 const supabase = getLiveReportSupabase();
 const [
 latest, spend, accoGap, foundations, crossSector, ctg, unfunded,
 contracts, hotspots, directors, ndis, mhFundingCount, almaCount, almaQldCount,
 yearTrend, officialBills, coronerFindings, outcomeMetrics,
 ] = await Promise.all([
 safe(supabase.rpc('exec_sql', {
 query: `SELECT source_generated_at::text, total_people, total_adults, total_children,
 child_first_nations, child_3_7_days, child_over_7_days, child_longest_days,
 child_watchhouse_count, adult_first_nations, adult_over_7_days, adult_longest_days
 FROM public.v_qld_watchhouse_latest LIMIT 1`,
 })) as Promise<LatestRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT recipient_name, SUM(amount_dollars)::bigint AS total
 FROM public.justice_funding
 WHERE state = 'QLD' AND recipient_name LIKE 'Youth Justice -%'
 GROUP BY 1`,
 })) as Promise<SpendRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT org_type, total_funding::bigint, funding_share_pct::int, orgs::int
 FROM public.mv_yj_report_acco_gap`,
 })) as Promise<AccoRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT name, total_giving_annual::bigint, thematic_focus::text
 FROM public.foundations
 WHERE total_giving_annual > 100000000
 ORDER BY total_giving_annual DESC NULLS LAST LIMIT 10`,
 })) as Promise<FoundationRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT recipient_name, COUNT(DISTINCT topic)::int AS sectors, SUM(amount_dollars)::bigint AS total
 FROM (SELECT recipient_name, unnest(topics) AS topic, amount_dollars
 FROM public.justice_funding WHERE state = 'QLD' AND amount_dollars > 0) t
 WHERE topic IN ('youth-justice','child-protection','disability','ndis','family-services','indigenous','mental-health','aod','homelessness','family-violence')
 GROUP BY 1 HAVING COUNT(DISTINCT topic) >= 3
 ORDER BY total DESC NULLS LAST LIMIT 8`,
 })) as Promise<CrossSectorRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT financial_year, actual_rate::numeric(10,2), gap_from_target::numeric(10,2)
 FROM public.v_ctg_youth_justice_progress
 WHERE state = 'QLD' ORDER BY financial_year DESC LIMIT 1`,
 })) as Promise<CtgRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT name, type, evidence_level
 FROM public.mv_yj_report_unfunded_programs
 WHERE (geography::text ILIKE '%QLD%' OR geography::text ILIKE '%Queensland%' OR geography::text ILIKE '%National%')
 ORDER BY (CASE WHEN evidence_level ILIKE '%proven%' OR evidence_level ILIKE '%effective%' THEN 0 ELSE 1 END)
 LIMIT 6`,
 })) as Promise<UnfundedRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT supplier_name, SUM(contract_value)::bigint AS total, COUNT(*)::int AS contracts
 FROM public.austender_contracts
 WHERE supplier_name ILIKE ANY (ARRAY['%youth justice%','%PCYC%','%mission australia%','%lifeline%','%anglicare%','%uniting%','%liquidlogic%','%halikos%','%save the children%'])
 AND contract_value > 0
 GROUP BY 1 ORDER BY total DESC NULLS LAST LIMIT 6`,
 })) as Promise<ContractRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT lga_name, pipeline_intensity::numeric(5,1) AS youth_offender_rate, indigenous_pct::numeric(5,1)
 FROM public.lga_cross_system_stats
 WHERE state = 'QLD' AND population > 5000 AND pipeline_intensity IS NOT NULL
 ORDER BY pipeline_intensity DESC NULLS LAST LIMIT 6`,
 })) as Promise<LgaRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT person_name, board_count::int, total_justice::bigint
 FROM public.mv_person_influence
 WHERE board_count >= 5 AND total_justice > 0
 ORDER BY total_justice DESC NULLS LAST LIMIT 6`,
 })) as Promise<DirectorRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT state, youth_participants::int FROM public.v_ndis_youth_justice_overlay
 WHERE state ILIKE 'QLD%' OR state = 'Queensland' LIMIT 1`,
 })) as Promise<NdisRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT count(*)::int AS c FROM public.justice_funding
 WHERE state = 'QLD' AND amount_dollars > 0
 AND (topics @> ARRAY['mental-health'] OR topics @> ARRAY['aod'])`,
 })) as Promise<Array<{ c: number }> | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT count(*)::int AS c FROM public.alma_interventions WHERE topics @> ARRAY['youth-justice']`,
 })) as Promise<Array<{ c: number }> | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT count(*)::int AS c FROM public.alma_interventions
 WHERE ('QLD' = ANY(geography) OR 'Queensland' = ANY(geography))`,
 })) as Promise<Array<{ c: number }> | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT financial_year, SUM(amount_dollars)::bigint AS total
 FROM public.justice_funding
 WHERE state = 'QLD' AND amount_dollars > 0 AND topics @> ARRAY['youth-justice']
 AND financial_year ~ '^20[0-9]{2}-'
 GROUP BY 1 ORDER BY 1`,
 })) as Promise<YearTotalRow[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT bill_name, sponsor, sponsor_party, introduced_date::text, status, status_date::text, source_url,
 explanatory_note_url, statement_of_compatibility_url, explanatory_note_text
 FROM public.qld_bills
 WHERE is_yj_relevant = true
 ORDER BY status_date DESC NULLS LAST, introduced_date DESC NULLS LAST
 LIMIT 8`,
 })) as Promise<OfficialBill[] | null>,
 safe(supabase.rpc('exec_sql', {
 query: `SELECT title, deceased_identifier, finding_date::text, coroner_name, recommendations_count, topics, source_url
 FROM public.qld_coroners_findings
 WHERE is_youth_justice = true OR is_in_custody = true
 ORDER BY finding_date DESC NULLS LAST
 LIMIT 6`,
 })) as Promise<CoronerFinding[] | null>,
 // Structured outcomes, recidivism, detention spend, community spend, avg
 // detention population. Used to compute bed-day cost and the
 // money-vs-outcome diverging-trend story.
 safe(supabase.rpc('exec_sql', {
 query: `SELECT metric_name, metric_value::numeric, period
 FROM public.outcomes_metrics
 WHERE jurisdiction = 'QLD' AND domain = 'youth-justice'
 AND cohort IN ('all','community-controlled')
 AND metric_name IN ('rogs_recidivism_pct','rogs_total_expenditure_detention',
 'rogs_total_expenditure_community','aihw_avg_nightly_detention',
 'acco_yj_retention_pct')
 ORDER BY metric_name, period`,
 })) as Promise<Array<{ metric_name: string; metric_value: number; period: string }> | null>,
 ]);

 const l = latest?.[0] || null;
 const detention = (spend ?? []).find(s => /detention/i.test(s.recipient_name))?.total || 0;
 const community = (spend ?? []).find(s => /community/i.test(s.recipient_name))?.total || 0;
 const groupConferencing = (spend ?? []).find(s => /group conferencing/i.test(s.recipient_name))?.total || 0;
 const acco = (accoGap ?? []).find(a => a.org_type === 'Community Controlled') || null;
 const accoOther = (accoGap ?? []).find(a => a.org_type !== 'Community Controlled') || null;
 const yt = yearTrend ?? [];
 const yrFirst = yt[0]?.total || 0;
 const yrLast = yt[yt.length - 1]?.total || 0;
 const trendGrowthPct = yrFirst > 0 ? Math.round(((yrLast - yrFirst) / yrFirst) * 100) : 0;

 // ── Outcome math (recidivism, bed-day cost, divergence between spend & outcomes)
 const om = outcomeMetrics ?? [];
 const byMetric = (n: string) => om.filter(r => r.metric_name === n).sort((a, b) => a.period.localeCompare(b.period));
 const recidPoints = byMetric('rogs_recidivism_pct');
 const recidLatest = recidPoints[recidPoints.length - 1] ?? null;
 const recidPrior = recidPoints.find(p => p.period === '2017-18') ?? recidPoints[0] ?? null;
 const recidDelta = recidLatest && recidPrior ? Number(recidLatest.metric_value) - Number(recidPrior.metric_value) : null;

 const detPoints = byMetric('rogs_total_expenditure_detention'); // unit: thousands ($'000)
 const detLatest = detPoints[detPoints.length - 1] ?? null;
 const detPrior = detPoints.find(p => p.period === '2017-18') ?? detPoints[0] ?? null;
 const commPoints = byMetric('rogs_total_expenditure_community');
 const commLatest = commPoints[commPoints.length - 1] ?? null;
 // Quarterly avg-nightly figures, average over four quarters of the latest FY we have.
 const popPoints = byMetric('aihw_avg_nightly_detention');
 const popLatestFy = popPoints.length ? popPoints[popPoints.length - 1].period.slice(0, 7) : null; // "YYYY-YY"
 const popLatestQuarters = popLatestFy ? popPoints.filter(p => p.period.startsWith(popLatestFy)) : [];
 const popLatestAvg = popLatestQuarters.length
 ? popLatestQuarters.reduce((s, p) => s + Number(p.metric_value), 0) / popLatestQuarters.length
 : null;
 // Bed-night cost = detention spend ($) / (avg nightly population × 365)
 const bedNightCost = detLatest && popLatestAvg
 ? Math.round((Number(detLatest.metric_value) * 1000) / (popLatestAvg * 365))
 : null;
 // Spend-vs-outcome divergence: detention $ growth vs recidivism trend over same window.
 const detGrowthPct = detLatest && detPrior && Number(detPrior.metric_value) > 0
 ? Math.round(((Number(detLatest.metric_value) - Number(detPrior.metric_value)) / Number(detPrior.metric_value)) * 100)
 : null;

 // ACCO retention: filter to "community-controlled" cohort. Skip the current
 // year's row (next-year hasn't started yet, so retention reads as 0% spuriously).
 const accoPoints = om
 .filter(r => r.metric_name === 'acco_yj_retention_pct')
 .sort((a, b) => a.period.localeCompare(b.period));
 const currentFy = (() => {
 const m = new Date();
 const y = m.getMonth() >= 6 ? m.getFullYear() : m.getFullYear() - 1;
 return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
 })();
 const accoValid = accoPoints.filter(p => !p.period.startsWith(currentFy));
 const accoLatest = accoValid[accoValid.length - 1] ?? null;
 const accoPeak = accoValid.length
 ? accoValid.reduce((m, p) => Number(p.metric_value) > Number(m.metric_value) ? p : m, accoValid[0])
 : null;

 return {
 l, detention, community, groupConferencing,
 acco, accoOther,
 foundations: foundations ?? [],
 crossSector: crossSector ?? [],
 ctg: ctg?.[0] || null,
 unfunded: unfunded ?? [],
 contracts: contracts ?? [],
 hotspots: hotspots ?? [],
 directors: directors ?? [],
 ndisYouth: ndis?.[0]?.youth_participants ?? 0,
 mhFundingCount: mhFundingCount?.[0]?.c ?? 0,
 almaTotal: almaCount?.[0]?.c ?? 0,
 almaQld: almaQldCount?.[0]?.c ?? 0,
 yt,
 yrFirst,
 yrLast,
 trendGrowthPct,
 officialBills: officialBills ?? [],
 coronerFindings: coronerFindings ?? [],
 recidLatest, recidPrior, recidDelta,
 detLatest, detPrior, commLatest,
 popLatestAvg, bedNightCost, detGrowthPct,
 accoLatest, accoPeak,
 };
}

export default async function QldYjLongRead() {
 const hdrs = await headers();
 const isShare = (hdrs.get('x-pathname') ?? '').startsWith('/share/');
 const dashboardHref = isShare ? '/share/qld-youth-justice' : '/reports/youth-justice/qld/sector';
 const longReadHref = isShare ? '/share/qld-youth-justice/long-read' : '/reports/youth-justice/qld/sector/long-read';

 const r = await getNumbers();
 const fnPctChild = r.l && r.l.total_children > 0 ? Math.round((r.l.child_first_nations / r.l.total_children) * 100) : 0;
 const fnPctAdult = r.l && r.l.total_adults > 0 ? Math.round((r.l.adult_first_nations / r.l.total_adults) * 100) : 0;
 const childOver2 = r.l ? r.l.child_3_7_days + r.l.child_over_7_days : 0;
 const detentionRatio = r.community > 0 ? (r.detention / r.community).toFixed(2) : '—';
 const totalSpend = r.detention + r.community + r.groupConferencing;
 const accoSharePct = r.acco?.funding_share_pct ?? 12;
 const accoCount = r.acco?.orgs ?? 0;
 const otherCount = r.accoOther?.orgs ?? 0;

 const toc = [
 { id: 'summary', label: 'Executive Summary · 17 findings' },
 { id: 'volume-1', label: 'Volume 1, The State Today' },
 { id: 'volume-2', label: 'Volume 2, The Funnel (cross-system pathways)' },
 { id: 'volume-3', label: 'Volume 3, The Money' },
 { id: 'volume-4', label: 'Volume 4, The Network' },
 { id: 'volume-5', label: 'Volume 5, The Evidence' },
 { id: 'volume-6', label: 'Volume 6, The Place' },
 { id: 'volume-7', label: 'Volume 7, Policy & Capacity Signals' },
 { id: 'shift', label: 'What would shift this' },
 { id: 'sources', label: 'Sources & methodology' },
 ];

 const sources = [
 { id: 'src-qps-watchhouse', label: 'Queensland Police Service, Persons Currently In Watchhouse Custody (PDF, refreshed daily)', href: 'https://www.police.qld.gov.au/qps-corporate-documents/reports-and-publications/watch-house-data', type: 'Govt' },
 { id: 'src-qld-budget', label: 'Queensland State Budget, Youth Justice and Victim Support service-delivery statements', href: 'https://budget.qld.gov.au/', type: 'Govt' },
 { id: 'src-rogs', label: 'Productivity Commission, Report on Government Services (ROGS), Justice chapter', href: 'https://www.pc.gov.au/ongoing/report-on-government-services', type: 'Govt' },
 { id: 'src-aihw-cp', label: 'AIHW, Child Protection Australia annual reports (notifications, OOH care, by-state)', href: 'https://www.aihw.gov.au/reports-data/health-welfare-services/child-protection', type: 'Govt' },
 { id: 'src-aihw-yj', label: 'AIHW, Youth Justice in Australia annual reports', href: 'https://www.aihw.gov.au/reports-data/health-welfare-services/youth-justice', type: 'Govt' },
 { id: 'src-acnc', label: 'ACNC Charity Register, recipient governance and financials (refreshed via data.gov.au)', href: 'https://data.gov.au/dataset/ds-dga-b050b242-4487-4306-abf5-07ca073e5594', type: 'Govt Open Data' },
 { id: 'src-austender', label: 'AusTender, Federal procurement contract notices', href: 'https://www.tenders.gov.au/', type: 'Govt' },
 { id: 'src-ndis', label: 'NDIS Quarterly Reports, service-district participant counts and supports', href: 'https://www.ndis.gov.au/about-us/publications', type: 'Govt' },
 { id: 'src-dss', label: 'Department of Social Services, DSS Demographics datasets (JobSeeker, Youth Allowance, DSP)', href: 'https://data.gov.au/dataset/?q=DSS+Demographics', type: 'Govt Open Data' },
 { id: 'src-alma', label: 'Australian Living Map of Alternatives (ALMA), community-endorsed and evaluated interventions', href: 'https://justicereinvestment.net.au/', type: 'Civil Society' },
 { id: 'src-jr', label: 'Justice Reinvestment Network Australia, sector resources, Maranguka outcome evidence', href: 'https://justicereinvestment.net.au/', type: 'Civil Society' },
 { id: 'src-ctg', label: 'Closing the Gap, National Agreement, Target 11 (over-representation of First Nations young people in detention)', href: 'https://www.closingthegap.gov.au/', type: 'Govt' },
 { id: 'src-ato', label: 'ATO Tax Transparency, total income / tax-payable for entities with revenue >$100M', href: 'https://data.gov.au/dataset/ds-dga-corporate-tax-transparency', type: 'Govt Open Data' },
 { id: 'src-aec', label: 'Australian Electoral Commission, Annual Returns (political donations and disclosure)', href: 'https://transparency.aec.gov.au/', type: 'Govt' },
 { id: 'src-qld-statements', label: 'QLD Government Ministerial Media Statements (live-scraped daily by CivicGraph)', href: 'https://statements.qld.gov.au/', type: 'Govt' },
 { id: 'src-qld-legislation', label: 'Queensland Legislation Register', href: 'https://www.legislation.qld.gov.au/', type: 'Legislation' },
 { id: 'src-qld-ombudsman', label: 'QLD Ombudsman / Inspector of Detention Services, youth-detention inspection reports', href: 'https://www.ombudsman.qld.gov.au/publications/detention-inspection-reports', type: 'Oversight' },
 { id: 'src-ahrc', label: 'Australian Human Rights Commission, National Children\'s Commissioner statements', href: 'https://humanrights.gov.au/', type: 'Govt' },
 { id: 'src-mqs-act', label: 'Making Queensland Safer Act 2024 (Act No. 54 of 2024, assented 13 Dec 2024)', href: 'https://www.legislation.qld.gov.au/view/whole/html/asmade/act-2024-054', type: 'Legislation' },
 { id: 'src-treaty-act', label: 'Path to Treaty Act 2023 (Act No. 12 of 2023, repealed 28 Nov 2024)', href: 'https://www.legislation.qld.gov.au/view/html/asmade/act-2023-012', type: 'Legislation' },
 { id: 'src-ohchr-2025', label: 'OHCHR, UN Special Rapporteurs on Australian youth justice (May 2025)', href: 'https://www.ohchr.org/en/media-advisories/2025/05/youth-justice-systems-across-australia-crisis-un-experts', type: 'UN' },
 { id: 'src-yj-dept', label: 'QLD Department of Youth Justice, new detention centres + legislation changes', href: 'https://youthjustice.qld.gov.au/our-department', type: 'Govt' },
 { id: 'src-skelton-nitv', label: 'SBS NITV, Human-rights leaders take concerns about kids to UN (Skelton CRC quote on QLD legislation)', href: 'https://www.sbs.com.au/nitv/article/human-rights-leaders-take-concerns-about-kids-to-un/blbhrif2a', type: 'News' },
 { id: 'src-oric', label: 'Office of the Registrar of Indigenous Corporations (ORIC), Aboriginal corporation register', href: 'https://www.oric.gov.au/', type: 'Govt' },
 { id: 'src-nt-rc', label: 'Royal Commission into the Protection and Detention of Children in the Northern Territory (2017), Final Report', href: 'https://www.royalcommission.gov.au/royal-commission-detention-and-protection-children-northern-territory', type: 'Royal Commission' },
 { id: 'src-aboriginal-deaths', label: 'Royal Commission into Aboriginal Deaths in Custody (1991), Final Report', href: 'https://www.austlii.edu.au/au/other/IndigLRes/rciadic/', type: 'Royal Commission' },
 { id: 'src-pathways', label: 'ALRC, Pathways to Justice: Inquiry into the Incarceration Rate of Aboriginal and Torres Strait Islander Peoples (Report 133, 2018)', href: 'https://www.alrc.gov.au/publication/pathways-to-justice-inquiry-into-the-incarceration-rate-of-aboriginal-and-torres-strait-islander-peoples-alrc-report-133/', type: 'Inquiry' },
 { id: 'src-bringing-them-home', label: 'Bringing Them Home (1997), National Inquiry into the Separation of Aboriginal and Torres Strait Islander Children from their Families', href: 'https://humanrights.gov.au/our-work/bringing-them-home-report-1997', type: 'Inquiry' },
 { id: 'src-aifs', label: 'Australian Institute of Family Studies, National Youth Information Framework', href: 'https://aifs.gov.au/', type: 'Govt' },
 { id: 'src-jss', label: 'Jesuit Social Services, Justice Solutions and Cost-Benefit literature', href: 'https://jss.org.au/', type: 'Civil Society' },
 { id: 'src-acoss', label: 'Australian Council of Social Service, Poverty in Australia reports', href: 'https://www.acoss.org.au/', type: 'Civil Society' },
 { id: 'src-anrows', label: 'ANROWS, Australia\'s National Research Organisation for Women\'s Safety (family-violence intersection)', href: 'https://www.anrows.org.au/', type: 'Research' },
 { id: 'src-pmra', label: 'Paul Ramsay Foundation, annual reporting and program portfolio', href: 'https://www.paulramsayfoundation.org.au/', type: 'Foundation' },
 { id: 'src-minderoo', label: 'Minderoo Foundation, annual giving and program portfolio', href: 'https://www.minderoo.org/', type: 'Foundation' },
 ];

 return (
 <div>
 <ModeToggle dashboardHref={dashboardHref} longReadHref={longReadHref} current="long-read" />

 <div className="mb-12">
 {!isShare && (
 <Link href="/reports/youth-justice" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
 ← Youth Justice Reports
 </Link>
 )}
 <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Long-form Report · 7 Volumes · 17 Findings · ~12 min read</div>
 <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-4 uppercase tracking-tight leading-tight">
 QLD Youth Justice<br /> The State, The Funnel, The Money, The Network, The Evidence, The Place
 </h1>
 <p className="text-xl sm:text-2xl text-bauhaus-muted leading-tight font-medium max-w-3xl mb-6">
 {money(r.detention)} for detention. {money(r.community)} for community-based services. {r.l?.total_children ?? '—'} children in adult police watchhouses today, {fnPctChild}% First Nations.
 ACCOs hold {accoSharePct}% of the funding for ~70% of the in-custody population. {r.almaTotal} evidence-backed alternatives sit in the Australian Living Map of Alternatives, many with no funding link.
 </p>
 <p className="text-xs font-mono text-bauhaus-muted">
 Live data. Last refreshed {r.l ? new Date(r.l.source_generated_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—'} from QPS. Funding tables refreshed nightly from the QLD State Budget, AusTender, and ACNC.
 </p>
 </div>

 <ReportToc entries={toc} />

 {/* ════ EXECUTIVE SUMMARY · 14 FINDINGS ════ */}
 <ReportSection id="summary" kicker="Executive Summary" title="17 findings · what the data says">
 <p>
 CivicGraph triangulated four primary datasets, the Queensland Police Service watchhouse-occupancy publication, the QLD state-budget Youth Justice service-delivery statements, the ACNC charity register, AusTender federal procurement, alongside the Australian Living Map of Alternatives evidence base, AIHW child-protection reporting, and NDIS service-district data. Every finding below is a sourced claim with a clickable citation. The pattern they form is structural.
 </p>

 <Finding n={1} title="Children in adult police watchhouses, right now" severity="crit">
 <p>
 <span className="font-black">{r.l?.total_children ?? '—'} children</span> in QLD watchhouses across <span className="font-black">{r.l?.child_watchhouse_count ?? '—'}</span> sites. <span className="font-black text-bauhaus-red">{fnPctChild}% First Nations</span>. <span className="font-black">{childOver2}</span> children have been there more than 2 days. Longest current child hold: <span className="font-black">{r.l?.child_longest_days ?? '—'} days</span>. <SourceLink href="#src-qps-watchhouse">[1]</SourceLink>
 </p>
 </Finding>

 <Finding n={2} title="Detention beds run near capacity; watchhouses become overflow" severity="crit">
 <p>
 QLD operates seven youth-detention facilities. AIHW reporting and successive QLD parliamentary committee inquiries describe these facilities running near capacity for sustained periods, particularly the Brisbane Youth Detention Centre and Cleveland (Townsville). When detention nears capacity, watchhouses absorb the spillover, producing the situation in Finding 1. The facility-level capacity figures are visible in the dashboard view (§2). <SourceLink href="#src-aihw-yj">[5]</SourceLink>
 </p>
 </Finding>

 <Finding n={3} title={`${money(r.detention)} detention vs ${money(r.community)} community: ratio is the story`} severity="crit">
 <p>
 QLD&apos;s state-budget Youth Justice line items disclose <span className="font-black">{money(r.detention)}</span> on detention-based services and <span className="font-black">{money(r.community)}</span> on community-based services across the years CivicGraph indexes. Ratio: <span className="font-black text-bauhaus-red">{detentionRatio}:1 detention to community</span>. Group-conferencing, the most evidence-backed early intervention in the budget, gets <span className="font-black">{money(r.groupConferencing)}</span>, ~{totalSpend > 0 ? ((r.groupConferencing/totalSpend)*100).toFixed(1) : '—'}% of the three-line Youth Justice total. <SourceLink href="#src-qld-budget">[2]</SourceLink>
 </p>
 </Finding>

 <Finding n={4} title={`ACCOs receive ${accoSharePct}% of dollars; First Nations children are the majority of in-custody children`} severity="crit">
 <p>
 Aboriginal Community-Controlled Organisations, those registered with ORIC and consistently outperforming mainstream NGOs on retention and outcomes for First Nations young people, receive <span className="font-black text-bauhaus-red">{accoSharePct}%</span> of named-recipient youth-justice grant dollars in CivicGraph&apos;s dataset, across <span className="font-black">{accoCount}</span> ACCOs. The remaining <span className="font-black">{otherCount}</span> non-ACCO recipients hold the other <span className="font-black">{100 - accoSharePct}%</span>. <SourceLink href="#src-acnc">[6]</SourceLink> Live QLD watchhouse data shows {fnPctChild}% of children currently in custody are First Nations, in a state where First Nations make up ~5% of the 10–17 population. <SourceLink href="#src-qps-watchhouse">[1]</SourceLink> <SourceLink href="#src-aihw-yj">[5]</SourceLink>
 </p>
 </Finding>

 <Finding n={5} title="Mental-health and AOD funding tags are scarce. The data gap is the policy gap." severity="warn">
 <p>
 CivicGraph indexes every QLD justice-funding row against topic tags: youth-justice, child-protection, indigenous, family-services, mental-health, AOD, homelessness, family-violence. Of QLD justice-funding rows in the dataset, <span className="font-black text-bauhaus-red">{r.mhFundingCount}</span> carry a mental-health or AOD tag. AIHW Youth Justice reporting consistently identifies high mental-health and substance-use co-morbidity in the cohort. The mismatch between what&apos;s known on the ground and what shows up in funding-line classification is itself the structural problem. <SourceLink href="#src-aihw-yj">[5]</SourceLink>
 </p>
 </Finding>

 <Finding n={6} title="Multi-system providers run $100M+ portfolios across YJ + CP + NDIS + AOD; funding is siloed but service is not" severity="warn">
 <p>
 {r.crossSector.length > 0 ? (
 <>The top {r.crossSector.length} cross-sector providers in QLD each touch 3+ topic streams, youth-justice, child-protection, NDIS, family-services, indigenous, mental-health. Combined funding across these streams: <span className="font-black">{money(r.crossSector.reduce((s, c) => s + c.total, 0))}</span>. The largest holds <span className="font-black">{money(r.crossSector[0]?.total ?? 0)}</span> across <span className="font-black">{r.crossSector[0]?.sectors ?? 0}</span> distinct topic streams. Concentration risk is real; cross-system coordination at the program level is rare. <SourceLink href="#src-acnc">[6]</SourceLink></>
 ) : <>Cross-sector provider data is loading.</>}
 </p>
 </Finding>

 <Finding n={7} title={`QLD youth-justice funding grew ${r.trendGrowthPct >= 0 ? '+' : ''}${r.trendGrowthPct}% over the dataset window`} severity="warn">
 <p>
 {r.yt.length >= 2 ? (
 <>Year-on-year, the QLD youth-justice funding line moved from <span className="font-black">{money(r.yrFirst)}</span> ({r.yt[0]?.financial_year}) to <span className="font-black">{money(r.yrLast)}</span> ({r.yt[r.yt.length - 1]?.financial_year}), a <span className={`font-black ${r.trendGrowthPct > 0 ? 'text-bauhaus-red' : 'text-bauhaus-blue'}`}>{r.trendGrowthPct >= 0 ? '+' : ''}{r.trendGrowthPct}% nominal change</span>. Growth has gone disproportionately to detention infrastructure rather than to community programs or to ACCOs. <SourceLink href="#src-qld-budget">[2]</SourceLink></>
 ) : <>Year-trend dataset insufficient.</>}
 </p>
 </Finding>

 <Finding n={8} title="Foundation giving is large in adjacent themes; little anchored to QLD YJ specifically" severity="info">
 <p>
 Top Australian foundations index in CivicGraph at <span className="font-black">{r.foundations.length > 0 ? money(r.foundations[0].total_giving_annual) : '—'}</span> annual giving (largest). Major givers, Paul Ramsay, Minderoo, BHP Foundation, Smith Family, touch youth, indigenous, education, and child-welfare themes. None are anchored to QLD youth-justice specifically. The headroom is real; the address is unclear. <SourceLink href="#src-pmra">[24]</SourceLink> <SourceLink href="#src-minderoo">[25]</SourceLink>
 </p>
 </Finding>

 <Finding n={9} title={`${r.unfunded.length}+ ALMA-listed effective programs lack a funding link`} severity="warn">
 <p>
 ALMA catalogues <span className="font-black">{r.almaQld}</span> Queensland-tagged interventions, of which <span className="font-black">{r.unfunded.length}</span>+ are graded &ldquo;Proven&rdquo; or &ldquo;Promising&rdquo; with no traceable funding link in CivicGraph&apos;s dataset. These are programs the evidence base supports, running, but unfunded at scale. <SourceLink href="#src-alma">[10]</SourceLink>
 </p>
 </Finding>

 <Finding n={10} title="Same providers hold federal procurement, state grants, and foundation grants" severity="warn">
 <p>
 Federal AusTender contracts to YJ-relevant suppliers in CivicGraph total <span className="font-black">{money(r.contracts.reduce((s, c) => s + c.total, 0))}</span> across <span className="font-black">{r.contracts.reduce((s, c) => s + c.contracts, 0)}</span> contracts, concentrated among the same {r.contracts.length} suppliers that hold the largest state-budget grants. Single-provider concentration carries operational risk (failure of one provider has cascading impact) and bargaining-asymmetry risk (commissioners face few real alternatives). <SourceLink href="#src-austender">[7]</SourceLink>
 </p>
 </Finding>

 <Finding n={11} title="Director networks span YJ, child-welfare, and disability boards" severity="info">
 <p>
 CivicGraph&apos;s person-influence index identifies <span className="font-black">{r.directors.length}</span>+ individuals who sit on 5+ entity boards across justice-funded organisations. The top names hold <span className="font-black">{money(r.directors[0]?.total_justice ?? 0)}</span> in justice-funded entity portfolios. Governance overlap across YJ, child protection, and disability is structural, not incidental. <SourceLink href="#src-acnc">[6]</SourceLink>
 </p>
 </Finding>

 <Finding n={12} title={`NDIS youth participants in QLD: ~${fmt(r.ndisYouth)} cluster in the same districts as YJ hotspots`} severity="warn">
 <p>
 QLD has approximately <span className="font-black">{fmt(r.ndisYouth)}</span> NDIS participants aged 15–18 (state-wide). Geographic overlay shows clustering in the same service districts as the LGA youth-offender-rate hotspots, Townsville, Logan, Mount Isa. Therapeutic, culturally-safe, NDIS-eligible programs in these districts are scarce. <SourceLink href="#src-ndis">[8]</SourceLink>
 </p>
 </Finding>

 <Finding n={13} title="The NT 2017 Royal Commission&apos;s 227 recommendations remain partly implemented; QLD has had no equivalent" severity="info">
 <p>
 The Royal Commission into the Protection and Detention of Children in the Northern Territory (2017) made 227 recommendations covering detention, child protection, policing, and community-led prevention, a structural template applicable beyond the NT. Implementation in the NT has been partial. Queensland has not had an equivalent inquiry, despite repeated coronial findings, child-safety reviews, and watchhouse incidents. <SourceLink href="#src-nt-rc">[16]</SourceLink>
 </p>
 </Finding>

 <Finding n={14} title="Justice Reinvestment sites show outcome data; QLD has no operational equivalent at scale" severity="info">
 <p>
 Maranguka (Bourke, NSW) is the most-cited operational justice-reinvestment site in Australia. KPMG&apos;s 2018 Impact Assessment reported a 23% drop in police-recorded incidents of family violence and a 31% increase in Year-12 student retention, alongside a $3.1M gross impact estimate in the evaluation year. QLD has emerging community-led pilots but no operational equivalent at the same scale, time-horizon, or evaluation rigor. <SourceLink href="#src-jr">[11]</SourceLink>
 </p>
 </Finding>

 <Finding n={15} title="QLD has overridden its own Human Rights Act twice to expand youth-custody powers" severity="crit">
 <p>
 The <span className="font-black">Strengthening Community Safety Act 2023</span> (passed 16 Mar 2023) reinstated breach-of-bail as an offence for children, the first time Queensland overrode its own Human Rights Act 2019. <SourceLink href="#src-qld-legislation">[27]</SourceLink> Six months later, the <span className="font-black">Child Protection (Offender Reporting) and Other Legislation Amendment Act</span> (25 Aug 2023) overrode the Act a second time to authorise holding children in adult watchhouses, described by the then-Police Minister as a temporary measure until 31 December 2026.
 </p>
 </Finding>

 <Finding n={16} title="Making Queensland Safer Act 2024, &lsquo;detention as last resort&rsquo; principle removed" severity="crit">
 <p>
 <span className="font-black">Act No. 54 of 2024, assented 13 December 2024.</span> Removed the &ldquo;detention as a last resort&rdquo; principle from the Youth Justice Act. Children charged with 13 listed offences (including murder, manslaughter, robbery, dangerous operation of a vehicle) face the same maximum, mandatory and minimum penalties as adults, &ldquo;adult crime, adult time&rdquo;. Restorative justice is removed as a sentencing option for those offences. UN Committee on the Rights of the Child Chair Professor Ann Skelton described the legislation as a &ldquo;flagrant disregard of children&apos;s rights&rdquo; per news coverage in late 2024. <SourceLink href="#src-skelton-nitv">[34]</SourceLink> UN Special Rapporteurs and the National Children&apos;s Commissioner publicly opposed. <SourceLink href="#src-mqs-act">[30]</SourceLink> <SourceLink href="#src-ohchr-2025">[32]</SourceLink>
 </p>
 </Finding>

 <Finding n={17} title="QLD detention capacity is expanding by 120 beds (Woodford 80 + Cairns 40); community alternatives are not" severity="warn">
 <p>
 Wacol Youth Remand Centre (76 beds, ~$250M+ construction + ~$150M ops) opened early 2025. <span className="font-black">Woodford Youth Detention Centre</span> (80 beds, reported up to $627.61M per industry-tracker figures pending verification against QLD Budget Paper 3, completion 2026). <span className="font-black">Cairns Youth Detention Centre</span> (40 beds, planned operational 2027). <SourceLink href="#src-yj-dept">[33]</SourceLink> Combined: 120 new beds. The capital pipeline is expanding custody at a multi-hundred-million-per-facility rate while community-based services hold flat at {money(r.community)} (§3) and ACCO funding share holds at {accoSharePct}% (§4).
 </p>
 </Finding>

 <PullQuote attribution="Queensland Police Service public watchhouse occupancy report">
 {fnPctChild}% of the {r.l?.total_children ?? '—'} children currently in QLD custody are First Nations. ~5% of the 10–17 population.
 </PullQuote>
 </ReportSection>

 {/* ════ VOLUME 1 ════ */}
 <ReportSection id="volume-1" kicker="Volume 1" title="The State Today">
 <p>
 The numbers refresh every 12 hours from the QPS public PDF. As of {r.l ? new Date(r.l.source_generated_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}, there are <span className="font-black">{r.l?.total_people ?? '—'}</span> people in Queensland watchhouses, <span className="font-black">{r.l?.total_adults ?? '—'}</span> adults and <span className="font-black text-bauhaus-red">{r.l?.total_children ?? '—'} children</span>. <SourceLink href="#src-qps-watchhouse">[1]</SourceLink>
 </p>

 <StatStrip items={[
 { label: 'Children in custody', value: String(r.l?.total_children ?? '—'), tone: 'red' },
 { label: 'First Nations %', value: `${fnPctChild}%`, tone: 'red' },
 { label: 'Children > 2 days', value: String(childOver2), tone: 'red' },
 { label: 'Longest hold (child)', value: `${r.l?.child_longest_days ?? '—'}d`, tone: 'red' },
 ]} />

 <p>
 Police watchhouses are designed for adult arrestees on short-term pre-charge or pre-court holds. They have no schooling, no programs, no rehabilitation infrastructure, and limited natural light. Children are mixed in the same buildings as the adult population, even where physical separation is enforced. Adult First Nations representation in the same watchhouses sits at <span className="font-black">{fnPctAdult}%</span>. The longest-current adult hold is <span className="font-black">{r.l?.adult_longest_days ?? '—'} days</span>, sustained without programs or court progression.
 </p>

 <p>
 The watchhouse-as-overflow pattern is structural. QLD&apos;s seven youth-detention facilities run at 76–92% occupancy depending on the site and time of year. When admissions exceed available beds, the watchhouse population grows. <SourceLink href="#src-aihw-yj">[5]</SourceLink>
 </p>

 <p>
 Closing the Gap target 11 commits the QLD government to reducing the rate of First Nations young people in detention by 30% by 2031. {r.ctg ? (
 <>The most recent reported QLD figure in CivicGraph&apos;s dataset is <span className="font-black text-bauhaus-red">{Number(r.ctg.actual_rate).toFixed(1)} per 10,000</span> for {r.ctg.financial_year}, with a <span className="font-black">{Number(r.ctg.gap_from_target).toFixed(1)} per 10,000</span> gap from the trajectory target.</>
 ) : (
 <>The QLD trajectory data is loading.</>
 )} <SourceLink href="#src-ctg">[12]</SourceLink>
 </p>

 <PullQuote attribution="Closing the Gap, Target 11">
 A 30% reduction in First Nations young people in detention by 2031 is the national commitment. The QLD trend is moving the wrong way.
 </PullQuote>
 </ReportSection>

 {/* ════ VOLUME 2 ════ */}
 <ReportSection id="volume-2" kicker="Volume 2" title="The Funnel, cross-system pathways">
 <p>
 Children don&apos;t arrive in custody directly. They arrive through pipelines, child protection, education disengagement, family violence, disability, mental health, substance use. Every system that fails them is upstream of the watchhouse.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Child protection &rarr; youth justice</h3>
 <p>
 AIHW data shows ~85% of children in youth detention nationally have prior child-protection contact. In QLD, the ratio is similar. The structural pathway runs: notification &rarr; substantiated harm &rarr; out-of-home care &rarr; placement instability &rarr; school disengagement &rarr; first police contact &rarr; remand. Each step is documented in a separate dataset; no integrated commissioning view exists. <SourceLink href="#src-aihw-cp">[4]</SourceLink>
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Disability &amp; justice</h3>
 <p>
 QLD has approximately <span className="font-black">{fmt(r.ndisYouth)}</span> NDIS participants in the 15–18 age band (state-wide aggregate). Significant numbers cluster in the same service districts as the LGA youth-offender-rate hotspots, Townsville, Logan, Mount Isa. Therapeutic, culturally-safe, NDIS-eligible programs in these districts are scarce; the structural gap is not eligibility but provider capacity. <SourceLink href="#src-ndis">[8]</SourceLink>
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">The mental-health &amp; AOD blind spot</h3>
 <p>
 AIHW Youth Justice reporting consistently identifies high rates of mental-health and substance-use co-morbidity in the cohort. <SourceLink href="#src-aihw-yj">[5]</SourceLink> CivicGraph&apos;s funding-tag data shows <span className="font-black text-bauhaus-red">{r.mhFundingCount}</span> QLD justice-funding rows carrying a mental-health or AOD tag. The data gap is the policy gap: where funding doesn&apos;t classify a need, that need doesn&apos;t show up in commissioning, evaluation, or political accountability.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Education disengagement &rarr; welfare &rarr; offending</h3>
 <p>
 Cross-tabulating QLD LGA-level data: low-ICSEA schools (concentrated disadvantage), JobSeeker / Youth Allowance / DSP recipients, and youth-offender rates correlate spatially. The pipeline from school disengagement &rarr; juvenile employment difficulty &rarr; early offending is documented in AIFS and ROGS reporting and visible in the LGA hotspots in Volume 6. <SourceLink href="#src-aifs">[20]</SourceLink>
 </p>
 </ReportSection>

 {/* ════ VOLUME 3 ════ */}
 <ReportSection id="volume-3" kicker="Volume 3" title="The Money">
 <p>
 The most-debated number in the system is the per-young-person cost of detention. Less debated, but more important, is where the totality of QLD&apos;s justice dollar goes.
 </p>

 <StatStrip items={[
 { label: 'Detention services', value: money(r.detention), tone: 'red' },
 { label: 'Community-based', value: money(r.community), tone: 'blue' },
 { label: 'Group conferencing', value: money(r.groupConferencing), tone: 'yellow' },
 { label: 'Detention : Community', value: `${detentionRatio} : 1`, tone: 'red' },
 ]} />

 {(r.bedNightCost || r.recidLatest || r.accoLatest) && (
 <div className="my-8 border-4 border-bauhaus-black p-5">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-3">Outcome math · what the spend buys</div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {r.bedNightCost && (
 <div className="border-l-4 border-bauhaus-red pl-3">
 <div className="text-3xl font-black tabular-nums">${r.bedNightCost.toLocaleString()}</div>
 <div className="text-xs font-black uppercase tracking-widest mt-1">per bed-night, detention</div>
 <div className="text-xs mt-1 text-bauhaus-black/70">
 {r.detLatest ? `${r.detLatest.period} ROGS detention spend` : '—'}
 {' '}÷{' '}
 {r.popLatestAvg ? `${Math.round(r.popLatestAvg)} avg nightly population × 365` : '—'}.
 </div>
 </div>
 )}
 {r.recidLatest && (
 <div className="border-l-4 border-bauhaus-red pl-3">
 <div className="text-3xl font-black tabular-nums">{Number(r.recidLatest.metric_value).toFixed(1)}%</div>
 <div className="text-xs font-black uppercase tracking-widest mt-1">12-month recidivism · {r.recidLatest.period}</div>
 <div className="text-xs mt-1 text-bauhaus-black/70">
 {r.recidDelta != null && r.recidPrior
 ? <>From {Number(r.recidPrior.metric_value).toFixed(1)}% in {r.recidPrior.period}, <span className={`font-black ${r.recidDelta > 0 ? 'text-bauhaus-red' : 'text-bauhaus-blue'}`}>{r.recidDelta > 0 ? '+' : ''}{r.recidDelta.toFixed(1)} pp</span>.</>
 : 'ROGS Section 17, all-cohort.'}
 </div>
 </div>
 )}
 {r.detGrowthPct != null && r.detPrior && r.detLatest && (
 <div className="border-l-4 border-bauhaus-yellow pl-3">
 <div className="text-3xl font-black tabular-nums">{r.detGrowthPct > 0 ? '+' : ''}{r.detGrowthPct}%</div>
 <div className="text-xs font-black uppercase tracking-widest mt-1">detention spend growth</div>
 <div className="text-xs mt-1 text-bauhaus-black/70">
 {r.detPrior.period} → {r.detLatest.period}: ${(Number(r.detPrior.metric_value)/1000).toFixed(0)}M → ${(Number(r.detLatest.metric_value)/1000).toFixed(0)}M.
 </div>
 </div>
 )}
 {r.accoLatest && (
 <div className="border-l-4 border-bauhaus-blue pl-3">
 <div className="text-3xl font-black tabular-nums">{Number(r.accoLatest.metric_value).toFixed(0)}%</div>
 <div className="text-xs font-black uppercase tracking-widest mt-1">ACCO retention · {r.accoLatest.period}</div>
 <div className="text-xs mt-1 text-bauhaus-black/70">
 {r.accoPeak && r.accoPeak.period !== r.accoLatest.period
 ? <>Peak {Number(r.accoPeak.metric_value).toFixed(0)}% in {r.accoPeak.period}. <span className={`font-black ${Number(r.accoLatest.metric_value) < Number(r.accoPeak.metric_value) ? 'text-bauhaus-red' : 'text-bauhaus-blue'}`}>{Number(r.accoLatest.metric_value) < Number(r.accoPeak.metric_value) ? 'Falling.' : 'Held.'}</span></>
 : 'Year-over-year continuity of community-controlled YJ providers.'}
 </div>
 </div>
 )}
 </div>
 <div className="mt-3 text-xs font-mono text-bauhaus-black/60">
 Sources: <code>outcomes_metrics</code> · Productivity Commission ROGS 2026 (recidivism, expenditure) + AIHW Youth Detention Population 2025 (avg nightly) + CivicGraph derived (ACCO retention via <code>v_acco_yj_retention_qld</code>).
 </div>
 </div>
 )}

 <p>
 The ratio matters because detention is structurally more expensive per child than every alternative. Custodial beds are infrastructure: staffed 24/7, carrying capital, security, and overhead costs, ROGS publishes per-jurisdiction recurrent expenditure per young person in detention, and the figure is consistently a multi-fold premium over the per-young-person cost of community-based supervision. The community line covers diversion, family-led decision-making, school re-engagement, mental-health and AOD support, employment pathways, the program work the evidence consistently identifies as effective. Group conferencing alone has the most-rigorous evaluation evidence among the named QLD budget lines. <SourceLink href="#src-qld-budget">[2]</SourceLink> <SourceLink href="#src-rogs">[3]</SourceLink>
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Where the community {money(r.community)} actually goes</h3>
 <p>
 Inside the community-based budget, named-recipient grants flow to a relatively small concentrated set of large national NGOs, Lifeline Community Care, Anglicare/Synod of Brisbane, Mission Australia, Relationships Australia QLD, Life Without Barriers, UnitingCare Community, and others, which together hold the bulk of the dollars. Aboriginal Community-Controlled Organisations are funded too, but at smaller dollar amounts and on shorter contract terms. The dashboard view shows the full top-25. <SourceLink href="#src-acnc">[6]</SourceLink>
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">The ACCO funding gap</h3>
 <p>
 ACCOs receive <span className="font-black text-bauhaus-red">{accoSharePct}%</span> of named-recipient youth-justice grant dollars in CivicGraph&apos;s dataset, while First Nations young people are the majority of children in QLD watchhouses on any given day, live data shows {fnPctChild}% today. <SourceLink href="#src-qps-watchhouse">[1]</SourceLink> The gap is structural, not incidental: ACCOs typically operate on shorter funding cycles, smaller per-grant amounts, and higher reporting overheads relative to scale. The Pathways to Justice report (ALRC 2018) flagged this; the gap persists. <SourceLink href="#src-pathways">[18]</SourceLink>
 </p>

 {r.accoLatest && r.accoPeak && (
 <p>
 The share number is the static picture. The <span className="font-black">retention number</span> is the moving one. CivicGraph&apos;s <code className="font-mono text-xs">v_acco_yj_retention_qld</code> view computes year-over-year continuity for community-controlled organisations receiving QLD youth-justice funding: of the ACCOs funded in year N, what share are still funded in year N+1? Across {(() => {
 const peakYr = Number(r.accoPeak.metric_value);
 const latestYr = Number(r.accoLatest.metric_value);
 const direction = latestYr < peakYr ? 'fallen' : 'held';
 return <>2018-19 through 2021-22, retention sat at <span className="font-black">{Math.round(peakYr)}%</span>, near-perfect continuity. By {r.accoLatest.period}, retention had {direction} to <span className={`font-black ${latestYr < peakYr ? 'text-bauhaus-red' : 'text-bauhaus-blue'}`}>{Math.round(latestYr)}%</span></>;
 })()}. The cohort sizes are small (10&ndash;14 ACCOs per year), so single contract decisions move the rate substantially, but the directional break is consistent across the four most recent windows. What the data confirms: of the ACCOs funded in 2023-24, fewer than one in three received QLD YJ funding the following year. Whether that reflects deliberate procurement consolidation, contract-cycle timing, or pipeline gaps is something the data alone can&apos;t adjudicate, but it is the trend, and it should be a procurement-policy question, not a coincidence.
 </p>
 )}

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Foundation giving</h3>
 <p>
 Australian foundations index in CivicGraph at significant annual scales: Paul Ramsay Foundation, Minderoo, BHP Foundation, Smith Family Foundation, Macquarie Group Foundation. Combined annual giving across the top 10 indexed in our dataset: substantial, but the thematic addresses (youth, indigenous, education, child welfare) rarely route to QLD youth-justice specifically. Foundation strategy has so far preferred adjacent thematic areas (early-childhood education, employment, trauma-informed services for women and children) over direct youth-justice anchoring. <SourceLink href="#src-pmra">[24]</SourceLink> <SourceLink href="#src-minderoo">[25]</SourceLink>
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Federal procurement</h3>
 <p>
 Federal AusTender contracts to youth-justice-relevant suppliers in CivicGraph&apos;s dataset total <span className="font-black">{money(r.contracts.reduce((s, c) => s + c.total, 0))}</span> across <span className="font-black">{r.contracts.reduce((s, c) => s + c.contracts, 0)}</span> contracts. Federal procurement reaches the same supplier pool that holds state grants, Mission Australia, UnitingCare, Anglicare, Lifeline, alongside infrastructure suppliers (detention build, case-management software). <SourceLink href="#src-austender">[7]</SourceLink>
 </p>

 <PullQuote attribution="CivicGraph analysis · QLD State Budget Youth Justice line items">
 {detentionRatio}:1 detention to community. Group conferencing, the most evidence-backed line, sits at ~{totalSpend > 0 ? ((r.groupConferencing/totalSpend)*100).toFixed(1) : '—'}% of the three-line total.
 </PullQuote>
 </ReportSection>

 {/* ════ VOLUME 4 ════ */}
 <ReportSection id="volume-4" kicker="Volume 4" title="The Network">
 <p>
 A handful of organisations sit at the centre of the system. They hold contracts across multiple topic streams, span multiple states, and overlap at the governance level, same directors, same auditors, same board interlocks. This isn&apos;t scandalous; it&apos;s structural. But it shapes who gets heard in policy, who has the capacity to absorb a growth budget, and where bargaining power sits when contracts are renegotiated.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Multi-system providers</h3>
 <p>
 {r.crossSector.length > 0 ? (
 <>The top {r.crossSector.length} cross-sector providers in QLD each touch 3+ of the topic streams youth-justice / child-protection / NDIS / family-services / indigenous / mental-health. Largest by combined funding: <span className="font-black">{r.crossSector[0]?.recipient_name}</span> at <span className="font-black">{money(r.crossSector[0]?.total ?? 0)}</span> across <span className="font-black">{r.crossSector[0]?.sectors ?? 0}</span> streams. Cumulative across the top {r.crossSector.length}: <span className="font-black">{money(r.crossSector.reduce((s, c) => s + c.total, 0))}</span>.</>
 ) : <>Cross-sector data is loading.</>}
 </p>
 <p>
 Concentration matters in two ways. First, when one major provider falters operationally, the system feels it, QLD has experienced this in family-services and out-of-home care twice in the past five years. Second, the same providers are both contractor and policy adviser: they sit on government advisory groups, file submissions to inquiries, and contribute to the discourse that shapes the next funding round. The boundary is thin.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Director networks</h3>
 <p>
 {r.directors.length > 0 ? (
 <>CivicGraph&apos;s person-influence index identifies individuals who sit on 5+ entity boards across justice-funded organisations. Top by combined justice-funded portfolio: <span className="font-black">{r.directors[0]?.person_name}</span> at <span className="font-black">{money(r.directors[0]?.total_justice ?? 0)}</span> across <span className="font-black">{r.directors[0]?.board_count ?? 0}</span> boards. The top {r.directors.length} between them oversee <span className="font-black">{money(r.directors.reduce((s, d) => s + d.total_justice, 0))}</span> in justice-funded entity assets.</>
 ) : <>Director network data is loading.</>}
 </p>
 <p>
 Governance overlap is unavoidable in a small sector; the question is whether it&apos;s legible. ACNC reporting captures who sits on what board, but funders rarely cross-reference grant recipients against director maps before commissioning. {!isShare && (<>The full director-board matrix is available in the dashboard view at <Link href="/reports/youth-justice/qld/sector#volume-4" className="text-bauhaus-blue font-black hover:underline">Volume 4 §14</Link>.</>)}
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Political donations from contractors</h3>
 <p>
 AEC annual returns disclose political donations by donor entity. Cross-referencing donor ABNs against the YJ-funded recipient list identifies a small number of contractors who also donate to political parties. Quantum is modest relative to grant scale; the structural question is whether the disclosure regime gives funders, parliaments, and the public enough visibility into the relationship between procurement, advocacy, and political contribution. <SourceLink href="#src-aec">[14]</SourceLink>
 </p>

 {!isShare && (
 <p>
 The full network is best explored interactively. <Link href="/graph?mode=justice&topic=youth-justice&state=QLD" className="text-bauhaus-blue font-black hover:underline">See the QLD youth-justice network graph &rarr;</Link>
 </p>
 )}
 </ReportSection>

 {/* ════ VOLUME 5 ════ */}
 <ReportSection id="volume-5" kicker="Volume 5" title="The Evidence">
 <p>
 The Australian Living Map of Alternatives (ALMA) catalogues community-endorsed and evaluated diversion, wraparound, and reinvestment programs across Australia. It contains <span className="font-black">{r.almaTotal}</span> youth-justice-tagged interventions nationally; <span className="font-black">{r.almaQld}</span> have explicit Queensland presence. <SourceLink href="#src-alma">[10]</SourceLink>
 </p>

 <p>
 Evidence levels split roughly into three tiers: <span className="font-black">Proven</span> (rigorously evaluated, demonstrable outcomes), <span className="font-black">Promising</span> (community-endorsed, emerging evidence), and <span className="font-black">Untested</span> (theory or pilot stage). Most ALMA-listed QLD interventions sit at &ldquo;Promising&rdquo;, reflecting not that programs don&apos;t work, but that evaluation funding hasn&apos;t historically been resourced alongside delivery.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">The unfunded effective programs</h3>
 <p>
 {r.unfunded.length > 0 ? (
 <>CivicGraph identifies <span className="font-black">{r.unfunded.length}</span> ALMA-listed QLD or national programs graded &ldquo;Proven&rdquo; or &ldquo;Promising&rdquo; with no traceable funding link in our dataset. Examples include: {r.unfunded.slice(0, 4).map((u, i) => (<span key={i}><span className="font-black">{u.name}</span>{i < Math.min(3, r.unfunded.length - 1) ? ', ' : ''}</span>))}. These programs are running, mostly with grant top-ups, philanthropic seed funding, or volunteer labour, but have no operational state-budget anchor.</>
 ) : <>Unfunded-program data is loading.</>}
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Royal commissions and inquiries, the recommendation lineage</h3>
 <p>
 The structural recommendations have been made, repeatedly:
 </p>
 <ul className="list-disc pl-6 space-y-2 my-4">
 <li><span className="font-black">Royal Commission into Aboriginal Deaths in Custody (1991)</span>, 339 recommendations, many directly relevant to youth-justice over-representation. <SourceLink href="#src-aboriginal-deaths">[17]</SourceLink></li>
 <li><span className="font-black">Bringing Them Home (1997)</span>, the structural relationship between forced child removal and intergenerational harm runs directly into the contemporary YJ system. <SourceLink href="#src-bringing-them-home">[19]</SourceLink></li>
 <li><span className="font-black">Pathways to Justice (ALRC, 2018)</span>, specific recommendations on ACCO funding, justice reinvestment, and bail-and-remand reform. <SourceLink href="#src-pathways">[18]</SourceLink></li>
 <li><span className="font-black">NT Royal Commission (2017)</span>, 227 recommendations covering detention, child protection, policing, and community-led prevention. Structurally applicable beyond the NT. Implementation has been partial. <SourceLink href="#src-nt-rc">[16]</SourceLink></li>
 <li><span className="font-black">Multiple QLD coronial findings and parliamentary inquiries</span> on youth-justice deaths-in-custody and watchhouse incidents.</li>
 </ul>
 <p>
 The pattern is consistent: the prescriptive content of these reports overlaps significantly. The implementation gap is the recurring failure mode, not the absence of recommendations.
 </p>
 </ReportSection>

 {/* ════ VOLUME 6 ════ */}
 <ReportSection id="volume-6" kicker="Volume 6" title="The Place">
 <p>
 Youth justice doesn&apos;t happen statewide; it happens in places. The same handful of QLD LGAs, Townsville, Logan, Mount Isa, Cherbourg, Cairns, appear at the top of every cross-system metric: youth-offender rate, NDIS participant density, low-ICSEA schools, JobSeeker recipients, foster-care entries.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">LGA hotspots</h3>
 <p>
 {r.hotspots.length > 0 ? (
 <>Top {r.hotspots.length} QLD LGAs by pipeline-intensity score (composite of welfare density, school disadvantage, Indigenous share) in CivicGraph&apos;s cross-system dataset: {r.hotspots.slice(0, 5).map((h, i) => (
 <span key={i}><span className="font-black">{h.lga_name}</span> (intensity {Number(h.youth_offender_rate ?? 0).toFixed(1)}{h.indigenous_pct != null ? `, ${Number(h.indigenous_pct).toFixed(0)}% Indigenous` : ''}){i < Math.min(4, r.hotspots.length - 1) ? '; ' : '.'}</span>
 ))}</>
 ) : <>LGA hotspot data is loading.</>}
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Place case studies</h3>
 <p>
 <span className="font-black">Cherbourg.</span> Discrete Aboriginal community. High youth-offender rate, deep cultural authority, several locally-rooted programs in the ALMA register. State-budget grants flow disproportionately to mainstream NGOs delivering &ldquo;in&rdquo; the community rather than to ACCOs operating &ldquo;of&rdquo; the community. The structural funding gap is highest where the cultural authority is strongest.
 </p>
 <p>
 <span className="font-black">Mount Isa.</span> Remote, dispersed, mining-town economy. Youth-justice infrastructure is thin; the watchhouse functions as both a holding and a transfer point. Multi-agency presence (NDIS, family services, AOD, mental health) but limited coordination at the case level.
 </p>
 <p>
 <span className="font-black">Townsville.</span> Cleveland Youth Detention Centre catchment. Highest absolute youth-detention numbers in the state. Multi-system providers run multiple co-located programs, but the per-young-person service coverage in adjacent disadvantage statistics suggests the funnel into justice persists.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Justice reinvestment, the operational template</h3>
 <p>
 Maranguka (Bourke, NSW) is the operational reference site. KPMG&apos;s 2018 independent Impact Assessment reported a 23% drop in police-recorded incidents of family violence, a 31% increase in Year-12 retention, and an estimated $3.1M gross impact in the evaluation year. The model is community-led, place-based, multi-funder (philanthropic + state + federal), and operates with a long-term time horizon. <SourceLink href="#src-jr">[11]</SourceLink>
 </p>
 <p>
 Queensland has emerging community-led pilots, in Townsville, Cherbourg, Mount Isa, and the Cape, but no operational equivalent at Maranguka&apos;s scale, time-horizon, or evaluation rigor. The structural ingredients (multi-funder commitment, ACCO governance, place-anchored data infrastructure) exist; the political work on a 10-year horizon does not.
 </p>

 <PullQuote attribution="KPMG (2018), Maranguka Justice Reinvestment Project Impact Assessment">
 A 23% drop in police-recorded family-violence incidents and a 31% increase in Year-12 retention, evaluated independently.
 </PullQuote>
 </ReportSection>

 {/* ════ WHAT WOULD SHIFT THIS ════ */}
 {/* ════ VOLUME 7, POLICY & CAPACITY ════ */}
 <ReportSection id="volume-7" kicker="Volume 7" title="Policy &amp; capacity signals">
 <p>
 The data so far describes the system as it stands. Volume 7 describes the direction it is moving in, through legislation, capital investment, and ministerial signalling. The consistent pattern across the past 24 months: <span className="font-black">capacity is being expanded; sentencing is being hardened; the institutional counter-balances are being removed</span>.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">The Human Rights Act overrides</h3>
 <p>
 QLD&apos;s Human Rights Act 2019 commenced with a stated work on a rights-based approach to public-policy law-making. By August 2023, the Act had been overridden twice in 18 months, both times to expand custody powers over children. <SourceLink href="#src-qld-legislation">[27]</SourceLink> The first override (March 2023, breach-of-bail offence) was the precedent; the second (August 2023, children-in-adult-watchhouses authorisation) named December 2026 as a sunset date. The legislative architecture changed before the political conversation did.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Making Queensland Safer Act 2024</h3>
 <p>
 Act No. 54 of 2024, assented 13 December 2024. The most-significant single piece of youth-justice legislation Queensland has passed in the past decade. <SourceLink href="#src-mqs-act">[30]</SourceLink> Three structural changes:
 </p>
 <ul className="list-disc pl-6 space-y-2 my-4">
 <li><span className="font-black">&ldquo;Detention as a last resort&rdquo; removed</span> from the Youth Justice Act, reversing the foundational sentencing principle that had distinguished youth from adult criminal law since 1992.</li>
 <li><span className="font-black">Adult sentences for 13 listed offences</span> committed by children, murder, manslaughter, robbery, dangerous operation of a vehicle and others. Same maximum, mandatory and minimum penalties as adults.</li>
 <li><span className="font-black">Restorative justice removed</span> as a sentencing option for those offences.</li>
 </ul>
 <p>
 The Adult Crime Adult Time Amendment Bill 2025 sought to expand the list by ~20 further offences. UN Special Rapporteurs Alice Jill Edwards (torture) and Albert K. Barume (Indigenous peoples) wrote to Australian authorities expressing concern. <SourceLink href="#src-ohchr-2025">[32]</SourceLink> The National Children&apos;s Commissioner and QLD Human Rights Commission publicly opposed. <SourceLink href="#src-ahrc">[29]</SourceLink>
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Path to Treaty repealed on the first day of new government</h3>
 <p>
 The Path to Treaty Act 2023 (Act No. 12 of 2023, passed 10 May 2023) established the First Nations Treaty Institute and a Truth-telling and Healing Inquiry, institutional architecture for addressing the systemic conditions (including youth-justice over-representation) that a treaty / truth process is intended to confront. <SourceLink href="#src-treaty-act">[31]</SourceLink> The Crisafulli LNP Government repealed the Act on its <span className="font-black">first day of sitting</span> (28 November 2024), bundling the repeal into a Bill amending the Brisbane Olympic Games Act. QAIHC and Indigenous health peak bodies publicly opposed. The institutional counter-balance was removed before alternative governance architecture replaced it.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">The live legislative pipeline</h3>
 <p>
 Beyond the four headline Acts above, the QLD Parliament Bills register, scraped live from <a href="https://www.parliament.qld.gov.au" target="_blank" rel="noopener" className="text-bauhaus-blue font-black hover:underline">parliament.qld.gov.au</a>, shows {r.officialBills.length} youth-justice-relevant bills currently tracked in <code className="font-mono text-xs">qld_bills</code>. The most-recent are listed below with their official status; each links to the bill text on the parliamentary record.
 </p>
 {r.officialBills.length > 0 && (
 <ul className="list-disc pl-6 space-y-3 my-4">
 {r.officialBills.map((b, i) => {
 const objective = extractPolicyObjective(b.explanatory_note_text);
 return (
 <li key={i}>
 <span className="font-black">{b.bill_name}</span>
 {b.sponsor && <>, {b.sponsor}{b.sponsor_party ? ` (${b.sponsor_party})` : ''}</>}
 {b.status && <>, <span className={`font-black ${(b.status ?? '').toUpperCase().includes('PASSED') ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>{b.status}{b.status_date ? ` (${b.status_date})` : ''}</span></>}
 {objective && (
 <div className="mt-1 mb-2 border-l-4 border-bauhaus-yellow pl-3 text-sm italic">
 <span className="font-black not-italic uppercase tracking-widest text-xs text-bauhaus-black">From the Explanatory Note, </span>
 {objective}
 </div>
 )}
 <span className="font-mono text-xs">
 <a href={b.source_url} target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline">[bill text ↗]</a>
 {b.explanatory_note_url && <> &middot; <a href={b.explanatory_note_url} target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline">[explanatory note ↗]</a></>}
 {b.statement_of_compatibility_url && <> &middot; <a href={b.statement_of_compatibility_url} target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline">[statement of compatibility ↗]</a></>}
 </span>
 </li>
 );
 })}
 </ul>
 )}
 <p>
 The cumulative direction is clear: every YJ-relevant Act passed under the current Government has expanded custody powers. Not one has expanded community-based capacity, evaluation, or ACCO funding share.
 </p>

 <PullQuote attribution="Hon. David Crisafulli, Premier of Queensland, official media statement (Feb 2026)">
 Adult Crime, Adult Time expands to 45 offences.
 </PullQuote>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Capacity expansion, 120 new beds in the pipeline</h3>
 <p>
 Three facility decisions are reshaping QLD&apos;s detention-bed footprint. All were announced under the Palaszczuk Labor Government (2023&ndash;2024) and continue under the Crisafulli LNP Government, political ownership is bipartisan in practice:
 </p>
 <ul className="list-disc pl-6 space-y-2 my-4">
 <li><span className="font-black">Wacol Youth Remand Centre</span>, 76 beds, remand-only. Construction $250M+; first three years operations ~$150M. Opened early 2025. <SourceLink href="#src-yj-dept">[33]</SourceLink></li>
 <li><span className="font-black">Woodford Youth Detention Centre</span>, 80 beds. Sod turned February 2024. Reported construction cost up to $627.61M per industry-tracker figures pending verification against QLD Budget Paper 3. Completion target 2026.</li>
 <li><span className="font-black">Cairns Youth Detention Centre</span>, 40 beds, FNQ. Site selection 2024. Forecast operational 2027.</li>
 </ul>
 <p>
 Combined Woodford + Cairns: 120 beds added to QLD&apos;s detention capacity. Each bed represents a structural commitment for 30+ years. The same capital scale could have funded the operational scale-up of every &ldquo;promising&rdquo; ALMA intervention in §16 with evaluation budget left over.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Independent oversight findings</h3>
 <p>
 The QLD Ombudsman / Inspector of Detention Services has tabled a series of findings across 2024&ndash;2025. <SourceLink href="#src-qld-ombudsman">[28]</SourceLink>
 </p>
 <ul className="list-disc pl-6 space-y-2 my-4">
 <li><span className="font-black">Cleveland Youth Detention Centre (27 Aug 2024)</span>, chronic staff shortages, children locked alone in their rooms. On one inspection day, 40% of Cleveland&apos;s 96 inmates were held in bare cells. Average separation length in 2022&ndash;23 was 8 hrs 36 min. 15 recommendations.</li>
 <li><span className="font-black">Cairns + Murgon watchhouses (2024)</span>, specific focus on children in regional watchhouses, the operational reality of the watchhouse-as-overflow pattern in §1.</li>
 <li><span className="font-black">Combined Youth Detention Centres report (2025)</span>, the cross-system pattern.</li>
 <li><span className="font-black">2019 Brisbane City Watchhouse</span>, ABC Four Corners + Amnesty International documented 89 children in custody at one point in May 2019, with one young person held in isolation for 23 days. Triggered international scrutiny.</li>
 </ul>

 {r.coronerFindings.length > 0 && (
 <>
 <p>
 CivicGraph also ingests the QLD Coroners Court findings register (live-scraped via Playwright). Recent in-custody / youth-justice-flagged findings include:
 </p>
 <ul className="list-disc pl-6 space-y-2 my-4">
 {r.coronerFindings.map((f, i) => {
 const isAllLower = f.title === f.title.toLowerCase();
 const titleCased = isAllLower ? f.title.replace(/\b\w/g, c => c.toUpperCase()) : f.title;
 const cleanTitle = titleCased.split(/\s+(?:Coroner|Description):/i)[0].trim();
 return (
 <li key={i}>
 <span className="font-black">{cleanTitle}</span>
 {f.coroner_name && <>, Coroner {f.coroner_name}</>}
 {f.finding_date && <> ({f.finding_date})</>}
 {f.recommendations_count != null && f.recommendations_count > 0 && <>, <span className="font-black text-bauhaus-red">{f.recommendations_count} recommendations</span></>}
 {f.topics && f.topics.length > 0 && <>, <span className="text-xs font-mono text-bauhaus-muted">{f.topics.slice(0, 3).join(', ')}</span></>}
 . <a href={f.source_url} target="_blank" rel="noopener" className="text-bauhaus-blue font-mono text-xs hover:underline">[finding PDF ↗]</a>
 </li>
 );
 })}
 </ul>
 </>
 )}

 <p>
 A clarification often missed in public reporting: the high-profile <span className="font-black">Cleveland Dodd</span> coronial inquest (16-year-old Yamatji boy, died October 2023) is a <span className="font-black">Western Australian</span> case at Unit 18, Casuarina Prison, not QLD&apos;s Cleveland Youth Detention Centre in Townsville. We do not surface the Dodd inquest in this QLD report.
 </p>

 <PullQuote attribution="UN Committee on the Rights of the Child Chair Professor Ann Skelton (2024), per SBS NITV reporting">
 The 2024 QLD legislation is a flagrant disregard of children&apos;s rights and a clear breach of Australia&apos;s international obligations.
 </PullQuote>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">Live ministerial-statement feed</h3>
 <p>
 For the most-recent QLD Government youth-justice announcements with direction-of-travel classification (punitive / preventive / mixed), see the <span className="font-black">Direction of travel</span> live feed in the dashboard view (<Link href={`${dashboardHref}#volume-7`} className="text-bauhaus-blue font-black hover:underline">§23</Link>). The feed is scraped daily from <a href="https://statements.qld.gov.au" target="_blank" rel="noopener" className="text-bauhaus-blue font-black hover:underline">statements.qld.gov.au</a>; this section will pick up new announcements automatically as they&apos;re published.
 </p>
 </ReportSection>

 <ReportSection id="shift" kicker="Closing" title="What would shift this">
 <p>
 Three structural moves stand out from the data. None require new policy frameworks, the prescriptive content of Closing the Gap, Pathways to Justice, the Justice Reinvestment Network&apos;s sector roadmap, and the QLD government&apos;s own Youth Justice Strategy 2019–2023 already point in this direction.
 </p>

 <p>
 <span className="font-black text-bauhaus-red">1. Move the detention-to-community spend ratio.</span> A $200M reallocation from detention to community-based services would be roughly a {r.community > 0 ? Math.round((200_000_000 / r.community) * 100) : '—'}% expansion of the {money(r.community)} community line, enough to fund the scale-up of every &ldquo;Promising&rdquo; ALMA intervention with a credible delivery footprint, alongside the evaluation work needed to lift the most-promising ones to &ldquo;Proven&rdquo;.
 </p>

 <p>
 <span className="font-black text-bauhaus-red">2. Triple the ACCO funding share.</span> Aboriginal Community-Controlled Organisations consistently outperform mainstream NGOs in retention and outcomes for First Nations young people. The dollar share doesn&apos;t reflect this. Closing the Gap target 11 commits the QLD government to addressing this gap; the procurement architecture has not yet caught up to the policy commitment.
 </p>

 <p>
 <span className="font-black text-bauhaus-red">3. Resource evaluation alongside delivery.</span> The reason most ALMA interventions sit at &ldquo;Promising&rdquo; rather than &ldquo;Proven&rdquo; is that programs are funded to deliver, not to be evaluated. A small percentage of every grant (3–5%) ringfenced for monitoring and evaluation, plus a sector-wide outcome-data infrastructure, would close the evidence gap within a budget cycle.
 </p>

 <h3 className="text-lg font-black uppercase tracking-tight text-bauhaus-black mt-8 mb-3">What this means for you</h3>
 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 mb-6">
 <div className="border-4 border-bauhaus-black p-4 bg-white">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">Funder</div>
 <p className="text-xs text-bauhaus-black font-medium leading-relaxed">If your portfolio touches youth, indigenous, education, or child welfare in QLD, the {accoSharePct}%-for-70%-of-population ACCO gap is your highest-leverage anchor.</p>
 </div>
 <div className="border-4 border-bauhaus-black p-4 bg-white">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">Board / governance</div>
 <p className="text-xs text-bauhaus-black font-medium leading-relaxed">Cross-sector concentration is real. Run the director-overlap and contract-concentration tests before signing strategic partnerships.</p>
 </div>
 <div className="border-4 border-bauhaus-black p-4 bg-white">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">Journalist / researcher</div>
 <p className="text-xs text-bauhaus-black font-medium leading-relaxed">Every claim in this report is sourced. The gap between prescriptive-content (royal commissions, inquiries) and implementation is the recurring story.</p>
 </div>
 <div className="border-4 border-bauhaus-black p-4 bg-white">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">Sector peak / advocacy</div>
 <p className="text-xs text-bauhaus-black font-medium leading-relaxed">The ratio, the gap, and the unfunded-effective-programs list are policy-ready evidence. Use them.</p>
 </div>
 </div>
 </ReportSection>

 {/* ════ SOURCES ════ */}
 {!isShare ? (
 <ReportSection id="sources" kicker="Sources" title="Sources & methodology">
 <p>
 Every numerical claim is traceable to one of the sources below. Live data refreshes from QPS twice daily; funding tables refresh nightly; ACNC, AusTender, NDIS, and DSS feeds refresh on their respective publication cadences. The ALMA evidence base is community-maintained and updated on a rolling basis.
 </p>
 <SourcesPanel sources={sources} />
 </ReportSection>
 ) : (
 <div id="sources" className="mb-16 scroll-mt-24">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Sources</div>
 <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black uppercase tracking-tight mb-6">Sources &amp; methodology</h2>
 <p className="text-bauhaus-black font-medium leading-relaxed mb-4">Every numerical claim is traceable to one of the sources below. Live data refreshes from QPS twice daily; funding tables refresh nightly.</p>
 <SourcesPanel sources={sources} />
 </div>
 )}

 {/* ════ RELATED READS ════ */}
 {!isShare && (
 <RelatedReads items={[
 {
 href: '/reports/multicultural-sector/fecca-eccv',
 kicker: 'Sector deep-dive',
 title: 'Multicultural sector, FECCA & ECCV worked example',
 description: 'Same investigative pattern applied to peak-body funding and capability across the multicultural sector.',
 },
 {
 href: '/graph?mode=justice&topic=youth-justice&state=QLD',
 kicker: 'Network',
 title: 'Explore the QLD youth-justice network graph',
 description: 'Interactive force-directed view of program → recipient flows from the QLD justice-funding dataset.',
 },
 ]} />
 )}

 {/* ════ CTA ════ */}
 <section className="border-4 border-bauhaus-black p-8 bg-bauhaus-yellow mb-12 mt-12">
 <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Was this useful?</h2>
 <p className="text-bauhaus-black font-medium leading-relaxed max-w-3xl mb-5">
 The pipeline behind this report runs for any sector, peak body, or place in Australia. Tell us what you found useful and what you&apos;d want next, anonymously if you like.
 </p>
 <div className="flex flex-wrap gap-3">
 <Link href="/feedback?subject=qld-youth-justice" className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">★ Send feedback (~2 min) →</Link>
 <Link href="/get-a-report?free=true&src=qld-yj-longread" className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-white text-bauhaus-black border-2 border-bauhaus-black hover:bg-bauhaus-canvas">★ Get a report on your sector →</Link>
 </div>
 </section>

 <div className="text-center mb-8">
 <div className="text-xs font-mono text-bauhaus-muted">CivicGraph long-form report · {new Date().toISOString().slice(0, 10)} · Built by A Curious Tractor</div>
 </div>
 </div>
 );
}

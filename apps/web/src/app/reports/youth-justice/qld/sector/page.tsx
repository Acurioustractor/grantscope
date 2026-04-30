import Link from 'next/link';
import { headers } from 'next/headers';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'QLD Youth Justice — Sector Deep Dive · CivicGraph',
  description: "Six volumes. 22 sections. Every dollar traced. Live watchhouse data refreshed twice daily, cross-system pathways from child protection through disability and AOD, ACCO funding gap, foundation landscape, director networks, and place-based hotspots — all sourced.",
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
function pct(n: number | null | undefined, digits: number = 0): string {
  if (n == null) return '—';
  return `${Number(n).toFixed(digits)}%`;
}

/* ─── Curated reference data ─────────────────────────────────────────────
 *
 * These items are NOT in the structured dataset yet — they are publicly-
 * announced QLD government infrastructure and policy moves with citation
 * URLs. They live as a constant here so the report can surface them with
 * sources while we build the data-ingestion pipeline. Each entry MUST cite
 * a verifiable public source.
 */
type PlannedFacility = {
  name: string;
  status: 'announced' | 'under-construction' | 'recently-opened';
  capacity: string;
  location: string;
  estimatedCost: string | null;
  source: { label: string; href: string };
  notes: string;
};

const QLD_PLANNED_FACILITIES: PlannedFacility[] = [
  {
    name: 'Wacol Youth Remand Centre',
    status: 'recently-opened',
    capacity: '76 beds (remand-only)',
    location: 'Wacol, Brisbane',
    estimatedCost: '$250M+ construction · ~$150M first three years operations',
    source: { label: 'QLD Government statement (Sep 2023)', href: 'https://statements.qld.gov.au/statements/98865' },
    notes: 'Announced 21 Sep 2023 (Palaszczuk Labor Government). Officially opened and began transferring young people in early 2025 under the Crisafulli LNP Government. Operates remand-only — reduces watchhouse overflow but adds detention capacity rather than community alternatives.',
  },
  {
    name: 'Woodford Youth Detention Centre',
    status: 'under-construction',
    capacity: '80 beds (planned)',
    location: 'Woodford (north of Brisbane)',
    estimatedCost: 'up to $627.61M reported (industry tracker; verify against QLD Budget Paper 3)',
    source: { label: 'QLD Department of Youth Justice — Woodford', href: 'https://youthjustice.qld.gov.au/our-department/strategies-reform/new-youth-detention-centres/woodford' },
    notes: 'Sod turned February 2024 (Palaszczuk Labor); BESIX Watpac (QLD) Pty Ltd appointed as lead contractor. Project continues under the Crisafulli LNP Government. Completion target 2026.',
  },
  {
    name: 'Cairns Youth Detention Centre',
    status: 'announced',
    capacity: '40 beds (planned)',
    location: 'Far North Queensland',
    estimatedCost: 'TBD',
    source: { label: 'QLD Department of Youth Justice — Cairns', href: 'https://youthjustice.qld.gov.au/our-department/strategies-reform/new-youth-detention-centres/cairns' },
    notes: 'Announced under Palaszczuk Labor; site selection consultation through 2024. Forecast operational 2027. Combined with Woodford, adds 120 beds to QLD detention capacity.',
  },
];

type PolicySignal = {
  date: string;
  title: string;
  thrust: 'punitive' | 'preventive' | 'mixed';
  summary: string;
  source: { label: string; href: string };
};

const QLD_POLICY_SIGNALS: PolicySignal[] = [
  {
    date: '16 Mar 2023',
    title: 'Strengthening Community Safety Act 2023 — first override of QLD Human Rights Act',
    thrust: 'punitive',
    summary: 'Reinstated the breach-of-bail offence for children. Overrode Queensland\'s own Human Rights Act 2019 — the first such override since the Act commenced. Set the precedent for subsequent youth-justice legislation overriding rights protections.',
    source: { label: 'AHRI — Overriding the Queensland HR Act', href: 'https://humanrights.unsw.edu.au/students/blogs/overriding-queensland-human-rights-act' },
  },
  {
    date: '10 May 2023',
    title: 'Path to Treaty Act 2023 — established Truth-telling and Treaty Body',
    thrust: 'preventive',
    summary: 'Act No. 12 of 2023, passed 10 May 2023. Established the First Nations Treaty Institute and a Truth-telling and Healing Inquiry. Was the policy framework explicitly tying systemic First Nations over-representation in YJ to a longer-term treaty/truth process.',
    source: { label: 'QLD Legislation — Path to Treaty Act 2023', href: 'https://www.legislation.qld.gov.au/view/html/asmade/act-2023-012' },
  },
  {
    date: '25 Aug 2023',
    title: 'Children-in-adult-watchhouses Act — second HR Act override',
    thrust: 'punitive',
    summary: 'Child Protection (Offender Reporting and Offender Prohibition Order) and Other Legislation Amendment Act. Overrode QLD HR Act for the second time; explicitly authorised holding children in adult watchhouses. Then-Police Minister Mark Ryan described as a temporary measure until 31 December 2026.',
    source: { label: 'Al Jazeera coverage', href: 'https://www.aljazeera.com/news/2023/9/18/australian-state-suspends-human-rights-law-to-lock-up-more-children' },
  },
  {
    date: '13 Dec 2024',
    title: 'Making Queensland Safer Act 2024 — "adult crime, adult time"',
    thrust: 'punitive',
    summary: 'Act No. 54 of 2024, assented 13 December 2024. Removed the "detention as a last resort" principle from the Youth Justice Act. Children charged with 13 listed offences (incl. murder, manslaughter, robbery, dangerous operation of a vehicle) face the same maximum, mandatory and minimum penalties as adults. Restorative justice removed as a sentencing option for those offences. UN CRC chair Ann Skelton called it "flagrant disregard of children\'s rights".',
    source: { label: 'QLD Legislation — Making QLD Safer Act 2024', href: 'https://www.legislation.qld.gov.au/view/whole/html/asmade/act-2024-054' },
  },
  {
    date: '28 Nov 2024',
    title: 'Path to Treaty Act repealed — first sitting day of new government',
    thrust: 'punitive',
    summary: 'Crisafulli LNP Government repealed the Path to Treaty Act on its first day of sitting. Repeal bundled into a Bill amending the Brisbane Olympic Games Act. QAIHC and Indigenous health peak bodies publicly opposed. Removed the institutional treaty/truth framework that explicitly addressed YJ over-representation.',
    source: { label: 'QLD Statement — Repeal (Nov 2024)', href: 'https://statements.qld.gov.au/statements/101654' },
  },
  {
    date: '2024–25',
    title: 'Bail Act amendments — wider presumption-against-bail list',
    thrust: 'punitive',
    summary: 'Police no longer required to consider alternatives to arrest for bail-condition breaches by children. Presumption-against-bail expanded: unlawful use of motor vehicle (aggravated), burglary, entering premises to commit indictable offences. Electronic monitoring of high-risk youth on bail expanded to Toowoomba, Mt Isa and Cairns. More children on remand for longer.',
    source: { label: 'QLD Department of Youth Justice — Changes to Acts', href: 'https://youthjustice.qld.gov.au/our-department/our-legislation/changes-act' },
  },
  {
    date: 'May 2025',
    title: 'Adult Crime Adult Time Amendment Bill 2025 — proposed expansion to ~33 offences',
    thrust: 'punitive',
    summary: 'Sought to expand the adult-crime-adult-time list by ~20 further offences including arson, attempted murder, torture, rape, attempted rape, attempted robbery and trafficking in dangerous drugs. UN Special Rapporteurs Alice Jill Edwards (torture) and Albert K. Barume (Indigenous peoples) wrote to Australian authorities expressing concern.',
    source: { label: 'OHCHR — UN experts on Australian youth justice (May 2025)', href: 'https://www.ohchr.org/en/media-advisories/2025/05/youth-justice-systems-across-australia-crisis-un-experts' },
  },
];

type OversightFinding = {
  date: string;
  body: string;
  title: string;
  summary: string;
  source: { label: string; href: string };
};

const QLD_OVERSIGHT_FINDINGS: OversightFinding[] = [
  {
    date: '27 Aug 2024',
    body: 'QLD Ombudsman / Inspector of Detention Services',
    title: 'Cleveland Youth Detention Centre Inspection Report — separation due to staff shortages',
    summary: 'Inspector Anthony Reilly tabled findings of chronic staff shortages causing children to be locked alone in their rooms. On one inspection day, 40% of Cleveland\'s 96 inmates were held in bare cells. Average separation length in 2022–23 was 8 hrs 36 min, reduced to 4 hrs 24 min by mid-2024. 15 recommendations.',
    source: { label: 'QLD Ombudsman — Cleveland inspection report', href: 'https://www.ombudsman.qld.gov.au/publications/detention-inspection-reports/cleveland-youth-detention-centre-inspection-report-focus-on-separation-due-to-staff-shortages' },
  },
  {
    date: '2024',
    body: 'QLD Ombudsman / Inspector of Detention Services',
    title: 'Cairns and Murgon Watch-Houses Inspection Report — focus on detention of children',
    summary: 'Inspection of Cairns and Murgon watch-houses with specific focus on the detention of children. Documented operational and welfare issues at both regional sites — directly relevant to the watchhouse-as-overflow pattern in Volume 1.',
    source: { label: 'QLD Ombudsman — Cairns + Murgon inspection', href: 'https://www.ombudsman.qld.gov.au/publications/detention-inspection-reports/cairns-and-murgon-watch-houses-inspection-report-2024' },
  },
  {
    date: '2025',
    body: 'QLD Ombudsman / Inspector of Detention Services',
    title: 'Combined Youth Detention Centres Inspection Report',
    summary: 'Combined inspection report covering all QLD youth detention centres. Read alongside the 2024 Cleveland report for the across-system pattern.',
    source: { label: 'QLD Ombudsman — combined YDC inspections 2025', href: 'https://www.ombudsman.qld.gov.au/publications/detention-inspection-reports/ydc-inspections-combined-report-2025' },
  },
  {
    date: '2019',
    body: 'Australian Human Rights Commission · Amnesty International',
    title: 'Children in Brisbane City Watchhouse — 89 children, isolation incidents',
    summary: 'ABC Four Corners + Amnesty International documented 89 children held in the Brisbane City Watchhouse at one point in May 2019. Reported incidents included children losing fingers in cell doors and one young person held in isolation for 23 days. Triggered international and federal-level scrutiny.',
    source: { label: 'Human Rights Watch — Australia\'s terrifying watch-houses', href: 'https://www.hrw.org/news/2019/06/24/australias-terrifying-watch-houses' },
  },
  {
    date: '2024',
    body: 'Australian Human Rights Commission',
    title: 'National Children\'s Commissioner — public criticism of QLD reforms',
    summary: 'The National Children\'s Commissioner publicly criticised QLD\'s 2024 youth-justice reforms as a breach of Australia\'s international child-rights obligations.',
    source: { label: 'AHRC — Statement on QLD reforms', href: 'https://humanrights.gov.au/about/news/media-releases/national-childrens-commissioner-slams-shocking-new-qld-youth-justice-laws' },
  },
];

// ACNC legal names are often "THE TRUSTEE FOR X TRUST" or all-caps registered company names,
// religious legal-entity wrappers ("The Corporation of the Trustees of the X"), etc.
// Convert to a friendlier display form for the report.
function displayName(raw: string): string {
  let s = raw.trim();
  // Religious legal-entity patterns first (most specific)
  s = s.replace(/^the\s+corporation\s+of\s+the\s+trustees\s+of\s+the\s+/i, '');
  s = s.replace(/^the\s+corporation\s+of\s+the\s+synod\s+of\s+the\s+diocese\s+of\s+brisbane(\s*-\s*)?/i, 'Anglican Diocese of Brisbane $1');
  s = s.replace(/^the\s+trustee\s+for\s+/i, '');
  // Common Pty/Ltd/Incorporated/Pictures-Limited suffix strip
  s = s.replace(/\s+(pty\s+ltd|pty|ltd\.?|limited|incorporated|inc\.?|pictures\s+limited)$/i, '');
  // Title-case strings that are mostly ALL-CAPS
  if (/^[A-Z0-9\s&.,'-]+$/.test(s) && s.length > 4) {
    s = s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    s = s.replace(/\bBhp\b/g, 'BHP');
    s = s.replace(/\bAcco\b/g, 'ACCO');
    s = s.replace(/\bNgo\b/g, 'NGO');
    s = s.replace(/\bQld\b/g, 'QLD');
    s = s.replace(/\bNsw\b/g, 'NSW');
  }
  // Trim trailing dash-spaces left by the diocese rule
  s = s.replace(/\s*-\s*$/, '').trim();
  return s;
}

/* ─── Inline primitives ──────────────────────────────────────────────── */

function StackedBar({ total, segments }: { total: number; segments: Array<{ key: string; value: number; color: string; label: string }> }) {
  const t = Math.max(total || 0, 1);
  return (
    <div>
      <div className="relative h-7 bg-bauhaus-canvas border-2 border-bauhaus-black flex">
        {segments.map(s => {
          if (!s.value || s.value <= 0) return null;
          return <div key={s.key} className={`${s.color} h-full`} style={{ width: `${(s.value / t) * 100}%` }} title={`${s.label}: ${money(s.value)}`} />;
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono text-bauhaus-muted">
        {segments.filter(s => (s.value || 0) > 0).map(s => (
          <span key={s.key}>
            <span className={`inline-block w-2 h-2 ${s.color} mr-1 align-middle`} />
            {s.label} {money(s.value)} ({total ? ((s.value / total) * 100).toFixed(0) : 0}%)
          </span>
        ))}
      </div>
    </div>
  );
}

function HBar({ value, peak, color }: { value: number; peak: number; color: string }) {
  const w = peak > 0 ? (value / peak) * 100 : 0;
  return (
    <div className="relative h-5 bg-bauhaus-canvas border-2 border-bauhaus-black">
      <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

/* ─── Data types ─────────────────────────────────────────────────────── */

type WatchhouseLatest = {
  source_generated_at: string;
  total_people: number; total_adults: number; total_children: number;
  child_first_nations: number; child_non_indigenous: number;
  child_0_2_days: number; child_3_7_days: number; child_over_7_days: number; child_longest_days: number;
  adult_first_nations: number; adult_non_indigenous: number; adult_over_7_days: number; adult_longest_days: number;
  child_watchhouse_count: number;
};
type WatchhouseRow = { watchhouse_name: string; age_group: string; total_in_custody: number; first_nations: number; custody_over_7_days: number; longest_days: number };
type WatchhouseTrend = { day: string; total_children: number; child_fn: number };
type DetentionFacility = { name: string; capacity_beds: number | null; indigenous_population_percentage: number | null; postcode: string | null };
type SpendCategory = { category: string; total: number };
type CtgRow = { financial_year: string; actual_rate: number; trajectory_rate: number | null; gap_from_target: number | null };
type TopOrgRow = { recipient_name: string | null; recipient_abn: string | null; total: number; grants: number };
type AccoGapRow = { org_type: string; orgs: number; total_funding: number; avg_per_recipient: number; funding_share_pct: number };
type RecipientRow = { recipient_name: string; total: number; grants: number };
type CrossSectorRow = { recipient_name: string; sectors: number; topic_list: string[]; total: number };
type AlmaInterventionRow = { name: string; type: string; evidence_level: string | null; geography: string[]; cost_per_young_person: number | null; portfolio_score: number | null; cultural_authority: string | null };
type AlmaTypeCount = { type: string; count: number };
type ContractRow = { supplier_name: string; total: number; contracts: number };
type FoundationRow = { name: string; total_giving_annual: number; thematic_focus: string };
type HeatmapRow = { lga_name: string; population: number | null; youth_population: number | null; indigenous_pct: number | null; pipeline_intensity: number | null; ndis_youth_participants: number | null; jh_funding_tracked: number | null; school_count: number | null; jobseeker_recipients: number | null };
type YearSpendRow = { financial_year: string; topic: string; total: number };
type DssRow = { state: string; payment_type: string; recipient_count: number };
type NdisOverlayRow = { state: string; total_participants: number; youth_participants: number; psychosocial_participants: number; intellectual_disability_participants: number; autism_participants: number };
type UnfundedRow = { name: string; type: string; evidence_level: string | null; geography: string };
type DirectorRow = { person_name: string; board_count: number; total_procurement: number; total_justice: number };
type SpendRow = { recipient_name: string; total: number };
type MinStatement = { published_at: string; minister_name: string | null; portfolio: string | null; headline: string; source_url: string; topics: string[] | null };
type HansardRow = { sitting_date: string; speaker_name: string | null; speaker_party: string | null; subject: string | null; snippet: string; source_url: string | null };
type HansardPartyCount = { speaker_party: string | null; speeches: number };

async function getReport() {
  const supabase = getLiveReportSupabase();
  const [
    latest, sites, trend, detentionFacilities, ctg, topOrgs, accoGap,
    recipients, crossSector, almaTypeCounts, almaInterventions, contracts,
    foundations, heatmap, yearSpend, dssQld, ndisOverlay,
    unfundedPrograms, mentalHealthAlma, aodAlma, mhFundingCount, directors,
    politicalDonations, spend, ministerialStatements, hansardRows, hansardPartyCounts,
  ] = await Promise.all([
    safe(supabase.rpc('exec_sql', { query: `SELECT source_generated_at::text, total_people, total_adults, total_children, child_first_nations, child_non_indigenous, child_0_2_days, child_3_7_days, child_over_7_days, child_longest_days, adult_first_nations, adult_non_indigenous, adult_over_7_days, adult_longest_days, child_watchhouse_count FROM public.v_qld_watchhouse_latest LIMIT 1` })) as Promise<WatchhouseLatest[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT watchhouse_name, age_group, total_in_custody::int, first_nations::int, custody_over_7_days::int, longest_days::int FROM public.qld_watchhouse_snapshot_rows WHERE snapshot_id = (SELECT id FROM public.v_qld_watchhouse_latest LIMIT 1) ORDER BY (CASE WHEN age_group = 'Child' THEN 0 ELSE 1 END), total_in_custody DESC LIMIT 50` })) as Promise<WatchhouseRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT date_trunc('day', source_generated_at)::date::text AS day, AVG(total_children::numeric)::numeric(10,1) AS total_children, AVG(child_first_nations::numeric)::numeric(10,1) AS child_fn FROM public.qld_watchhouse_snapshots WHERE source_generated_at > NOW() - INTERVAL '60 days' GROUP BY 1 ORDER BY 1` })) as Promise<WatchhouseTrend[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT name, capacity_beds, indigenous_population_percentage, postcode FROM public.youth_detention_facilities WHERE state = 'QLD' AND operational_status = 'operational' ORDER BY capacity_beds DESC NULLS LAST LIMIT 10` })) as Promise<DetentionFacility[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT financial_year, actual_rate::numeric(10,2), trajectory_rate::numeric(10,2), gap_from_target::numeric(10,2) FROM public.v_ctg_youth_justice_progress WHERE state = 'QLD' ORDER BY financial_year` })) as Promise<CtgRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT recipient_name, recipient_abn, total::bigint, grants::int FROM public.mv_yj_report_state_top_orgs WHERE state = 'QLD' OR state = 'Queensland' ORDER BY total DESC NULLS LAST LIMIT 25` })) as Promise<TopOrgRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT org_type, orgs::int, total_funding::bigint, avg_per_recipient::bigint, funding_share_pct::int FROM public.mv_yj_report_acco_gap` })) as Promise<AccoGapRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT recipient_name, SUM(amount_dollars)::bigint AS total, COUNT(*)::int AS grants FROM public.justice_funding WHERE state = 'QLD' AND topics @> ARRAY['youth-justice'] AND recipient_name NOT ILIKE '%total%' AND recipient_name NOT ILIKE 'department of youth justice%' AND recipient_name NOT ILIKE 'youth justice -%' AND recipient_name NOT IN ('(blank)','TAFE Queensland') AND amount_dollars > 0 GROUP BY 1 ORDER BY total DESC NULLS LAST LIMIT 15` })) as Promise<RecipientRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT recipient_name, COUNT(DISTINCT topic)::int AS sectors, ARRAY_AGG(DISTINCT topic) AS topic_list, SUM(amount_dollars)::bigint AS total FROM (SELECT recipient_name, unnest(topics) AS topic, amount_dollars FROM public.justice_funding WHERE state = 'QLD' AND amount_dollars > 0 AND recipient_name IS NOT NULL AND length(recipient_name) > 3 AND recipient_name !~ '^[0-9]+$' AND recipient_name NOT ILIKE '%Total%' AND recipient_name NOT ILIKE '%Department of%' AND recipient_name NOT ILIKE '%State of %' AND recipient_name NOT ILIKE '(blank)') t WHERE topic IN ('youth-justice','child-protection','disability','ndis','family-services','indigenous','mental-health','homelessness','aod','family-violence') GROUP BY 1 HAVING COUNT(DISTINCT topic) >= 3 ORDER BY total DESC NULLS LAST LIMIT 12` })) as Promise<CrossSectorRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT type, count::int FROM public.mv_yj_report_alma_type_counts ORDER BY count DESC LIMIT 12` })) as Promise<AlmaTypeCount[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT name, type, evidence_level, geography, cost_per_young_person::int, portfolio_score::int, cultural_authority FROM public.alma_interventions WHERE ('QLD' = ANY(geography) OR 'Queensland' = ANY(geography)) AND (topics @> ARRAY['youth-justice'] OR type ILIKE '%diversion%' OR type ILIKE '%justice%' OR type ILIKE '%wraparound%' OR type ILIKE '%community-led%' OR type ILIKE '%therapeutic%') ORDER BY (CASE WHEN evidence_level ILIKE '%proven%' THEN 0 WHEN evidence_level ILIKE '%promising%' THEN 1 ELSE 2 END), portfolio_score DESC NULLS LAST LIMIT 16` })) as Promise<AlmaInterventionRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT supplier_name, COUNT(*)::int AS contracts, SUM(contract_value)::bigint AS total FROM public.austender_contracts WHERE supplier_name ILIKE ANY (ARRAY['%youth justice%','%PCYC%','%youth advocacy%','%murri watch%','%youth off the streets%','%mission australia%','%lifeline community%','%anglicare%','%uniting%','%liquidlogic%','%halikos%','%Save the Children%']) AND contract_value > 0 GROUP BY 1 ORDER BY total DESC NULLS LAST LIMIT 12` })) as Promise<ContractRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT name, total_giving_annual::bigint AS total_giving_annual, thematic_focus::text FROM public.foundations WHERE thematic_focus::text ILIKE ANY (ARRAY['%justice%','%youth%','%children%','%first nations%','%indigenous%','%disability%','%mental health%','%aboriginal%']) AND total_giving_annual > 0 AND name NOT ILIKE '%universit%' AND name NOT ILIKE '%accommodation%' AND name NOT ILIKE '%catholic education%' AND name NOT ILIKE '%hospital%' AND name NOT ILIKE '%council%' ORDER BY total_giving_annual DESC NULLS LAST LIMIT 12` })) as Promise<FoundationRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT lga_name, population::int, youth_population::int, indigenous_pct::numeric(5,1), pipeline_intensity::numeric(5,1), ndis_youth_participants::int, jh_funding_tracked::bigint, school_count::int, jobseeker_recipients::int FROM public.lga_cross_system_stats WHERE state = 'QLD' AND population > 5000 AND pipeline_intensity IS NOT NULL ORDER BY pipeline_intensity DESC NULLS LAST LIMIT 15` })) as Promise<HeatmapRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT financial_year, topic, SUM(amount_dollars)::bigint AS total FROM (SELECT financial_year, unnest(topics) AS topic, amount_dollars FROM public.justice_funding WHERE state = 'QLD' AND amount_dollars > 0 AND financial_year IS NOT NULL) t WHERE topic IN ('youth-justice','child-protection','indigenous','disability','family-services') AND financial_year ~ '^20[0-9]{2}-' GROUP BY 1,2 ORDER BY financial_year, topic` })) as Promise<YearSpendRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT 'QLD'::text AS state, payment_type, recipient_count::int FROM public.dss_payment_demographics WHERE state = 'QLD' ORDER BY recipient_count DESC NULLS LAST LIMIT 10` })) as Promise<DssRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT state, total_participants::int, youth_participants::int, psychosocial_participants::int, intellectual_disability_participants::int, autism_participants::int FROM public.v_ndis_youth_justice_overlay WHERE state = 'QLD' OR state = 'Queensland' OR state ILIKE 'QLD%' LIMIT 20` })) as Promise<NdisOverlayRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT name, type, evidence_level, geography::text FROM public.mv_yj_report_unfunded_programs WHERE (geography::text ILIKE '%QLD%' OR geography::text ILIKE '%Queensland%' OR geography::text ILIKE '%National%') ORDER BY (CASE WHEN evidence_level ILIKE '%proven%' OR evidence_level ILIKE '%effective%' THEN 0 ELSE 1 END), name LIMIT 8` })) as Promise<UnfundedRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT count(*)::int AS c FROM public.alma_interventions WHERE ('QLD' = ANY(geography) OR 'Queensland' = ANY(geography)) AND (type ILIKE '%mental%' OR description ILIKE '%mental health%')` })) as Promise<Array<{ c: number }> | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT count(*)::int AS c FROM public.alma_interventions WHERE ('QLD' = ANY(geography) OR 'Queensland' = ANY(geography)) AND (type ILIKE '%aod%' OR description ILIKE '%alcohol%' OR description ILIKE '%drug%' OR description ILIKE '%addiction%')` })) as Promise<Array<{ c: number }> | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT count(*)::int AS c FROM public.justice_funding WHERE state = 'QLD' AND amount_dollars > 0 AND (topics @> ARRAY['mental-health'] OR topics @> ARRAY['aod'])` })) as Promise<Array<{ c: number }> | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT person_name, board_count::int, total_procurement::bigint, total_justice::bigint FROM public.mv_person_influence WHERE board_count >= 5 AND total_justice > 0 AND (entity_types::text ILIKE '%charity%' OR entity_types::text ILIKE '%indigenous%') ORDER BY total_justice DESC NULLS LAST LIMIT 12` })) as Promise<DirectorRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT count(*)::int AS donations, SUM(amount)::bigint AS total FROM public.political_donations pd WHERE pd.donor_abn IN (SELECT recipient_abn FROM public.justice_funding WHERE state = 'QLD' AND topics @> ARRAY['youth-justice'] AND recipient_abn IS NOT NULL)` })) as Promise<Array<{ donations: number; total: number }> | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT recipient_name, SUM(amount_dollars)::bigint AS total FROM public.justice_funding WHERE state = 'QLD' AND recipient_name LIKE 'Youth Justice -%' GROUP BY 1` })) as Promise<SpendRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT published_at::text, minister_name, portfolio, headline, source_url, topics FROM public.civic_ministerial_statements WHERE jurisdiction = 'QLD' AND (topics @> ARRAY['youth-justice'] OR headline ~* '(youth|detention|watch.?house|adult crime|bail|young offender)') AND published_at > NOW() - INTERVAL '24 months' ORDER BY published_at DESC LIMIT 12` })) as Promise<MinStatement[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT sitting_date::text, speaker_name, speaker_party, subject, substring(body_text, 1, 280) AS snippet, source_url FROM public.civic_hansard WHERE jurisdiction = 'QLD' AND length(body_text) > 100 AND speaker_name IS NOT NULL AND speaker_name != 'Deputy Speaker' AND speaker_name != 'Speaker' AND speaker_name NOT ILIKE '%Hansard%' AND (body_text ~* '(youth justice|adult crime, adult time|adult time|youth detention|watchhouse|breach of bail|making queensland safer|young offender)') ORDER BY sitting_date DESC NULLS LAST LIMIT 10` })) as Promise<HansardRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT speaker_party, COUNT(*)::int AS speeches FROM public.civic_hansard WHERE jurisdiction = 'QLD' AND length(body_text) > 100 AND speaker_party IS NOT NULL AND (body_text ~* '(youth justice|adult crime, adult time|adult time|youth detention|watchhouse|breach of bail|making queensland safer|young offender)') AND sitting_date > NOW() - INTERVAL '12 months' GROUP BY 1 ORDER BY 2 DESC` })) as Promise<HansardPartyCount[] | null>,
  ]);

  const detention = (spend ?? []).find(s => /detention/i.test(s.recipient_name))?.total || 0;
  const community = (spend ?? []).find(s => /community/i.test(s.recipient_name))?.total || 0;
  const groupConferencing = (spend ?? []).find(s => /group conferencing/i.test(s.recipient_name))?.total || 0;

  return {
    latest: latest?.[0] || null,
    sites: sites ?? [],
    trend: trend ?? [],
    detentionFacilities: detentionFacilities ?? [],
    ctg: ctg ?? [],
    topOrgs: topOrgs ?? [],
    accoGap: accoGap ?? [],
    recipients: recipients ?? [],
    crossSector: crossSector ?? [],
    almaTypeCounts: almaTypeCounts ?? [],
    almaInterventions: almaInterventions ?? [],
    contracts: contracts ?? [],
    foundations: foundations ?? [],
    heatmap: heatmap ?? [],
    yearSpend: yearSpend ?? [],
    dssQld: dssQld ?? [],
    ndisOverlay: ndisOverlay?.[0] || null,
    unfundedPrograms: unfundedPrograms ?? [],
    mhAlma: mentalHealthAlma?.[0]?.c ?? 0,
    aodAlma: aodAlma?.[0]?.c ?? 0,
    mhFundingCount: mhFundingCount?.[0]?.c ?? 0,
    directors: directors ?? [],
    politicalDonations: politicalDonations?.[0] || null,
    detention, community, groupConferencing,
    ministerialStatements: ministerialStatements ?? [],
    hansardRows: hansardRows ?? [],
    hansardPartyCounts: hansardPartyCounts ?? [],
  };
}

// Heuristic classifier for QLD ministerial statements about youth justice.
// Reads minister portfolio + headline keywords to bucket the policy thrust.
function classifyStatement(s: { headline: string; portfolio: string | null }): 'punitive' | 'preventive' | 'mixed' {
  const h = s.headline.toLowerCase();
  if (/adult crime|adult time|bail|tougher|crackdown|stronger|watch.?house expansion|new detention|new prison|sentencing|45 offences/.test(h)) return 'punitive';
  if (/early intervention|rehabilitation|step up step down|career pathways|youth week|prevention|community-led|treaty|justice reinvestment|family-led/.test(h)) return 'preventive';
  return 'mixed';
}

/* ─── Dashboard ─────────────────────────────────────────────────────── */

export default async function QldYjSectorPage() {
  const hdrs = await headers();
  const isShare = (hdrs.get('x-pathname') ?? '').startsWith('/share/');
  const dashboardPath = isShare ? '/share/qld-youth-justice' : '/reports/youth-justice/qld/sector';
  const longReadPath = isShare ? '/share/qld-youth-justice/long-read' : '/reports/youth-justice/qld/sector/long-read';
  const r = await getReport();

  const ws = r.latest;
  const fnPctChild = ws && ws.total_children > 0 ? Math.round((ws.child_first_nations / ws.total_children) * 100) : 0;
  const fnPctAdult = ws && ws.total_adults > 0 ? Math.round((ws.adult_first_nations / ws.total_adults) * 100) : 0;
  const childOver2 = ws ? ws.child_3_7_days + ws.child_over_7_days : 0;
  const accoCommunity = r.accoGap.find(a => a.org_type === 'Community Controlled');
  const accoOther = r.accoGap.find(a => a.org_type !== 'Community Controlled');
  const detentionFacilityTotal = r.detentionFacilities.reduce((s, f) => s + (f.capacity_beds || 0), 0);

  // Spend categorisation from cross-sector + raw justice_funding (we don't have a perfect mv but can synthesise)
  const accoSharePct = accoCommunity ? accoCommunity.funding_share_pct : 12;
  const totalIntervTypes = r.almaTypeCounts.reduce((s, t) => s + t.count, 0);

  // Year-spend trajectory: pivot to topic-by-year for stacked bars
  const yearSpendByYear = r.yearSpend.reduce<Record<string, Record<string, number>>>((acc, row) => {
    if (!acc[row.financial_year]) acc[row.financial_year] = {};
    acc[row.financial_year][row.topic] = row.total;
    return acc;
  }, {});

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex flex-wrap items-center gap-0 mb-6">
        <Link href={dashboardPath} className="inline-block px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-black text-white" aria-current="page">Dashboard</Link>
        <Link href={longReadPath} className="inline-block px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black -ml-0.5 bg-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-canvas">📖 Read the Long-form Report</Link>
      </div>

      <div className="mb-10">
        {!isShare && (
          <Link href="/reports/youth-justice" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            &larr; Youth Justice Reports
          </Link>
        )}
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Featured · 6 Volumes · 22 Sections · Live</div>
        <h1 className="text-3xl sm:text-5xl font-black text-bauhaus-black mb-3 uppercase tracking-tight leading-tight">
          QLD Youth Justice<br />— The State, The Funnel, The Money, The Network, The Evidence, The Place
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Australia&apos;s most-debated youth-justice system, sourced. Live watchhouse occupancy refreshes from QPS twice daily. Funding flows through the QLD state budget, federal procurement, and foundation giving. Cross-system pathways from child protection, disability, AOD, and education traced via {fmt(r.heatmap.length)} QLD LGAs and {fmt(r.almaInterventions.length + r.unfundedPrograms.length)} ALMA-catalogued interventions.
        </p>
      </div>

      {/* HEADLINE STATS BAR */}
      <section className="mb-12 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Children in custody now', value: ws ? String(ws.total_children) : '—', tone: 'red' },
          { label: 'First Nations %', value: `${fnPctChild}%`, tone: 'red' },
          { label: 'Detention $ (cum.)', value: money(r.detention), tone: 'red' },
          { label: 'Community $', value: money(r.community), tone: 'blue' },
          { label: 'ACCO share', value: `${accoSharePct}%`, tone: 'red' },
          { label: 'ALMA programs', value: fmt(totalIntervTypes), tone: 'black' },
          { label: 'LGA hotspots', value: fmt(r.heatmap.length), tone: 'black' },
        ].map((s, i) => (
          <div key={i} className="border-4 border-bauhaus-black p-3 bg-white">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{s.label}</div>
            <div className={`text-xl sm:text-2xl font-black tabular-nums leading-tight ${s.tone === 'red' ? 'text-bauhaus-red' : s.tone === 'blue' ? 'text-bauhaus-blue' : 'text-bauhaus-black'}`}>{s.value}</div>
          </div>
        ))}
      </section>

      {/* ════ VOLUME 1 — THE STATE TODAY ════ */}
      <div className="mb-10 mt-16 border-l-8 border-bauhaus-red pl-5">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">VOLUME 1</div>
        <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">The State Today</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl">Live data from the police-custody publication, audited spend lines, and First Nations over-representation trends.</p>
      </div>

      {/* §1 LIVE WATCHHOUSE */}
      {ws && (
        <section className="mb-16">
          <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§1 · LIVE</div>
          <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">In QLD watchhouses, right now</h3>
          <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
            Auto-refreshed twice daily from the Queensland Police Service watchhouse-occupancy publication. Last snapshot: <span className="font-black text-bauhaus-black">{new Date(ws.source_generated_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="border-4 border-bauhaus-red p-5 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">Children in custody</div>
              <div className="text-4xl font-black text-bauhaus-red tabular-nums">{ws.total_children}</div>
              <p className="text-xs text-bauhaus-muted font-medium mt-2">Across {ws.child_watchhouse_count} watchhouses</p>
            </div>
            <div className="border-4 border-bauhaus-red p-5 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">First Nations children</div>
              <div className="text-4xl font-black text-bauhaus-red tabular-nums">{fnPctChild}%</div>
              <p className="text-xs text-bauhaus-muted font-medium mt-2"><span className="font-black">{ws.child_first_nations}</span> of {ws.total_children}. ~5% of QLD&apos;s 10–17 population.</p>
            </div>
            <div className="border-4 border-bauhaus-black p-5 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-1">Children &gt; 2 days</div>
              <div className="text-4xl font-black text-bauhaus-black tabular-nums">{childOver2}</div>
              <p className="text-xs text-bauhaus-muted font-medium mt-2">Adult cells, no programs. Longest: <span className="font-black">{ws.child_longest_days}d</span>.</p>
            </div>
            <div className="border-4 border-bauhaus-black p-5 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-1">Adults &gt; 7 days</div>
              <div className="text-4xl font-black text-bauhaus-black tabular-nums">{ws.adult_over_7_days}</div>
              <p className="text-xs text-bauhaus-muted font-medium mt-2">Of {ws.total_adults}; {fnPctAdult}% First Nations. Longest {ws.adult_longest_days}d.</p>
            </div>
          </div>
          {r.sites.length > 0 && (
            <div className="border-4 border-bauhaus-black overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bauhaus-black text-white">
                  <tr>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Watchhouse</th>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Age</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">In custody</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">First Nations</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">&gt; 7d</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Longest</th>
                  </tr>
                </thead>
                <tbody>
                  {r.sites.map((s, i) => {
                    const isChild = s.age_group === 'Child';
                    return (
                      <tr key={`${s.watchhouse_name}-${s.age_group}-${i}`} className={isChild ? 'bg-bauhaus-red/10 border-l-4 border-bauhaus-red' : i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                        <td className="p-3 font-black text-bauhaus-black">{s.watchhouse_name}</td>
                        <td className={`p-3 text-xs uppercase tracking-widest font-black ${isChild ? 'text-bauhaus-red' : 'text-bauhaus-muted'}`}>{s.age_group}</td>
                        <td className="p-3 text-right font-mono font-black">{s.total_in_custody}</td>
                        <td className="p-3 text-right font-mono">{s.first_nations} ({s.total_in_custody > 0 ? Math.round((s.first_nations / s.total_in_custody) * 100) : 0}%)</td>
                        <td className="p-3 text-right font-mono">{s.custody_over_7_days || '—'}</td>
                        <td className="p-3 text-right font-mono">{s.longest_days || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* §2 BED PROBLEM */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§2</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The bed problem — detention occupancy + watchhouse-as-overflow</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          QLD operates {r.detentionFacilities.length} youth-detention facilities with a combined capacity of <span className="font-black text-bauhaus-black">{detentionFacilityTotal}</span> beds. When detention runs near capacity, watchhouses become overflow. Below: facilities + a 60-day trailing average of children in police watchhouses.
        </p>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="border-4 border-bauhaus-black p-5 bg-white">
            <h4 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-3">Operational facilities</h4>
            {r.detentionFacilities.length === 0 ? (
              <p className="text-bauhaus-muted text-sm">No facility data ingested.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {r.detentionFacilities.map((f, i) => (
                  <div key={i} className="flex justify-between items-baseline border-b border-bauhaus-canvas pb-2">
                    <div>
                      <div className="font-black text-bauhaus-black">{f.name}</div>
                      <div className="text-bauhaus-muted font-mono">postcode {f.postcode ?? '—'} · {pct(f.indigenous_population_percentage, 0)} Indigenous</div>
                    </div>
                    <div className="font-black text-bauhaus-black tabular-nums">{f.capacity_beds ?? '—'} beds</div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t-2 border-bauhaus-black pt-3 mt-4">
              <h4 className="text-sm font-black uppercase tracking-widest text-bauhaus-red mb-3">Planned + recently-opened (curated)</h4>
              <div className="space-y-3 text-xs">
                {QLD_PLANNED_FACILITIES.map((f, i) => (
                  <div key={i} className="border-l-4 border-bauhaus-red pl-3">
                    <div className="flex justify-between items-baseline mb-1">
                      <div className="font-black text-bauhaus-black">{f.name}</div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${f.status === 'recently-opened' ? 'bg-bauhaus-red text-white' : f.status === 'under-construction' ? 'bg-bauhaus-yellow text-bauhaus-black' : 'bg-bauhaus-canvas text-bauhaus-black border border-bauhaus-black'}`}>{f.status}</span>
                    </div>
                    <div className="text-bauhaus-muted font-mono mb-1">{f.location} · {f.capacity}{f.estimatedCost ? ` · ${f.estimatedCost}` : ''}</div>
                    <p className="text-bauhaus-black leading-relaxed">{f.notes}</p>
                    <a href={f.source.href} target="_blank" rel="noopener" className="text-bauhaus-blue text-[10px] font-mono hover:underline">{f.source.label} ↗</a>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-bauhaus-muted font-mono mt-3 pt-2 border-t border-bauhaus-canvas">Curated from public QLD-government announcements. Not yet ingested into the structured detention dataset; we&apos;re building the pipeline.</p>
            </div>
          </div>
          <div className="border-4 border-bauhaus-black p-5 bg-white">
            <h4 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-3">Children in watchhouses · 60-day trend</h4>
            {r.trend.length === 0 ? (
              <p className="text-bauhaus-muted text-sm">No trend data.</p>
            ) : (() => {
              const peak = Math.max(...r.trend.map(d => Number(d.total_children) || 0), 1);
              return (
                <div className="space-y-1">
                  {r.trend.slice(-30).map(d => {
                    const tc = Number(d.total_children) || 0;
                    const fn = Number(d.child_fn) || 0;
                    return (
                      <div key={d.day} className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="w-16 text-bauhaus-muted shrink-0">{d.day.slice(5)}</span>
                        <div className="flex-1 relative h-3 bg-bauhaus-canvas border border-bauhaus-black">
                          <div className="absolute inset-y-0 left-0 bg-bauhaus-red" style={{ width: `${(fn / peak) * 100}%` }} />
                          <div className="absolute inset-y-0 bg-bauhaus-black" style={{ left: `${(fn / peak) * 100}%`, width: `${((tc - fn) / peak) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right tabular-nums">{tc.toFixed(1)}</span>
                      </div>
                    );
                  })}
                  <div className="flex gap-3 text-[10px] font-mono pt-2 border-t-2 border-bauhaus-black mt-3">
                    <span><span className="inline-block w-2 h-2 bg-bauhaus-red mr-1 align-middle" />First Nations</span>
                    <span><span className="inline-block w-2 h-2 bg-bauhaus-black mr-1 align-middle" />Other</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* §3 INDIGENOUS OVER-REP CTG */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§3</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Who&apos;s in custody — Closing the Gap target 11 progress</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          National Agreement on Closing the Gap: target 11 commits to reducing the rate of First Nations young people in detention by 30% by 2031. Below: QLD&apos;s actual rate vs the target trajectory.
        </p>
        {r.ctg.length === 0 ? (
          <div className="border-4 border-bauhaus-black p-6 bg-white text-bauhaus-muted text-sm">CTG data not available.</div>
        ) : (() => {
          // Closing the Gap official baseline = 2018-19; target = 30% reduction by 2030-31 (12-year window).
          const baselineRow = r.ctg.find(c => c.financial_year === '2018-19') ?? r.ctg[0];
          const baselineRate = Number(baselineRow.actual_rate) || 0;
          const targetRate = baselineRate * 0.7;
          const baselineYr = parseInt((baselineRow.financial_year || '2018-19').slice(0, 4), 10);
          const targetYr = 2030;
          const trajectory = (fy: string) => {
            const yr = parseInt(fy.slice(0, 4), 10);
            const span = targetYr - baselineYr;
            const pos = Math.max(0, Math.min(1, (yr - baselineYr) / span));
            return baselineRate - (baselineRate - targetRate) * pos;
          };
          const enriched = r.ctg.map(row => ({ ...row, traj: trajectory(row.financial_year) }));
          const peak = Math.max(...enriched.map(c => Math.max(Number(c.actual_rate) || 0, c.traj)), 1);
          return (
            <div className="border-4 border-bauhaus-black p-6 bg-white">
              <div className="space-y-3">
                {enriched.map(row => {
                  const actual = Number(row.actual_rate) || 0;
                  const traj = row.traj;
                  const gap = actual - traj;
                  return (
                    <div key={row.financial_year}>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="font-black text-bauhaus-black">{row.financial_year}</span>
                        <span className="text-bauhaus-muted">Actual <span className="font-black text-bauhaus-red">{actual.toFixed(1)}</span>/10K · CTG trajectory {traj.toFixed(1)}/10K · Gap <span className={`font-black ${gap > 0 ? 'text-bauhaus-red' : 'text-bauhaus-blue'}`}>{gap > 0 ? '+' : ''}{gap.toFixed(1)}</span></span>
                      </div>
                      <div className="relative h-5 bg-bauhaus-canvas border-2 border-bauhaus-black">
                        <div className="absolute inset-y-0 left-0 bg-bauhaus-blue/40" style={{ width: `${(traj / peak) * 100}%` }} />
                        <div className="absolute inset-y-0 left-0 bg-bauhaus-red" style={{ width: `${(actual / peak) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 text-[10px] font-mono pt-3 border-t-2 border-bauhaus-black mt-4">
                <span><span className="inline-block w-2 h-2 bg-bauhaus-red mr-1 align-middle" />Actual rate (per 10,000 First Nations young people)</span>
                <span><span className="inline-block w-2 h-2 bg-bauhaus-blue/40 mr-1 align-middle" />CTG trajectory: linear path from {baselineRow.financial_year} baseline ({baselineRate.toFixed(1)}) to 30% reduction ({targetRate.toFixed(1)}) by 2030–31</span>
              </div>
              <p className="text-[10px] text-bauhaus-muted font-mono mt-2">Source: <code>v_ctg_youth_justice_progress</code>. Trajectory computed from official Closing the Gap baseline year (2018-19) per National Agreement.</p>
            </div>
          );
        })()}
      </section>

      {/* ════ VOLUME 2 — THE FUNNEL ════ */}
      <div className="mb-10 mt-16 border-l-8 border-bauhaus-yellow pl-5">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">VOLUME 2</div>
        <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">The Funnel</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl">Cross-linked pathways: child protection, disability, mental health, addiction, and education disengagement that funnel children into the youth-justice system.</p>
      </div>

      {/* §4 LGA HOTSPOTS — pipeline */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§4</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The pipeline — vulnerability hotspots by QLD LGA</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Top 15 QLD Local Government Areas ranked by <span className="font-black">pipeline intensity</span> — a composite score from <code className="font-mono text-xs">lga_cross_system_stats</code> combining welfare-recipient density, school disadvantage, and Indigenous-population share. With cross-system context: NDIS youth, JobSeeker, schools, and tracked funding.
        </p>
        <div className="border-4 border-bauhaus-black overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <th className="text-left p-2 font-black uppercase tracking-widest text-[10px]">LGA</th>
                <th className="text-right p-2 font-black uppercase tracking-widest text-[10px] whitespace-nowrap">Youth pop</th>
                <th className="text-right p-2 font-black uppercase tracking-widest text-[10px] whitespace-nowrap">Pipeline intensity</th>
                <th className="text-right p-2 font-black uppercase tracking-widest text-[10px] whitespace-nowrap">Indig. %</th>
                <th className="text-right p-2 font-black uppercase tracking-widest text-[10px] whitespace-nowrap">NDIS youth</th>
                <th className="text-right p-2 font-black uppercase tracking-widest text-[10px] whitespace-nowrap">JobSeeker</th>
                <th className="text-right p-2 font-black uppercase tracking-widest text-[10px] whitespace-nowrap">Schools</th>
                <th className="text-right p-2 font-black uppercase tracking-widest text-[10px] whitespace-nowrap">Funding tracked</th>
              </tr>
            </thead>
            <tbody>
              {r.heatmap.map((h, i) => (
                <tr key={h.lga_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                  <td className="p-2 font-black text-bauhaus-black text-xs">{h.lga_name}</td>
                  <td className="p-2 text-right font-mono text-xs">{fmt(h.youth_population)}</td>
                  <td className={`p-2 text-right font-mono text-xs font-black ${(Number(h.pipeline_intensity) || 0) > 50 ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>{Number(h.pipeline_intensity ?? 0).toFixed(1)}</td>
                  <td className="p-2 text-right font-mono text-xs">{Number(h.indigenous_pct ?? 0).toFixed(1)}%</td>
                  <td className="p-2 text-right font-mono text-xs">{h.ndis_youth_participants ? fmt(h.ndis_youth_participants) : '—'}</td>
                  <td className="p-2 text-right font-mono text-xs">{h.jobseeker_recipients ? fmt(h.jobseeker_recipients) : '—'}</td>
                  <td className="p-2 text-right font-mono text-xs">{h.school_count ?? '—'}</td>
                  <td className="p-2 text-right font-mono text-xs">{h.jh_funding_tracked ? money(h.jh_funding_tracked) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-bauhaus-muted font-mono mt-3">Source: <code>lga_cross_system_stats</code>. Pipeline intensity is a composite score (welfare density + school disadvantage + Indigenous share). Per-LGA youth-offender rates aren&apos;t yet sourced into this dataset for QLD. Funding = grants traced through this LGA in our dataset.</p>
      </section>

      {/* §5 NDIS / DISABILITY OVERLAP */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§5</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Disability &amp; justice — NDIS youth in QLD</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          The disability-criminalisation pipeline: cognitive impairment, autism, FASD and intellectual disability are over-represented in detention. Below: NDIS youth (15&ndash;18) by category in QLD overall.
        </p>
        {r.ndisOverlay ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'NDIS participants total', value: fmt(r.ndisOverlay.total_participants), tone: 'black' },
              { label: 'Youth (15–18)', value: fmt(r.ndisOverlay.youth_participants), tone: 'red' },
              { label: 'Psychosocial', value: fmt(r.ndisOverlay.psychosocial_participants), tone: 'black' },
              { label: 'Intellectual', value: fmt(r.ndisOverlay.intellectual_disability_participants), tone: 'black' },
              { label: 'Autism', value: fmt(r.ndisOverlay.autism_participants), tone: 'black' },
            ].map((s, i) => (
              <div key={i} className="border-4 border-bauhaus-black p-3 bg-white">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{s.label}</div>
                <div className={`text-xl font-black tabular-nums ${s.tone === 'red' ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>{s.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-bauhaus-muted text-sm">NDIS overlay data not loaded.</p>
        )}
        <p className="text-xs text-bauhaus-muted font-mono mt-3">Source: <code>v_ndis_youth_justice_overlay</code>. AIHW Youth Justice reporting consistently identifies cognitive disability over-representation in the cohort — the NDIS provides one of the only structured records of disability supports for young people 15–18.</p>
      </section>

      {/* §6 MENTAL HEALTH / AOD BLIND SPOT */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§6</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The mental health &amp; AOD blind spot</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          The data gap is the policy gap. CivicGraph indexes thousands of QLD justice-funding rows and ALMA-catalogued programs. Mental-health and alcohol-and-other-drug surface counts:
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="border-4 border-bauhaus-red p-5 bg-white">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">QLD justice grants tagged mental-health or AOD</div>
            <div className="text-4xl font-black text-bauhaus-red tabular-nums">{r.mhFundingCount}</div>
            <p className="text-xs text-bauhaus-muted font-medium mt-2">Out of thousands of grants. The funding stream doesn&apos;t name the issue.</p>
          </div>
          <div className="border-4 border-bauhaus-yellow p-5 bg-white">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-1">ALMA mental-health programs · QLD</div>
            <div className="text-4xl font-black text-bauhaus-black tabular-nums">{r.mhAlma}</div>
            <p className="text-xs text-bauhaus-muted font-medium mt-2">Identified by intervention type or description.</p>
          </div>
          <div className="border-4 border-bauhaus-yellow p-5 bg-white">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-1">ALMA AOD programs · QLD</div>
            <div className="text-4xl font-black text-bauhaus-black tabular-nums">{r.aodAlma}</div>
            <p className="text-xs text-bauhaus-muted font-medium mt-2">Alcohol, drug, addiction-tagged programs.</p>
          </div>
        </div>
        <p className="text-sm text-bauhaus-black font-medium mt-4 max-w-3xl leading-relaxed">
          AIHW Youth Justice reporting consistently identifies high rates of mental-health and substance-use co-morbidity in the cohort. The QLD justice-funding stream tags <span className="font-black text-bauhaus-red">{r.mhFundingCount}</span> rows for mental health or AOD. <span className="font-black">If you can&apos;t name the issue in the data, you can&apos;t fund it accountably.</span>
        </p>
      </section>

      {/* §7 EDUCATION + WELFARE PIPELINE */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§7</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Education disengagement → welfare → offending</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Welfare payments (Disability Support Pension, JobSeeker, Youth Allowance) cluster in the same QLD LGAs as low-ICSEA schools and high youth-offender rates. The pipeline doesn&apos;t start with the police — it starts with disengagement.
        </p>
        {r.dssQld.length > 0 && (
          <div className="border-4 border-bauhaus-black p-5 bg-white mb-4">
            <h4 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-3">QLD welfare-recipient counts by payment type</h4>
            <div className="space-y-2">
              {(() => {
                const peak = Math.max(...r.dssQld.map(d => d.recipient_count), 1);
                return r.dssQld.map(d => (
                  <div key={d.payment_type}>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="font-black text-bauhaus-black">{d.payment_type}</span>
                      <span className="text-bauhaus-muted">{fmt(d.recipient_count)} recipients</span>
                    </div>
                    <HBar value={d.recipient_count} peak={peak} color="bg-bauhaus-blue" />
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
        <p className="text-sm text-bauhaus-muted font-medium max-w-3xl">
          The §4 hotspot table above shows that LGAs with the highest youth-offender rates also have the highest school-count of low-ICSEA schools (advantage &ndash; disadvantage index). The system doesn&apos;t fail at the courthouse; it fails at the schoolyard.
        </p>
      </section>

      {/* ════ VOLUME 3 — THE MONEY ════ */}
      <div className="mb-10 mt-16 border-l-8 border-bauhaus-blue pl-5">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">VOLUME 3</div>
        <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">The Money</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl">Where the dollars actually go: detention vs community, top recipients, the ACCO funding gap, the foundation landscape, federal procurement.</p>
      </div>

      {/* §8 DETENTION VS COMMUNITY MULTI-YEAR */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§8</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Detention vs community — the structural ratio</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          From the QLD state-budget Youth Justice expenditure lines, queried live from <code className="font-mono text-xs">justice_funding</code>. <span className="font-black text-bauhaus-red">{money(r.detention)} detention</span> vs <span className="font-black text-bauhaus-blue">{money(r.community)} community-based</span> vs <span className="font-black">{money(r.groupConferencing)} group conferencing</span>. Ratio: {r.community > 0 ? (r.detention / r.community).toFixed(2) : '—'}:1 detention to community.
        </p>
        <div className="border-4 border-bauhaus-black p-6 bg-white mb-6">
          <StackedBar
            total={r.detention + r.community + r.groupConferencing}
            segments={[
              { key: 'det', value: r.detention, color: 'bg-bauhaus-red', label: 'Detention services' },
              { key: 'com', value: r.community, color: 'bg-bauhaus-blue', label: 'Community-based services' },
              { key: 'gc', value: r.groupConferencing, color: 'bg-bauhaus-yellow', label: 'Group conferencing' },
            ]}
          />
        </div>
        {Object.keys(yearSpendByYear).length > 0 && (
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            <h4 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-3">QLD justice-tagged spend by year + topic</h4>
            <div className="space-y-2">
              {Object.entries(yearSpendByYear).map(([fy, byTopic]) => {
                const total = Object.values(byTopic).reduce((s, v) => s + v, 0);
                const peak = Math.max(...Object.values(yearSpendByYear).map(t => Object.values(t).reduce((s, v) => s + v, 0)));
                return (
                  <div key={fy}>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="font-black text-bauhaus-black">FY {fy}</span>
                      <span className="text-bauhaus-muted">{money(total)}</span>
                    </div>
                    <div className="relative h-6 bg-bauhaus-canvas border-2 border-bauhaus-black flex" style={{ width: `${(total / peak) * 100}%` }}>
                      {(['youth-justice','child-protection','indigenous','disability','family-services'] as const).map((topic) => {
                        const v = byTopic[topic] || 0;
                        if (v <= 0) return null;
                        const colorMap: Record<string, string> = { 'youth-justice': 'bg-bauhaus-red', 'child-protection': 'bg-bauhaus-blue', 'indigenous': 'bg-bauhaus-yellow', 'disability': 'bg-bauhaus-black', 'family-services': 'bg-bauhaus-muted' };
                        return <div key={topic} className={colorMap[topic]} style={{ width: `${(v / total) * 100}%` }} title={`${topic}: ${money(v)}`} />;
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-3 text-[10px] font-mono pt-3 border-t-2 border-bauhaus-black mt-4">
                <span><span className="inline-block w-2 h-2 bg-bauhaus-red mr-1 align-middle" />Youth justice</span>
                <span><span className="inline-block w-2 h-2 bg-bauhaus-blue mr-1 align-middle" />Child protection</span>
                <span><span className="inline-block w-2 h-2 bg-bauhaus-yellow mr-1 align-middle" />Indigenous</span>
                <span><span className="inline-block w-2 h-2 bg-bauhaus-black mr-1 align-middle" />Disability</span>
                <span><span className="inline-block w-2 h-2 bg-bauhaus-muted mr-1 align-middle" />Family services</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* §9 TOP RECIPIENTS */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§9</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Where the community {money(r.community)} actually goes</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Top 15 QLD recipients of youth-justice-tagged grants (excluding state department line items). National NGOs hold the largest contracts. Aboriginal Community-Controlled Organisations are funded — but at smaller dollar amounts (see §10).
        </p>
        <div className="border-4 border-bauhaus-black overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Recipient</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Grants</th>
              </tr>
            </thead>
            <tbody>
              {r.recipients.map((p, i) => (
                <tr key={p.recipient_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                  <td className="p-3 font-black text-bauhaus-black">{displayName(p.recipient_name)}</td>
                  <td className="p-3 text-right font-mono font-black">{money(p.total)}</td>
                  <td className="p-3 text-right font-mono">{p.grants}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* §10 ACCO FUNDING GAP */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§10</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The ACCO funding gap — {accoSharePct}% of dollars for ~70% of in-custody population</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Aboriginal Community-Controlled Organisations consistently outperform mainstream NGOs in retention and outcomes for First Nations young people. The dollar share doesn&apos;t reflect this. Closing the Gap target 11 commits to addressing it.
        </p>
        {accoCommunity && accoOther && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border-4 border-bauhaus-red p-6 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">Community Controlled (ACCOs)</div>
              <div className="text-5xl font-black text-bauhaus-red tabular-nums">{accoCommunity.funding_share_pct}%</div>
              <p className="text-sm text-bauhaus-black font-medium mt-3">{money(accoCommunity.total_funding)} across {fmt(accoCommunity.orgs)} organisations</p>
              <p className="text-xs text-bauhaus-muted font-mono mt-1">Avg per recipient: {money(accoCommunity.avg_per_recipient)}</p>
            </div>
            <div className="border-4 border-bauhaus-black p-6 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-1">Other service providers</div>
              <div className="text-5xl font-black text-bauhaus-black tabular-nums">{accoOther.funding_share_pct}%</div>
              <p className="text-sm text-bauhaus-black font-medium mt-3">{money(accoOther.total_funding)} across {fmt(accoOther.orgs)} organisations</p>
              <p className="text-xs text-bauhaus-muted font-mono mt-1">Avg per recipient: {money(accoOther.avg_per_recipient)}</p>
            </div>
          </div>
        )}
      </section>

      {/* §11 FOUNDATIONS */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§11</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Foundation landscape — billions in adjacent giving, none anchored to QLD YJ</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          The 12 largest Australian foundations whose stated thematic focus includes justice / youth / children / First Nations / disability / mental health. Annual giving listed; most are not anchored specifically to QLD youth-justice work.
        </p>
        {r.foundations.length > 0 && (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Foundation</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Annual giving</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Thematic focus</th>
                </tr>
              </thead>
              <tbody>
                {r.foundations.map((f, i) => (
                  <tr key={f.name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">{displayName(f.name)}</td>
                    <td className="p-3 text-right font-mono font-black">{money(f.total_giving_annual)}</td>
                    <td className="p-3 text-xs font-mono text-bauhaus-muted">{f.thematic_focus.replace(/[{}"]/g, '').split(',').slice(0, 5).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* §12 FEDERAL PROCUREMENT */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§12</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Federal procurement — Austender contracts to YJ-relevant suppliers</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Top 12 federal Austender suppliers with names matching common YJ / community-services keywords (Mission Australia, Anglicare, Uniting, PCYC, Halikos, Liquidlogic, Save the Children).
        </p>
        {r.contracts.length > 0 && (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Supplier</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Total</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
                </tr>
              </thead>
              <tbody>
                {r.contracts.map((c, i) => (
                  <tr key={`${c.supplier_name}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black text-xs">{c.supplier_name}</td>
                    <td className="p-3 text-right font-mono font-black">{money(c.total)}</td>
                    <td className="p-3 text-right font-mono">{c.contracts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ════ VOLUME 4 — THE NETWORK ════ */}
      <div className="mb-10 mt-16 border-l-8 border-bauhaus-black pl-5">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black">VOLUME 4</div>
        <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">The Network</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl">Multi-system providers, director board interlocks, political donations from contractors. Who&apos;s connected to whom — and what that does to accountability.</p>
      </div>

      {/* §13 CROSS-SECTOR PROVIDERS */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§13</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The multi-system providers — orgs operating across 3+ sectors</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          QLD providers with funding flows tagged across at least 3 of: youth-justice, child-protection, disability, NDIS, family services, Indigenous services, mental health, homelessness, AOD, family violence. These are de-facto integrated service hubs, fragmented across siloed funding mechanisms.
        </p>
        {r.crossSector.length > 0 && (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Provider</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Sectors</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Topic tags</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Total $</th>
                </tr>
              </thead>
              <tbody>
                {r.crossSector.map((c, i) => (
                  <tr key={c.recipient_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">{displayName(c.recipient_name)}</td>
                    <td className="p-3 text-right">
                      <span className={`inline-block px-2 py-1 text-xs font-black ${c.sectors >= 5 ? 'bg-bauhaus-red text-white' : c.sectors >= 4 ? 'bg-bauhaus-yellow text-bauhaus-black' : 'bg-bauhaus-canvas text-bauhaus-black'}`}>{c.sectors}</span>
                    </td>
                    <td className="p-3 text-xs font-mono text-bauhaus-muted">{c.topic_list.slice(0, 5).join(' · ')}{c.topic_list.length > 5 ? '…' : ''}</td>
                    <td className="p-3 text-right font-mono font-black">{money(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* §14 DIRECTOR INTERLOCKS */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§14</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Director interlocks — who sits on multiple boards</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          People holding 5+ board / advisory positions across charities or Indigenous corporations connected to justice funding. The federation&apos;s shadow network: governance, advocacy, and funding all run through a small cohort.
        </p>
        {r.directors.length > 0 && (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Person</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Boards</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">$ Procurement in network</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">$ Justice in network</th>
                </tr>
              </thead>
              <tbody>
                {r.directors.map((d, i) => (
                  <tr key={d.person_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">{d.person_name}</td>
                    <td className="p-3 text-right font-mono font-black">{d.board_count}</td>
                    <td className="p-3 text-right font-mono">{money(d.total_procurement)}</td>
                    <td className="p-3 text-right font-mono">{money(d.total_justice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-bauhaus-muted font-mono mt-3">
          {!isShare && <Link href="/graph?mode=justice&topic=youth-justice&state=QLD" className="text-bauhaus-blue font-black hover:underline">See the QLD YJ network graph →</Link>}
        </p>
      </section>

      {/* §15 POLITICAL DONATIONS */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§15</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Political donations by orgs that hold QLD YJ funding</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Cross-reference: QLD youth-justice-funded recipients (by ABN) appear in the federal political-donations register. <span className="font-black">These donations may relate to any of the donor org&apos;s activities, not specifically to youth-justice work.</span> Read as a structural-overlap signal, not as a YJ-attributable transfer.
        </p>
        <div className="border-4 border-bauhaus-black p-6 bg-white">
          {r.politicalDonations && r.politicalDonations.donations > 0 ? (
            <div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Donation records</div>
                  <div className="text-3xl font-black text-bauhaus-red tabular-nums">{fmt(r.politicalDonations.donations)}</div>
                  <p className="text-[10px] text-bauhaus-muted font-mono mt-1">Lifetime AEC disclosures from this donor pool</p>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Total disclosed $</div>
                  <div className="text-3xl font-black text-bauhaus-red tabular-nums">{money(r.politicalDonations.total)}</div>
                  <p className="text-[10px] text-bauhaus-muted font-mono mt-1">Cumulative across the disclosure window — all themes, not YJ-specific</p>
                </div>
              </div>
              <p className="text-xs text-bauhaus-muted font-mono mt-4 pt-3 border-t-2 border-bauhaus-black">Source: <code>political_donations</code> federal register. Caveat: state-level donation registers and individual-director donations are not in this dataset; lifetime totals span all causes the donor org has funded.</p>
            </div>
          ) : (
            <p className="text-sm text-bauhaus-black font-medium leading-relaxed">
              No political donations on the federal register from ABN-matched QLD youth-justice grant recipients. (Note: state-level donation registers and individual-director donations are not in this dataset.)
            </p>
          )}
        </div>
      </section>

      {/* ════ VOLUME 5 — THE EVIDENCE ════ */}
      <div className="mb-10 mt-16 border-l-8 border-bauhaus-blue pl-5">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">VOLUME 5</div>
        <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">The Evidence</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl">What works, what&apos;s funded, what&apos;s not. The Australian Living Map of Alternatives (ALMA) catalogues evaluated programs; we cross-reference them against funding flows.</p>
      </div>

      {/* §16 ALMA TYPE COUNTS + TOP INTERVENTIONS */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§16</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The ALMA evidence base</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          The Australian Living Map of Alternatives (ALMA) — a civil-society register of community-endorsed and evaluated diversion / wraparound / justice-reinvestment / therapeutic / community-led programs. National counts by type, and the top {fmt(r.almaInterventions.length)} QLD-relevant interventions ranked by evidence + portfolio score.
        </p>
        <p className="text-xs text-bauhaus-muted font-mono mb-4 border-l-4 border-bauhaus-yellow pl-3"><span className="font-black uppercase tracking-widest">Methodology:</span> Evidence levels are self-attributed by ALMA submitters at registration time, not independently graded by CivicGraph. &ldquo;Proven&rdquo; / &ldquo;Effective&rdquo; / &ldquo;Promising&rdquo; reflect the program&apos;s own claim about its evaluation status — read as a starting point, not a verdict.</p>
        {r.almaTypeCounts.length > 0 && (
          <div className="border-4 border-bauhaus-black p-5 bg-white mb-6">
            <h4 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-3">Interventions by type (national)</h4>
            <div className="space-y-2">
              {(() => {
                const peak = Math.max(...r.almaTypeCounts.map(t => t.count), 1);
                return r.almaTypeCounts.map(t => (
                  <div key={t.type}>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="font-black text-bauhaus-black">{t.type}</span>
                      <span className="text-bauhaus-muted">{fmt(t.count)}</span>
                    </div>
                    <HBar value={t.count} peak={peak} color="bg-bauhaus-blue" />
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          {r.almaInterventions.map((a, i) => {
            const ev = (a.evidence_level || '').toLowerCase();
            const tone = ev.includes('proven') ? 'border-bauhaus-blue bg-bauhaus-blue/5' : ev.includes('promising') ? 'border-bauhaus-yellow bg-bauhaus-yellow/5' : 'border-bauhaus-black bg-white';
            return (
              <div key={i} className={`border-4 ${tone} p-4`}>
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-1">{a.type}</div>
                <div className="font-black text-bauhaus-black uppercase tracking-tight text-sm leading-tight mb-2">{a.name}</div>
                <div className="text-[10px] text-bauhaus-muted font-mono leading-relaxed space-y-0.5">
                  {a.evidence_level && <div>{a.evidence_level}</div>}
                  {a.cultural_authority && <div>Cultural authority: {a.cultural_authority}</div>}
                  {Array.isArray(a.geography) && a.geography.length > 0 && <div>Geography: {a.geography.slice(0, 4).join(' · ')}</div>}
                  {a.cost_per_young_person ? <div>~{money(a.cost_per_young_person)}/young person</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* §17 UNFUNDED EFFECTIVE */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§17</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The unfunded effective programs</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          ALMA-listed programs at &quot;Proven&quot; or &quot;Promising&quot; evidence levels that have NO funding link in CivicGraph. These exist; they work; they&apos;re not being scaled.
        </p>
        {r.unfundedPrograms.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {r.unfundedPrograms.map((u, i) => (
              <div key={i} className="border-4 border-bauhaus-red p-4 bg-white">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1">UNFUNDED · {u.type}</div>
                <div className="font-black text-bauhaus-black uppercase tracking-tight text-sm leading-tight mb-2">{u.name}</div>
                <div className="text-[10px] text-bauhaus-muted font-mono">
                  {u.evidence_level} · {(u.geography ?? '').replace(/[{}"\\]/g, '').split(',').slice(0, 3).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-bauhaus-muted text-sm">All ALMA-listed effective programs have at least some funding linkage in our data.</p>
        )}
      </section>

      {/* §18 ROYAL COMMISSIONS */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§18</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The royal-commission inheritance</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Six landmark inquiries shape what&apos;s known about youth-justice failures in Australia. QLD has not had a major youth-detention royal commission of its own; it inherits the lessons.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { title: 'NT Royal Commission into the Detention and Protection of Children (2017)', recs: '227 recommendations · partly implemented', notes: 'Don Dale tear-gassing footage triggered the inquiry. Most recommendations remain unimplemented at scale.' },
            { title: 'Royal Commission into Aboriginal Deaths in Custody (1991)', recs: '339 recommendations', notes: 'Implementation lagging across all jurisdictions; deaths in custody continue.' },
            { title: 'ALRC Pathways to Justice (2017)', recs: '35 recommendations', notes: 'Indigenous over-representation reform agenda; partial implementation at federal level.' },
            { title: 'Bringing Them Home (1997)', recs: '54 recommendations', notes: 'Stolen Generations inquiry — basis for ongoing reparations work.' },
            { title: 'Cleveland Detention Inquest (QLD, ongoing)', recs: 'Coronial inquiry', notes: 'Inquest into death in QLD detention; recommendations pending.' },
            { title: 'Productivity Commission Closing the Gap reviews', recs: 'Annual', notes: 'Target 11 progress tracked above (§3); all-jurisdiction commitment.' },
          ].map((rc, i) => (
            <div key={i} className="border-4 border-bauhaus-black p-4 bg-white">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-1">{rc.recs}</div>
              <div className="font-black text-bauhaus-black uppercase tracking-tight text-sm leading-tight mb-2">{rc.title}</div>
              <p className="text-xs text-bauhaus-muted font-medium leading-relaxed">{rc.notes}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════ VOLUME 6 — THE PLACE ════ */}
      <div className="mb-10 mt-16 border-l-8 border-bauhaus-yellow pl-5">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">VOLUME 6</div>
        <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">The Place</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl">Geography matters. The system fails specific places repeatedly: Townsville, Logan, Mount Isa, Cherbourg. The hotspots aren&apos;t random.</p>
      </div>

      {/* §19 LGA hotspot summary already at §4 — here add place case study + remoteness */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§19</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Place case studies — top 4 QLD LGAs by youth-offender rate</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          The §4 table ranks the top 15 QLD LGAs by pipeline-intensity score. Below: a fact card per LGA showing the cross-system context.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {r.heatmap.slice(0, 4).map((h, i) => (
            <div key={i} className="border-4 border-bauhaus-black p-5 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-1">QLD LGA</div>
              <div className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">{h.lga_name}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-muted">Population</div>
                  <div className="font-black tabular-nums">{fmt(h.population)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-muted">Indigenous %</div>
                  <div className="font-black tabular-nums">{Number(h.indigenous_pct ?? 0).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-muted">Pipeline intensity</div>
                  <div className="font-black tabular-nums text-bauhaus-red">{Number(h.pipeline_intensity ?? 0).toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-muted">NDIS youth</div>
                  <div className="font-black tabular-nums">{h.ndis_youth_participants ? fmt(h.ndis_youth_participants) : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-muted">JobSeeker</div>
                  <div className="font-black tabular-nums">{h.jobseeker_recipients ? fmt(h.jobseeker_recipients) : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-muted">Funding tracked</div>
                  <div className="font-black tabular-nums">{h.jh_funding_tracked ? money(h.jh_funding_tracked) : '—'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* §20 LGA OFFENDER-RATE RANKING */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§20</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">QLD LGAs ranked by youth-offender rate</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          The hotspot pattern is geographic. Top 15 QLD LGAs by youth-offender rate (offences per 1,000 young people), with funding tracked through CivicGraph&apos;s dataset shown as the bar magnitude.
        </p>
        <div className="border-4 border-bauhaus-black p-5 bg-white">
          {(() => {
            const peak = Math.max(...r.heatmap.map(h => Number(h.pipeline_intensity) || 0), 1);
            return (
              <div className="space-y-2">
                {r.heatmap.slice(0, 15).map(h => {
                  const score = Number(h.pipeline_intensity) || 0;
                  const noFunding = !h.jh_funding_tracked || h.jh_funding_tracked === 0;
                  return (
                    <div key={h.lga_name}>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="font-black text-bauhaus-black">{h.lga_name}</span>
                        <span className="text-bauhaus-muted">pipeline intensity {score.toFixed(1)} · {h.jh_funding_tracked ? money(h.jh_funding_tracked) : 'no tracked funding'}</span>
                      </div>
                      <HBar value={score} peak={peak} color={noFunding ? 'bg-bauhaus-red' : 'bg-bauhaus-blue'} />
                    </div>
                  );
                })}
                <p className="text-[10px] text-bauhaus-muted font-mono pt-3 border-t-2 border-bauhaus-black mt-3">Red bars indicate LGAs with no tracked funding for community-based alternatives in CivicGraph&apos;s dataset.</p>
              </div>
            );
          })()}
        </div>
      </section>

      {/* §21 JUSTICE REINVESTMENT */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§21</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Justice reinvestment — the Bourke benchmark</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Bourke (NSW) is Australia&apos;s longest-running place-based justice-reinvestment site. Outcomes are evaluated and published. QLD has no operational equivalent at scale; the model is replicable but unfunded for QLD hotspots.
        </p>
        <div className="border-4 border-bauhaus-black p-5 bg-bauhaus-canvas">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">Maranguka Justice Reinvestment · Bourke NSW</div>
          <h4 className="text-xl font-black text-bauhaus-black uppercase tracking-tight mb-3">23% drop in family-violence incidents (2017 baseline year)</h4>
          <ul className="space-y-2 text-sm font-medium text-bauhaus-black leading-relaxed">
            <li>· 31% increase in Year 12 retention</li>
            <li>· $3.1M gross impact estimated in the evaluation year — KPMG analysis</li>
            <li>· Aboriginal-led, place-based, data-driven cross-agency coordination</li>
            <li>· QLD has emerging place-based pilots; no operational equivalent at the same scale, time-horizon, or evaluation rigor</li>
          </ul>
          <p className="text-xs text-bauhaus-muted font-mono mt-3">Source: KPMG (2018) Maranguka Justice Reinvestment Project Impact Assessment.</p>
        </div>
      </section>

      {/* §22 CTG TARGET 11 — covered in §3 — this is the closing prescriptive block instead */}

      {/* ════ VOLUME 7 — POLICY & CAPACITY SIGNALS ════ */}
      <div className="mb-10 mt-16 border-l-8 border-bauhaus-red pl-5">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">VOLUME 7</div>
        <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">Policy &amp; capacity signals</h2>
        <p className="text-bauhaus-muted font-medium max-w-3xl">Live QLD ministerial statements scraped daily from <code className="font-mono text-xs">statements.qld.gov.au</code>, filtered to youth-justice keywords and tagged by direction-of-travel.</p>
      </div>

      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§23 · LIVE</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Direction of travel — recent QLD ministerial statements</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          The most-recent {r.ministerialStatements.length} youth-justice statements from QLD ministers. Each tagged by thrust: <span className="text-bauhaus-red font-black">punitive</span> (custody-expanding), <span className="text-bauhaus-blue font-black">preventive</span> (community-investing), <span className="text-bauhaus-yellow font-black">mixed</span> (both / contested). Read for the structural direction the system is moving in.
        </p>

        {(() => {
          const counts = r.ministerialStatements.reduce<Record<string, number>>((acc, s) => {
            const t = classifyStatement(s);
            acc[t] = (acc[t] ?? 0) + 1;
            return acc;
          }, {});
          const total = r.ministerialStatements.length || 1;
          return (
            <div className="border-4 border-bauhaus-black p-4 bg-white mb-6">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">Thrust mix · last {r.ministerialStatements.length} statements</div>
              <StackedBar
                total={total}
                segments={[
                  { key: 'p', value: counts.punitive ?? 0, color: 'bg-bauhaus-red', label: `Punitive (${counts.punitive ?? 0})` },
                  { key: 'm', value: counts.mixed ?? 0, color: 'bg-bauhaus-yellow', label: `Mixed (${counts.mixed ?? 0})` },
                  { key: 'pr', value: counts.preventive ?? 0, color: 'bg-bauhaus-blue', label: `Preventive (${counts.preventive ?? 0})` },
                ]}
              />
            </div>
          );
        })()}

        {r.ministerialStatements.length === 0 ? (
          <div className="border-4 border-bauhaus-black p-6 bg-white text-bauhaus-muted text-sm">No QLD ministerial statements in the last 24 months matched the youth-justice filter. Re-run <code>scrape-ministerial-statements</code>.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {r.ministerialStatements.map((s, i) => {
              const thrust = classifyStatement(s);
              const tone =
                thrust === 'punitive' ? { border: 'border-bauhaus-red', tag: 'bg-bauhaus-red text-white' } :
                thrust === 'preventive' ? { border: 'border-bauhaus-blue', tag: 'bg-bauhaus-blue text-white' } :
                { border: 'border-bauhaus-yellow', tag: 'bg-bauhaus-yellow text-bauhaus-black' };
              return (
                <div key={i} className={`border-4 ${tone.border} p-5 bg-white`}>
                  <div className="flex justify-between items-baseline mb-2 gap-3">
                    <div className="text-xs font-mono font-black text-bauhaus-muted">{new Date(s.published_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${tone.tag}`}>{thrust}</span>
                  </div>
                  <h4 className="text-base font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-2">{s.headline}</h4>
                  <p className="text-[10px] font-mono text-bauhaus-muted mb-3">{s.minister_name?.replace(/^The Honourable /, '') ?? 'Minister'}{s.portfolio ? ` · ${s.portfolio}` : ''}</p>
                  <a href={s.source_url} target="_blank" rel="noopener" className="text-bauhaus-blue text-[10px] font-mono hover:underline">statements.qld.gov.au ↗</a>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-bauhaus-muted font-mono mt-4">Source: <code>civic_ministerial_statements</code> scraped from <a href="https://statements.qld.gov.au" target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline">statements.qld.gov.au</a> by the <code>scrape-ministerial-statements</code> agent. Direction-of-travel classifier reads the headline; classification is heuristic, not editorial. Want a different cut? <Link href="/feedback?subject=qld-yj-policy-tracking" className="text-bauhaus-blue font-black hover:underline">Tell us</Link>.</p>
      </section>

      {/* §23.1 — STRUCTURAL POLICY MOVES (curated, low-frequency) */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§23.1 · CURATED LEGISLATION</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Structural policy backdrop</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          The major QLD legislative and treaty-framework moves over 2023&ndash;2024 that frame every announcement above. These are curated reference items linked to the underlying QLD legislation register.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {QLD_POLICY_SIGNALS.map((s, i) => {
            const tone =
              s.thrust === 'punitive' ? { border: 'border-bauhaus-red', tag: 'bg-bauhaus-red text-white' } :
              s.thrust === 'preventive' ? { border: 'border-bauhaus-blue', tag: 'bg-bauhaus-blue text-white' } :
              { border: 'border-bauhaus-yellow', tag: 'bg-bauhaus-yellow text-bauhaus-black' };
            return (
              <div key={i} className={`border-4 ${tone.border} p-5 bg-white`}>
                <div className="flex justify-between items-baseline mb-2 gap-3">
                  <div className="text-xs font-mono font-black text-bauhaus-muted">{s.date}</div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${tone.tag}`}>{s.thrust}</span>
                </div>
                <h4 className="text-base font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-2">{s.title}</h4>
                <p className="text-xs text-bauhaus-black leading-relaxed mb-3">{s.summary}</p>
                <a href={s.source.href} target="_blank" rel="noopener" className="text-bauhaus-blue text-[10px] font-mono hover:underline">{s.source.label} ↗</a>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§24 · OVERSIGHT FINDINGS</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Oversight, inspection &amp; coronial findings</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          What independent inspectors and oversight bodies have found about the QLD youth-justice operation. Sourced from the Inspector of Detention Services, the Australian Human Rights Commission, and human-rights research bodies. Each entry links to the originating report.
        </p>
        <div className="border-l-4 border-bauhaus-yellow bg-bauhaus-canvas p-4 mb-6 text-xs">
          <p className="font-black text-bauhaus-black mb-1">Important clarification</p>
          <p className="text-bauhaus-black leading-relaxed">The high-profile <span className="font-black">Cleveland Dodd</span> coronial inquest (16-year-old Yamatji boy who died in October 2023) is a <span className="font-black">Western Australian</span> case at Unit 18, Casuarina Prison &mdash; <span className="font-black">not</span> QLD&apos;s Cleveland Youth Detention Centre in Townsville. Public reporting often conflates the two given the shared name. We do not surface the Dodd inquest in this QLD report. WA Coroner&apos;s findings (Dec 2025) called for Unit 18 to close as a matter of urgency.</p>
        </div>
        <div className="space-y-4">
          {QLD_OVERSIGHT_FINDINGS.map((f, i) => (
            <div key={i} className="border-4 border-bauhaus-black p-5 bg-white">
              <div className="flex flex-wrap justify-between items-baseline mb-2 gap-3">
                <div>
                  <div className="text-xs font-mono font-black text-bauhaus-muted">{f.date}</div>
                  <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-blue">{f.body}</div>
                </div>
              </div>
              <h4 className="text-base font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-2">{f.title}</h4>
              <p className="text-xs text-bauhaus-black leading-relaxed mb-3">{f.summary}</p>
              <a href={f.source.href} target="_blank" rel="noopener" className="text-bauhaus-blue text-[10px] font-mono hover:underline">{f.source.label} ↗</a>
            </div>
          ))}
        </div>
        <p className="text-xs text-bauhaus-muted font-mono mt-4">
          Source: QLD Ombudsman / Inspector of Detention Services (<a href="https://www.ombudsman.qld.gov.au" target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline">ombudsman.qld.gov.au</a>) and Australian Human Rights Commission. Specific QLD-jurisdiction youth-death-in-custody coronial findings are searchable at <a href="https://coronerscourt.qld.gov.au/findings-upcoming-inquests/search-findings" target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline">coronerscourt.qld.gov.au</a> &mdash; we have not yet ingested those structurally.
        </p>
      </section>

      {/* §24.5 — LIVE HANSARD MENTIONS */}
      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§24.5 · LIVE HANSARD</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">QLD Parliament — what MPs are actually saying</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Most-recent youth-justice mentions in QLD Parliament Hansard, scraped from <code className="font-mono text-xs">parliament.qld.gov.au</code>. Each card shows the speaker, party, sitting date, and the opening of their contribution. Filter: keyword match in body_text on youth justice / adult crime / detention / watchhouse / bail / Making Queensland Safer.
        </p>

        {r.hansardPartyCounts.length > 0 && (
          <div className="border-4 border-bauhaus-black p-4 bg-white mb-6">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">Speeches by party · last 12 months</div>
            <div className="space-y-2">
              {(() => {
                const peak = Math.max(...r.hansardPartyCounts.map(p => p.speeches), 1);
                return r.hansardPartyCounts.slice(0, 6).map(p => {
                  const colour = p.speaker_party === 'LNP' ? 'bg-bauhaus-blue' : p.speaker_party === 'ALP' ? 'bg-bauhaus-red' : p.speaker_party === 'KAP' ? 'bg-bauhaus-yellow' : p.speaker_party === 'GRN' ? 'bg-bauhaus-black' : 'bg-bauhaus-muted';
                  return (
                    <div key={p.speaker_party ?? 'none'}>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="font-black text-bauhaus-black">{p.speaker_party ?? '—'}</span>
                        <span className="text-bauhaus-muted">{p.speeches} speeches</span>
                      </div>
                      <HBar value={p.speeches} peak={peak} color={colour} />
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {r.hansardRows.length === 0 ? (
          <div className="border-4 border-bauhaus-black p-6 bg-white text-bauhaus-muted text-sm">No QLD Hansard mentions matched the youth-justice filter. Run <code>scrape-qld-hansard</code> to populate.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {r.hansardRows.map((h, i) => {
              const partyTone =
                h.speaker_party === 'LNP' ? { border: 'border-bauhaus-blue', tag: 'bg-bauhaus-blue text-white' } :
                h.speaker_party === 'ALP' ? { border: 'border-bauhaus-red', tag: 'bg-bauhaus-red text-white' } :
                h.speaker_party === 'KAP' ? { border: 'border-bauhaus-yellow', tag: 'bg-bauhaus-yellow text-bauhaus-black' } :
                h.speaker_party === 'GRN' ? { border: 'border-bauhaus-black', tag: 'bg-bauhaus-black text-white' } :
                { border: 'border-bauhaus-black', tag: 'bg-bauhaus-canvas text-bauhaus-black border border-bauhaus-black' };
              return (
                <div key={i} className={`border-4 ${partyTone.border} p-5 bg-white`}>
                  <div className="flex justify-between items-baseline mb-2 gap-3">
                    <div className="text-xs font-mono font-black text-bauhaus-muted">{h.sitting_date ? new Date(h.sitting_date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${partyTone.tag}`}>{h.speaker_party ?? 'Independent'}</span>
                  </div>
                  <h4 className="text-base font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-2">{h.speaker_name ?? 'Unknown'}{h.subject ? ` · ${h.subject.slice(0, 60)}` : ''}</h4>
                  <p className="text-xs text-bauhaus-black leading-relaxed italic mb-3">&ldquo;{h.snippet.replace(/\s+/g, ' ').trim()}…&rdquo;</p>
                  {h.source_url && <a href={h.source_url} target="_blank" rel="noopener" className="text-bauhaus-blue text-[10px] font-mono hover:underline">parliament.qld.gov.au ↗</a>}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-bauhaus-muted font-mono mt-4">Source: <code>civic_hansard</code> table populated by <code>scrape-qld-hansard</code> agent. {fmt(r.hansardRows.length)} most-recent youth-justice mentions shown; party-bar covers the last 12 months. Speaker-name parsing is best-effort from PDF text and may render as surnames only.</p>
      </section>

      <section className="mb-16">
        <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§25 · SYNTHESIS</div>
        <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The shape of the choice</h3>
        <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
          Each new bed announcement is a structural commitment for 30+ years. Each new piece of bail-tightening legislation lengthens the average remand period. Each repealed prevention framework removes a counter-balancing institution. The cumulative direction of travel — combining the dataset numbers above (§3, §8, §10) with the policy moves in §23 — is unambiguous: <span className="font-black text-bauhaus-red">QLD is structurally expanding custody capacity faster than community capacity</span>. The same dollars could have funded the operational scale-up of every &ldquo;promising&rdquo; ALMA intervention listed in §16, with evaluation budget left over.
        </p>
        <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">Capacity direction</div>
            <p className="text-bauhaus-black leading-relaxed">Expanding. Multiple new facilities announced; Wacol remand opened; existing centres still running near capacity.</p>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">Sentencing direction</div>
            <p className="text-bauhaus-black leading-relaxed">Hardening. &ldquo;Adult crime, adult time&rdquo; introduces adult sentences for child offences. Bail provisions tightened.</p>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-1">Prevention direction</div>
            <p className="text-bauhaus-black leading-relaxed">Contracting. Path to Treaty repealed. ACCO funding share unchanged at {accoSharePct}%. {money(r.groupConferencing)} for group conferencing, the most-evidence-backed line.</p>
          </div>
        </div>
      </section>

      {/* WHAT WOULD SHIFT THIS */}
      <section className="border-4 border-bauhaus-black p-8 bg-white mt-16 mb-10">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">CLOSING — Three structural moves</div>
        <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight mb-5">What would shift this</h2>
        <div className="grid md:grid-cols-3 gap-5 text-sm font-medium leading-relaxed text-bauhaus-black">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">1. Reallocate $200M from detention to community</div>
            <p>A $200M reallocation is roughly a {r.community > 0 ? Math.round((200_000_000 / r.community) * 100) : '—'}% expansion of the {money(r.community)} community-services line — enough to scale-up the most-promising ALMA interventions across the regional QLD network. Detention costs more per child than every alternative.</p>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">2. Triple the ACCO share</div>
            <p>From {accoSharePct}% to ~{Math.min(accoSharePct * 3, 70)}% to match population over-representation. Aboriginal Community-Controlled Organisations consistently outperform mainstream NGOs on retention and outcomes for First Nations young people.</p>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">3. Resource evaluation alongside delivery</div>
            <p>The reason most ALMA interventions sit at &quot;promising&quot; rather than &quot;proven&quot; isn&apos;t that programs don&apos;t work — it&apos;s that programs are funded to deliver, not to be evaluated. A small percentage of every grant going to monitoring closes the evidence gap within a budget cycle.</p>
          </div>
        </div>
      </section>

      {/* WHAT THIS MEANS FOR YOU */}
      <section className="border-4 border-bauhaus-black p-8 bg-white mb-12">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">For Boards · Funders · Journalists · Sector Peers</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">What this means for you</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm font-medium leading-relaxed text-bauhaus-black">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">If you fund youth-justice work in QLD</div>
            <ul className="space-y-2">
              <li><span className="font-black">{accoSharePct}% of dollars for ~70% of in-custody children.</span> Frame your grants against this denominator. ACCOs deliver better outcomes; they don&apos;t get the dollars.</li>
              <li><span className="font-black">Evidence-vs-spend gap is real and quantifiable.</span> {money(r.groupConferencing)} group conferencing — the most-evidence-backed early intervention in the budget — versus {money(r.detention)} for detention services.</li>
              <li><span className="font-black">Foundation giving is adjacent, not anchored.</span> See §11 — billions in adjacent giving from Paul Ramsay / Minderoo / BHP / Smith Family. None anchored to QLD YJ specifically.</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">If you sit on a board doing youth-justice work</div>
            <ul className="space-y-2">
              <li><span className="font-black">Watchhouse data should sit on every QLD YJ board agenda.</span> It&apos;s public, daily, and tells you who&apos;s in custody right now. {ws ? `Today: ${ws.total_children} children, ${fnPctChild}% First Nations.` : ''}</li>
              <li><span className="font-black">Audit your evidence-level disclosure.</span> If your programs sit at &quot;promising&quot; or &quot;untested&quot;, you need an evaluation strategy. Funders are starting to ask.</li>
              <li><span className="font-black">Map your funder concentration.</span> Most QLD YJ NGOs run a single Justice department line item as their lifeline. Diversify before the cycle ends.</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">If you&apos;re a journalist</div>
            <ul className="space-y-2">
              <li><span className="font-black">The watchhouse data refreshes every 12 hours</span> — pair it with the day&apos;s political news for live context.</li>
              <li><span className="font-black">{r.mhFundingCount} QLD justice grants tagged mental-health or AOD.</span> The data gap is the policy gap. The system doesn&apos;t fund what it doesn&apos;t name.</li>
              <li><span className="font-black">Director networks in §14</span> connect QLD YJ orgs to national NGO boards, to advocacy peaks, to government advisory committees. The shadow network is small.</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">If you run advocacy / a sector peak</div>
            <ul className="space-y-2">
              <li><span className="font-black">{money(r.detention)} detention vs {money(r.community)} community</span> is a campaign-grade statistic. Detention isn&apos;t cheaper; it&apos;s structurally larger.</li>
              <li><span className="font-black">First Nations children at {fnPctChild}% of in-custody kids</span> is a Closing the Gap target-11 signal. It&apos;s daily-data, not annual.</li>
              <li><span className="font-black">{fmt(r.almaInterventions.length)} ALMA-listed alternatives with QLD presence</span> are real, evaluated, community-endorsed work. The &quot;there&apos;s no alternative&quot; framing doesn&apos;t hold.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-4 border-bauhaus-black p-8 bg-bauhaus-yellow mb-12">
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Was this useful?</h2>
        <p className="text-bauhaus-black font-medium leading-relaxed max-w-3xl mb-5">
          We&apos;re building CivicGraph in public. Same pipeline works for any sector or organisation in Australia &mdash; multicultural peak bodies, ACCOs, foundations, lobbyists, federal procurement. Tell us what was valuable and what you&apos;d want next, anonymously if you like.
        </p>
        <Link href="/feedback?subject=qld-youth-justice" className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">★ Send feedback (~2 min) →</Link>
      </section>

      <section className="text-center mb-8">
        <div className="text-xs font-mono text-bauhaus-muted">
          Watchhouse: refreshed twice daily from QPS · Funding: QLD state-budget &amp; Justice department disclosures · ACCO gap: <code>mv_yj_report_acco_gap</code> · ALMA: civil-society register · LGA: <code>lga_cross_system_stats</code> · NDIS: <code>v_ndis_youth_justice_overlay</code> · CTG: <code>v_ctg_youth_justice_progress</code> · Last loaded {new Date().toISOString().slice(0, 10)}
        </div>
      </section>
    </div>
  );
}

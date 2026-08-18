import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import { DetailDrawer, DrawerSection, DrawerKeyValue } from '@/components/reports/DetailDrawer';
import { summarizeMinisterialStatement, summarizeHansardSpeech, summarizeCoronerFinding } from '@/lib/civicgraph-summary';
import { QLD_YJ_DRILLDOWN_RECIPIENTS } from '@/lib/services/qld-yj-recipient';

// Lookup: recipient_name → drill-down slug (for §9 "Detail →" column).
const QLD_YJ_RECIPIENT_SLUG_BY_NAME: Record<string, string> = Object.fromEntries(
  QLD_YJ_DRILLDOWN_RECIPIENTS.map(r => [r.recipient_name, r.slug])
);

export const dynamic = 'force-dynamic';
export const metadata = {
 title: 'QLD Youth Justice, Sector Deep Dive · CivicGraph',
 description: "Six volumes. 22 sections. Every dollar traced. Live watchhouse data refreshed twice daily, cross-system pathways from child protection through disability and AOD, ACCO funding gap, foundation landscape, director networks, and place-based hotspots, all sourced.",
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

/* ─── Curated bill-detail content (for §24.7 drawer body) ────────────────
 * Match keys are bill_name strings in parliament_bills. When a bill in the
 * live register matches a key here, the drawer shows the curated key
 * amendments + opposition voices + source citations alongside the live
 * status timeline. Drives the "what this bill actually changed" depth
 * the live register doesn't structurally store.
 */
type BillDetail = {
 keyAmendments: string[];
 impactSummary: string;
 opposition: Array<{ who: string; quote: string; sourceUrl?: string }>;
 implementingDept?: string;
 capitalBacking?: string[];
 outcomeProxies?: string[];
};

const BILL_DETAILS: Record<string, BillDetail> = {
 'Making Queensland Safer Bill 2024': {
 keyAmendments: [
 'Removed the "detention as a last resort" principle from the Youth Justice Act 1992, reversing the foundational sentencing principle that distinguished youth from adult criminal law since 1992.',
 'Introduced "adult crime, adult time": children charged with 13 listed offences (murder, manslaughter, robbery, dangerous operation of a vehicle, and others) face the same maximum, mandatory and minimum penalties as adults.',
 'Restorative justice removed as a sentencing option for those 13 offences.',
 'Act No. 54 of 2024, assented 13 December 2024.',
 ],
 impactSummary: 'The most-significant single piece of youth-justice legislation Queensland has passed in the past decade. Reverses 30+ years of sentencing principle for children. UN, AHRC, and QLD HRC all publicly opposed.',
 opposition: [
 { who: 'Prof. Ann Skelton, Chair UN Committee on the Rights of the Child', quote: 'A flagrant disregard of children\'s rights and a clear breach of Australia\'s international obligations.', sourceUrl: 'https://www.sbs.com.au/nitv/article/human-rights-leaders-take-concerns-about-kids-to-un/blbhrif2a' },
 { who: 'National Children\'s Commissioner', quote: 'Public criticism of QLD\'s reforms as breaching international child-rights obligations.', sourceUrl: 'https://humanrights.gov.au/about/news/media-releases/national-childrens-commissioner-slams-shocking-new-qld-youth-justice-laws' },
 { who: 'Queensland Human Rights Commission', quote: 'Formally opposed the Bill in its parliamentary submission.', sourceUrl: 'https://documents.parliament.qld.gov.au/com/JICSC-CD82/MQSACATAB2-9E30/submissions/00000036.pdf' },
 ],
 implementingDept: 'QLD Department of Youth Justice',
 capitalBacking: ['Wacol Youth Remand $250M+ build, $150M ops first 3 yrs', 'Woodford Youth Detention up to $627.61M (industry-tracker)', 'Cairns Youth Detention 40 beds, planned 2027'],
 outcomeProxies: ['Live watchhouse children today, with First Nations share above the population baseline of ~5%', 'CTG gap from trajectory: +8.0/10K (2023-24, widening)', 'ACCO funding share unchanged at 12%'],
 },
 'Making Queensland Safer (Adult Crime, Adult Time) Amendment Bill 2025': {
 keyAmendments: [
 'Refinements to the 2024 Act\'s 13-offence list and procedural amendments to the operational provisions.',
 'Sets the schema for the further expansion in the 2026 Bill (which adds ~20 more offences).',
 ],
 impactSummary: 'Operational follow-up to the 2024 Making QLD Safer Act. Tightens the procedural framework for "adult crime, adult time" sentencing.',
 opposition: [
 { who: 'UN Special Rapporteurs', quote: 'Wrote to Australian authorities (May 2025) expressing concern about the trajectory.', sourceUrl: 'https://www.ohchr.org/en/media-advisories/2025/05/youth-justice-systems-across-australia-crisis-un-experts' },
 ],
 implementingDept: 'QLD Department of Youth Justice',
 },
 'Expanding Adult Crime, Adult Time and Taking a Strong Stance on Drugs and Anti-Social Behaviour Amendment Bill 2026': {
 keyAmendments: [
 'Expanded the adult-crime-adult-time offence list by ~20 further offences: arson, attempted murder, torture, rape, attempted rape, attempted robbery, trafficking in dangerous drugs, and others.',
 'Combined "Adult Crime, Adult Time" expansion with anti-social behaviour and drug-trafficking provisions in a single Bill.',
 'Sponsored by Minister for Youth Justice and Victim Support Laura Gerber.',
 ],
 impactSummary: 'Doubles the scope of the 2024 framework. Brings the listed offence count to ~33-45 (depending on counting method).',
 opposition: [
 { who: 'Member for Maiwar (Greens)', quote: 'Yes, the title of the bill alone sounds absurd, but it has nothing on the actual contents of this bill. This bill and this government are…', sourceUrl: 'https://www.parliament.qld.gov.au' },
 { who: 'UN Special Rapporteurs Edwards (torture) + Barume (Indigenous peoples)', quote: 'Wrote to Australian authorities expressing concern about the further expansion.', sourceUrl: 'https://www.ohchr.org/en/media-advisories/2025/05/youth-justice-systems-across-australia-crisis-un-experts' },
 ],
 implementingDept: 'QLD Department of Youth Justice',
 },
 'Youth Justice (Electronic Monitoring) Amendment Bill 2025': {
 keyAmendments: [
 'Expanded electronic monitoring of high-risk youth on bail to Toowoomba, Mt Isa and Cairns regional areas.',
 'Removed the requirement for police to consider alternatives to arrest for bail-condition breaches by children.',
 ],
 impactSummary: 'Operational expansion of bail-monitoring tools. Increases remand population in regional QLD as monitoring infrastructure rolls out.',
 opposition: [],
 implementingDept: 'QLD Department of Youth Justice',
 },
 'Youth Justice (Monitoring Devices) Amendment Bill 2025': {
 keyAmendments: [
 'Authorised use of monitoring devices on young offenders subject to specific bail conditions.',
 'Sets technical schema for the Electronic Monitoring expansion later in 2025.',
 ],
 impactSummary: 'Technical / procedural enabling Act for expanded electronic-monitoring program.',
 opposition: [],
 implementingDept: 'QLD Department of Youth Justice',
 },
 'Criminal Code (Defence of Dwellings and Other Premises,Castle Law) Amendment Bill 2026': {
 keyAmendments: [
 'Strengthens the defence available to a person who uses force to defend their dwelling, colloquially referred to as "Castle Law".',
 'Private member\'s Bill from Mr Robbie Katter MP (KAP).',
 ],
 impactSummary: 'Narrowly focused on adult home-defence law, surfaces in YJ debate as part of the broader "tough on crime" framing of 2026.',
 opposition: [],
 },
};

/* ─── Curated reference data ─────────────────────────────────────────────
 *
 * These items are NOT in the structured dataset yet, they are publicly-
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

type ProgrammeStatus =
 | 'announced-only' // said, no bill, no funding visible
 | 'announced-funded' // statement + $ in justice_funding
 | 'bill-passed' // legislation assented
 | 'bill-pending' // before Parliament, not passed
 | 'operational' // funded + delivering
 | 'under-construction' // capital project in build
 | 'recently-opened' // capital project opened
 | 'repealed'; // was law, now reversed

type ProgrammeRegistryItem = {
 name: string;
 category: 'legislation' | 'facility' | 'community-program' | 'repeal' | 'capital';
 status: ProgrammeStatus;
 direction: 'custody' | 'community' | 'mixed';
 announcement: { date: string; minister: string; source_url: string; headline: string } | null;
 bill: { name: string; status: string; status_date: string | null; source_url: string } | null;
 funding_match: { description: string; program_name_pattern?: string; recipient_pattern?: string } | null;
 capital_cost: string | null;
 delivery_notes: string;
 circuit_breaker: string; // What's blocking this from landing, the leverage point.
};

const QLD_PROGRAMME_REGISTRY: ProgrammeRegistryItem[] = [
 // ─── CUSTODY-EXPANDING LEGISLATION (passed) ──────────────────────────
 {
 name: 'Making Queensland Safer Bill 2024, "Adult Crime, Adult Time" Act',
 category: 'legislation',
 status: 'bill-passed',
 direction: 'custody',
 announcement: { date: '2024-11-28', minister: 'Hon D Crisafulli MP', source_url: 'https://statements.qld.gov.au/', headline: 'Making Queensland Safer, adult crime, adult time' },
 bill: { name: 'Making Queensland Safer Bill 2024', status: 'PASSED', status_date: '2024-12-12', source_url: 'https://www.legislation.qld.gov.au/view/html/asmade/act-2024-054' },
 funding_match: null,
 capital_cost: null,
 delivery_notes: 'Removed "detention as last resort" principle from Youth Justice Act. 13 listed offences carry adult sentencing exposure for children. UN CRC chair Ann Skelton called it "flagrant disregard of children\'s rights".',
 circuit_breaker: 'Reinstate "detention as last resort." A custody-expanding Bill that passes without a parallel community-services appropriation in the same package locks in a one-way ratchet. The legislative pattern itself is the circuit, break it by requiring matching community capacity in every YJ Bill.',
 },
 {
 name: '"Adult Crime, Adult Time" expansion 2025',
 category: 'legislation',
 status: 'bill-passed',
 direction: 'custody',
 announcement: { date: '2026-03-01', minister: 'Hon D Crisafulli MP', source_url: 'https://statements.qld.gov.au/', headline: 'Adult Crime, Adult Time expands to 45 offences' },
 bill: { name: 'Making Queensland Safer (Adult Crime, Adult Time) Amendment Bill 2025', status: 'PASSED', status_date: '2025-05-21', source_url: 'https://documents.parliament.qld.gov.au/bills/2025/3247/Making-Queensland-Safer-(Adult-Crime,-Adult-Time)-Amendment-Bill-2025-6fee.pdf' },
 funding_match: null,
 capital_cost: null,
 delivery_notes: 'Added ~20 further offences to the adult-sentencing list including arson, attempted murder, torture, rape. UN Special Rapporteurs wrote to Australian authorities expressing concern.',
 circuit_breaker: 'External standard: UN Special Rapporteurs and the National Children\'s Commissioner have written publicly. The legislative direction is heading away from international child-rights compliance. The circuit-breaker is a federal Treaty / National Children\'s Commissioner finding that names QLD\'s legislative trajectory non-compliant, not a state-level negotiation.',
 },
 {
 name: 'Expanding Adult Crime, Adult Time + Drugs Bill 2026',
 category: 'legislation',
 status: 'bill-passed',
 direction: 'custody',
 announcement: { date: '2026-04-22', minister: 'Hon L Gerber MP', source_url: 'https://statements.qld.gov.au/', headline: 'Statewide police crackdown targets youth crime crisis' },
 bill: { name: 'Expanding Adult Crime, Adult Time and Taking a Strong Stance on Drugs and Anti-Social Behaviour Amendment Bill 2026', status: 'PASSED with amendment', status_date: '2026-04-23', source_url: 'https://documents.parliament.qld.gov.au/bills/2026/4277/' },
 funding_match: null,
 capital_cost: null,
 delivery_notes: 'Most-recent expansion. Three components: more adult-time offences, drug penalties, anti-social behaviour. Greens (Berkman) opposed.',
 circuit_breaker: 'A second LNP MP, a coronial finding, or a public-service walkout. The legislative floor of opposition voices is one Greens vote (Berkman). For this trajectory to break, opposition needs to come from inside the LNP party room, usually triggered by a coronial event or a federal compliance finding.',
 },
 {
 name: 'Stronger youth bail monitoring',
 category: 'legislation',
 status: 'bill-passed',
 direction: 'custody',
 announcement: { date: '2025-12-10', minister: 'Hon L Gerber MP', source_url: 'https://statements.qld.gov.au/', headline: 'Stronger youth bail monitoring laws to make Queensland safer' },
 bill: { name: 'Youth Justice (Electronic Monitoring) Amendment Bill 2025', status: 'PASSED', status_date: '2026-02-12', source_url: 'https://documents.parliament.qld.gov.au/bills/2025/4270/' },
 funding_match: null,
 capital_cost: null,
 delivery_notes: 'Two related bills passed within 60 days. Electronic monitoring expanded to Toowoomba, Mt Isa, Cairns. Police no longer required to consider alternatives to arrest for breaches. Predictable knock-on: more children on remand, more watchhouse-as-overflow.',
 circuit_breaker: 'Bail-support funding indexed to the bail-tightening population. Tightening bail without scaling community-bed capacity moves children from community to remand. The fix is a hard appropriation rule: every additional child on monitored bail = N hours of paid wraparound + 1 family-conferencing slot.',
 },
 {
 name: 'Youth Justice Monitoring Devices Act',
 category: 'legislation',
 status: 'bill-passed',
 direction: 'custody',
 announcement: { date: '2025-02-20', minister: 'Hon L Gerber MP', source_url: 'https://statements.qld.gov.au/', headline: 'Youth bail monitoring devices to restore community safety' },
 bill: { name: 'Youth Justice (Monitoring Devices) Amendment Bill 2025', status: 'PASSED', status_date: '2025-04-02', source_url: 'https://documents.parliament.qld.gov.au/bills/2025/' },
 funding_match: null,
 capital_cost: null,
 delivery_notes: 'Companion to the Electronic Monitoring Bill. Operational rollout via DYJ + monitoring-device contractor.',
 circuit_breaker: 'Independent evaluation of monitoring outcomes. Devices are procurement; "does it reduce reoffending" is unresearched in QLD\'s rollout. The fix is a sunset clause requiring published evaluation data before any further roll-out is funded.',
 },

 // ─── BILLS PENDING ──────────────────────────────────────────────────
 {
 name: 'Castle Law Amendment Bill 2026',
 category: 'legislation',
 status: 'bill-pending',
 direction: 'mixed',
 announcement: { date: '2026-03-04', minister: 'Mr R Katter MP (KAP)', source_url: 'https://statements.qld.gov.au/', headline: 'Castle Law Amendment introduced' },
 bill: { name: 'Criminal Code (Defence of Dwellings and Other Premises,Castle Law) Amendment Bill 2026', status: 'Referred to Committee', status_date: '2026-03-04', source_url: 'https://www.parliament.qld.gov.au/Work-of-the-Assembly/Bills-and-Legislation/' },
 funding_match: null,
 capital_cost: null,
 delivery_notes: 'KAP private bill on home-defence. Surfaces in YJ debate by association rather than direct YJ effect.',
 circuit_breaker: 'Not a YJ-leverage point. Listed for transparency about what surfaces in YJ debate by association.',
 },

 // ─── CAPITAL EXPANSION (custody side) ───────────────────────────────
 {
 name: 'Wacol Youth Remand Centre',
 category: 'facility',
 status: 'recently-opened',
 direction: 'custody',
 announcement: { date: '2023-09-21', minister: 'Palaszczuk Labor Government', source_url: 'https://statements.qld.gov.au/', headline: 'Wacol Youth Remand Centre announcement' },
 bill: null,
 funding_match: null,
 capital_cost: '$250M+ build · ~$150M ops first 3 years',
 delivery_notes: '76 beds, remand-only. Opened early 2025 under Crisafulli LNP. Reduces watchhouse overflow but adds detention capacity rather than community alternatives.',
 circuit_breaker: 'Already built. The leverage now is operational: how the beds are used (remand vs sentenced), what wraparound services are colocated, whether ACCO programs are commissioned to deliver inside. Each opened bed without an ACCO partnership is a 30-year lock-in.',
 },
 {
 name: 'Woodford Youth Detention Centre',
 category: 'facility',
 status: 'under-construction',
 direction: 'custody',
 announcement: { date: '2024-02-01', minister: 'Palaszczuk Labor Government (sod-turn)', source_url: 'https://statements.qld.gov.au/', headline: 'Woodford Youth Detention Centre construction begins' },
 bill: null,
 funding_match: null,
 capital_cost: 'Up to $627.61M reported (industry tracker)',
 delivery_notes: '80 beds, north of Brisbane. BESIX Watpac (QLD) lead contractor. Completion target 2026. Project continues under Crisafulli LNP.',
 circuit_breaker: 'A capital-budget freeze before commissioning. Operational appropriation is decided in the Budget that turns construction into operations, typically 12 months pre-opening. That window is the public-finance leverage point.',
 },
 {
 name: 'Cairns Youth Detention Centre',
 category: 'facility',
 status: 'announced-only',
 direction: 'custody',
 announcement: { date: '2024-01-01', minister: 'Palaszczuk Labor Government', source_url: 'https://statements.qld.gov.au/', headline: 'Cairns Youth Detention Centre announced' },
 bill: null,
 funding_match: null,
 capital_cost: 'TBD',
 delivery_notes: '40 beds, Far North Queensland. Site selection through 2024. Forecast operational 2027. With Woodford + Wacol = +120 beds added to QLD detention capacity.',
 circuit_breaker: 'Pre-construction. The most leverageable item in this registry. Cancel the build, redirect ~$200M to FNQ ACCO + community-bed capacity, and the regional disengagement-pipeline (§7 hotspots: Mareeba, Tablelands, Cairns 13 low-ICSEA schools) gets the closest thing to a place-based justice-reinvestment allocation in QLD\'s history.',
 },

 // ─── COMMUNITY-SIDE (announced + funded) ────────────────────────────
 {
 name: 'Circuit Breaker Sentencing, court-ordered intensive rehab',
 category: 'community-program',
 status: 'announced-funded',
 direction: 'community',
 announcement: { date: '2025-06-01', minister: 'Hon L Gerber MP', source_url: 'https://statements.qld.gov.au/', headline: 'Circuit Breaker Sentencing, intensive rehabilitation as alternative to detention' },
 bill: null,
 funding_match: { description: 'Circuit Breaker Sentencing in justice_funding ($20M FY25-26 · $80M over 4 yrs to DYJ)', program_name_pattern: 'Circuit Breaker Sentencing' },
 capital_cost: '$80M over 4 years · two remote facilities (North + South QLD) · capacity up to 60 youth offenders',
 delivery_notes: 'Court-ordered intensive youth rehabilitation as alternative to detention. Two remote facilities (North and South QLD), capacity up to 60 youth offenders. Delivery commencing 2026. The largest single named "alternative to detention" appropriation in the registry, but with a sentencing-court gateway and remote-facility delivery model, sits between custody and community.',
 circuit_breaker: 'Where it gets delivered. Remote-facility models (i.e., bush camps) have a mixed evidence base. ACCO governance + local-area culturally-grounded design is the difference between this becoming a real alternative to detention and becoming a softer-skinned custodial line. The $80M is the right scale; the delivery design is the unresolved leverage point.',
 },
 {
 name: 'Tribe of Mentors, Circuit Breaker Project',
 category: 'community-program',
 status: 'operational',
 direction: 'community',
 announcement: null,
 bill: null,
 funding_match: { description: 'Tribe of Mentors - Circuit Breaker Project ($142K to Adapt Mentorship, FY22-23)', program_name_pattern: 'Tribe of Mentors' },
 capital_cost: null,
 delivery_notes: 'Intensive 30-week immediate response for re-offending young people. Includes 7-month cultural project providing cultural mentoring and connection to First Nations community. Funded program in justice_funding, small but explicitly culturally-grounded.',
 circuit_breaker: 'Scale + duration. $142K for 30-week intensive cultural mentoring is one cohort. The fix is multi-year contracting and geographic expansion, this is exactly the kind of program §17 (unfunded effective programs) is asking the system to scale.',
 },
 {
 name: 'Townsville Youth Step Up Step Down (mental health)',
 category: 'facility',
 status: 'announced-funded',
 direction: 'community',
 announcement: { date: '2026-02-04', minister: 'Hon T Nicholls MP (Health)', source_url: 'https://statements.qld.gov.au/statements/104434', headline: 'New Townsville Youth Step Up Step Down facility site confirmed' },
 bill: null,
 funding_match: { description: 'Mental Health Levy (hypothecated), separate funding stream from Youth Justice budget', program_name_pattern: 'mental health' },
 capital_cost: 'TBD',
 delivery_notes: 'Short-stay residential MH beds, intermediate between community and inpatient. Funded through MH levy, NOT Youth Justice budget, invisible from a justice-funding search. The most-tangible preventive announcement of the past 12 months. Site selected; build timeline TBD.',
 circuit_breaker: 'Cross-stream tagging. The fix is administrative: every MH-levy / NDIS / Health appropriation that serves YJ-cohort youth gets a cross-tag so it surfaces from a justice-funding search. Until that tagging exists, "no MH funding for YJ youth" remains the apparent answer to anyone querying the justice stream, even when the funding exists.',
 },
 {
 name: 'Kickstart Early Intervention, multi-region rollout',
 category: 'community-program',
 status: 'announced-funded',
 direction: 'community',
 announcement: { date: '2026-04-01', minister: 'Hon L Gerber MP', source_url: 'https://statements.qld.gov.au/statements/104827', headline: 'Kickstarting new early intervention programs to restore safety to Wide Bay' },
 bill: null,
 funding_match: { description: 'Kickstarter Grants line in justice_funding ($3.8M, 12 recipients)', program_name_pattern: 'Kickstarter Grants' },
 capital_cost: null,
 delivery_notes: 'Branded as "Kickstart" / "Kickstarter Grants" across Brisbane (Mar 2026), Toowoomba (Mar 2026), Cairns (Jan 2026), Wide Bay (Apr 2026), Far North QLD, Moreton Bay, Central QLD, Wide Bay-Burnett. Multiple announcements over 6 months. ~$3.8M total funded across 12 recipients in dataset.',
 circuit_breaker: 'Scale. $3.8M against $1.88B detention is symbolic. The fix is a 100× expansion (~$380M) and a multi-year contracting cycle so providers can hire and retain staff. At current scale, Kickstart is a press-release vehicle, not a system-shift program.',
 },
 {
 name: 'Bail Support Service / Bail Support Program',
 category: 'community-program',
 status: 'operational',
 direction: 'community',
 announcement: null,
 bill: null,
 funding_match: { description: 'Bail Support Service ($16.7M / 26 recipients) + Bail Support Program ($10.7M / 15 recipients)', program_name_pattern: 'Bail Support' },
 capital_cost: null,
 delivery_notes: 'Long-running line, pre-dates current government. Continues under contract. Tightening of bail laws (above) increases the population this program is meant to support without proportionate funding increase.',
 circuit_breaker: 'Multi-year contracts. ACCOs and small community providers can\'t scale on 12-month contract cycles. The fix: minimum 4-year contracts for all bail-support providers, with cost-of-living indexation, so staffing decisions can be made beyond a single budget cycle.',
 },
 {
 name: 'Young Offender Support Service',
 category: 'community-program',
 status: 'operational',
 direction: 'community',
 announcement: null,
 bill: null,
 funding_match: { description: 'Young Offender Support Service ($24.2M / 43 recipients) in justice_funding', program_name_pattern: 'Young Offender Support Service' },
 capital_cost: null,
 delivery_notes: 'Recurrent community-supervision support. 43 funded recipients across 2014-15 to 2024-25.',
 circuit_breaker: 'ACCO retention (§10), provider continuity has fallen from 100% to ~25%. The fix is a procurement reform: lengthen contracts, prefer ACCO-led delivery, and protect retention as a measured KPI alongside the spend.',
 },
 {
 name: 'Youth Justice Family Led Decision Making trial',
 category: 'community-program',
 status: 'operational',
 direction: 'community',
 announcement: null,
 bill: null,
 funding_match: { description: 'Family Led Decision Making trial ($2.0M / 5 recipients)', program_name_pattern: 'Family Led Decision Making' },
 capital_cost: null,
 delivery_notes: 'Aligns with "Youth Justice family-led decision making" intervention in ALMA, graded Effective. Funded but not scaled; one of the smaller programs in the registry.',
 circuit_breaker: 'Geographic scaling. The trial is real and the evidence in ALMA grades it Effective. The fix is to scale from 5 recipients to every QLD region with hotspot LGAs (§4), particularly Lockyer Valley, Mareeba, Tablelands, Cairns. The evidence is in. The capital is the constraint.',
 },
 {
 name: 'Youth Criminal Rehabilitation Programs (Wide Bay-Burnett, SE QLD)',
 category: 'community-program',
 status: 'announced-only',
 direction: 'community',
 announcement: { date: '2025-12-05', minister: 'Hon L Gerber MP', source_url: 'https://statements.qld.gov.au/statements/104094', headline: 'New youth criminal rehabilitation program making Wide Bay-Burnett safer' },
 bill: null,
 funding_match: null,
 capital_cost: null,
 delivery_notes: 'Multiple regional rehabilitation announcements (Wide Bay-Burnett 5 Dec 2025, SE QLD 20 Nov 2025). No matched line in justice_funding for these specific announcements yet, possibly delivered via existing community-services contracts.',
 circuit_breaker: 'Disclosure. Either (a) the appropriation exists under a generic line ("Social Services" / "Young People") and needs to be tagged, or (b) the announcement was unfunded press. A FOI on Treasury Cabinet submissions for these specific announcements would resolve the ambiguity.',
 },

 // ─── REPEAL (institutional removal) ─────────────────────────────────
 {
 name: 'Path to Treaty Act',
 category: 'repeal',
 status: 'repealed',
 direction: 'community',
 announcement: { date: '2024-11-28', minister: 'Crisafulli LNP Government (first sitting day)', source_url: 'https://statements.qld.gov.au/', headline: 'Path to Treaty Act repealed' },
 bill: { name: 'Repeal bundled into Brisbane Olympic Games Act amendment', status: 'PASSED', status_date: '2024-11-28', source_url: 'https://www.parliament.qld.gov.au/' },
 funding_match: null,
 capital_cost: null,
 delivery_notes: 'Removed institutional architecture (First Nations Treaty Institute + Truth-telling Inquiry) that explicitly addressed YJ over-representation. QAIHC and Indigenous health peaks publicly opposed. No replacement architecture announced.',
 circuit_breaker: 'Federal action or state-government turnover. The repeal happened on the LNP\'s first sitting day; reversal at state level requires the same political moment in the other direction. Federally, the Voice / Treaty / Truth conversation continues, federal architecture would partially fill the gap.',
 },
 {
 name: 'QLD Human Rights Act override (2nd time)',
 category: 'legislation',
 status: 'bill-passed',
 direction: 'custody',
 announcement: { date: '2023-08-25', minister: 'Hon Mark Ryan MP (Police)', source_url: 'https://statements.qld.gov.au/', headline: 'Children-in-adult-watchhouses authorisation' },
 bill: { name: 'Child Protection (Offender Reporting and Offender Prohibition Order) and Other Legislation Amendment Act 2023', status: 'PASSED', status_date: '2023-08-25', source_url: 'https://www.legislation.qld.gov.au/' },
 funding_match: null,
 capital_cost: null,
 delivery_notes: 'Overrode QLD HR Act for the second time; explicitly authorised holding children in adult watchhouses. Originally framed as temporary until 31 Dec 2026.',
 circuit_breaker: 'The 31 December 2026 sunset. The override was framed as temporary. Whether it expires, is renewed, or is made permanent is the single most-leveragable structural decision in this registry. Public pressure between now and end-2026 is the window. Once permanent, the architecture loses meaningful HR-Act protection for children.',
 },
];

const QLD_PLANNED_FACILITIES: PlannedFacility[] = [
 {
 name: 'Wacol Youth Remand Centre',
 status: 'recently-opened',
 capacity: '76 beds (remand-only)',
 location: 'Wacol, Brisbane',
 estimatedCost: '$250M+ construction · ~$150M first three years operations',
 source: { label: 'QLD Government statement (Sep 2023)', href: 'https://statements.qld.gov.au/statements/98865' },
 notes: 'Announced 21 Sep 2023 (Palaszczuk Labor Government). Officially opened and began transferring young people in early 2025 under the Crisafulli LNP Government. Operates remand-only, reduces watchhouse overflow but adds detention capacity rather than community alternatives.',
 },
 {
 name: 'Woodford Youth Detention Centre',
 status: 'under-construction',
 capacity: '80 beds (planned)',
 location: 'Woodford (north of Brisbane)',
 estimatedCost: 'up to $627.61M reported (industry tracker)',
 source: { label: 'QLD Department of Youth Justice, Woodford', href: 'https://youthjustice.qld.gov.au/our-department/strategies-reform/new-youth-detention-centres/woodford' },
 notes: 'Sod turned February 2024 (Palaszczuk Labor); BESIX Watpac (QLD) Pty Ltd appointed as lead contractor. Project continues under the Crisafulli LNP Government. Completion target 2026.',
 },
 {
 name: 'Cairns Youth Detention Centre',
 status: 'announced',
 capacity: '40 beds (planned)',
 location: 'Far North Queensland',
 estimatedCost: 'TBD',
 source: { label: 'QLD Department of Youth Justice, Cairns', href: 'https://youthjustice.qld.gov.au/our-department/strategies-reform/new-youth-detention-centres/cairns' },
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
 title: 'Strengthening Community Safety Act 2023, first override of QLD Human Rights Act',
 thrust: 'punitive',
 summary: 'Reinstated the breach-of-bail offence for children. Overrode Queensland\'s own Human Rights Act 2019, the first such override since the Act commenced. Set the precedent for subsequent youth-justice legislation overriding rights protections.',
 source: { label: 'AHRI, Overriding the Queensland HR Act', href: 'https://humanrights.unsw.edu.au/students/blogs/overriding-queensland-human-rights-act' },
 },
 {
 date: '10 May 2023',
 title: 'Path to Treaty Act 2023, established Truth-telling and Treaty Body',
 thrust: 'preventive',
 summary: 'Act No. 12 of 2023, passed 10 May 2023. Established the First Nations Treaty Institute and a Truth-telling and Healing Inquiry, institutional architecture for addressing the systemic conditions (including youth-justice over-representation) that a treaty / truth process is intended to confront.',
 source: { label: 'QLD Legislation, Path to Treaty Act 2023', href: 'https://www.legislation.qld.gov.au/view/html/asmade/act-2023-012' },
 },
 {
 date: '25 Aug 2023',
 title: 'Children-in-adult-watchhouses Act, second HR Act override',
 thrust: 'punitive',
 summary: 'Child Protection (Offender Reporting and Offender Prohibition Order) and Other Legislation Amendment Act. Overrode QLD HR Act for the second time; explicitly authorised holding children in adult watchhouses. Then-Police Minister Mark Ryan described as a temporary measure until 31 December 2026.',
 source: { label: 'Al Jazeera coverage', href: 'https://www.aljazeera.com/news/2023/9/18/australian-state-suspends-human-rights-law-to-lock-up-more-children' },
 },
 {
 date: '13 Dec 2024',
 title: 'Making Queensland Safer Act 2024, "adult crime, adult time"',
 thrust: 'punitive',
 summary: 'Act No. 54 of 2024, assented 13 December 2024. Removed the "detention as a last resort" principle from the Youth Justice Act. Children charged with 13 listed offences (incl. murder, manslaughter, robbery, dangerous operation of a vehicle) face the same maximum, mandatory and minimum penalties as adults. Restorative justice removed as a sentencing option for those offences. UN CRC chair Ann Skelton called it "flagrant disregard of children\'s rights".',
 source: { label: 'QLD Legislation, Making QLD Safer Act 2024', href: 'https://www.legislation.qld.gov.au/view/whole/html/asmade/act-2024-054' },
 },
 {
 date: '28 Nov 2024',
 title: 'Path to Treaty Act repealed, first sitting day of new government',
 thrust: 'punitive',
 summary: 'Crisafulli LNP Government repealed the Path to Treaty Act on its first day of sitting. Repeal bundled into a Bill amending the Brisbane Olympic Games Act. QAIHC and Indigenous health peak bodies publicly opposed. Removed the institutional treaty/truth framework that explicitly addressed YJ over-representation.',
 source: { label: 'QLD Statement, Repeal (Nov 2024)', href: 'https://statements.qld.gov.au/statements/101654' },
 },
 {
 date: '2024–25',
 title: 'Bail Act amendments, wider presumption-against-bail list',
 thrust: 'punitive',
 summary: 'Police no longer required to consider alternatives to arrest for bail-condition breaches by children. Presumption-against-bail expanded: unlawful use of motor vehicle (aggravated), burglary, entering premises to commit indictable offences. Electronic monitoring of high-risk youth on bail expanded to Toowoomba, Mt Isa and Cairns. More children on remand for longer.',
 source: { label: 'QLD Department of Youth Justice, Changes to Acts', href: 'https://youthjustice.qld.gov.au/our-department/our-legislation/changes-act' },
 },
 {
 date: 'May 2025',
 title: 'Adult Crime Adult Time Amendment Bill 2025, proposed expansion to ~33 offences',
 thrust: 'punitive',
 summary: 'Sought to expand the adult-crime-adult-time list by ~20 further offences including arson, attempted murder, torture, rape, attempted rape, attempted robbery and trafficking in dangerous drugs. UN Special Rapporteurs Alice Jill Edwards (torture) and Albert K. Barume (Indigenous peoples) wrote to Australian authorities expressing concern.',
 source: { label: 'OHCHR, UN experts on Australian youth justice (May 2025)', href: 'https://www.ohchr.org/en/media-advisories/2025/05/youth-justice-systems-across-australia-crisis-un-experts' },
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
 title: 'Cleveland Youth Detention Centre Inspection Report, separation due to staff shortages',
 summary: 'Inspector Anthony Reilly tabled findings of chronic staff shortages causing children to be locked alone in their rooms. On one inspection day, 40% of Cleveland\'s 96 inmates were held in bare cells. Average separation length in 2022–23 was 8 hrs 36 min, reduced to 4 hrs 24 min by mid-2024. 15 recommendations.',
 source: { label: 'QLD Ombudsman, Cleveland inspection report', href: 'https://www.ombudsman.qld.gov.au/publications/detention-inspection-reports/cleveland-youth-detention-centre-inspection-report-focus-on-separation-due-to-staff-shortages' },
 },
 {
 date: '2024',
 body: 'QLD Ombudsman / Inspector of Detention Services',
 title: 'Cairns and Murgon Watch-Houses Inspection Report, focus on detention of children',
 summary: 'Inspection of Cairns and Murgon watch-houses with specific focus on the detention of children. Documented operational and welfare issues at both regional sites, directly relevant to the watchhouse-as-overflow pattern in Volume 1.',
 source: { label: 'QLD Ombudsman, Cairns + Murgon inspection', href: 'https://www.ombudsman.qld.gov.au/publications/detention-inspection-reports/cairns-and-murgon-watch-houses-inspection-report-2024' },
 },
 {
 date: '2025',
 body: 'QLD Ombudsman / Inspector of Detention Services',
 title: 'Combined Youth Detention Centres Inspection Report',
 summary: 'Combined inspection report covering all QLD youth detention centres. Read alongside the 2024 Cleveland report for the across-system pattern.',
 source: { label: 'QLD Ombudsman, combined YDC inspections 2025', href: 'https://www.ombudsman.qld.gov.au/publications/detention-inspection-reports/ydc-inspections-combined-report-2025' },
 },
 {
 date: '2019',
 body: 'Australian Human Rights Commission · Amnesty International',
 title: 'Children in Brisbane City Watchhouse, 89 children, isolation incidents',
 summary: 'ABC Four Corners + Amnesty International documented 89 children held in the Brisbane City Watchhouse at one point in May 2019. Reported incidents included children losing fingers in cell doors and one young person held in isolation for 23 days. Triggered international and federal-level scrutiny.',
 source: { label: 'Human Rights Watch, Australia\'s terrifying watch-houses', href: 'https://www.hrw.org/news/2019/06/24/australias-terrifying-watch-houses' },
 },
 {
 date: '2024',
 body: 'Australian Human Rights Commission',
 title: 'National Children\'s Commissioner, public criticism of QLD reforms',
 summary: 'The National Children\'s Commissioner publicly criticised QLD\'s 2024 youth-justice reforms as a breach of Australia\'s international child-rights obligations.',
 source: { label: 'AHRC, Statement on QLD reforms', href: 'https://humanrights.gov.au/about/news/media-releases/national-childrens-commissioner-slams-shocking-new-qld-youth-justice-laws' },
 },
];

// Hard-coded display-name overrides for cases where ACNC legal-entity name is misleading
// (e.g. Minderoo Foundation's giving figures attached to "MINDEROO PICTURES LIMITED" via shared ABN block).
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
 'MINDEROO PICTURES LIMITED': 'Minderoo Foundation',
};

// ACNC legal names are often "THE TRUSTEE FOR X TRUST" or all-caps registered company names,
// religious legal-entity wrappers ("The Corporation of the Trustees of the X"), etc.
// Convert to a friendlier display form for the report.
function displayName(raw: string): string {
 const override = DISPLAY_NAME_OVERRIDES[raw.trim().toUpperCase()];
 if (override) return override;
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
type RecipientRow = { recipient_name: string; total: number; grants: number; last_year: string | null };
type RegistryDelivererRow = {
 pattern: string;
 recipient_count: number;
 recipients: Array<{
 name: string;
 abn: string | null;
 total: number;
 line_items: number;
 first_fy: string | null;
 last_fy: string | null;
 gs_id: string | null;
 website: string | null;
 email: string | null;
 }>;
};

type SpendTranscriptRecipient = {
 name: string;
 abn: string | null;
 total: number;
 line_items: number;
 first_fy: string | null;
 last_fy: string | null;
 gs_id: string | null;
 website: string | null;
 email: string | null;
};
type SpendTranscriptRow = {
 program_name: string;
 total: number;
 line_items: number;
 recipient_count: number;
 first_fy: string | null;
 last_fy: string | null;
 description: string | null;
 has_alma: boolean;
 alma_count: number;
 topics: string[] | null;
 recipients: SpendTranscriptRecipient[];
};

type RecipientChainRow = {
 recipient_name: string;
 total: number;
 grants: number;
 first_year: string | null;
 last_year: string | null;
 programs: Array<{ program_name: string | null; financial_year: string | null; amount: number; description: string | null }>;
 interventions: Array<{ name: string; evidence_level: string | null; type: string | null }>;
 all_topics: string[];
};
type CrossSectorRow = { recipient_name: string; sectors: number; topic_list: string[]; total: number };
type AlmaInterventionRow = { name: string; type: string; evidence_level: string | null; geography: string[]; cost_per_young_person: number | null; portfolio_score: number | null; cultural_authority: string | null; description: string | null; topics: string[] | null };
type AlmaTypeCount = { type: string; count: number };
type ContractRow = { supplier_name: string; total: number; contracts: number };
type FoundationRow = { name: string; total_giving_annual: number; thematic_focus: string };
type HeatmapRow = { lga_name: string; population: number | null; youth_population: number | null; indigenous_pct: number | null; pipeline_intensity: number | null; ndis_youth_participants: number | null; jh_funding_tracked: number | null; school_count: number | null; jobseeker_recipients: number | null; dsp_recipients: number | null; youth_allowance_recipients: number | null; low_icsea_schools: number | null; avg_icsea: number | null };
type YearSpendRow = { financial_year: string; topic: string; total: number };
type DssRow = { state: string; payment_type: string; recipient_count: number };
type NdisOverlayRow = { state: string; total_participants: number; youth_participants: number; psychosocial_participants: number; intellectual_disability_participants: number; autism_participants: number };
type UnfundedRow = { name: string; type: string; evidence_level: string | null; geography: string };
type DirectorRow = { person_name: string; board_count: number; total_procurement: number; total_justice: number };
type SpendRow = { recipient_name: string; total: number };
type MinStatement = { published_at: string; minister_name: string | null; portfolio: string | null; headline: string; source_url: string; topics: string[] | null; body_text: string | null };
type HansardRow = { sitting_date: string; speaker_name: string | null; speaker_party: string | null; subject: string | null; snippet: string; source_url: string | null; body_text: string | null };
type HansardPartyCount = { speaker_party: string | null; speeches: number };
type BillRow = { bill_name: string; mentions: number; distinct_speakers: number; parties: string[] | null; last_mention: string | null; is_yj_specific: boolean };
type OfficialBill = { source_url: string; bill_name: string; sponsor: string | null; sponsor_party: string | null; introduced_date: string | null; status: string | null; status_date: string | null; topics: string[] | null };
type ActiveBill = { source_url: string; bill_name: string; sponsor: string | null; sponsor_party: string | null; introduced_date: string | null; status: string | null; status_date: string | null };
type CoronerFinding = { source_url: string; title: string; deceased_identifier: string | null; finding_date: string | null; coroner_name: string | null; recommendations_count: number | null; topics: string[] | null; body_text: string | null };

async function getReport() {
 const supabase = getLiveReportSupabase();
 const [
 latest, sites, trend, detentionFacilities, ctg, topOrgs, accoGap,
 recipients, crossSector, almaTypeCounts, almaInterventions, contracts,
 foundations, heatmap, yearSpend, dssQld, ndisOverlay,
 unfundedPrograms, mentalHealthAlma, aodAlma, mhFundingCount, directors,
 politicalDonations, spend, ministerialStatements, hansardRows, hansardPartyCounts, bills,
 officialBills, coronerFindings, activeBills, outcomeMetrics, supportAnnouncements, qldStateTotals, registryDeliverers, spendTranscript, recipientChains,
 ] = await Promise.all([
 safe(supabase.rpc('exec_sql', { query: `SELECT source_generated_at::text, total_people, total_adults, total_children, child_first_nations, child_non_indigenous, child_0_2_days, child_3_7_days, child_over_7_days, child_longest_days, adult_first_nations, adult_non_indigenous, adult_over_7_days, adult_longest_days, child_watchhouse_count FROM public.v_qld_watchhouse_latest LIMIT 1` })) as Promise<WatchhouseLatest[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT watchhouse_name, age_group, total_in_custody::int, first_nations::int, custody_over_7_days::int, longest_days::int FROM public.qld_watchhouse_snapshot_rows WHERE snapshot_id = (SELECT id FROM public.v_qld_watchhouse_latest LIMIT 1) ORDER BY (CASE WHEN age_group = 'Child' THEN 0 ELSE 1 END), total_in_custody DESC LIMIT 50` })) as Promise<WatchhouseRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT date_trunc('day', source_generated_at)::date::text AS day, AVG(total_children::numeric)::numeric(10,1) AS total_children, AVG(child_first_nations::numeric)::numeric(10,1) AS child_fn FROM public.qld_watchhouse_snapshots WHERE source_generated_at > NOW() - INTERVAL '60 days' GROUP BY 1 ORDER BY 1` })) as Promise<WatchhouseTrend[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT name, capacity_beds, indigenous_population_percentage, postcode FROM public.youth_detention_facilities WHERE state = 'QLD' AND operational_status = 'operational' ORDER BY capacity_beds DESC NULLS LAST LIMIT 10` })) as Promise<DetentionFacility[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT financial_year, actual_rate::numeric(10,2), trajectory_rate::numeric(10,2), gap_from_target::numeric(10,2) FROM public.v_ctg_youth_justice_progress WHERE state = 'QLD' ORDER BY financial_year` })) as Promise<CtgRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT recipient_name, recipient_abn, total::bigint, grants::int FROM public.mv_yj_report_state_top_orgs WHERE state = 'QLD' OR state = 'Queensland' ORDER BY total DESC NULLS LAST LIMIT 25` })) as Promise<TopOrgRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT org_type, orgs::int, total_funding::bigint, avg_per_recipient::bigint, funding_share_pct::int FROM public.mv_yj_report_acco_gap` })) as Promise<AccoGapRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT recipient_name, SUM(amount_dollars)::bigint AS total, COUNT(*)::int AS grants, MAX(financial_year) AS last_year FROM public.justice_funding WHERE state = 'QLD' AND topics @> ARRAY['youth-justice'] AND recipient_name NOT ILIKE '%total%' AND recipient_name NOT ILIKE 'department of youth justice%' AND recipient_name NOT ILIKE 'youth justice -%' AND recipient_name NOT IN ('(blank)','TAFE Queensland') AND amount_dollars > 0 GROUP BY 1 ORDER BY total DESC NULLS LAST LIMIT 25` })) as Promise<RecipientRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT recipient_name, COUNT(DISTINCT topic)::int AS sectors, ARRAY_AGG(DISTINCT topic) AS topic_list, SUM(amount_dollars)::bigint AS total FROM (SELECT recipient_name, unnest(topics) AS topic, amount_dollars FROM public.justice_funding WHERE state = 'QLD' AND amount_dollars > 0 AND recipient_name IS NOT NULL AND length(recipient_name) > 3 AND recipient_name !~ '^[0-9]+$' AND recipient_name NOT ILIKE '%Total%' AND recipient_name NOT ILIKE '%Department of%' AND recipient_name NOT ILIKE '%State of %' AND recipient_name NOT ILIKE '(blank)') t WHERE topic IN ('youth-justice','child-protection','disability','ndis','family-services','indigenous','mental-health','homelessness','aod','family-violence') GROUP BY 1 HAVING COUNT(DISTINCT topic) >= 3 ORDER BY total DESC NULLS LAST LIMIT 12` })) as Promise<CrossSectorRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT type, count::int FROM public.mv_yj_report_alma_type_counts ORDER BY count DESC LIMIT 12` })) as Promise<AlmaTypeCount[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT name, type, evidence_level, geography, cost_per_young_person::int, portfolio_score::int, cultural_authority, substring(description, 1, 1500) AS description, topics FROM public.alma_interventions WHERE ('QLD' = ANY(geography) OR 'Queensland' = ANY(geography)) AND (topics @> ARRAY['youth-justice'] OR type ILIKE '%diversion%' OR type ILIKE '%justice%' OR type ILIKE '%wraparound%' OR type ILIKE '%community-led%' OR type ILIKE '%therapeutic%') ORDER BY (CASE WHEN evidence_level ILIKE '%proven%' THEN 0 WHEN evidence_level ILIKE '%promising%' THEN 1 ELSE 2 END), portfolio_score DESC NULLS LAST LIMIT 16` })) as Promise<AlmaInterventionRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT LOWER(supplier_name) AS supplier_key, MIN(supplier_name) AS supplier_name, COUNT(*)::int AS contracts, SUM(contract_value)::bigint AS total FROM public.austender_contracts WHERE supplier_name ILIKE ANY (ARRAY['%youth justice%','%PCYC%','%youth advocacy%','%murri watch%','%youth off the streets%','%mission australia%','%lifeline community%','%anglicare%','%uniting%','%liquidlogic%','%halikos%','%Save the Children%']) AND contract_value > 0 AND length(supplier_name) < 200 AND supplier_name NOT ILIKE '%;%' GROUP BY LOWER(supplier_name) ORDER BY total DESC NULLS LAST LIMIT 12` })) as Promise<ContractRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `WITH ranked AS (SELECT name, total_giving_annual::bigint AS total_giving_annual, thematic_focus::text AS thematic_focus, profile_confidence, ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(regexp_replace(lower(name), '\\s+(limited|ltd|pty|inc|incorporated|trust|foundation)\\b.*$', '', 'g'), ''), name) ORDER BY CASE WHEN profile_confidence = 'high' THEN 0 WHEN profile_confidence = 'medium' THEN 1 ELSE 2 END, total_giving_annual DESC NULLS LAST) AS dedupe_rn FROM public.foundations WHERE thematic_focus::text ILIKE ANY (ARRAY['%justice%','%youth%','%children%','%first nations%','%indigenous%','%disability%','%mental health%','%aboriginal%']) AND total_giving_annual > 0 AND name NOT ILIKE '%universit%' AND name NOT ILIKE '%accommodation%' AND name NOT ILIKE '%catholic education%' AND name NOT ILIKE '%hospital%' AND name NOT ILIKE '%council%' AND name NOT ILIKE '%legal aid%' AND name NOT ILIKE '%primary healthcare network%' AND name NOT ILIKE '%phn%' AND name NOT ILIKE '%health network%' AND name NOT ILIKE 'job futures%' AND name NOT ILIKE '%refugee relief%' AND name NOT ILIKE '%world vision%') SELECT name, total_giving_annual, thematic_focus FROM ranked WHERE dedupe_rn = 1 ORDER BY total_giving_annual DESC NULLS LAST LIMIT 12` })) as Promise<FoundationRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT lga_name, population::int, youth_population::int, indigenous_pct::numeric(5,1), pipeline_intensity::numeric(5,1), ndis_youth_participants::int, jh_funding_tracked::bigint, school_count::int, jobseeker_recipients::int, dsp_recipients::int, youth_allowance_recipients::int, low_icsea_schools::int, avg_icsea::int FROM public.lga_cross_system_stats WHERE state = 'QLD' AND population > 5000 AND pipeline_intensity IS NOT NULL ORDER BY pipeline_intensity DESC NULLS LAST LIMIT 15` })) as Promise<HeatmapRow[] | null>,
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
 safe(supabase.rpc('exec_sql', { query: `SELECT published_at::text, minister_name, portfolio, headline, source_url, topics, body_text FROM public.civic_ministerial_statements WHERE jurisdiction = 'QLD' AND (topics @> ARRAY['youth-justice'] OR headline ~* '(youth|detention|watch.?house|adult crime|bail|young offender)') AND published_at > NOW() - INTERVAL '24 months' ORDER BY published_at DESC LIMIT 12` })) as Promise<MinStatement[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT sitting_date::text, speaker_name, speaker_party, subject, substring(body_text, 1, 280) AS snippet, source_url, substring(body_text, 1, 4000) AS body_text FROM public.civic_hansard WHERE jurisdiction = 'QLD' AND length(body_text) > 100 AND speaker_name IS NOT NULL AND speaker_name != 'Deputy Speaker' AND speaker_name != 'Speaker' AND speaker_name NOT ILIKE '%Hansard%' AND (body_text ~* '(youth justice|adult crime, adult time|adult time|youth detention|watchhouse|breach of bail|making queensland safer|young offender)') ORDER BY sitting_date DESC NULLS LAST LIMIT 10` })) as Promise<HansardRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT speaker_party, COUNT(*)::int AS speeches FROM public.civic_hansard WHERE jurisdiction = 'QLD' AND length(body_text) > 100 AND speaker_party IS NOT NULL AND (body_text ~* '(youth justice|adult crime, adult time|adult time|youth detention|watchhouse|breach of bail|making queensland safer|young offender)') AND sitting_date > NOW() - INTERVAL '12 months' GROUP BY 1 ORDER BY 2 DESC` })) as Promise<HansardPartyCount[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT bill_name, mentions, distinct_speakers, parties::text[] AS parties, last_mention::text, is_yj_specific FROM public.v_qld_yj_bills_active ORDER BY is_yj_specific DESC, mentions DESC LIMIT 10` })) as Promise<BillRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT source_url, bill_name, sponsor, sponsor_party, introduced_date::text, status, status_date::text, topics FROM public.qld_bills WHERE is_yj_relevant = true ORDER BY status_date DESC NULLS LAST, introduced_date DESC NULLS LAST LIMIT 10` })) as Promise<OfficialBill[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT source_url, title, deceased_identifier, finding_date::text, coroner_name, recommendations_count, topics, substring(body_text, 1, 6000) AS body_text FROM public.qld_coroners_findings WHERE is_youth_justice = true OR is_in_custody = true ORDER BY finding_date DESC NULLS LAST LIMIT 8` })) as Promise<CoronerFinding[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT source_url, bill_name, sponsor, sponsor_party, introduced_date::text, status, status_date::text FROM public.parliament_bills WHERE jurisdiction = 'QLD' AND status NOT ILIKE '%PASSED%' AND status NOT ILIKE '%defeated%' AND status NOT ILIKE '%lapsed%' AND status NOT ILIKE '%withdrawn%' AND introduced_date IS NOT NULL AND (is_yj_relevant = true OR bill_name ~* '(youth|children|child abuse|criminal code|criminal proceedings|sentencing|community safety|making queensland safer|breach of bail|young offender|civil liability|education and other|child protection)') ORDER BY (CASE WHEN is_yj_relevant = true THEN 0 ELSE 1 END), introduced_date DESC NULLS LAST LIMIT 6` })) as Promise<ActiveBill[] | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT metric_name, metric_value::numeric AS metric_value, period, cohort FROM public.outcomes_metrics WHERE jurisdiction='QLD' AND domain='youth-justice' AND ((cohort='all' AND metric_name IN ('rogs_recidivism_pct','rogs_total_expenditure_detention','aihw_avg_nightly_detention','aihw_avg_nightly_sentenced','rogs_avg_daily_community')) OR (cohort='community-controlled' AND metric_name='acco_yj_retention_pct')) ORDER BY metric_name, period` })) as Promise<Array<{ metric_name: string; metric_value: number; period: string; cohort: string }> | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT published_at::date::text AS published_at, headline, source_url, minister_name, portfolio FROM public.civic_ministerial_statements WHERE jurisdiction='QLD' AND headline ~* '(mental health|AOD|drug|addict|alcohol|step up|step down|disabilit|autism|FASD|cognitive|trauma|early intervention|kickstart|kickstarter|wraparound|wrap.around|diversion|youth criminal rehabilitation|circuit breaker|circuit-breaker|career pathway|youth program|prevention|family-led|family led|justice reinvestment|youth week|youth justice|young offender)' AND published_at > NOW() - INTERVAL '36 months' ORDER BY published_at DESC LIMIT 40` })) as Promise<Array<{ published_at: string; headline: string; source_url: string; minister_name: string | null; portfolio: string | null }> | null>,
 safe(supabase.rpc('exec_sql', { query: `SELECT SUM(population)::bigint AS pop, SUM(dsp_recipients)::bigint AS dsp, SUM(jobseeker_recipients)::bigint AS js, SUM(youth_allowance_recipients)::bigint AS ya, SUM(low_icsea_schools)::int AS low_icsea, SUM(school_count)::int AS schools FROM public.lga_cross_system_stats WHERE state='QLD'` })) as Promise<Array<{ pop: number; dsp: number; js: number; ya: number; low_icsea: number; schools: number }> | null>,
 safe(supabase.rpc('exec_sql', { query: `WITH patterns(p) AS (VALUES ('Circuit Breaker Sentencing'),('Tribe of Mentors'),('Kickstarter Grants'),('Bail Support'),('Young Offender Support Service'),('Family Led Decision Making')), recip AS (SELECT pat.p AS pattern, j.recipient_name, j.recipient_abn, SUM(j.amount_dollars)::bigint AS total, COUNT(*)::int AS line_items, MIN(j.financial_year) AS first_fy, MAX(j.financial_year) AS last_fy, MAX(j.gs_entity_id::text) AS entity_id FROM patterns pat JOIN public.justice_funding j ON j.program_name ILIKE '%' || pat.p || '%' WHERE j.state='QLD' AND j.amount_dollars > 0 AND j.recipient_name NOT ILIKE 'Youth Justice -%' AND j.recipient_name NOT ILIKE '%Total expenditure%' GROUP BY pat.p, j.recipient_name, j.recipient_abn), ranked AS (SELECT r.*, e.gs_id, e.website, e.email, ROW_NUMBER() OVER (PARTITION BY r.pattern ORDER BY r.total DESC) AS rn FROM recip r LEFT JOIN public.gs_entities e ON e.id::text = r.entity_id) SELECT pattern, COUNT(*)::int AS recipient_count, jsonb_agg(jsonb_build_object('name', recipient_name, 'abn', recipient_abn, 'total', total, 'line_items', line_items, 'first_fy', first_fy, 'last_fy', last_fy, 'gs_id', gs_id, 'website', website, 'email', email) ORDER BY total DESC) AS recipients FROM ranked WHERE rn <= 50 GROUP BY pattern` })) as Promise<RegistryDelivererRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `WITH base AS (SELECT j.program_name, j.recipient_name, j.recipient_abn, j.amount_dollars, j.financial_year, j.alma_intervention_id, j.gs_entity_id, j.topics, j.project_description FROM public.justice_funding j WHERE j.state='QLD' AND j.topics @> ARRAY['youth-justice'] AND j.amount_dollars > 0 AND j.program_name IS NOT NULL AND length(j.program_name) > 3 AND COALESCE(j.is_aggregate, false) = false AND j.recipient_name NOT ILIKE 'Youth Justice -%' AND j.recipient_name NOT ILIKE 'Department of%' AND j.recipient_name NOT ILIKE '%Total expenditure%' AND j.program_name NOT ILIKE 'ROGS %' AND j.program_name NOT ILIKE 'Government real recurrent%' AND j.program_name NOT ILIKE 'Cost per young person%'), programs AS (SELECT program_name, SUM(amount_dollars)::bigint AS total, COUNT(*)::int AS line_items, COUNT(DISTINCT recipient_name)::int AS recipient_count, MIN(financial_year) AS first_fy, MAX(financial_year) AS last_fy, BOOL_OR(alma_intervention_id IS NOT NULL) AS has_alma, COUNT(DISTINCT alma_intervention_id) FILTER (WHERE alma_intervention_id IS NOT NULL)::int AS alma_count FROM base GROUP BY program_name ORDER BY total DESC LIMIT 15), program_topics AS (SELECT b.program_name, ARRAY_AGG(DISTINCT t) FILTER (WHERE t IS NOT NULL) AS topics FROM base b LEFT JOIN LATERAL unnest(b.topics) t ON true WHERE b.program_name IN (SELECT program_name FROM programs) GROUP BY b.program_name), descs AS (SELECT program_name, project_description, ROW_NUMBER() OVER (PARTITION BY program_name ORDER BY length(project_description) DESC) AS rn FROM base WHERE project_description IS NOT NULL AND program_name IN (SELECT program_name FROM programs)), recipients_per AS (SELECT b.program_name, b.recipient_name, b.recipient_abn, SUM(b.amount_dollars)::bigint AS total, COUNT(*)::int AS line_items, MIN(b.financial_year) AS first_fy, MAX(b.financial_year) AS last_fy, MAX(b.gs_entity_id::text) AS entity_id FROM base b WHERE b.program_name IN (SELECT program_name FROM programs) GROUP BY b.program_name, b.recipient_name, b.recipient_abn), recipients_ranked AS (SELECT rp.*, e.gs_id, e.website, e.email, ROW_NUMBER() OVER (PARTITION BY rp.program_name ORDER BY rp.total DESC) AS rn FROM recipients_per rp LEFT JOIN public.gs_entities e ON e.id::text = rp.entity_id), recipients_agg AS (SELECT program_name, jsonb_agg(jsonb_build_object('name', recipient_name, 'abn', recipient_abn, 'total', total, 'line_items', line_items, 'first_fy', first_fy, 'last_fy', last_fy, 'gs_id', gs_id, 'website', website, 'email', email) ORDER BY total DESC) AS recipients FROM recipients_ranked WHERE rn <= 25 GROUP BY program_name) SELECT p.program_name, p.total, p.line_items, p.recipient_count, p.first_fy, p.last_fy, p.has_alma, p.alma_count, LEFT(d.project_description, 480) AS description, COALESCE(pt.topics, ARRAY[]::text[]) AS topics, COALESCE(ra.recipients, '[]'::jsonb) AS recipients FROM programs p LEFT JOIN descs d ON d.program_name = p.program_name AND d.rn = 1 LEFT JOIN program_topics pt ON pt.program_name = p.program_name LEFT JOIN recipients_agg ra ON ra.program_name = p.program_name ORDER BY p.total DESC` })) as Promise<SpendTranscriptRow[] | null>,
 safe(supabase.rpc('exec_sql', { query: `WITH top_r AS (SELECT recipient_name, SUM(amount_dollars)::bigint AS total, COUNT(*)::int AS grants, MIN(financial_year) AS first_year, MAX(financial_year) AS last_year FROM public.justice_funding WHERE state='QLD' AND topics @> ARRAY['youth-justice'] AND amount_dollars > 0 AND recipient_name IS NOT NULL AND length(recipient_name) > 3 AND recipient_name !~ '^[0-9]+$' AND recipient_name NOT ILIKE '%total%' AND recipient_name NOT ILIKE 'department of%' AND recipient_name NOT ILIKE 'youth justice -%' AND recipient_name NOT ILIKE '%state of %' AND recipient_name NOT IN ('(blank)','TAFE Queensland') GROUP BY 1 ORDER BY total DESC LIMIT 8), prog AS (SELECT t.recipient_name, jsonb_agg(jsonb_build_object('program_name', t.program_name, 'financial_year', t.financial_year, 'amount', t.amount_dollars, 'description', LEFT(COALESCE(t.project_description, ''), 240)) ORDER BY t.amount_dollars DESC) AS programs FROM (SELECT j.recipient_name, j.program_name, j.financial_year, j.amount_dollars, j.project_description, ROW_NUMBER() OVER (PARTITION BY j.recipient_name ORDER BY j.amount_dollars DESC) AS rn FROM public.justice_funding j WHERE j.state='QLD' AND j.topics @> ARRAY['youth-justice'] AND j.amount_dollars > 0 AND j.recipient_name IN (SELECT recipient_name FROM top_r)) t WHERE t.rn <= 5 GROUP BY 1), alma AS (SELECT j.recipient_name, jsonb_agg(DISTINCT jsonb_build_object('name', a.name, 'evidence_level', a.evidence_level, 'type', a.type)) AS interventions FROM public.justice_funding j JOIN public.alma_interventions a ON a.id = j.alma_intervention_id WHERE j.state='QLD' AND j.topics @> ARRAY['youth-justice'] AND j.recipient_name IN (SELECT recipient_name FROM top_r) GROUP BY 1), tp AS (SELECT recipient_name, ARRAY_AGG(DISTINCT topic) AS all_topics FROM (SELECT j.recipient_name, unnest(j.topics) AS topic FROM public.justice_funding j WHERE j.state='QLD' AND j.amount_dollars > 0 AND j.recipient_name IN (SELECT recipient_name FROM top_r)) tt GROUP BY 1) SELECT tr.recipient_name, tr.total, tr.grants, tr.first_year, tr.last_year, COALESCE(prog.programs, '[]'::jsonb) AS programs, COALESCE(alma.interventions, '[]'::jsonb) AS interventions, COALESCE(tp.all_topics, ARRAY[]::text[]) AS all_topics FROM top_r tr LEFT JOIN prog USING (recipient_name) LEFT JOIN alma USING (recipient_name) LEFT JOIN tp USING (recipient_name) ORDER BY tr.total DESC` })) as Promise<RecipientChainRow[] | null>,
 ]);

 const detention = (spend ?? []).find(s => /detention/i.test(s.recipient_name))?.total || 0;
 const community = (spend ?? []).find(s => /community/i.test(s.recipient_name))?.total || 0;
 const groupConferencing = (spend ?? []).find(s => /group conferencing/i.test(s.recipient_name))?.total || 0;

 // ── Outcome math for cold-arrival TLDR
 const om = outcomeMetrics ?? [];
 const omFor = (n: string) => om.filter(r => r.metric_name === n).sort((a, b) => a.period.localeCompare(b.period));
 const recid = omFor('rogs_recidivism_pct');
 const recidLatest = recid[recid.length - 1] ?? null;
 const detSpend = omFor('rogs_total_expenditure_detention');
 const detSpendLatest = detSpend[detSpend.length - 1] ?? null;
 const popPts = omFor('aihw_avg_nightly_detention');
 const popLatestFy = popPts.length ? popPts[popPts.length - 1].period.slice(0, 7) : null;
 const popLatestQuarters = popLatestFy ? popPts.filter(p => p.period.startsWith(popLatestFy)) : [];
 const popLatestAvg = popLatestQuarters.length
 ? popLatestQuarters.reduce((s, p) => s + Number(p.metric_value), 0) / popLatestQuarters.length
 : null;
 const bedNightCost = detSpendLatest && popLatestAvg
 ? Math.round((Number(detSpendLatest.metric_value) * 1000) / (popLatestAvg * 365))
 : null;

 // Tonight-in-the-funnel numbers: avg nightly detention (latest quarter),
 // sentenced subset (remainder = remand), and community supervision avg daily.
 const detentionTonight = popPts.length ? Math.round(Number(popPts[popPts.length - 1].metric_value)) : null;
 const sentencedPts = omFor('aihw_avg_nightly_sentenced');
 const sentencedTonight = sentencedPts.length ? Math.round(Number(sentencedPts[sentencedPts.length - 1].metric_value)) : null;
 const remandTonight = (detentionTonight != null && sentencedTonight != null) ? detentionTonight - sentencedTonight : null;
 const remandPct = (detentionTonight && remandTonight != null && detentionTonight > 0)
 ? Math.round((remandTonight / detentionTonight) * 100)
 : null;
 const communityOrdersPts = omFor('rogs_avg_daily_community');
 const communityOrdersAvg = communityOrdersPts.length ? Math.round(Number(communityOrdersPts[communityOrdersPts.length - 1].metric_value)) : null;
 const detentionPeriod = popPts.length ? popPts[popPts.length - 1].period : null;
 const communityOrdersPeriod = communityOrdersPts.length ? communityOrdersPts[communityOrdersPts.length - 1].period : null;

 // ACCO retention, surface latest valid year (skip current FY, no next-year data yet).
 const accoPts = om.filter(r => r.metric_name === 'acco_yj_retention_pct').sort((a, b) => a.period.localeCompare(b.period));
 const currentFy = (() => {
 const m = new Date();
 const y = m.getMonth() >= 6 ? m.getFullYear() : m.getFullYear() - 1;
 return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
 })();
 const accoValid = accoPts.filter(p => !p.period.startsWith(currentFy));
 const accoRetentionLatest = accoValid[accoValid.length - 1] ?? null;
 const accoRetentionPeak = accoValid.length
 ? accoValid.reduce((m, p) => Number(p.metric_value) > Number(m.metric_value) ? p : m, accoValid[0])
 : null;

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
 bills: bills ?? [],
 officialBills: officialBills ?? [],
 coronerFindings: coronerFindings ?? [],
 activeBills: activeBills ?? [],
 recidLatest, bedNightCost, detSpendLatest, popLatestAvg,
 detSpendSeries: detSpend,
 recidSeries: recid,
 detentionTonight, sentencedTonight, remandTonight, remandPct,
 communityOrdersAvg, detentionPeriod, communityOrdersPeriod,
 accoRetentionLatest, accoRetentionPeak,
 supportAnnouncements: supportAnnouncements ?? [],
 recipientChains: recipientChains ?? [],
 qldTotals: qldStateTotals?.[0] ?? null,
 registryDeliverers: registryDeliverers ?? [],
 spendTranscript: spendTranscript ?? [],
 };
}

// Heuristic classifier for QLD ministerial statements about youth justice.
// Reads minister portfolio + headline keywords to bucket the policy thrust.
// The scraper's `portfolio` field often runs into article body text with
// JSON unicode escapes (literal backslash-u-XXXX) and raw HTML tags. Cut
// at the first of: a literal "\u" escape sequence, an HTML tag, an
// "X Y said" speaker reference, or a literal CR/LF (\r\n). Then strip
// any escaped non-breaking spaces and tags from the remaining text.
// Hansard speaker-name fallback. PDF parsing sometimes trails the start of a
// speech into the speaker_name field (e.g., "Head · I take those interjections
// from all of my colleagues."). When the field is long-ish or contains a `·`,
// take only the first ~3 words before the separator. Otherwise return as-is.
function cleanSpeakerName(raw: string | null | undefined): string {
 if (!raw) return 'Unknown';
 const trimmed = raw.trim();
 if (!trimmed) return 'Unknown';
 // If a `·` separator appears, the part before it is typically the surname
 const beforeDot = trimmed.split('·')[0]?.trim() ?? trimmed;
 // Cap at 3 words
 const words = beforeDot.split(/\s+/);
 if (words.length <= 3) return beforeDot;
 return words.slice(0, 3).join(' ');
}

// Coroner-name fallback. The PDF scraper sometimes pulls the literal
// section header "CATCHWORDS" or "FINDINGS" into the coroner_name field.
// Surface those as null so the UI shows nothing rather than a fake name.
function cleanCoronerName(raw: string | null | undefined): string | null {
 if (!raw) return null;
 const trimmed = raw.trim();
 if (!trimmed) return null;
 if (/^(catchwords|findings|inquest|coroner|delivered|hearing|date)$/i.test(trimmed)) return null;
 if (/^[A-Z]{4,}$/.test(trimmed)) return null; // SHOUTING-CASE artefacts
 return trimmed;
}

function cleanPortfolio(raw: string | null | undefined): string | null {
 if (!raw) return null;
 let s = raw;
 // The DB string literally contains "&" as 6 chars (backslash, u, 0,
 // 0, 2, 6), not a real unicode escape. So the regex must match a
 // literal backslash. In a JS regex literal, `\\u` matches `\u`.
 const cuts = [
 s.search(/\\u[0-9a-fA-F]{4}/),
 s.search(/<\/?[a-zA-Z]/),
 s.search(/\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s+said\b/),
 s.search(/\\r\\n|\\n/),
 ].filter(n => n > 0);
 if (cuts.length > 0) s = s.slice(0, Math.min(...cuts));
 // Belt-and-braces: strip any literal-backslash-u escapes / tags / non-breaking-space tokens / CR-LF
 s = s.replace(/\\u[0-9a-fA-F]{4}[a-z]*;?/g, ' ');
 s = s.replace(/<[^>]+>/g, ' ');
 s = s.replace(/&nbsp;|&rsquo;|&ldquo;|&rdquo;|&amp;|&quot;/g, ' ');
 s = s.trim().replace(/\s+/g, ' ');
 if (s.length < 4) return null;
 return s.slice(0, 110);
}

function classifyStatement(s: { headline: string; portfolio: string | null }): 'punitive' | 'preventive' | 'mixed' {
 const h = s.headline.toLowerCase();
 // "bail" alone doesn't classify, many bail headlines are support/diversion-related;
 // require a punitive compound (tougher/stronger/breach/monitoring/crackdown).
 if (/adult crime|adult time|tougher|crackdown|tough\s+on|stronger\s+(youth\s+)?bail|bail\s+(monitoring|breach|crackdown|tough)|new\s+detention|new\s+prison|45\s+offences|expanding\s+adult|harder\s+on|life\s+sentenc|adult\s+penalt/.test(h)) return 'punitive';
 if (/early intervention|rehabilitation|step up step down|career pathways|youth week|prevention|community-led|treaty|justice reinvestment|family-led|kickstart|wrap.?around|diversion\b|education\b|jobs/.test(h)) return 'preventive';
 return 'mixed';
}

/* ─── Dashboard ─────────────────────────────────────────────────────── */

/** Cost + pooler load: this page was force-dynamic with no caching, so every request ran
 *  its query. The report's underlying data changes nightly at most. */
const getReportCached = unstable_cache(getReport, ['reports-youth-justice-qld-sector'], { revalidate: 3600 });

export default async function QldYjSectorPage() {
 const hdrs = await headers();
 const isShare = (hdrs.get('x-pathname') ?? '').startsWith('/share/');
 const dashboardPath = isShare ? '/share/qld-youth-justice' : '/reports/youth-justice/qld/sector';
 const longReadPath = isShare ? '/share/qld-youth-justice/long-read' : '/reports/youth-justice/qld/sector/long-read';
 const r = await getReportCached();

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
 QLD Youth Justice<br /> The State, The Funnel, The Money, The Network, The Evidence, The Place
 </h1>
 <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
 Australia&apos;s most-debated youth-justice system, sourced. Live watchhouse occupancy refreshes from QPS twice daily. Funding flows through the QLD state budget, federal procurement, and foundation giving. Cross-system pathways from child protection, disability, AOD, and education traced via {fmt(r.heatmap.length)} QLD LGAs. ALMA evidence base shown in §5–§17, where each count carries its filter (e.g. {fmt(r.almaInterventions.length)} QLD-tagged YJ interventions in §16; {r.unfundedPrograms.length} effective-but-unfunded in §17; {r.mhAlma} MH-typed and {r.aodAlma} AOD-typed across the national catalogue, §6).
 </p>
 </div>

 {/* COLD-ARRIVAL TLDR HERO, three numbers that tell the whole story before the sticky nav */}
 <section aria-label="TLDR" className="mb-10 border-4 border-bauhaus-black bg-bauhaus-black text-white p-6 sm:p-8">
 <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-3">TLDR · 30 seconds</div>

 {/* THE DIVERGENCE CHART, single visual that anchors the whole report */}
 {r.detSpendSeries.length > 4 && r.recidSeries.length > 4 && (() => {
 const detData = r.detSpendSeries.map(d => ({ period: d.period, value: Number(d.metric_value) / 1000 })); // $M
 const recidData = r.recidSeries.map(d => ({ period: d.period, value: Number(d.metric_value) }));
 const allPeriods = Array.from(new Set([...detData.map(d => d.period), ...recidData.map(d => d.period)])).sort();
 if (allPeriods.length < 4) return null;
 const W = 920, H = 320, padL = 70, padR = 70, padT = 28, padB = 48;
 const innerW = W - padL - padR, innerH = H - padT - padB;
 const x = (period: string) => {
 const idx = allPeriods.indexOf(period);
 if (idx < 0) return padL;
 return padL + (idx / (allPeriods.length - 1)) * innerW;
 };
 const detMax = 320, detMin = 0;
 const yDet = (v: number) => padT + innerH - ((v - detMin) / (detMax - detMin)) * innerH;
 const recidMax = 75, recidMin = 55;
 const yRecid = (v: number) => padT + innerH - ((v - recidMin) / (recidMax - recidMin)) * innerH;
 const detPath = detData.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.period).toFixed(1)},${yDet(d.value).toFixed(1)}`).join(' ');
 const recidPath = recidData.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.period).toFixed(1)},${yRecid(d.value).toFixed(1)}`).join(' ');
 const events = [
 { period: '2023-24', label: 'Community Safety Act + HR-Act override #2' },
 { period: '2024-25', label: 'Making QLD Safer 2024' },
 ];
 const detLast = detData[detData.length - 1];
 const detFirst = detData[0];
 const recidLast = recidData[recidData.length - 1];
 const recidFirst = recidData[0];
 const detGrowthPct = detFirst ? Math.round(((detLast.value - detFirst.value) / detFirst.value) * 100) : 0;
 const recidDeltaPp = recidFirst ? (recidLast.value - recidFirst.value) : 0;
 return (
 <div className="mb-6 bg-white text-bauhaus-black border-4 border-bauhaus-yellow p-4 sm:p-5">
 <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">The single chart of this report</div>
 <h3 className="text-base sm:text-xl font-black uppercase tracking-tight leading-tight mb-1">
 Detention spend doubled. Recidivism rose with it.
 </h3>
 <p className="text-xs sm:text-sm text-bauhaus-black/80 leading-snug mb-4 max-w-3xl">
 Same time axis, two ROGS lines. The yellow markers below the chart are the legislative moments. Spend climbed; the bills got tighter; the reoffend rate kept rising.
 </p>
 <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Dual-axis line chart: QLD detention spend vs 12-month recidivism, 2014-15 to 2024-25.">
 {/* Frame */}
 <rect x={padL} y={padT} width={innerW} height={innerH} fill="none" stroke="#121212" strokeWidth="2" />
 {/* Light gridlines */}
 {[100, 200, 300].map(v => (
 <line key={`g${v}`} x1={padL} x2={padL + innerW} y1={yDet(v)} y2={yDet(v)} stroke="#F0F0F0" strokeWidth="1" />
 ))}
 {/* Left Y axis ticks ($M) */}
 {[0, 100, 200, 300].map(v => (
 <g key={`l${v}`}>
 <line x1={padL - 4} x2={padL} y1={yDet(v)} y2={yDet(v)} stroke="#121212" strokeWidth="2" />
 <text x={padL - 8} y={yDet(v) + 4} fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="900" textAnchor="end" fill="#D02020">${v}M</text>
 </g>
 ))}
 {/* Right Y axis ticks (%) */}
 {[55, 60, 65, 70, 75].map(v => (
 <g key={`r${v}`}>
 <line x1={padL + innerW} x2={padL + innerW + 4} y1={yRecid(v)} y2={yRecid(v)} stroke="#121212" strokeWidth="2" />
 <text x={padL + innerW + 8} y={yRecid(v) + 4} fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="900" fill="#1040C0">{v}%</text>
 </g>
 ))}
 {/* X axis ticks (compact 2-digit FY end, all years labelled) */}
 {allPeriods.map((p) => {
 const yyEnd = p.slice(5); // '2018-19' → '19'
 return (
 <g key={p}>
 <line x1={x(p)} x2={x(p)} y1={padT + innerH} y2={padT + innerH + 4} stroke="#121212" strokeWidth="2" />
 <text x={x(p)} y={padT + innerH + 18} fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="900" textAnchor="middle" fill="#121212">FY{yyEnd}</text>
 </g>
 );
 })}
 {/* COVID dip annotation on recidivism trough */}
 {(() => {
 const cov = recidData.find(d => d.period === '2019-20');
 if (!cov) return null;
 const cx = x(cov.period), cy = yRecid(cov.value);
 return (
 <g>
 <line x1={cx} y1={cy + 8} x2={cx} y2={cy + 32} stroke="#1040C0" strokeWidth="1" strokeDasharray="2 2" />
 <text x={cx} y={cy + 46} fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="900" textAnchor="middle" fill="#1040C0">covid dip</text>
 </g>
 );
 })()}
 {/* Event vertical lines (no inline labels — keyed below chart) */}
 {events.map((e, i) => {
 const ex = x(e.period);
 return (
 <g key={i}>
 <line x1={ex} x2={ex} y1={padT} y2={padT + innerH + 6} stroke="#F0C020" strokeWidth="2" strokeDasharray="3 3" />
 <text x={ex} y={padT + innerH + 32} fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="900" textAnchor="middle" fill="#121212">▼{i + 1}</text>
 </g>
 );
 })}
 {/* Detention spend line (red) */}
 <path d={detPath} fill="none" stroke="#D02020" strokeWidth="3" />
 {detData.map((d, i) => <circle key={`d${i}`} cx={x(d.period)} cy={yDet(d.value)} r="4" fill="#D02020" stroke="#fff" strokeWidth="2" />)}
 {/* Detention end-of-line callout */}
 {detLast && (
 <g>
 <text x={x(detLast.period) - 4} y={yDet(detLast.value) - 12} fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="900" textAnchor="end" fill="#D02020">+{detGrowthPct}%</text>
 </g>
 )}
 {/* Recidivism line (blue) */}
 <path d={recidPath} fill="none" stroke="#1040C0" strokeWidth="3" />
 {recidData.map((d, i) => <circle key={`r${i}`} cx={x(d.period)} cy={yRecid(d.value)} r="4" fill="#1040C0" stroke="#fff" strokeWidth="2" />)}
 {/* Recidivism end-of-line callout */}
 {recidLast && (
 <g>
 <text x={x(recidLast.period) + 8} y={yRecid(recidLast.value) + 4} fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="900" fill="#1040C0">+{recidDeltaPp.toFixed(1)}pp</text>
 </g>
 )}
 {/* Axis legend (top corners) */}
 <text x={padL} y={padT - 10} fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="900" fill="#D02020">DETENTION SPEND, $M</text>
 <text x={padL + innerW} y={padT - 10} fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="900" textAnchor="end" fill="#1040C0">RECIDIVISM %</text>
 </svg>
 {/* Event key (rendered as text strip below the chart, not on it) */}
 <div className="mt-3 grid sm:grid-cols-2 gap-2 text-[11px] text-bauhaus-black">
 {events.map((e, i) => (
 <div key={i} className="flex gap-2 items-baseline">
 <span className="font-black tabular-nums text-bauhaus-black bg-bauhaus-yellow px-1.5">▼{i + 1}</span>
 <span className="font-mono text-bauhaus-muted">{e.period}</span>
 <span>{e.label}</span>
 </div>
 ))}
 </div>
 <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-bauhaus-canvas text-[10px] font-mono text-bauhaus-muted">
 <span><span className="inline-block w-3 h-3 bg-bauhaus-red mr-1 align-middle" /> Detention spend ($M, ROGS recurrent expenditure)</span>
 <span><span className="inline-block w-3 h-3 bg-bauhaus-blue mr-1 align-middle" /> 12-month recidivism (%, ROGS Section 17)</span>
 </div>
 <p className="text-[11px] text-bauhaus-black/80 leading-snug mt-3 max-w-3xl">
 <span className="font-black">Spend, +{detGrowthPct}%</span> over the window ({detFirst && detLast ? `${detFirst.period} → ${detLast.period}` : ''}). <span className="font-black">Recidivism, +{recidDeltaPp.toFixed(1)}pp</span> ({recidFirst && recidLast ? `${recidFirst.period} → ${recidLast.period}` : ''}). The blue dip in FY20 is a covid artefact, lockdowns shrank the opportunity to offend, but the rate snapped back above pre-pandemic levels and kept climbing. The political answer to a rising reoffend rate has consistently been to expand custody, not community capacity. Source: Productivity Commission ROGS 2026, jurisdictional youth-justice tables.
 </p>
 </div>
 );
 })()}

 <p className="text-xl sm:text-3xl font-black leading-tight uppercase tracking-tight mb-6">
 {r.communityOrdersAvg && r.detentionTonight ? (
 <>QLD already supervises <span className="text-bauhaus-yellow">~{r.communityOrdersAvg} young people in the community</span> every day, {(r.communityOrdersAvg / r.detentionTonight).toFixed(1)}× the number locked up. </>
 ) : (
 <>QLD already supervises hundreds of young people in the community every day. </>
 )}
 {r.bedNightCost
 ? <>Yet detention costs <span className="text-bauhaus-red">${r.bedNightCost.toLocaleString()} per child per night</span>, </>
 : <>Yet detention costs more per child than every alternative, </>}
 {r.recidLatest
 ? <>and{' '}<span className="text-bauhaus-red">{Number(r.recidLatest.metric_value).toFixed(0)}%</span>{' '}of children released come back within 12 months.</>
 : <>and most children released come back within 12 months.</>}
 {' '}The case for community-based support isn&apos;t hypothetical, it&apos;s already running, underfunded.
 </p>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
 <div className="border-l-4 border-bauhaus-yellow pl-3">
 <div className="text-3xl sm:text-4xl font-black tabular-nums leading-none mb-2">
 {ws ? ws.total_children : '—'}
 </div>
 <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-1">Children · adult watchhouses · today</div>
 <p className="text-xs text-white/80 font-medium leading-snug">
 {fnPctChild}% First Nations · live from QPS, refreshed twice daily.
 </p>
 </div>
 <div className="border-l-4 border-bauhaus-red pl-3">
 <div className="text-3xl sm:text-4xl font-black tabular-nums leading-none mb-2">
 {r.bedNightCost ? `$${r.bedNightCost.toLocaleString()}` : '—'}
 </div>
 <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">Per bed-night · detention</div>
 <p className="text-xs text-white/80 font-medium leading-snug">
 {r.detSpendLatest && r.popLatestAvg
 ? <>${(Number(r.detSpendLatest.metric_value)/1000).toFixed(0)}M ÷ {Math.round(r.popLatestAvg)} avg nightly × 365 ({r.detSpendLatest.period})</>
 : 'ROGS detention spend ÷ avg nightly population × 365.'}
 </p>
 </div>
 <div className="border-l-4 border-bauhaus-red pl-3">
 <div className="text-3xl sm:text-4xl font-black tabular-nums leading-none mb-2">
 {r.recidLatest ? `${Number(r.recidLatest.metric_value).toFixed(1)}%` : '—'}
 </div>
 <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">Recidivism · 12 months · {r.recidLatest?.period ?? 'latest'}</div>
 <p className="text-xs text-white/80 font-medium leading-snug">
 ROGS Section 17. Trended up over the past five years while detention spend more than doubled.
 </p>
 </div>
 </div>
 {(r.detentionTonight || r.communityOrdersAvg) && (
 <div className="border-t border-white/20 pt-5 mb-5">
 <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-3">The funnel tonight · QLD young people under youth-justice supervision</div>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {ws && (
 <div>
 <div className="text-2xl sm:text-3xl font-black tabular-nums leading-none mb-1">{ws.total_children}</div>
 <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white mb-1">in adult police watchhouses</div>
 <p className="text-xs text-white/70 font-medium leading-snug">Live from QPS · today · {fnPctChild}% First Nations.</p>
 </div>
 )}
 {r.detentionTonight && (
 <div>
 <div className="text-2xl sm:text-3xl font-black tabular-nums leading-none mb-1">~{r.detentionTonight}</div>
 <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white mb-1">in youth detention each night</div>
 <p className="text-xs text-white/70 font-medium leading-snug">
 AIHW avg nightly · {r.detentionPeriod ?? 'latest'}
 {r.remandTonight != null && r.remandPct != null && (
 <> · <span className="text-bauhaus-red font-black">~{r.remandTonight} on remand ({r.remandPct}%)</span>, not yet sentenced.</>
 )}
 </p>
 </div>
 )}
 {r.communityOrdersAvg && (
 <div>
 <div className="text-2xl sm:text-3xl font-black tabular-nums leading-none mb-1">~{r.communityOrdersAvg}</div>
 <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white mb-1">on community supervision orders</div>
 <p className="text-xs text-white/70 font-medium leading-snug">
 ROGS avg daily · {r.communityOrdersPeriod ?? 'latest'}.
 {r.detentionTonight && r.community > 0 && (
 <> Roughly <span className="font-black">{(r.communityOrdersAvg / r.detentionTonight).toFixed(1)}× more young people on community orders than locked up</span>, yet detention takes <span className="font-black">{(r.detention / r.community).toFixed(1)}×</span> the spend.</>
 )}
 </p>
 </div>
 )}
 </div>
 </div>
 )}

 <div className="border-t border-white/20 pt-5 mb-5">
 <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-3">The system&apos;s direction of travel · all three at once</div>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
 <div className="border-l-4 border-bauhaus-red pl-3">
 <div className="font-black uppercase tracking-widest text-bauhaus-red mb-1">Custody capacity</div>
 <p className="text-white/85 leading-snug">Expanding. +120 beds in build (Woodford 80 + Cairns 40), Wacol opened 2025.</p>
 </div>
 <div className="border-l-4 border-bauhaus-red pl-3">
 <div className="font-black uppercase tracking-widest text-bauhaus-red mb-1">Sentencing law</div>
 <p className="text-white/85 leading-snug">Hardening. Adult-time provisions; bail tightened twice in 14 months; HR Act overridden twice.</p>
 </div>
 <div className="border-l-4 border-bauhaus-blue pl-3">
 <div className="font-black uppercase tracking-widest text-bauhaus-blue mb-1">Community + prevention</div>
 <p className="text-white/85 leading-snug">Contracting. Path to Treaty repealed. ACCO share {accoSharePct}%. 0 grants tagged mental-health/AOD.</p>
 </div>
 </div>
 </div>

 <div className="border-t border-white/20 pt-4 mb-4">
 <p className="text-[11px] sm:text-xs text-white/85 leading-snug font-medium">
 <span className="font-black uppercase tracking-widest text-bauhaus-yellow">Two budget windows:</span> Cumulative dataset {money(r.detention)} detention vs {money(r.community)} community (2008–2026, <code className="font-mono">justice_funding</code>). Current-year ROGS recurrent: {r.detSpendLatest ? <>${(Number(r.detSpendLatest.metric_value)/1000).toFixed(0)}M detention ({r.detSpendLatest.period})</> : 'pending'}. Same direction of travel; different denominators. Full explainer in §8.
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest">
 <Link href={longReadPath} className="inline-block px-4 py-2 border-2 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black hover:bg-white">📖 Read the long-form report</Link>
 <a href="#vol-3" className="inline-block px-4 py-2 border-2 border-white text-white hover:bg-white hover:text-bauhaus-black">→ Skip to the money</a>
 <a href="#vol-7" className="inline-block px-4 py-2 border-2 border-white text-white hover:bg-white hover:text-bauhaus-black">→ Skip to policy + bills</a>
 </div>
 </section>

 {/* 5-MINUTE READING PATH, the shortest route through the report */}
 <section aria-label="Five-minute reading path" className="mb-10 border-4 border-bauhaus-black bg-white p-6 sm:p-8">
 <div className="flex flex-wrap items-baseline gap-3 mb-4">
 <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-bauhaus-red">⏱ 5-minute path</span>
 <h2 className="text-xl sm:text-2xl font-black text-bauhaus-black uppercase tracking-tight">Got 5 minutes? The shortest path through the report</h2>
 </div>
 <p className="text-sm text-bauhaus-black font-medium leading-snug max-w-3xl mb-5">
 Five sections, in order, that carry the argument. Skim them and you have the whole report&apos;s spine.
 </p>
 <ol className="space-y-3">
 {[
 { href: '#section-3', label: '§3', q: 'Are we closing the Closing-the-Gap target?', tone: 'border-bauhaus-red' },
 { href: '#section-8', label: '§8', q: 'How many detention dollars per dollar of community-based services?', tone: 'border-bauhaus-blue' },
 { href: '#section-10', label: '§10', q: 'Where is the ACCO funding gap?', tone: 'border-bauhaus-yellow' },
 { href: '#section-17', label: '§17', q: 'Which effective programs are running with no funding link?', tone: 'border-bauhaus-blue' },
 { href: '#section-25-5', label: '§25.5', q: 'What does the synthesis actually say?', tone: 'border-bauhaus-black' },
 ].map((s, i) => (
 <li key={s.href}>
 <a href={s.href} className={`group block border-l-4 ${s.tone} pl-4 py-2 hover:bg-bauhaus-canvas transition-colors`}>
 <div className="flex flex-wrap items-baseline gap-3">
 <span className="text-[10px] font-mono font-black tabular-nums text-bauhaus-muted">{(i + 1).toString().padStart(2, '0')}</span>
 <span className="text-sm font-black uppercase tracking-widest text-bauhaus-red">{s.label}</span>
 <span className="text-sm sm:text-base font-medium text-bauhaus-black flex-1 group-hover:underline">{s.q}</span>
 <span className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">→</span>
 </div>
 </a>
 </li>
 ))}
 </ol>
 <p className="text-[10px] font-mono text-bauhaus-muted mt-5">
 Each anchor jumps to the corresponding section in the long report. Read all five and you have the cold-arrival case in roughly five minutes.
 </p>
 </section>

 {/* STICKY VOLUME NAV */}
 <nav aria-label="Volumes" className="sticky top-0 z-30 -mx-2 sm:-mx-4 px-2 sm:px-4 py-2 mb-6 bg-bauhaus-canvas border-b-4 border-bauhaus-black overflow-x-auto">
 <ol className="flex flex-nowrap items-center gap-1 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
 {[
 { id: 'vol-1', label: 'V1 · State', tone: 'border-bauhaus-red' },
 { id: 'vol-2', label: 'V2 · Funnel', tone: 'border-bauhaus-yellow' },
 { id: 'vol-3', label: 'V3 · Money', tone: 'border-bauhaus-blue' },
 { id: 'vol-4', label: 'V4 · Network', tone: 'border-bauhaus-black' },
 { id: 'vol-5', label: 'V5 · Evidence', tone: 'border-bauhaus-blue' },
 { id: 'vol-6', label: 'V6 · Place', tone: 'border-bauhaus-yellow' },
 { id: 'vol-7', label: 'V7 · Policy + Live', tone: 'border-bauhaus-red' },
 ].map(v => (
 <li key={v.id}>
 <a href={`#${v.id}`} className={`inline-block px-3 py-2 border-2 ${v.tone} bg-white text-bauhaus-black hover:bg-bauhaus-yellow`}>{v.label}</a>
 </li>
 ))}
 </ol>
 </nav>

 {/* HEADLINE STATS BAR, structural story, not bare numbers */}
 <section className="mb-12 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
 {(() => {
 const detRatio = r.community > 0 ? (r.detention / r.community).toFixed(2) : '—';
 const ctgGap = r.ctg.length > 0 ? Math.max(0, ((Number(r.ctg[r.ctg.length - 1]?.actual_rate) || 0) - 33.1)) : 0;
 const cells: Array<{ kicker: string; stat: string; descriptor: string; tone: 'red' | 'blue' | 'yellow' | 'black'; href?: string }> = [
 {
 kicker: 'Right now',
 stat: ws ? String(ws.total_children) : '—',
 descriptor: `children in adult police watchhouses · ${fnPctChild}% First Nations`,
 tone: 'red',
 href: '#vol-1',
 },
 {
 kicker: 'Custody vs community',
 stat: `${detRatio} : 1`,
 descriptor: `detention dollars for every $1 of community-based services (${money(r.detention)} vs ${money(r.community)})`,
 tone: 'red',
 href: '#vol-3',
 },
 {
 kicker: 'ACCO funding gap',
 stat: `${accoSharePct}% / ~65–75%`,
 descriptor: 'ACCO funding share (CivicGraph, justice_funding) vs First Nations share of children in QLD detention (AIHW Youth Detention Population 2024-25, range across quarters)',
 tone: 'red',
 href: '#vol-3',
 },
 ...(r.accoRetentionLatest && r.accoRetentionPeak ? [{
 kicker: 'ACCO retention trend',
 stat: `${Math.round(Number(r.accoRetentionPeak.metric_value))}% → ${Math.round(Number(r.accoRetentionLatest.metric_value))}%`,
 descriptor: `year-over-year continuity of community-controlled YJ providers · ${r.accoRetentionPeak.period} peak → ${r.accoRetentionLatest.period}`,
 tone: 'red' as const,
 href: '#vol-3',
 }] : []),
 {
 kicker: 'Legislation since 2024',
 stat: `${fmt(r.officialBills.length)} bills`,
 descriptor: 'YJ-relevant bills tracked, major Acts since 2024 are custody-expanding',
 tone: 'red',
 href: '#vol-7',
 },
 {
 kicker: 'Capital pipeline',
 stat: '+120 beds',
 descriptor: 'Woodford (80) + Cairns (40) in build · Wacol Remand (76) opened 2025',
 tone: 'blue',
 href: '#vol-1',
 },
 {
 kicker: 'Coronial findings live',
 stat: fmt(r.coronerFindings.length),
 descriptor: 'in-custody / YJ-flagged inquests · 27 recommendations on Pilkington alone',
 tone: 'red',
 href: '#vol-7',
 },
 {
 kicker: 'Evidence base',
 stat: fmt(r.almaInterventions.length),
 descriptor: `QLD-tagged ALMA programs · ${r.unfundedPrograms.length} effective ones with no funding link`,
 tone: 'blue',
 href: '#vol-5',
 },
 {
 kicker: 'CTG target 11',
 stat: ctgGap > 0 ? `+${ctgGap.toFixed(1)}/10K` : '—',
 descriptor: 'gap from the trajectory toward a 30% reduction by 2031, widening, not narrowing',
 tone: 'red',
 href: '#vol-1',
 },
 ];
 const toneClasses = (t: string) => ({
 red: { border: 'border-bauhaus-red', stat: 'text-bauhaus-red' },
 blue: { border: 'border-bauhaus-blue', stat: 'text-bauhaus-blue' },
 yellow: { border: 'border-bauhaus-yellow', stat: 'text-bauhaus-black' },
 black: { border: 'border-bauhaus-black', stat: 'text-bauhaus-black' },
 }[t] ?? { border: 'border-bauhaus-black', stat: 'text-bauhaus-black' });
 return cells.map((s, i) => {
 const t = toneClasses(s.tone);
 const Wrapper: React.ComponentType<{ children: React.ReactNode; className: string }> =
 s.href
 ? (({ children, className }) => <a href={s.href} className={className}>{children}</a>) as React.ComponentType<{ children: React.ReactNode; className: string }>
 : (({ children, className }) => <div className={className}>{children}</div>);
 return (
 <Wrapper key={i} className={`border-4 ${t.border} p-4 bg-white block ${s.href ? 'hover:bg-bauhaus-canvas transition-colors' : ''}`}>
 <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted mb-2">{s.kicker}</div>
 <div className={`text-2xl sm:text-3xl font-black tabular-nums leading-none mb-2 ${t.stat}`}>{s.stat}</div>
 <p className="text-[11px] text-bauhaus-black leading-snug font-medium">{s.descriptor}</p>
 </Wrapper>
 );
 });
 })()}
 </section>

 {/* ════ VOLUME 1, THE STATE TODAY ════ */}
 <div id="vol-1" className="mb-10 mt-16 border-l-8 border-bauhaus-red pl-5 scroll-mt-24">
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
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The bed problem, detention occupancy + watchhouse-as-overflow</h3>
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
 <p className="text-[10px] text-bauhaus-muted font-mono mt-2">Methodology: capital figures sourced from industry trackers and ministerial statements. QLD Budget Paper 3 line-by-line reconciliation pending.</p>
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
 <section id="section-3" className="mb-16 scroll-mt-24">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§3</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Who&apos;s in custody, Closing the Gap target 11 progress</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 National Agreement on Closing the Gap: target 11 commits to reducing the rate of First Nations young people in detention by 30% by 2031. Below: QLD&apos;s actual rate vs the target trajectory.
 </p>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-w-3xl">
 <div className="border-4 border-bauhaus-red p-4 bg-white">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1">First Nations share · QLD detention</div>
 <div className="text-2xl sm:text-3xl font-black text-bauhaus-red tabular-nums leading-none mb-1">~65–75%</div>
 <p className="text-[11px] text-bauhaus-black leading-snug font-medium">AIHW Youth Detention Population 2024-25, range across quarterly snapshots. Compared to ~5% First Nations share of QLD&apos;s 10–17 population.</p>
 </div>
 <div className="border-4 border-bauhaus-black p-4 bg-white">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">ACCO funding share · QLD YJ grants</div>
 <div className="text-2xl sm:text-3xl font-black text-bauhaus-black tabular-nums leading-none mb-1">{accoSharePct}%</div>
 <p className="text-[11px] text-bauhaus-black leading-snug font-medium">Aboriginal Community-Controlled share of <code className="font-mono">justice_funding</code> dollars (CivicGraph). Frame your grants against the AIHW denominator, not the population baseline.</p>
 </div>
 </div>
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

 {/* ════ VOLUME 2, THE FUNNEL ════ */}
 <div id="vol-2" className="mb-10 mt-16 border-l-8 border-bauhaus-yellow pl-5 scroll-mt-24">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">VOLUME 2</div>
 <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">The Funnel</h2>
 <p className="text-bauhaus-muted font-medium max-w-3xl">Cross-linked pathways: child protection, disability, mental health, addiction, and education disengagement that funnel children into the youth-justice system.</p>
 </div>

 {/* §4 LGA HOTSPOTS, pipeline */}
 <section className="mb-16">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§4</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The pipeline, vulnerability hotspots by QLD LGA</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 Top 15 QLD Local Government Areas ranked by <span className="font-black">pipeline intensity</span>, a composite score from <code className="font-mono text-xs">lga_cross_system_stats</code> combining welfare-recipient density, school disadvantage, and Indigenous-population share. With cross-system context: NDIS youth, JobSeeker, schools, and tracked funding.
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
 <p className="text-xs text-bauhaus-muted font-mono mt-3">Source: <code>lga_cross_system_stats</code>. Pipeline intensity is a composite score (welfare density + school disadvantage + Indigenous share). Youth pop estimated from QLD state-level 10–17 share (10.4% per ABS ERP June 2024) where per-LGA ABS data not yet ingested, flagged in <code>sources.youth_population_method</code>. Per-LGA youth-offender rates aren&apos;t yet sourced into this dataset for QLD. Funding = grants traced through this LGA in our dataset.</p>
 </section>

 {/* §5 NDIS / DISABILITY OVERLAP */}
 <section className="mb-16">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§5</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Disability &amp; justice, NDIS youth in QLD</h3>
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
 <p className="text-xs text-bauhaus-muted font-mono mt-3">Source: <code>v_ndis_youth_justice_overlay</code>. AIHW Youth Justice reporting identifies cognitive disability over-representation in the cohort; NDIS data is one of the only structured records of disability supports for young people 15–18. <span className="font-black">Categories are not mutually exclusive:</span> a participant can hold more than one primary disability classification, so the autism / intellectual / psychosocial counts may sum higher than the youth (15–18) total.</p>
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
 Welfare payments (Disability Support Pension, JobSeeker, Youth Allowance) cluster in the same QLD LGAs as low-ICSEA schools and high youth-offender rates. The pipeline doesn&apos;t start with the police, it starts with disengagement.
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
 <p className="text-sm text-bauhaus-muted font-medium max-w-3xl mb-6">
 The §4 hotspot table above shows that LGAs with the highest pipeline-intensity scores also carry the highest count of low-ICSEA schools (the ACARA Index of Community Socio-Educational Advantage; lower scores indicate concentrated disadvantage). The system doesn&apos;t fail at the courthouse; it fails at the schoolyard.
 </p>

 {/* QLD-aggregate stat strip */}
 {r.qldTotals && (() => {
 const top10 = r.heatmap.slice(0, 10);
 const top10Pop = top10.reduce((s, h) => s + (h.population ?? 0), 0);
 const top10Dsp = top10.reduce((s, h) => s + (h.dsp_recipients ?? 0), 0);
 const top10Js = top10.reduce((s, h) => s + (h.jobseeker_recipients ?? 0), 0);
 const top10Ya = top10.reduce((s, h) => s + (h.youth_allowance_recipients ?? 0), 0);
 const top10LowIcsea = top10.reduce((s, h) => s + (h.low_icsea_schools ?? 0), 0);
 const total = r.qldTotals;
 const popShare = total.pop > 0 ? (top10Pop / Number(total.pop)) * 100 : 0;
 const dspShare = total.dsp > 0 ? (top10Dsp / Number(total.dsp)) * 100 : 0;
 const jsShare = total.js > 0 ? (top10Js / Number(total.js)) * 100 : 0;
 const yaShare = total.ya > 0 ? (top10Ya / Number(total.ya)) * 100 : 0;
 const icseaShare = total.low_icsea > 0 ? (top10LowIcsea / Number(total.low_icsea)) * 100 : 0;
 const concentration = (((dspShare + jsShare + yaShare + icseaShare) / 4) - popShare).toFixed(1);
 return (
 <div className="border-4 border-bauhaus-black p-5 bg-bauhaus-canvas mb-6">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">The disengagement concentration</div>
 <h4 className="text-lg font-black text-bauhaus-black uppercase tracking-tight mb-3">Top 10 hotspot LGAs vs the rest of QLD</h4>
 <p className="text-sm text-bauhaus-black font-medium leading-relaxed mb-5 max-w-3xl">
 The top 10 hotspot LGAs by pipeline intensity hold <span className="font-black">{popShare.toFixed(1)}%</span> of QLD&apos;s population, but a disproportionate share of the welfare and disadvantage signals that precede the courthouse. The disengagement pipeline shows up in the data before the offending does.
 </p>
 <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
 <div className="border-l-4 border-bauhaus-blue pl-3 bg-white p-3">
 <div className="text-2xl font-black tabular-nums text-bauhaus-blue leading-none">{popShare.toFixed(1)}%</div>
 <div className="text-[10px] font-black uppercase tracking-widest mt-1">Population share</div>
 <p className="text-xs text-bauhaus-black/70 mt-1">{fmt(top10Pop)} of {fmt(Number(total.pop))} QLD residents.</p>
 </div>
 <div className={`border-l-4 ${dspShare > popShare ? 'border-bauhaus-red' : 'border-bauhaus-blue'} pl-3 bg-white p-3`}>
 <div className={`text-2xl font-black tabular-nums leading-none ${dspShare > popShare ? 'text-bauhaus-red' : 'text-bauhaus-blue'}`}>{dspShare.toFixed(1)}%</div>
 <div className="text-[10px] font-black uppercase tracking-widest mt-1">DSP share</div>
 <p className="text-xs text-bauhaus-black/70 mt-1">{fmt(top10Dsp)} of {fmt(Number(total.dsp))} on Disability Support Pension.</p>
 </div>
 <div className={`border-l-4 ${jsShare > popShare ? 'border-bauhaus-red' : 'border-bauhaus-blue'} pl-3 bg-white p-3`}>
 <div className={`text-2xl font-black tabular-nums leading-none ${jsShare > popShare ? 'text-bauhaus-red' : 'text-bauhaus-blue'}`}>{jsShare.toFixed(1)}%</div>
 <div className="text-[10px] font-black uppercase tracking-widest mt-1">JobSeeker share</div>
 <p className="text-xs text-bauhaus-black/70 mt-1">{fmt(top10Js)} of {fmt(Number(total.js))} on JobSeeker.</p>
 </div>
 <div className={`border-l-4 ${yaShare > popShare ? 'border-bauhaus-red' : 'border-bauhaus-blue'} pl-3 bg-white p-3`}>
 <div className={`text-2xl font-black tabular-nums leading-none ${yaShare > popShare ? 'text-bauhaus-red' : 'text-bauhaus-blue'}`}>{yaShare.toFixed(1)}%</div>
 <div className="text-[10px] font-black uppercase tracking-widest mt-1">Youth Allowance share</div>
 <p className="text-xs text-bauhaus-black/70 mt-1">{fmt(top10Ya)} of {fmt(Number(total.ya))} on Youth Allowance.</p>
 </div>
 <div className={`border-l-4 ${icseaShare > popShare ? 'border-bauhaus-red' : 'border-bauhaus-blue'} pl-3 bg-white p-3`}>
 <div className={`text-2xl font-black tabular-nums leading-none ${icseaShare > popShare ? 'text-bauhaus-red' : 'text-bauhaus-blue'}`}>{icseaShare.toFixed(1)}%</div>
 <div className="text-[10px] font-black uppercase tracking-widest mt-1">Low-ICSEA schools</div>
 <p className="text-xs text-bauhaus-black/70 mt-1">{fmt(top10LowIcsea)} of {fmt(Number(total.low_icsea))} below-average schools.</p>
 </div>
 </div>
 <p className="text-xs text-bauhaus-muted font-mono mt-4">
 {Number(concentration) > 0
 ? <>Avg over-concentration: hotspot LGAs hold ~<span className="font-black">{concentration}pp</span> more of QLD&apos;s welfare + low-ICSEA-school count than their population share. Red bars = signals running over-population. Blue = at or below.</>
 : <>Hotspot share roughly tracks population share. Blue bars = signals running at or below population share.</>}
 <br/>Source: <code>lga_cross_system_stats</code> · DSS Demographics + ABS ERP + ACARA ICSEA aggregates.
 </p>
 </div>
 );
 })()}

 {/* Per-LGA detail table */}
 <div className="border-4 border-bauhaus-black overflow-x-auto mb-4">
 <table className="w-full text-sm">
 <thead className="bg-bauhaus-black text-white">
 <tr>
 <th className="text-left p-2 font-black uppercase tracking-widest text-[10px]">LGA</th>
 <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">Youth pop</th>
 <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">DSP</th>
 <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">JobSeeker</th>
 <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">Youth Allow.</th>
 <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">Low-ICSEA / total</th>
 <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">Avg ICSEA</th>
 <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">Indig. %</th>
 </tr>
 </thead>
 <tbody>
 {r.heatmap.slice(0, 12).map((h, i) => (
 <tr key={h.lga_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
 <td className="p-2 font-black text-bauhaus-black">{h.lga_name}</td>
 <td className="p-2 text-right font-mono text-xs">{fmt(h.youth_population)}</td>
 <td className="p-2 text-right font-mono text-xs">{fmt(h.dsp_recipients)}</td>
 <td className="p-2 text-right font-mono text-xs">{fmt(h.jobseeker_recipients)}</td>
 <td className="p-2 text-right font-mono text-xs">{fmt(h.youth_allowance_recipients)}</td>
 <td className={`p-2 text-right font-mono text-xs ${(h.low_icsea_schools ?? 0) >= 5 ? 'font-black text-bauhaus-red' : ''}`}>{fmt(h.low_icsea_schools)} / {fmt(h.school_count)}</td>
 <td className={`p-2 text-right font-mono text-xs ${(h.avg_icsea ?? 1000) < 970 ? 'font-black text-bauhaus-red' : ''}`}>{h.avg_icsea ?? '—'}</td>
 <td className="p-2 text-right font-mono text-xs">{h.indigenous_pct != null ? `${Number(h.indigenous_pct).toFixed(1)}%` : '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <p className="text-xs text-bauhaus-muted font-mono">
 Read horizontally: each LGA&apos;s welfare load + school-disadvantage profile + Indigenous share. ICSEA: ACARA Index of Community Socio-Educational Advantage; <code>1000</code> is the national mean. Schools below 970 carry meaningful disadvantage; cells highlighted in red. Five-or-more low-ICSEA schools in an LGA also flagged. Source: <code>lga_cross_system_stats</code> · DSS Demographics 2024 + ACARA ICSEA + ABS ERP.
 </p>
 </section>

 {/* ════ VOLUME 3, THE MONEY ════ */}
 <div id="vol-3" className="mb-10 mt-16 border-l-8 border-bauhaus-blue pl-5 scroll-mt-24">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">VOLUME 3</div>
 <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">The Money, and the gaps in support</h2>
 <p className="text-bauhaus-muted font-medium max-w-3xl">
 {r.communityOrdersAvg && r.detentionTonight ? (
 <>QLD already supervises ~{r.communityOrdersAvg} young people in their communities every day, {(r.communityOrdersAvg / r.detentionTonight).toFixed(1)}× the number locked up. Community-based work isn&apos;t theoretical; it&apos;s the largest part of how QLD already runs the system. The question this volume answers is why the dollars don&apos;t follow the supervision, and where the gaps in support sit.</>
 ) : (
 <>Where the dollars actually go: detention vs community, top recipients, the ACCO funding gap, the foundation landscape, federal procurement.</>
 )}
 </p>
 </div>

 {/* §7.5 THE SUPPORT GAP, consolidates fragments scattered across other sections */}
 <section className="mb-12 border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">§7.5 · THE SUPPORT GAP</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">What &ldquo;not being supported&rdquo; looks like in five numbers</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 The detention-vs-community ratio is the headline. The gaps inside the community line are the deeper story. Five signals make the support deficit concrete, each is sourced live below from a different part of the dataset.
 </p>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
 <div className="border-l-4 border-bauhaus-red pl-3 bg-white p-3">
 <div className="text-2xl font-black tabular-nums leading-none mb-1 text-bauhaus-red">
 {r.remandPct != null ? `${r.remandPct}%` : '—'}
 </div>
 <div className="text-[10px] font-black uppercase tracking-widest mb-1">on remand without conviction</div>
 <p className="text-xs text-bauhaus-black/70 leading-snug">
 {r.remandTonight != null && r.detentionTonight ? <>~{r.remandTonight} of ~{r.detentionTonight} children in detention each night, locked up while waiting for court, no community plan.</> : 'AIHW avg-nightly detention vs sentenced.'}
 </p>
 </div>
 <div className="border-l-4 border-bauhaus-red pl-3 bg-white p-3">
 <div className="text-2xl font-black tabular-nums leading-none mb-1 text-bauhaus-red">
 {r.mhFundingCount}
 </div>
 <div className="text-[10px] font-black uppercase tracking-widest mb-1">grants tagged mental-health or AOD</div>
 <p className="text-xs text-bauhaus-black/70 leading-snug">
 QLD justice-funding rows tagged mental-health or AOD, out of thousands. AIHW reports high MH/AOD comorbidity in the cohort. The funding stream doesn&apos;t name the issue.
 </p>
 </div>
 <div className="border-l-4 border-bauhaus-red pl-3 bg-white p-3">
 <div className="text-2xl font-black tabular-nums leading-none mb-1 text-bauhaus-red">
 {r.unfundedPrograms.length}
 </div>
 <div className="text-[10px] font-black uppercase tracking-widest mb-1">effective programs unfunded</div>
 <p className="text-xs text-bauhaus-black/70 leading-snug">
 ALMA-listed QLD interventions graded &ldquo;Proven&rdquo; or &ldquo;Effective&rdquo; with no traceable funding link. They run; they work; they don&apos;t scale.
 </p>
 </div>
 {r.accoRetentionLatest && r.accoRetentionPeak && (
 <div className="border-l-4 border-bauhaus-red pl-3 bg-white p-3">
 <div className="text-2xl font-black tabular-nums leading-none mb-1 text-bauhaus-red">
 {Math.round(Number(r.accoRetentionPeak.metric_value))}% → {Math.round(Number(r.accoRetentionLatest.metric_value))}%
 </div>
 <div className="text-[10px] font-black uppercase tracking-widest mb-1">ACCO retention · YoY</div>
 <p className="text-xs text-bauhaus-black/70 leading-snug">
 ACCOs delivering YJ work in {r.accoRetentionPeak.period} vs still funded in {r.accoRetentionLatest.period}. Children losing their providers mid-system.
 </p>
 </div>
 )}
 <div className="border-l-4 border-bauhaus-red pl-3 bg-white p-3">
 <div className="text-2xl font-black tabular-nums leading-none mb-1 text-bauhaus-red">
 {accoSharePct}%
 </div>
 <div className="text-[10px] font-black uppercase tracking-widest mb-1">ACCO funding share</div>
 <p className="text-xs text-bauhaus-black/70 leading-snug">
 For ~{fnPctChild}% First Nations share of children in custody. The mismatch is the cleanest single signal of who&apos;s underfunded relative to need.
 </p>
 </div>
 </div>
 <div className="mt-4 text-xs font-mono text-bauhaus-black/60">
 Sources: AIHW avg-nightly detention (§1) · <code>justice_funding</code> topic tags (§6) · <code>mv_yj_report_unfunded_programs</code> (§17) · <code>v_acco_yj_retention_qld</code> (§10) · <code>mv_yj_report_acco_gap</code> (§10).
 </div>
 </section>

 {/* V3 METHODOLOGY NOTE, resolves the two-spend-figures confusion */}
 <section className="mb-8 border-l-4 border-bauhaus-yellow pl-4 max-w-3xl text-xs">
 <div className="font-black uppercase tracking-widest text-bauhaus-black mb-1">Reading two budget windows together</div>
 <p className="text-bauhaus-muted font-medium leading-snug">
 Volume 3 cites two spend figures intentionally. <span className="font-black text-bauhaus-black">Cumulative dataset spend</span> ({money(r.detention)} detention / {money(r.community)} community) covers every QLD justice line item in <code className="font-mono">justice_funding</code> across the indexed window (2008-26). <span className="font-black text-bauhaus-black">Current-year recurrent</span> ({r.detSpendLatest ? `$${(Number(r.detSpendLatest.metric_value)/1000).toFixed(0)}M detention (${r.detSpendLatest.period})` : 'ROGS detention'}) is the latest single year from ROGS Section 17. Same direction of travel; different denominators. The {r.community > 0 ? (r.detention / r.community).toFixed(2) : '—'}:1 ratio above is from the cumulative window.
 </p>
 </section>

 {/* §8 DETENTION VS COMMUNITY MULTI-YEAR */}
 <section id="section-8" className="mb-16 scroll-mt-24">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§8</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Detention vs community, the structural ratio</h3>
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
 // Partial-coverage years: 2013-14 (no sums), 2014-15 (~$181M, ~10% of normal), 2025-26 (in progress)
 const partialYears = new Set(['2013-14', '2014-15', '2025-26']);
 const isPartial = partialYears.has(fy);
 return (
 <div key={fy}>
 <div className="flex justify-between text-xs font-mono mb-1">
 <span className="font-black text-bauhaus-black">FY {fy}{isPartial && <span className="text-bauhaus-muted font-medium ml-1">· partial</span>}</span>
 <span className="text-bauhaus-muted">{money(total)}{isPartial && <span className="ml-1">*</span>}</span>
 </div>
 <div className={`relative h-6 bg-bauhaus-canvas border-2 border-bauhaus-black flex ${isPartial ? 'opacity-40' : ''}`} style={{ width: `${(total / peak) * 100}%` }}>
 {(['youth-justice','child-protection','indigenous','disability','family-services'] as const).map((topic) => {
 const v = byTopic[topic] || 0;
 if (v <= 0) return null;
 const colorMap: Record<string, string> = { 'youth-justice': 'bg-bauhaus-red', 'child-protection': 'bg-bauhaus-blue', 'indigenous': 'bg-bauhaus-yellow', 'disability': 'bg-bauhaus-black', 'family-services': 'bg-bauhaus-muted' };
 return <div key={topic} className={colorMap[topic]} style={{ width: `${(v / total) * 100}%` }} title={`${topic}: ${money(v)}${isPartial ? ' (partial coverage)' : ''}`} />;
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
 <p className="text-[10px] text-bauhaus-muted font-mono mt-2">* Partial-coverage years (FY13–15 missing source rows; FY25–26 in progress) are shown at 40% opacity. Treat their bar heights as a floor, not a real budget movement.</p>
 </div>
 </div>
 )}
 </section>

 {/* §9 TOP RECIPIENTS */}
 <section id="top-recipients" className="mb-16 scroll-mt-24">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§9</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Where the community {money(r.community)} actually goes</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 Top 15 QLD recipients of youth-justice-tagged grants (excluding state department line items) <span className="font-black">with at least one grant since FY22</span>. National NGOs hold the largest contracts. Aboriginal Community-Controlled Organisations are funded, but at smaller dollar amounts (see §10). Recipients with no grants since FY22 appear in the historical section below.
 </p>
 {(() => {
 const isCurrent = (ly: string | null | undefined) => {
 if (!ly) return false;
 const yr = parseInt(ly.slice(0, 4), 10);
 return Number.isFinite(yr) && yr >= 2021; // FY21-22 onwards (financial_year string starts '2021-' for FY21-22)
 };
 const current = r.recipients.filter(p => isCurrent(p.last_year)).slice(0, 15);
 const historical = r.recipients.filter(p => !isCurrent(p.last_year));
 return (
 <>
 <div className="border-4 border-bauhaus-black overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-bauhaus-black text-white">
 <tr>
 <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Recipient</th>
 <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total</th>
 <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Grants</th>
 <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Last grant FY</th>
 <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Detail</th>
 </tr>
 </thead>
 <tbody>
 {current.map((p, i) => {
 const slug = QLD_YJ_RECIPIENT_SLUG_BY_NAME[p.recipient_name];
 return (
 <tr key={p.recipient_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
 <td className="p-3 font-black text-bauhaus-black">{displayName(p.recipient_name)}</td>
 <td className="p-3 text-right font-mono font-black">{money(p.total)}</td>
 <td className="p-3 text-right font-mono">{p.grants}</td>
 <td className="p-3 text-right font-mono text-xs">{p.last_year ?? '—'}</td>
 <td className="p-3 text-right font-mono text-xs">
 {slug ? (
 <Link href={`/reports/youth-justice/qld/recipient/${slug}`} className="text-bauhaus-blue font-black hover:underline">Detail →</Link>
 ) : (
 <span className="text-bauhaus-muted">—</span>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 {historical.length > 0 && (
 <details className="mt-4 border-4 border-bauhaus-black bg-white">
 <summary className="cursor-pointer p-4 hover:bg-bauhaus-yellow flex flex-wrap items-baseline gap-3 list-none">
 <span className="font-black text-bauhaus-black uppercase tracking-widest text-xs">Historical (pre-FY22) recipients</span>
 <span className="font-mono text-xs text-bauhaus-muted">{historical.length} recipient{historical.length === 1 ? '' : 's'} · last grant before 2021-22</span>
 <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">▼ expand</span>
 </summary>
 <div className="border-t-4 border-bauhaus-black overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-bauhaus-canvas">
 <tr>
 <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Recipient</th>
 <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total</th>
 <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Grants</th>
 <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Last grant FY</th>
 </tr>
 </thead>
 <tbody>
 {historical.map((p, i) => (
 <tr key={p.recipient_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
 <td className="p-3 font-black text-bauhaus-black">{displayName(p.recipient_name)}</td>
 <td className="p-3 text-right font-mono font-black">{money(p.total)}</td>
 <td className="p-3 text-right font-mono">{p.grants}</td>
 <td className="p-3 text-right font-mono text-xs">{p.last_year ?? '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </details>
 )}
 </>
 );
 })()}

 </section>


 {/* §9.5, PROGRAMMES REGISTRY: announcement → bill → funding → status → circuit breaker (renumbered from §9.6 in Wave 3) */}
 <section className="mb-16">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§9.5 · PROGRAMMES REGISTRY</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">What was announced, and what&apos;s actually locked in</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-3">
 {QLD_PROGRAMME_REGISTRY.length} major QLD youth-justice initiatives, each laid out as a circuit diagram: <span className="font-black">Announcement → Bill → $ Funded → Delivery → Circuit breaker.</span> Where a node is missing, the gap is the data: an announcement without a bill is rhetoric; a bill without a funded program is paper; a funded program without an announcement is invisible. Each row ends with the explicit <span className="font-black text-bauhaus-red">Circuit breaker</span>, the leverage point that would change the trajectory.
 </p>
 <div className="border-l-4 border-bauhaus-red pl-3 mb-5 text-sm bg-bauhaus-canvas p-3 max-w-3xl">
 <span className="font-black uppercase tracking-widest text-[10px] text-bauhaus-red">How to read this</span>
 <p className="mt-1 text-bauhaus-black leading-snug">Each card maps an announced initiative through five questions: <span className="font-black">(1)</span> what was said publicly, <span className="font-black">(2)</span> was a bill passed, <span className="font-black">(3)</span> is there money flowing, <span className="font-black">(4)</span> what&apos;s the delivery status, <span className="font-black">(5)</span> what would unblock or break the pattern. The fifth question is where the work is, for boards, funders, journalists, and sector peaks.</p>
 </div>

 {/* Status legend */}
 <div className="flex flex-wrap gap-2 mb-6 text-[10px] font-black uppercase tracking-widest">
 <span className="px-2 py-1 bg-bauhaus-red text-white">custody-direction</span>
 <span className="px-2 py-1 bg-bauhaus-blue text-white">community-direction</span>
 <span className="px-2 py-1 bg-bauhaus-yellow text-bauhaus-black">mixed</span>
 <span className="ml-auto px-2 py-1 border-2 border-bauhaus-black">{QLD_PROGRAMME_REGISTRY.filter(p => p.direction === 'custody').length} custody</span>
 <span className="px-2 py-1 border-2 border-bauhaus-black">{QLD_PROGRAMME_REGISTRY.filter(p => p.direction === 'community').length} community</span>
 <span className="px-2 py-1 border-2 border-bauhaus-black">{QLD_PROGRAMME_REGISTRY.filter(p => p.bill !== null).length} have bills</span>
 <span className="px-2 py-1 border-2 border-bauhaus-black">{QLD_PROGRAMME_REGISTRY.filter(p => p.funding_match !== null).length} matched to funding stream</span>
 <span className="px-2 py-1 border-2 border-bauhaus-black">{QLD_PROGRAMME_REGISTRY.filter(p => p.announcement !== null).length} have public announcement</span>
 </div>

 <div className="space-y-3">
 {QLD_PROGRAMME_REGISTRY.map((p, i) => {
 const directionColor = p.direction === 'custody' ? 'border-bauhaus-red' : p.direction === 'community' ? 'border-bauhaus-blue' : 'border-bauhaus-yellow';
 const directionLabel = p.direction === 'custody' ? 'CUSTODY' : p.direction === 'community' ? 'COMMUNITY' : 'MIXED';
 const directionTextColor = p.direction === 'custody' ? 'text-bauhaus-red' : p.direction === 'community' ? 'text-bauhaus-blue' : 'text-bauhaus-black';
 const statusBadge = {
 'announced-only': { bg: 'bg-bauhaus-yellow', fg: 'text-bauhaus-black', label: '⚠ announced, no bill, no funding visible' },
 'announced-funded': { bg: 'bg-bauhaus-blue', fg: 'text-white', label: '✓ announced + funding stream matched' },
 'bill-passed': { bg: 'bg-bauhaus-red', fg: 'text-white', label: '⚖ Bill PASSED' },
 'bill-pending': { bg: 'bg-bauhaus-yellow', fg: 'text-bauhaus-black', label: '⌛ Bill before parliament' },
 'operational': { bg: 'bg-bauhaus-blue', fg: 'text-white', label: '▶ operational · funded + delivering' },
 'under-construction': { bg: 'bg-bauhaus-yellow', fg: 'text-bauhaus-black', label: '🏗 under construction' },
 'recently-opened': { bg: 'bg-bauhaus-red', fg: 'text-white', label: '✓ opened · operating' },
 'repealed': { bg: 'bg-bauhaus-black', fg: 'text-white', label: '✗ REPEALED' },
 }[p.status];
 return (
 <div key={i} className={`border-l-4 ${directionColor} bg-white p-5`}>
 <div className="flex flex-wrap items-baseline gap-3 mb-3">
 <span className="font-mono font-black text-xs text-bauhaus-muted tabular-nums">#{i + 1}</span>
 <span className={`text-[10px] font-black uppercase tracking-widest ${directionTextColor}`}>{directionLabel}</span>
 <span className="font-black text-bauhaus-black text-base flex-1 min-w-[14rem]">{p.name}</span>
 <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 ${statusBadge.bg} ${statusBadge.fg}`}>{statusBadge.label}</span>
 </div>

 <div className="grid sm:grid-cols-3 gap-4 text-xs">
 {/* Announcement */}
 <div className="border-l-2 border-bauhaus-black pl-3">
 <div className="font-black uppercase tracking-widest text-bauhaus-muted mb-1">Announcement</div>
 {p.announcement ? (
 <>
 <div className="font-mono font-black text-[10px] text-bauhaus-black">{new Date(p.announcement.date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
 <p className="text-bauhaus-black leading-snug font-medium mt-1">{p.announcement.headline}</p>
 <p className="text-[10px] text-bauhaus-muted font-mono mt-1">{p.announcement.minister}</p>
 <a href={p.announcement.source_url} target="_blank" rel="noopener" className="text-bauhaus-blue text-[10px] font-mono hover:underline">source ↗</a>
 </>
 ) : (
 <p className="text-bauhaus-muted italic text-xs">No public announcement located. Likely a recurrent contracting line, not a launched initiative.</p>
 )}
 </div>

 {/* Bill */}
 <div className="border-l-2 border-bauhaus-black pl-3">
 <div className="font-black uppercase tracking-widest text-bauhaus-muted mb-1">Bill / Legislation</div>
 {p.bill ? (
 <>
 <p className="text-bauhaus-black font-black leading-snug">{p.bill.name}</p>
 <p className="text-[10px] font-mono text-bauhaus-muted mt-1">
 <span className={p.bill.status.toUpperCase().includes('PASSED') ? 'text-bauhaus-red font-black' : ''}>{p.bill.status}</span>
 {p.bill.status_date && <> · {p.bill.status_date}</>}
 </p>
 <a href={p.bill.source_url} target="_blank" rel="noopener" className="text-bauhaus-blue text-[10px] font-mono hover:underline">bill text ↗</a>
 </>
 ) : (
 <p className="text-bauhaus-muted italic text-xs">No bill, administrative / appropriation / facility / funded-program initiative.</p>
 )}
 </div>

 {/* Funding + Delivery */}
 <div className="border-l-2 border-bauhaus-black pl-3">
 <div className="font-black uppercase tracking-widest text-bauhaus-muted mb-1">$ Funded / Delivery</div>
 {p.funding_match ? (
 <p className="text-bauhaus-black leading-snug font-medium">{p.funding_match.description}</p>
 ) : p.capital_cost ? (
 <p className="text-bauhaus-black leading-snug font-medium"><span className="font-black text-bauhaus-red">{p.capital_cost}</span></p>
 ) : (
 <p className="text-bauhaus-muted italic text-xs">No matched funding line in <code>justice_funding</code>. Either: not yet costed, funded via a separate department (Health / NDIS / Education), or sentencing/legislative change with no direct $ vehicle.</p>
 )}
 </div>
 </div>

 <div className="mt-3 grid sm:grid-cols-2 gap-3">
 {p.delivery_notes && (
 <div className="border-l-4 border-bauhaus-yellow pl-3 bg-bauhaus-canvas p-3">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black mb-1">What this actually does · status notes</div>
 <p className="text-xs text-bauhaus-black/85 leading-snug">{p.delivery_notes}</p>
 </div>
 )}
 {p.circuit_breaker && (
 <div className="border-l-4 border-bauhaus-red pl-3 bg-white p-3">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1">⚡ Circuit breaker · what would change this</div>
 <p className="text-xs text-bauhaus-black leading-snug font-medium">{p.circuit_breaker}</p>
 </div>
 )}
 </div>

 {/* DELIVERERS DRAWER, every org delivering this program, with entity-page click-through */}
 {p.funding_match?.program_name_pattern && (() => {
 const match = r.registryDeliverers.find(d => d.pattern === p.funding_match?.program_name_pattern);
 if (!match || match.recipients.length === 0) return null;
 return (
 <details className="mt-3 border-2 border-bauhaus-black bg-white">
 <summary className="cursor-pointer p-3 hover:bg-bauhaus-yellow flex flex-wrap items-baseline gap-2 list-none">
 <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">▶ Show all delivering organisations</span>
 <span className="text-[10px] font-mono text-bauhaus-muted">{match.recipient_count} organisation{match.recipient_count === 1 ? '' : 's'} · click each for full CivicGraph entity page (governance · board · all funding flows)</span>
 </summary>
 <div className="border-t-2 border-bauhaus-black p-4 bg-bauhaus-canvas">
 <table className="w-full text-xs">
 <thead>
 <tr className="border-b-2 border-bauhaus-black">
 <th className="text-left p-2 font-black uppercase tracking-widest text-[10px]">Organisation</th>
 <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">$ Total</th>
 <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">Grants</th>
 <th className="text-left p-2 font-black uppercase tracking-widest text-[10px]">Years</th>
 <th className="text-left p-2 font-black uppercase tracking-widest text-[10px]">CivicGraph entity · contact</th>
 </tr>
 </thead>
 <tbody>
 {match.recipients.map((rec, j) => (
 <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
 <td className="p-2 font-black text-bauhaus-black align-top">
 <div>{rec.name}</div>
 {rec.abn && <div className="font-mono text-[9px] text-bauhaus-muted">ABN {rec.abn}</div>}
 </td>
 <td className="p-2 text-right font-mono font-black tabular-nums align-top">{money(rec.total)}</td>
 <td className="p-2 text-right font-mono align-top">{rec.line_items}</td>
 <td className="p-2 font-mono text-[10px] text-bauhaus-muted align-top">{rec.first_fy ?? '?'}{rec.first_fy !== rec.last_fy ? `–${rec.last_fy ?? '?'}` : ''}</td>
 <td className="p-2 font-mono text-[10px] align-top">
 {rec.gs_id ? (
 <Link href={`/entity/${rec.gs_id}`} className="text-bauhaus-blue font-black hover:underline">→ open entity page</Link>
 ) : (
 <span className="text-bauhaus-muted">no entity match</span>
 )}
 {rec.website && (
 <div className="mt-0.5"><a href={`https://${rec.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline break-all">{rec.website} ↗</a></div>
 )}
 {rec.email && <div className="mt-0.5 text-bauhaus-muted break-all">{rec.email}</div>}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 <p className="mt-3 text-[10px] font-mono text-bauhaus-muted leading-snug">
 <span className="font-black">→ open entity page</span> reveals the full CivicGraph profile per org: directors · board interlocks (§14) · cross-system funding (procurement, donations, contracts, grants) · governance + relationships graph · ALMA evidence-base links · ACNC profile. Pattern matched: <code>program_name ILIKE &apos;%{p.funding_match?.program_name_pattern}%&apos;</code> against <code>justice_funding</code> (state=QLD, topics ⊃ youth-justice).
 </p>
 </div>
 </details>
 );
 })()}
 </div>
 );
 })}
 </div>

 <p className="text-xs text-bauhaus-muted font-mono mt-5 max-w-3xl leading-snug">
 <span className="font-black">Reading the patterns:</span> a row with a red <span className="font-black">Bill PASSED</span> badge and no matched funding line is custody-expansion law without parallel community investment, a one-way ratchet. A row with announcement + funding match but no bill is a community program running on appropriation, vulnerable to defunding without legislative friction. A row with <span className="font-black">announced, no bill, no funding visible</span> is rhetoric until proven otherwise. <span className="font-black">Limits:</span> {QLD_PROGRAMME_REGISTRY.length} major initiatives curated. Pair this registry with the per-recipient drill-downs (Detail → on each row of the §9 table) to see who&apos;s actually delivering each funded line.
 </p>
 </section>

 {/* §10 ACCO FUNDING GAP */}
 <section id="section-10" className="mb-16 scroll-mt-24">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§10</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The ACCO funding gap, {accoSharePct}% of dollars for the majority First Nations in-custody cohort</h3>
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
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Foundation landscape, billions in adjacent giving, none anchored to QLD YJ</h3>
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
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Federal procurement, Austender contracts to YJ-relevant suppliers</h3>
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

 {/* ════ VOLUME 4, THE NETWORK ════ */}
 <div id="vol-4" className="mb-10 mt-16 border-l-8 border-bauhaus-black pl-5 scroll-mt-24">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black">VOLUME 4</div>
 <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">The Network</h2>
 <p className="text-bauhaus-muted font-medium max-w-3xl">Multi-system providers, director board interlocks, political donations from contractors. Who&apos;s connected to whom, and what that does to accountability.</p>
 </div>

 {/* §13 CROSS-SECTOR PROVIDERS */}
 <section className="mb-16">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§13</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The multi-system providers, orgs operating across 3+ sectors</h3>
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
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Director interlocks, who sits on multiple boards</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 People holding 5+ board / advisory positions across charities or Indigenous corporations connected to justice funding. The federation&apos;s shadow network: governance, advocacy, and funding all run through a small cohort. <span className="font-black">Read the $ figures as network-cumulative, not per-person:</span> if two listed directors sit on the same board, both rows include that board&apos;s funding total, so the same dollars appear against multiple people. The point of the table is the overlap, not an individual exposure.
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
 <p className="text-[10px] text-bauhaus-muted font-mono mt-1">Cumulative across the disclosure window, all themes, not YJ-specific</p>
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

 {/* ════ VOLUME 5, THE EVIDENCE ════ */}
 <div id="vol-5" className="mb-10 mt-16 border-l-8 border-bauhaus-blue pl-5 scroll-mt-24">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">VOLUME 5</div>
 <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">The Evidence</h2>
 <p className="text-bauhaus-muted font-medium max-w-3xl">What works, what&apos;s funded, what&apos;s not. The Australian Living Map of Alternatives (ALMA) catalogues evaluated programs; we cross-reference them against funding flows.</p>
 </div>

 {/* §16 ALMA TYPE COUNTS + TOP INTERVENTIONS */}
 <section className="mb-16">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§16</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The ALMA evidence base</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 The Australian Living Map of Alternatives (ALMA), a civil-society register of community-endorsed and evaluated diversion / wraparound / justice-reinvestment / therapeutic / community-led programs. National counts by type, and the top {fmt(r.almaInterventions.length)} QLD-relevant interventions ranked by evidence + portfolio score.
 </p>
 <p className="text-xs text-bauhaus-muted font-mono mb-4 border-l-4 border-bauhaus-yellow pl-3"><span className="font-black uppercase tracking-widest">Methodology:</span> Evidence levels are self-attributed by ALMA submitters at registration time, not independently graded by CivicGraph. &ldquo;Proven&rdquo; / &ldquo;Effective&rdquo; / &ldquo;Promising&rdquo; reflect the program&apos;s own claim about its evaluation status, read as a starting point, not a verdict.</p>
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
 const tone = ev.includes('proven') ? 'border-bauhaus-blue' : ev.includes('promising') ? 'border-bauhaus-yellow' : 'border-bauhaus-black';
 return (
 <DetailDrawer
 key={i}
 toneClass={tone}
 title={a.name}
 subtitle={`${a.type}${a.evidence_level ? ` · ${a.evidence_level}` : ''}${a.cost_per_young_person ? ` · ~${money(a.cost_per_young_person)}/young person` : ''}`}
 trigger={
 <div className={`border-4 ${tone} p-4 bg-white hover:bg-bauhaus-canvas transition-colors cursor-pointer h-full`}>
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-1">{a.type}</div>
 <div className="font-black text-bauhaus-black uppercase tracking-tight text-sm leading-tight mb-2">{a.name}</div>
 <div className="text-[10px] text-bauhaus-muted font-mono leading-relaxed space-y-0.5">
 {a.evidence_level && <div>{a.evidence_level}</div>}
 {a.cultural_authority && <div>Cultural authority: {a.cultural_authority}</div>}
 {Array.isArray(a.geography) && a.geography.length > 0 && <div>Geography: {a.geography.slice(0, 4).join(' · ')}</div>}
 {a.cost_per_young_person ? <div>~{money(a.cost_per_young_person)}/young person</div> : null}
 </div>
 <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-blue mt-2">Read program detail →</div>
 </div>
 }
 >
 {a.description && (
 <DrawerSection label="What this program does">
 <p className="leading-relaxed">{a.description.replace(/\[\d+\]/g, '').trim()}</p>
 </DrawerSection>
 )}
 <DrawerKeyValue items={[
 { label: 'Intervention type', value: a.type },
 { label: 'Evidence level', value: a.evidence_level },
 { label: 'Cultural authority', value: a.cultural_authority },
 { label: 'Geography', value: Array.isArray(a.geography) ? a.geography.slice(0, 4).join(' · ') : null },
 { label: 'Cost per young person', value: a.cost_per_young_person ? `${money(a.cost_per_young_person)}` : null },
 { label: 'Portfolio score', value: a.portfolio_score != null ? a.portfolio_score.toFixed(2) : null },
 ]} />
 {a.topics && a.topics.length > 0 && (
 <DrawerSection label="Topic tags">
 <div className="flex flex-wrap gap-1">
 {a.topics.map((t, j) => (
 <span key={j} className="text-[10px] uppercase tracking-widest font-black bg-bauhaus-canvas text-bauhaus-black px-2 py-1 border border-bauhaus-black">{t}</span>
 ))}
 </div>
 </DrawerSection>
 )}
 <DrawerSection label="Methodology note">
 <p className="text-xs text-bauhaus-muted leading-relaxed">Evidence level is self-attributed by ALMA submitters at registration time, not independently graded by CivicGraph. &ldquo;Proven&rdquo; / &ldquo;Effective&rdquo; / &ldquo;Promising&rdquo; reflects the program&apos;s own claim about its evaluation status. The Australian Living Map of Alternatives is a civil-society register hosted at <a href="https://justicereinvestment.net.au" target="_blank" rel="noopener" className="text-bauhaus-blue font-black hover:underline">justicereinvestment.net.au</a>.</p>
 </DrawerSection>
 </DetailDrawer>
 );
 })}
 </div>
 </section>

 {/* §17 UNFUNDED EFFECTIVE */}
 <section id="section-17" className="mb-16 scroll-mt-24">
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
 { title: 'NT Royal Commission into the Detention and Protection of Children (2017)', recs: '227 recommendations · most unimplemented at scale', notes: 'Don Dale tear-gassing footage triggered the inquiry. NT government accepted most recommendations in principle; on-the-ground implementation remains partial nearly a decade on.' },
 { title: 'Royal Commission into Aboriginal Deaths in Custody (1991)', recs: '339 recommendations', notes: 'Implementation lagging across all jurisdictions; deaths in custody continue.' },
 { title: 'ALRC Pathways to Justice (2017)', recs: '35 recommendations', notes: 'Indigenous over-representation reform agenda; partial implementation at federal level.' },
 { title: 'Bringing Them Home (1997)', recs: '54 recommendations', notes: 'Stolen Generations inquiry, basis for ongoing reparations work.' },
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

 {/* ════ VOLUME 6, THE PLACE ════ */}
 <div id="vol-6" className="mb-10 mt-16 border-l-8 border-bauhaus-yellow pl-5 scroll-mt-24">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">VOLUME 6</div>
 <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">The Place</h2>
 <p className="text-bauhaus-muted font-medium max-w-3xl">Geography matters. The system fails specific places repeatedly: Townsville, Logan, Mount Isa, Cherbourg. The hotspots aren&apos;t random.</p>
 </div>

 {/* §19 LGA hotspot summary already at §4, here add place case study + remoteness */}
 <section className="mb-16">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§19</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Place case studies, top 4 QLD LGAs by pipeline-intensity score</h3>
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
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">QLD LGAs ranked by pipeline-intensity score</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 The hotspot pattern is geographic. Top 15 QLD LGAs ranked by the composite pipeline-intensity score (welfare-recipient density + school disadvantage + Indigenous-population share), with funding tracked through CivicGraph&apos;s dataset shown as the bar magnitude. Per-LGA youth-offender rates aren&apos;t yet sourced into this dataset.
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
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Justice reinvestment, the Bourke benchmark</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 Bourke (NSW) is Australia&apos;s longest-running place-based justice-reinvestment site. Outcomes are evaluated and published. QLD has no operational equivalent at scale; the model is replicable but unfunded for QLD hotspots.
 </p>
 <div className="border-4 border-bauhaus-black p-5 bg-bauhaus-canvas">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">Maranguka Justice Reinvestment · Bourke NSW</div>
 <h4 className="text-xl font-black text-bauhaus-black uppercase tracking-tight mb-3">23% drop in family-violence incidents (2017 baseline year)</h4>
 <ul className="space-y-2 text-sm font-medium text-bauhaus-black leading-relaxed">
 <li>· 31% increase in Year 12 retention</li>
 <li>· $3.1M gross impact estimated in the evaluation year, KPMG analysis</li>
 <li>· Aboriginal-led, place-based, data-driven cross-agency coordination</li>
 <li>· QLD has emerging place-based pilots; no operational equivalent at the same scale, time-horizon, or evaluation rigor</li>
 </ul>
 <p className="text-xs text-bauhaus-muted font-mono mt-3">Source: KPMG (2018) Maranguka Justice Reinvestment Project Impact Assessment.</p>
 </div>
 </section>

 {/* ════ VOLUME 7, POLICY & CAPACITY SIGNALS ════ */}
 <div id="vol-7" className="mb-10 mt-16 border-l-8 border-bauhaus-red pl-5 scroll-mt-24">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">VOLUME 7</div>
 <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight">Policy &amp; capacity signals</h2>
 <p className="text-bauhaus-muted font-medium max-w-3xl">Live QLD ministerial statements scraped daily from <code className="font-mono text-xs">statements.qld.gov.au</code>, filtered to youth-justice keywords and tagged by direction-of-travel.</p>
 </div>

 {/* §22, every announced community program (last 3 years). Originally §6.5 in Volume 2; relocated to Volume 7 and renumbered to §22 in Wave 3. */}
 {r.supportAnnouncements.length > 0 && (
 <section className="mb-16">
 <div className="border-4 border-bauhaus-black p-5 bg-bauhaus-canvas">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">§22 · EVERY ANNOUNCED COMMUNITY PROGRAM · LAST 3 YEARS</div>
 <h4 className="text-xl font-black text-bauhaus-black uppercase tracking-tight mb-3">All {r.supportAnnouncements.length} QLD ministerial announcements about youth community programs</h4>
 <p className="text-sm text-bauhaus-black font-medium leading-relaxed mb-5 max-w-3xl">
 Every QLD ministerial statement on youth community programs, Circuit Breaker Sentencing · Kickstart Early Intervention · Step Up Step Down · Career Pathways · youth criminal rehabilitation · family-led decision making · diversion · prevention, pulled live from <code className="font-mono text-xs">civic_ministerial_statements</code>. Sorted newest first. <span className="font-black">Click any card</span> for the full statement at statements.qld.gov.au. Pair with §9.5 Programmes Registry for the funded-program match per announcement.
 </p>
 <div className="space-y-3">
 {r.supportAnnouncements.map((a, i) => {
 // Match this announcement to a registry initiative by keyword.
 const h = (a.headline || '').toLowerCase();
 const matchedPattern =
 /circuit breaker/.test(h) ? 'Circuit Breaker Sentencing' :
 /kickstart|intensive early intervention|early intervention program/.test(h) ? 'Kickstarter Grants' :
 /family[- ]led/.test(h) ? 'Family Led Decision Making' :
 /bail (support|monitor|condition)/.test(h) ? 'Bail Support' :
 /tribe of mentors/.test(h) ? 'Tribe of Mentors' :
 null;
 const match = matchedPattern ? r.registryDeliverers.find(d => d.pattern === matchedPattern) : null;
 const matchedRegistry =
 matchedPattern
 ? QLD_PROGRAMME_REGISTRY.find(p => p.funding_match?.program_name_pattern === matchedPattern)
 : /step up step down/.test(h)
 ? QLD_PROGRAMME_REGISTRY.find(p => /step up step down/i.test(p.name))
 : /youth criminal rehabilitation|youth rehabilitation/.test(h)
 ? QLD_PROGRAMME_REGISTRY.find(p => /Youth Criminal Rehabilitation/i.test(p.name))
 : /tough new drug|drug law|adult crime, adult time|drug penalt|anti.social behaviour/.test(h)
 ? QLD_PROGRAMME_REGISTRY.find(p => /Drugs Bill 2026/i.test(p.name))
 : null;
 const isNonYj =
 /perinatal/.test(h) ||
 /cybercrime|tourism sector/.test(h) ||
 /applied research grant.*disabilit/.test(h) ||
 /firearm|wieambilla/.test(h);
 const isAdjacent =
 !matchedPattern && !matchedRegistry && !isNonYj && (
 /career pathway/.test(h) ||
 /youth week/.test(h) ||
 /youth justice school/.test(h)
 );
 return (
 <div key={i} className="border-2 border-bauhaus-black bg-white">
 <div className="p-3 flex flex-wrap gap-3 items-start">
 <div className="flex-1 min-w-[14rem]">
 <div className="text-[10px] font-mono text-bauhaus-muted mb-1">{new Date(a.published_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
 <a href={a.source_url} target="_blank" rel="noopener" className="text-sm font-black text-bauhaus-black leading-tight hover:underline block mb-1">{a.headline} ↗</a>
 <div className="text-[10px] font-mono text-bauhaus-muted">{a.minister_name?.replace(/^The Honourable /, '') ?? '—'}{a.portfolio ? ` · ${a.portfolio.slice(0, 60)}` : ''}</div>
 </div>
 <div className="flex-shrink-0 text-right">
 {match && match.recipients.length > 0 ? (
 <>
 <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-bauhaus-blue text-white inline-block">✓ MATCHED · {match.recipient_count} org{match.recipient_count === 1 ? '' : 's'}</span>
 <div className="text-[10px] font-mono text-bauhaus-muted mt-1">→ <code>{matchedPattern}</code> in justice_funding</div>
 </>
 ) : matchedRegistry ? (
 <>
 <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 inline-block ${matchedRegistry.bill ? 'bg-bauhaus-red text-white' : 'bg-bauhaus-yellow text-bauhaus-black'}`}>{matchedRegistry.bill ? '⚖ Legislation · no $ vehicle' : matchedRegistry.funding_match ? '⚠ Funded · separate stream' : '◇ Announced · matches registry, no $ trail'}</span>
 <div className="text-[10px] font-mono text-bauhaus-muted mt-1">→ {matchedRegistry.bill ? matchedRegistry.bill.name.slice(0, 70) : matchedRegistry.funding_match?.description ? matchedRegistry.funding_match.description.slice(0, 70) : matchedRegistry.name.slice(0, 70)}</div>
 </>
 ) : isAdjacent ? (
 <>
 <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-bauhaus-canvas border-2 border-bauhaus-black text-bauhaus-black inline-block">◇ Adjacent · youth program, not YJ-funded</span>
 <div className="text-[10px] font-mono text-bauhaus-muted mt-1">{(/career pathway/.test(h) ? 'employment / training appropriation' : /youth week/.test(h) ? 'event, not a funded program' : /youth justice school/.test(h) ? 'school program · separate appropriation' : 'youth program, separate funding stream')}</div>
 </>
 ) : isNonYj ? (
 <>
 <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-bauhaus-canvas border-2 border-bauhaus-muted text-bauhaus-muted inline-block">Not a YJ initiative</span>
 <div className="text-[10px] font-mono text-bauhaus-muted mt-1">{(/perinatal/.test(h) ? 'Health stream · perinatal MH' : /cybercrime|tourism/.test(h) ? 'small business · not YJ' : /applied research/.test(h) ? 'workforce funding · not YJ' : /firearm|wieambilla/.test(h) ? 'firearms reform · post-Wieambilla' : 'caught by keyword filter, not YJ')}</div>
 </>
 ) : (
 <>
 <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-bauhaus-red text-white inline-block">✗ No funded program matched</span>
 <div className="text-[10px] font-mono text-bauhaus-muted mt-1">announcement only · no <code>justice_funding</code> line</div>
 </>
 )}
 </div>
 </div>

 {match && match.recipients.length > 0 && (
 <details className="border-t-2 border-bauhaus-black">
 <summary className="cursor-pointer p-2 hover:bg-bauhaus-yellow text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
 ▶ Show {match.recipient_count} delivering organisation{match.recipient_count === 1 ? '' : 's'} · click each for full CivicGraph entity profile
 </summary>
 <div className="border-t border-bauhaus-black bg-bauhaus-canvas p-3">
 <table className="w-full text-xs">
 <thead>
 <tr className="border-b border-bauhaus-black">
 <th className="text-left p-1 font-black uppercase tracking-widest text-[10px]">Organisation</th>
 <th className="text-right p-1 font-black uppercase tracking-widest text-[10px]">$</th>
 <th className="text-right p-1 font-black uppercase tracking-widest text-[10px]">Grants</th>
 <th className="text-left p-1 font-black uppercase tracking-widest text-[10px]">Years</th>
 <th className="text-left p-1 font-black uppercase tracking-widest text-[10px]">CivicGraph profile</th>
 </tr>
 </thead>
 <tbody>
 {match.recipients.slice(0, 25).map((rec, j) => (
 <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
 <td className="p-1 font-black text-bauhaus-black align-top">
 <div>{rec.name}</div>
 {rec.abn && <div className="font-mono text-[9px] text-bauhaus-muted">ABN {rec.abn}</div>}
 </td>
 <td className="p-1 text-right font-mono font-black tabular-nums align-top">{money(rec.total)}</td>
 <td className="p-1 text-right font-mono align-top">{rec.line_items}</td>
 <td className="p-1 font-mono text-[10px] text-bauhaus-muted align-top">{rec.first_fy ?? '?'}{rec.first_fy !== rec.last_fy ? `–${rec.last_fy ?? '?'}` : ''}</td>
 <td className="p-1 font-mono text-[10px] align-top">
 {rec.gs_id ? (
 <Link href={`/entity/${rec.gs_id}`} className="text-bauhaus-blue font-black hover:underline">→ entity page</Link>
 ) : (
 <span className="text-bauhaus-muted">no entity match</span>
 )}
 {rec.website && (
 <div className="mt-0.5"><a href={`https://${rec.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline break-all">{rec.website} ↗</a></div>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 {match.recipient_count > 25 && (
 <p className="text-[10px] font-mono text-bauhaus-muted mt-2">+ {match.recipient_count - 25} additional smaller recipients not shown.</p>
 )}
 <p className="text-[10px] font-mono text-bauhaus-muted mt-2">
 Click any <span className="font-black">→ entity page</span> for the org&apos;s directors, board interlocks (§14), all funding flows across sectors, ACNC profile, and relationships graph.
 </p>
 </div>
 </details>
 )}
 </div>
 );
 })}
 </div>
 <p className="text-xs text-bauhaus-muted font-mono mt-4">
 Source: <code>civic_ministerial_statements</code> · 36-month window · keyword-matched to community-program / early-intervention / wraparound / diversion / Circuit Breaker / Step Up Step Down / Kickstart / family-led / youth justice. <span className="font-black">Why this matters:</span> {r.mhFundingCount} grants in <code>justice_funding</code> are tagged mental-health or AOD, but {r.supportAnnouncements.length} announcements above mention these supports. The mismatch tells you announced services for justice-system youth move through Health / NDIS / Education funding doors, not through Youth Justice. The justice stream looks empty even when the support exists.
 </p>
 </div>
 </section>
 )}

 <section className="mb-16">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§23 · LIVE</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">What QLD ministers are saying about youth justice</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 The {r.ministerialStatements.length} most-recent statements from <code className="font-mono text-xs">statements.qld.gov.au</code>. Each is auto-tagged by direction-of-travel: <span className="text-bauhaus-red font-black">punitive</span> (custody-expanding), <span className="text-bauhaus-blue font-black">preventive</span> (community-investing), <span className="text-bauhaus-yellow font-black">mixed</span>. Read horizontally for the system&apos;s real direction.
 </p>

 {(() => {
 const counts = r.ministerialStatements.reduce<Record<string, number>>((acc, s) => {
 const t = classifyStatement(s);
 acc[t] = (acc[t] ?? 0) + 1;
 return acc;
 }, {});
 const total = r.ministerialStatements.length || 1;
 const punPct = Math.round(((counts.punitive ?? 0) / total) * 100);
 const prePct = Math.round(((counts.preventive ?? 0) / total) * 100);
 return (
 <div className="border-4 border-bauhaus-black p-5 bg-white mb-6">
 <div className="flex flex-wrap justify-between items-baseline gap-3 mb-3">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black">Thrust mix · last {total} statements</div>
 <div className="text-xs font-mono text-bauhaus-muted">{punPct}% punitive · {prePct}% preventive</div>
 </div>
 {/* Inline counter strip (StackedBar formats values as money — wrong here, these are counts) */}
 <div className="relative h-7 bg-bauhaus-canvas border-2 border-bauhaus-black flex">
 {[
 { key: 'p', value: counts.punitive ?? 0, color: 'bg-bauhaus-red' },
 { key: 'm', value: counts.mixed ?? 0, color: 'bg-bauhaus-yellow' },
 { key: 'pr', value: counts.preventive ?? 0, color: 'bg-bauhaus-blue' },
 ].map(s => s.value > 0 ? (<div key={s.key} className={`${s.color} h-full`} style={{ width: `${(s.value / Math.max(total, 1)) * 100}%` }} title={`${s.key}: ${s.value}`} />) : null)}
 </div>
 <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono text-bauhaus-muted">
 {[
 { value: counts.punitive ?? 0, color: 'bg-bauhaus-red', label: 'Punitive' },
 { value: counts.mixed ?? 0, color: 'bg-bauhaus-yellow', label: 'Mixed' },
 { value: counts.preventive ?? 0, color: 'bg-bauhaus-blue', label: 'Preventive' },
 ].filter(s => s.value > 0).map(s => (
 <span key={s.label}>
 <span className={`inline-block w-2 h-2 ${s.color} mr-1 align-middle`} />
 {s.label} · {s.value} statements ({total ? Math.round((s.value / total) * 100) : 0}%)
 </span>
 ))}
 </div>
 </div>
 );
 })()}

 {r.ministerialStatements.length === 0 ? (
 <div className="border-4 border-bauhaus-black p-6 bg-white text-bauhaus-muted text-sm">No QLD ministerial statements in the last 24 months matched the youth-justice filter. Re-run <code>scrape-ministerial-statements</code>.</div>
 ) : (
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
 {r.ministerialStatements.map((s, i) => {
 const thrust = classifyStatement(s);
 const tone =
 thrust === 'punitive' ? { border: 'border-bauhaus-red', tag: 'bg-bauhaus-red text-white' } :
 thrust === 'preventive' ? { border: 'border-bauhaus-blue', tag: 'bg-bauhaus-blue text-white' } :
 { border: 'border-bauhaus-yellow', tag: 'bg-bauhaus-yellow text-bauhaus-black' };
 const minister = s.minister_name?.replace(/^The Honourable /, '') ?? null;
 const portfolio = cleanPortfolio(s.portfolio);
 const date = new Date(s.published_at);
 const summary = summarizeMinisterialStatement(s.body_text);
 return (
 <DetailDrawer
 key={i}
 toneClass={tone.border}
 title={s.headline}
 subtitle={`${minister ?? 'Minister'}${portfolio ? ` · ${portfolio}` : ''} · ${date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })} · ${thrust.toUpperCase()}`}
 sourceHref={s.source_url}
 sourceLabel="Read full statement on statements.qld.gov.au ↗"
 trigger={
 <div className={`border-4 ${tone.border} p-4 bg-white hover:bg-bauhaus-canvas transition-colors group cursor-pointer h-full`}>
 <div className="flex justify-between items-center mb-3 gap-2">
 <div className="text-[10px] font-mono font-black text-bauhaus-muted tabular-nums">{date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
 <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${tone.tag}`}>{thrust}</span>
 </div>
 <h4 className="text-sm font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-3 group-hover:underline">{s.headline}</h4>
 {minister && (
 <div className="text-[10px] font-mono text-bauhaus-muted leading-tight">
 <span className="font-black text-bauhaus-black">{minister}</span>
 {portfolio && <><br />{portfolio}</>}
 </div>
 )}
 <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-blue mt-3">Read summary →</div>
 </div>
 }
 >
 {summary.ledeBullets.length > 0 && (
 <DrawerSection label="Key points (lede)">
 <ul className="list-disc pl-5 space-y-2">
 {summary.ledeBullets.map((b, j) => <li key={j} className="leading-relaxed">{b}</li>)}
 </ul>
 </DrawerSection>
 )}
 {summary.bodyExcerpt && (
 <DrawerSection label="Statement body">
 <p className="leading-relaxed">{summary.bodyExcerpt}{summary.bodyExcerpt.length >= 600 ? '…' : ''}</p>
 </DrawerSection>
 )}
 <DrawerKeyValue items={[
 { label: 'Date published', value: date.toLocaleDateString('en-AU', { dateStyle: 'long' }) },
 { label: 'Speaker', value: minister },
 { label: 'Portfolio', value: portfolio },
 { label: 'Direction-of-travel', value: thrust.toUpperCase() },
 { label: 'Source feed', value: 'statements.qld.gov.au' },
 ]} />
 {s.topics && s.topics.length > 0 && (
 <DrawerSection label="Tagged topics">
 <div className="flex flex-wrap gap-1">
 {s.topics.map((t, j) => (
 <span key={j} className="text-[10px] uppercase tracking-widest font-black bg-bauhaus-canvas text-bauhaus-black px-2 py-1 border border-bauhaus-black">{t}</span>
 ))}
 </div>
 </DrawerSection>
 )}
 </DetailDrawer>
 );
 })}
 </div>
 )}
 <p className="text-xs text-bauhaus-muted font-mono mt-5">
 Source: <code>civic_ministerial_statements</code> via the <code>scrape-ministerial-statements</code> agent. Classifier reads headlines, e.g. &ldquo;Adult Crime, Adult Time&rdquo; &rarr; punitive; &ldquo;early intervention&rdquo; &rarr; preventive. Click a card to read the full statement on <a href="https://statements.qld.gov.au" target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline">statements.qld.gov.au</a>.
 </p>
 </section>

 {/* §23.1, STRUCTURAL POLICY MOVES (curated, low-frequency) */}
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
 <p className="text-bauhaus-black leading-relaxed">The high-profile <span className="font-black">Cleveland Dodd</span> coronial inquest (16-year-old Yamatji boy who died in October 2023) is a <span className="font-black">Western Australian</span> case at Unit 18, Casuarina Prison, <span className="font-black">not</span> QLD&apos;s Cleveland Youth Detention Centre in Townsville. Public reporting often conflates the two given the shared name. We do not surface the Dodd inquest in this QLD report. WA Coroner&apos;s findings (Dec 2025) called for Unit 18 to close as a matter of urgency.</p>
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
 Source: QLD Ombudsman / Inspector of Detention Services (<a href="https://www.ombudsman.qld.gov.au" target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline">ombudsman.qld.gov.au</a>) and Australian Human Rights Commission.
 </p>

 {r.coronerFindings.length > 0 && (
 <div className="mt-10 pt-8 border-t-4 border-bauhaus-black">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">LIVE · QLD Coroners Court</div>
 <h4 className="text-xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Recent QLD coronial findings · custody / youth-relevant</h4>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-4 text-xs">
 The {r.coronerFindings.length} most-recent QLD Coroners Court findings flagged as in-custody or youth-justice-relevant by keyword classifier. Scraped via Playwright from <code className="font-mono">coronerscourt.qld.gov.au/findings-upcoming-inquests/search-findings</code>. Each card links to the originating PDF; deceased-identifier fields respect QLD coronial-suppression rules and may be initials only.
 </p>
 <div className="space-y-3">
 {r.coronerFindings.map((f, i) => {
 const isAllLower = f.title === f.title.toLowerCase();
 const title = isAllLower ? f.title.replace(/\b\w/g, c => c.toUpperCase()) : f.title;
 const cleanTitle = title.split(/\s+(?:Coroner|Description):/i)[0].trim();
 const desc = title.split(/\s+(?:Coroner|Description):/i).slice(1).join(' ').trim();
 const summary = summarizeCoronerFinding(f.body_text);
 return (
 <DetailDrawer
 key={f.source_url}
 toneClass="border-bauhaus-red"
 title={cleanTitle}
 subtitle={`${cleanCoronerName(f.coroner_name) ? `Coroner ${cleanCoronerName(f.coroner_name)} · ` : ''}${f.finding_date ?? '—'}${f.recommendations_count != null ? ` · ${f.recommendations_count} recommendations` : ''}`}
 sourceHref={f.source_url}
 sourceLabel="Open full finding PDF on coronerscourt.qld.gov.au ↗"
 trigger={
 <div className="border-4 border-bauhaus-red p-5 bg-white hover:bg-bauhaus-canvas transition-colors cursor-pointer">
 <div className="flex flex-wrap justify-between items-baseline gap-3 mb-2">
 <h4 className="text-base font-black text-bauhaus-black uppercase tracking-tight leading-tight flex-1">{cleanTitle}</h4>
 </div>
 {desc && <p className="text-xs text-bauhaus-muted font-mono mb-2 italic">{desc.slice(0, 240)}{desc.length > 240 ? '…' : ''}</p>}
 <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono text-bauhaus-muted mb-2">
 {f.deceased_identifier && <span><span className="font-black text-bauhaus-black">Deceased:</span> {f.deceased_identifier}</span>}
 {cleanCoronerName(f.coroner_name) && <span><span className="font-black text-bauhaus-black">Coroner:</span> {cleanCoronerName(f.coroner_name)}</span>}
 {f.finding_date && <span><span className="font-black text-bauhaus-black">Finding date:</span> {f.finding_date}</span>}
 {f.recommendations_count != null && <span><span className="font-black text-bauhaus-red">{f.recommendations_count}</span> recommendations</span>}
 </div>
 {f.topics && f.topics.length > 0 && (
 <div className="flex flex-wrap gap-1 mb-2">
 {f.topics.slice(0, 6).map((t, j) => (
 <span key={j} className="text-[9px] uppercase tracking-widest font-black text-bauhaus-muted bg-bauhaus-canvas px-2 py-0.5 border border-bauhaus-black">{t}</span>
 ))}
 </div>
 )}
 <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-blue mt-2">Read summary →</div>
 </div>
 }
 >
 {desc && (
 <DrawerSection label="Catchwords (from coroner)">
 <p className="italic text-bauhaus-black leading-relaxed">{desc}</p>
 </DrawerSection>
 )}
 {summary.cause && (
 <DrawerSection label="Cause of death">
 <p className="leading-relaxed">{summary.cause}</p>
 </DrawerSection>
 )}
 {summary.catchwords && summary.catchwords !== desc && (
 <DrawerSection label="Additional catchwords">
 <p className="leading-relaxed text-bauhaus-muted text-xs">{summary.catchwords}</p>
 </DrawerSection>
 )}
 {summary.keyExcerpt && (
 <DrawerSection label="Key excerpt from finding">
 <p className="leading-relaxed text-xs">{summary.keyExcerpt}{summary.keyExcerpt.length >= 800 ? '…' : ''}</p>
 </DrawerSection>
 )}
 <DrawerKeyValue items={[
 { label: 'Deceased', value: f.deceased_identifier },
 { label: 'Coroner', value: cleanCoronerName(f.coroner_name) },
 { label: 'Finding date', value: f.finding_date },
 { label: 'Recommendations', value: f.recommendations_count != null ? String(f.recommendations_count) : null },
 { label: 'Source', value: 'QLD Coroners Court' },
 ]} />
 </DetailDrawer>
 );
 })}
 </div>
 <p className="text-xs text-bauhaus-muted font-mono mt-4">Source: <code>qld_coroners_findings</code> populated by <code>scrape-qld-coroners</code> agent. Title parsing is best-effort from page DOM; metadata extraction (age, finding date, coroner, recommendations) regex-derived from PDF text via Jina Reader. Verify against <a href="https://coronerscourt.qld.gov.au/findings-upcoming-inquests/search-findings" target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline">coronerscourt.qld.gov.au</a> before publication.</p>
 </div>
 )}
 </section>

 {/* §24.5, LIVE HANSARD MENTIONS */}
 <section className="mb-16">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§24.5 · LIVE HANSARD</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">QLD Parliament, what MPs are actually saying</h3>
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
 <>
 <div className="border-l-4 border-bauhaus-yellow bg-bauhaus-canvas p-4 mb-4 text-xs">
 <p className="font-black text-bauhaus-black mb-1">Verify before citing</p>
 <p className="text-bauhaus-black leading-relaxed">Speaker names below are parsed from QLD Parliament Hansard PDFs and may render as surname only or partial titles. Snippets are the opening characters of a contribution, not necessarily a complete or self-contained quote. Always confirm against the official transcript at parliament.qld.gov.au before publication.</p>
 </div>
 <div className="grid md:grid-cols-2 gap-4">
 {r.hansardRows.map((h, i) => {
 const partyTone =
 h.speaker_party === 'LNP' ? { border: 'border-bauhaus-blue', tag: 'bg-bauhaus-blue text-white' } :
 h.speaker_party === 'ALP' ? { border: 'border-bauhaus-red', tag: 'bg-bauhaus-red text-white' } :
 h.speaker_party === 'KAP' ? { border: 'border-bauhaus-yellow', tag: 'bg-bauhaus-yellow text-bauhaus-black' } :
 h.speaker_party === 'GRN' ? { border: 'border-bauhaus-black', tag: 'bg-bauhaus-black text-white' } :
 { border: 'border-bauhaus-black', tag: 'bg-bauhaus-canvas text-bauhaus-black border border-bauhaus-black' };
 const date = h.sitting_date ? new Date(h.sitting_date) : null;
 const summary = summarizeHansardSpeech(h.body_text);
 return (
 <DetailDrawer
 key={i}
 toneClass={partyTone.border}
 title={`${cleanSpeakerName(h.speaker_name)}${h.subject ? ` · ${h.subject.slice(0, 60)}` : ''}`}
 subtitle={`${date ? date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} · ${h.speaker_party ?? 'Independent'} · QLD Parliament Hansard`}
 sourceHref={h.source_url ?? undefined}
 sourceLabel="Open full Hansard PDF on parliament.qld.gov.au ↗"
 trigger={
 <div className={`border-4 ${partyTone.border} p-5 bg-white hover:bg-bauhaus-canvas transition-colors cursor-pointer`}>
 <div className="flex justify-between items-baseline mb-2 gap-3">
 <div className="text-xs font-mono font-black text-bauhaus-muted">{date ? date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
 <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${partyTone.tag}`}>{h.speaker_party ?? 'Independent'}</span>
 </div>
 <h4 className="text-base font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-2">{cleanSpeakerName(h.speaker_name)}{h.subject ? ` · ${h.subject.slice(0, 60)}` : ''}</h4>
 <p className="text-xs text-bauhaus-black leading-relaxed italic mb-3">&ldquo;{h.snippet.replace(/\s+/g, ' ').trim()}…&rdquo;</p>
 <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-blue">Read full speech →</div>
 </div>
 }
 >
 {summary.lede && (
 <DrawerSection label="Opening">
 <p className="leading-relaxed font-black">&ldquo;{summary.lede}&rdquo;</p>
 </DrawerSection>
 )}
 {summary.excerpt && summary.excerpt !== summary.lede && (
 <DrawerSection label="Speech excerpt">
 <p className="leading-relaxed text-xs italic">{summary.excerpt}{summary.excerpt.length >= 1200 ? '…' : ''}</p>
 </DrawerSection>
 )}
 <DrawerKeyValue items={[
 { label: 'Speaker', value: h.speaker_name },
 { label: 'Party', value: h.speaker_party },
 { label: 'Sitting date', value: date ? date.toLocaleDateString('en-AU', { dateStyle: 'long' }) : null },
 { label: 'Source', value: 'QLD Parliament Hansard' },
 ]} />
 </DetailDrawer>
 );
 })}
 </div>
 </>
 )}
 <p className="text-xs text-bauhaus-muted font-mono mt-4">Source: <code>civic_hansard</code> table populated by <code>scrape-qld-hansard</code> agent. {fmt(r.hansardRows.length)} most-recent youth-justice mentions shown; party-bar covers the last 12 months. Speaker-name parsing is best-effort from PDF text and may render as surnames only.</p>
 </section>

 {/* §24.6, WHAT'S COMING NEXT (active bills) */}
 {r.activeBills.length > 0 && (
 <section className="mb-16">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§24.6 · WHAT&apos;S COMING NEXT</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Currently before QLD Parliament</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 QLD bills introduced but not yet passed (or defeated / lapsed / withdrawn). Read for what&apos;s about to land before it makes it into §24.7&apos;s passed-legislation list. Includes adjacent legislation (criminal code, sentencing, dwelling-defence, etc.) that surfaces in YJ debate.
 </p>
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
 {r.activeBills.map((b, i) => {
 const partyTone =
 b.sponsor_party === 'LNP' ? 'border-bauhaus-blue' :
 b.sponsor_party === 'ALP' ? 'border-bauhaus-red' :
 b.sponsor_party === 'KAP' ? 'border-bauhaus-yellow' :
 b.sponsor_party === 'GRN' ? 'border-bauhaus-black' :
 'border-bauhaus-black';
 return (
 <a key={b.source_url} href={b.source_url} target="_blank" rel="noopener" className={`block border-4 ${partyTone} p-4 bg-white hover:bg-bauhaus-canvas transition-colors group`}>
 <div className="flex justify-between items-baseline mb-2 gap-2">
 <div className="text-[10px] font-mono font-black text-bauhaus-muted">{b.introduced_date ?? '—'}</div>
 <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-bauhaus-canvas border border-bauhaus-black">{b.sponsor_party ?? '—'}</span>
 </div>
 <h4 className="text-sm font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-2 group-hover:underline">{b.bill_name}</h4>
 <div className="text-[10px] font-mono text-bauhaus-muted leading-tight">
 {b.sponsor && <div className="font-black text-bauhaus-black">{b.sponsor}</div>}
 {b.status && <div>{b.status}{b.status_date ? ` · ${b.status_date}` : ''}</div>}
 </div>
 </a>
 );
 })}
 </div>
 <p className="text-[10px] text-bauhaus-muted font-mono mt-4">Source: <code>parliament_bills</code> WHERE status not in (PASSED, defeated, lapsed, withdrawn). Track here for early signal of what&apos;s about to be debated. Click through for Bill text + Explanatory Note + Statement of Compatibility.</p>
 </section>
 )}

 {/* §24.7, BILLS IN ACTIVE DEBATE, OFFICIAL REGISTER */}
 <section className="mb-16">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§24.7 · LIVE QLD BILLS REGISTER · PASSED LEGISLATION</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">YJ-relevant bills · already-passed</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 Bills passed (or with amendment) since 2024, scraped via Playwright from the official QLD Parliament register. Each card opens to a curated drawer with key amendments + opposition voices + capital backing + outcome proxies. Read alongside §24.6 (active) for the full pipeline.
 </p>

 {r.officialBills.length > 0 ? (
 <div className="space-y-3 mb-8">
 {r.officialBills.map((b, i) => {
 const partyTone =
 b.sponsor_party === 'LNP' ? { border: 'border-bauhaus-blue', tag: 'bg-bauhaus-blue text-white' } :
 b.sponsor_party === 'ALP' ? { border: 'border-bauhaus-red', tag: 'bg-bauhaus-red text-white' } :
 b.sponsor_party === 'KAP' ? { border: 'border-bauhaus-yellow', tag: 'bg-bauhaus-yellow text-bauhaus-black' } :
 b.sponsor_party === 'GRN' ? { border: 'border-bauhaus-black', tag: 'bg-bauhaus-black text-white' } :
 { border: 'border-bauhaus-black', tag: 'bg-bauhaus-canvas text-bauhaus-black border border-bauhaus-black' };
 const isPassed = (b.status ?? '').toUpperCase().includes('PASSED');
 const detail = BILL_DETAILS[b.bill_name];
 return (
 <DetailDrawer
 key={b.source_url}
 toneClass={partyTone.border}
 title={b.bill_name}
 subtitle={`${b.sponsor ?? '—'}${b.sponsor_party ? ` (${b.sponsor_party})` : ''} · ${b.status ?? '—'}${b.status_date ? ` ${b.status_date}` : ''}`}
 sourceHref={b.source_url}
 sourceLabel="Open Bill text, Explanatory Note + Statement of Compatibility ↗"
 trigger={
 <div className={`border-4 ${partyTone.border} p-5 bg-white hover:bg-bauhaus-canvas transition-colors cursor-pointer`}>
 <div className="flex flex-wrap justify-between items-baseline gap-3 mb-2">
 <h4 className="text-base font-black text-bauhaus-black uppercase tracking-tight leading-tight flex-1">{b.bill_name}</h4>
 <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${partyTone.tag}`}>{b.sponsor_party ?? 'Unknown'}</span>
 </div>
 <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono text-bauhaus-muted mb-2">
 <span><span className="font-black text-bauhaus-black">Sponsor:</span> {b.sponsor ?? '—'}</span>
 {b.introduced_date && <span><span className="font-black text-bauhaus-black">Introduced:</span> {b.introduced_date}</span>}
 {b.status && <span><span className={`font-black ${isPassed ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>{b.status}{b.status_date ? ` (${b.status_date})` : ''}</span></span>}
 </div>
 {b.topics && b.topics.length > 0 && (
 <div className="flex flex-wrap gap-1 mb-2">
 {b.topics.slice(0, 6).map((t, j) => (
 <span key={j} className="text-[9px] uppercase tracking-widest font-black text-bauhaus-muted bg-bauhaus-canvas px-2 py-0.5 border border-bauhaus-black">{t}</span>
 ))}
 </div>
 )}
 <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-blue">{detail ? 'Read amendments + opposition →' : 'Open detail →'}</div>
 </div>
 }
 >
 {detail && (
 <DrawerSection label="Impact summary">
 <p className="leading-relaxed">{detail.impactSummary}</p>
 </DrawerSection>
 )}
 {detail && detail.keyAmendments.length > 0 && (
 <DrawerSection label="Key amendments">
 <ul className="list-disc pl-5 space-y-2">
 {detail.keyAmendments.map((a, j) => <li key={j} className="leading-relaxed">{a}</li>)}
 </ul>
 </DrawerSection>
 )}
 {detail && detail.opposition.length > 0 && (
 <DrawerSection label="Opposition / human-rights response">
 <ul className="space-y-3">
 {detail.opposition.map((o, j) => (
 <li key={j} className="border-l-4 border-bauhaus-red pl-3">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">{o.who}</div>
 <p className="italic leading-relaxed">&ldquo;{o.quote}&rdquo;</p>
 {o.sourceUrl && <a href={o.sourceUrl} target="_blank" rel="noopener" className="text-bauhaus-blue text-[10px] font-mono hover:underline">source ↗</a>}
 </li>
 ))}
 </ul>
 </DrawerSection>
 )}
 {detail?.implementingDept && (
 <DrawerSection label="Implementing department">
 <p className="font-black">{detail.implementingDept}</p>
 </DrawerSection>
 )}
 {detail?.capitalBacking && detail.capitalBacking.length > 0 && (
 <DrawerSection label="Capital backing (cross-ref §2)">
 <ul className="list-disc pl-5 space-y-1">
 {detail.capitalBacking.map((c, j) => <li key={j} className="leading-relaxed">{c}</li>)}
 </ul>
 </DrawerSection>
 )}
 {detail?.outcomeProxies && detail.outcomeProxies.length > 0 && (
 <DrawerSection label="Outcome proxies (live data)">
 <ul className="list-disc pl-5 space-y-1">
 {detail.outcomeProxies.map((c, j) => <li key={j} className="leading-relaxed">{c}</li>)}
 </ul>
 </DrawerSection>
 )}
 <DrawerKeyValue items={[
 { label: 'Sponsor', value: b.sponsor },
 { label: 'Party (inferred)', value: b.sponsor_party },
 { label: 'Introduced', value: b.introduced_date },
 { label: 'Current status', value: b.status },
 { label: 'Status date', value: b.status_date },
 { label: 'Source', value: 'QLD Parliament Bills Register' },
 ]} />
 {b.topics && b.topics.length > 0 && (
 <DrawerSection label="Auto-classified topics">
 <div className="flex flex-wrap gap-1">
 {b.topics.map((t, j) => (
 <span key={j} className="text-[10px] uppercase tracking-widest font-black bg-bauhaus-canvas text-bauhaus-black px-2 py-1 border border-bauhaus-black">{t}</span>
 ))}
 </div>
 </DrawerSection>
 )}
 {!detail && (
 <DrawerSection label="More detail">
 <p className="text-bauhaus-muted text-xs">Curated key-amendment + opposition content not yet authored for this bill. The status timeline, sponsor, and topic tags above come live from the QLD Parliament register; click the source link below for the official Bill text and Explanatory Note.</p>
 </DrawerSection>
 )}
 </DetailDrawer>
 );
 })}
 </div>
 ) : (
 <div className="border-4 border-bauhaus-black p-6 bg-white text-bauhaus-muted text-sm mb-8">No YJ-relevant bills in <code>qld_bills</code>. Run <code>scrape-qld-bills</code> to populate.</div>
 )}

 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Cross-reference · Hansard mention volume</div>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-4 text-xs">
 The same bill names extracted from <code className="font-mono">civic_hansard.body_text</code> via <code className="font-mono">v_qld_yj_bills_active</code>, how often each appeared in debate. Yellow rail = YJ-specific by name pattern.
 </p>
 {r.bills.length === 0 ? (
 <div className="border-4 border-bauhaus-black p-6 bg-white text-bauhaus-muted text-sm">No bills detected in current Hansard window.</div>
 ) : (
 <div className="space-y-3">
 {r.bills.map((b, i) => (
 <div key={i} className={`border-4 p-5 bg-white ${b.is_yj_specific ? 'border-bauhaus-yellow' : 'border-bauhaus-black'}`}>
 <div className="flex flex-wrap justify-between items-baseline gap-3 mb-2">
 <h4 className="text-base font-black text-bauhaus-black uppercase tracking-tight leading-tight flex-1">{b.bill_name}</h4>
 {b.is_yj_specific && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-bauhaus-yellow text-bauhaus-black">YJ-specific</span>}
 </div>
 <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono text-bauhaus-muted">
 <span><span className="font-black text-bauhaus-black">{b.mentions}</span> hansard mentions</span>
 <span><span className="font-black text-bauhaus-black">{b.distinct_speakers}</span> distinct speakers</span>
 {b.parties && b.parties.length > 0 && <span>parties: <span className="font-black text-bauhaus-black">{b.parties.filter(Boolean).join(' · ')}</span></span>}
 {b.last_mention && <span>last mention: <span className="font-black text-bauhaus-black">{b.last_mention}</span></span>}
 </div>
 </div>
 ))}
 </div>
 )}
 <p className="text-xs text-bauhaus-muted font-mono mt-4">Bill names extracted by regex from PDF Hansard text, minor edge-case captures may include leading sentence fragments. Verify against the QLD Bills register at <a href="https://www.parliament.qld.gov.au" target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline">parliament.qld.gov.au</a> before quoting. The proper bills-register scraper is queued, Hansard-derived list is a free interim cut.</p>
 </section>

 {/* §25, PROMISE → ACTION → OUTCOMES CHAIN */}
 <section className="mb-16">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§25 · ACCOUNTABILITY CHAIN</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Promise → action → outcomes, does the chain hold?</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 For each major QLD policy promise we map the chain: the <span className="font-black text-bauhaus-red">announcement</span> (what was said), the <span className="font-black text-bauhaus-blue">bill</span> (what was passed), the <span className="font-black">implementing department or contractor</span> (who delivers), and the <span className="font-black">live outcomes data</span> we can read against it (what changed). Where the chain breaks, where promise outpaces action, where action lands but outcomes don&apos;t move, or where the system pretends two contradictory promises can both be delivered, the gap is the story. Four chains, ordered roughly by the gap between announcement and outcome.
 </p>

 <div className="space-y-6">
 {/* CHAIN 1, ADULT CRIME ADULT TIME */}
 <div className="border-4 border-bauhaus-red p-6 bg-white">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-3">Chain 1 · &ldquo;Adult Crime, Adult Time&rdquo;</div>
 <div className="grid md:grid-cols-4 gap-4 text-xs">
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-1">PROMISE</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">&ldquo;Adult Crime, Adult Time expands to 45 offences&rdquo;</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">Crisafulli · 28 Feb 2026 · <a href="#vol-7" className="text-bauhaus-blue hover:underline">§23</a></p>
 </div>
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue mb-1">BILL</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">Expanding Adult Crime, Adult Time Amendment Bill 2026</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">Sponsor: Gerber LNP · <span className="text-bauhaus-red font-black">PASSED with amendment 23 Apr 2026</span> · <a href="#vol-7" className="text-bauhaus-blue hover:underline">§24.7</a></p>
 </div>
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black mb-1">DELIVERED BY</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">QLD Department of Youth Justice</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">Capital backing: Wacol $250M+, Woodford up to $627.61M, Cairns 40 beds · <a href="#vol-1" className="text-bauhaus-blue hover:underline">§2</a></p>
 </div>
 <div>
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1">OUTCOMES</div>
 <ul className="text-[10px] text-bauhaus-black leading-relaxed space-y-1">
 <li>· Watchhouse children today: <span className="font-black text-bauhaus-red">{ws ? ws.total_children : '—'}</span> ({fnPctChild}% First Nations)</li>
 <li>· CTG gap: <span className="font-black text-bauhaus-red">+{r.ctg.length > 0 ? Math.max(0, ((Number(r.ctg[r.ctg.length - 1]?.actual_rate) || 0) - 33.1)).toFixed(1) : '—'}/10K</span> from trajectory (widening)</li>
 <li>· ACCO funding share: <span className="font-black">{accoSharePct}%</span> (unchanged)</li>
 <li>· {fmt(r.coronerFindings.length)} live coronial findings flagged in-custody</li>
 </ul>
 </div>
 </div>
 <div className="mt-4 pt-3 border-t-2 border-bauhaus-black text-[11px] font-medium text-bauhaus-black leading-relaxed">
 <span className="font-black uppercase tracking-widest text-bauhaus-red">Chain status:</span> Promise made → bill passed (with amendment) → department resourced → <span className="font-black text-bauhaus-red">outcome data lag (early; verify in 6–12 months)</span>. The legislation has been passed; the watchhouse and CTG-gap data has not yet shown the &ldquo;safer Queensland&rdquo; the announcements promised. The Apr-2026 amending Bill is too recent to read as outcomes; verify in 6, 12, 24 months as the data accumulates.
 </div>
 </div>

 {/* CHAIN 2, PATH TO TREATY REPEAL */}
 <div className="border-4 border-bauhaus-yellow p-6 bg-white">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-3">Chain 2 · Path to Treaty repeal</div>
 <div className="grid md:grid-cols-4 gap-4 text-xs">
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-1">PROMISE</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">LNP election commitment to repeal Path to Treaty Act</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">2024 election platform · <a href="#vol-7" className="text-bauhaus-blue hover:underline">§23.1</a></p>
 </div>
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue mb-1">BILL</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">Bundled into Brisbane Olympic Games Act amendment</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">28 Nov 2024 (first sitting day) · QAIHC publicly opposed</p>
 </div>
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black mb-1">DELIVERED BY</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">Crisafulli LNP Government</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">No funding allocation (institutional removal of Treaty Body + Truth-telling Inquiry)</p>
 </div>
 <div>
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1">OUTCOMES</div>
 <ul className="text-[10px] text-bauhaus-black leading-relaxed space-y-1">
 <li>· ACCO funding share: <span className="font-black">{accoSharePct}%</span> (unchanged)</li>
 <li>· First Nations % of in-custody children: <span className="font-black text-bauhaus-red">{fnPctChild}%</span></li>
 <li>· CTG target 11 trajectory: <span className="font-black text-bauhaus-red">widening</span></li>
 <li>· No replacement institutional architecture announced</li>
 </ul>
 </div>
 </div>
 <div className="mt-4 pt-3 border-t-2 border-bauhaus-black text-[11px] font-medium text-bauhaus-black leading-relaxed">
 <span className="font-black uppercase tracking-widest text-bauhaus-red">Chain status:</span> Promise made → bill passed (bundled) → institutional architecture removed → <span className="font-black text-bauhaus-red">no replacement</span>. The truth-telling and treaty-process framework that explicitly addressed YJ over-representation has been removed; the structural conditions it was designed to address are unchanged in the data.
 </div>
 </div>

 {/* CHAIN 5, TOWNSVILLE STEP UP STEP DOWN (preventive promise) */}
 <div className="border-4 border-bauhaus-blue p-6 bg-white">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-3">Chain 3 · &ldquo;New Townsville Youth Step Up Step Down facility&rdquo; (preventive)</div>
 <div className="grid md:grid-cols-4 gap-4 text-xs">
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-1">PROMISE</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">&ldquo;New Townsville Youth Step Up Step Down facility site confirmed&rdquo;</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">Tim Nicholls (Min. Health) · 4 Feb 2026 · <a href="#vol-7" className="text-bauhaus-blue hover:underline">§23</a></p>
 </div>
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue mb-1">FUNDING SOURCE</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">Mental health levy revenue (election commitment)</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">Levy hypothecated to youth mental health services. No specific bill, administrative + capital appropriation.</p>
 </div>
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black mb-1">DELIVERED BY</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">QLD Department of Health</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">Step Up Step Down model: short-stay residential mental-health beds, intermediate between community and inpatient. Townsville site selected; build timeline tbd.</p>
 </div>
 <div>
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1">OUTCOMES</div>
 <ul className="text-[10px] text-bauhaus-black leading-relaxed space-y-1">
 <li>· Site confirmed; not yet operational</li>
 <li>· QLD justice grants tagged mental-health/AOD: <span className="font-black text-bauhaus-red">{r.mhFundingCount}</span></li>
 <li>· Cleveland (Townsville) detention occupancy: 76–92%, pre-existing demand</li>
 <li>· Read against §6 mental-health blind spot for whether the system funds-what-it-names</li>
 </ul>
 </div>
 </div>
 <div className="mt-4 pt-3 border-t-2 border-bauhaus-black text-[11px] font-medium text-bauhaus-black leading-relaxed">
 <span className="font-black uppercase tracking-widest text-bauhaus-blue">Chain status:</span> The most-tangible preventive announcement of the past 12 months. Funded through the mental-health levy (not the YJ budget line). <span className="font-black">Builds the kind of community capacity §6 + §16 says is missing</span>, but at one site, against state-wide demand patterns. Useful proof-of-concept; insufficient at scale relative to capital direction in §2 ($1B+ to detention beds). Whether it generalises is the test.
 </div>
 </div>

 {/* CHAIN 4, BAIL MONITORING */}
 <div className="border-4 border-bauhaus-red p-6 bg-white">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-3">Chain 4 · &ldquo;Stronger youth bail monitoring&rdquo;</div>
 <div className="grid md:grid-cols-4 gap-4 text-xs">
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-1">PROMISE</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">&ldquo;Stronger youth bail monitoring laws to make Queensland safer&rdquo;</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">Gerber · 10 Dec 2025 + 12 Feb 2026 (twice) · <a href="#vol-7" className="text-bauhaus-blue hover:underline">§23</a></p>
 </div>
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue mb-1">BILLS (TWO)</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">YJ (Monitoring Devices) Amendment Bill 2025 → YJ (Electronic Monitoring) Amendment Bill 2025</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">PASSED 2 Apr 2025 + PASSED 12 Feb 2026 · Gerber LNP · <a href="#vol-7" className="text-bauhaus-blue hover:underline">§24.7</a></p>
 </div>
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black mb-1">DELIVERED BY</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">QLD DYJ + monitoring-device contractor</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">Roll-out expanded to Toowoomba, Mt Isa, Cairns regional areas. Police no longer required to consider alternatives to arrest for breaches.</p>
 </div>
 <div>
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1">OUTCOMES</div>
 <ul className="text-[10px] text-bauhaus-black leading-relaxed space-y-1">
 <li>· Children &gt;2 days in watchhouse: <span className="font-black text-bauhaus-red">{childOver2}</span> today (avg cell, no programs)</li>
 <li>· Adults &gt;7 days in watchhouse: <span className="font-black">{ws ? ws.adult_over_7_days : '—'}</span> · longest <span className="font-black">{ws ? `${ws.adult_longest_days}d` : '—'}</span></li>
 <li>· Detention occupancy: 76–92% across BYDC, Cleveland, West Moreton (overflow → watchhouses)</li>
 <li>· Remand-as-default pattern: data point we&apos;re building (proxy = watchhouse-pop trend, §2)</li>
 </ul>
 </div>
 </div>
 <div className="mt-4 pt-3 border-t-2 border-bauhaus-black text-[11px] font-medium text-bauhaus-black leading-relaxed">
 <span className="font-black uppercase tracking-widest text-bauhaus-red">Chain status:</span> Promise made (twice within 60 days) → two separate Bills passed → infrastructure rolled out to regional centres → <span className="font-black text-bauhaus-red">predictable knock-on effect: more children on remand, more watchhouse-as-overflow</span>. The bail-monitoring program is the most-paired example in the dataset of a promise that <em>does</em> land structurally, but the &ldquo;safer&rdquo; outcome the announcements claimed is operating against the watchhouse-occupancy data above. Tightening bail without scaling community-bed capacity simply moves children from community to remand.
 </div>
 </div>

 {/* CHAIN 3, DETENTION CAPACITY EXPANSION */}
 <div className="border-4 border-bauhaus-blue p-6 bg-white">
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-3">Chain 5 · Detention capacity expansion (bipartisan)</div>
 <div className="grid md:grid-cols-4 gap-4 text-xs">
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-1">PROMISE</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">Wacol Remand 76 beds, Woodford 80, Cairns 40, 196 new beds total</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">Palaszczuk Labor 2023–24 announcements; Crisafulli LNP continues</p>
 </div>
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue mb-1">BILL/STATEMENT</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">Multiple ministerial statements + capital appropriation</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">Construction underway 2024–2027 timeline</p>
 </div>
 <div className="border-r-2 border-bauhaus-canvas md:pr-4">
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black mb-1">DELIVERED BY</div>
 <p className="font-black text-bauhaus-black leading-tight mb-1">QLD DYJ + BESIX Watpac (Woodford lead contractor)</p>
 <p className="text-[10px] font-mono text-bauhaus-muted">$1B+ combined capital across the three facilities</p>
 </div>
 <div>
 <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1">OUTCOMES</div>
 <ul className="text-[10px] text-bauhaus-black leading-relaxed space-y-1">
 <li>· Wacol Remand: opened early 2025 (76 beds added)</li>
 <li>· Woodford: targeting 2026 completion</li>
 <li>· Cairns: targeting 2027 operational</li>
 <li>· No equivalent community-services capital allocation in the same window</li>
 </ul>
 </div>
 </div>
 <div className="mt-4 pt-3 border-t-2 border-bauhaus-black text-[11px] font-medium text-bauhaus-black leading-relaxed">
 <span className="font-black uppercase tracking-widest text-bauhaus-red">Chain status:</span> Promise made → bills/appropriation passed → contractors engaged → <span className="font-black text-bauhaus-blue">capacity coming online on schedule</span>. The capital pipeline is the most-delivered part of the QLD YJ promise stack. Whether the additional capacity drives the outcomes the announcements claimed (&ldquo;safer Queensland&rdquo;, lower offending) is the test that runs over the next 5 years.
 </div>
 </div>
 </div>

 <p className="text-xs text-bauhaus-muted font-mono mt-6 max-w-3xl">
 Method: each chain anchors a high-profile QLD YJ policy promise and traces it through the live data we hold, ministerial statements (§23), bills register (§24.7), watchhouse occupancy (§1), CTG progress (§3), ACCO funding share (§10), capital backing (§2), and coronial outcomes (§24). Where outcome data is missing or moves the wrong way, the chain&apos;s &ldquo;status&rdquo; line surfaces it. We&apos;re building richer outcome ingestion (recidivism by year, detention bed-day cost, ACCO retention rates) for next iteration.
 </p>
 </section>

 <section id="section-25-5" className="mb-16 scroll-mt-24">
 <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§25.5 · SYNTHESIS</div>
 <h3 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">The shape of the choice</h3>
 <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
 Each new bed announcement is a structural commitment for 30+ years. Each new piece of bail-tightening legislation lengthens the average remand period. Each repealed prevention framework removes a counter-balancing institution. The cumulative direction of travel, combining the dataset numbers above (§3, §8, §10) with the policy moves in §23, is unambiguous: <span className="font-black text-bauhaus-red">QLD is structurally expanding custody capacity faster than community capacity</span>. The same dollars could have funded the operational scale-up of every &ldquo;promising&rdquo; ALMA intervention listed in §16, with evaluation budget left over.
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
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">CLOSING, Four structural moves</div>
 <h2 className="text-3xl font-black text-bauhaus-black uppercase tracking-tight mb-5">What would shift this</h2>
 <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 text-sm font-medium leading-relaxed text-bauhaus-black">
 <div>
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">1. Reallocate $200M from detention to community</div>
 <p>A $200M reallocation is roughly a {r.community > 0 ? Math.round((200_000_000 / r.community) * 100) : '—'}% expansion of the {money(r.community)} community-services line, enough to scale-up the most-promising ALMA interventions across the regional QLD network. Detention costs more per child than every alternative.</p>
 </div>
 <div>
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">2. Triple the ACCO share</div>
 <p>From {accoSharePct}% toward the in-custody share, the AIHW 2024-25 range puts First Nations representation at ~65–75%, so a target near that band, not a fixed multiplier of the current share. Aboriginal Community-Controlled Organisations consistently outperform mainstream NGOs on retention and outcomes for First Nations young people.</p>
 </div>
 <div>
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">3. Resource evaluation alongside delivery</div>
 <p>The reason most ALMA interventions sit at &quot;promising&quot; rather than &quot;proven&quot; isn&apos;t that programs don&apos;t work, it&apos;s that programs are funded to deliver, not to be evaluated. A small percentage of every grant going to monitoring closes the evidence gap within a budget cycle.</p>
 </div>
 <div>
 <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">4. Stop overriding the QLD Human Rights Act</div>
 <p>QLD has overridden its own HR Act <span className="font-black">twice</span> in 18 months to expand custody powers over children (<a href="#vol-7" className="text-bauhaus-blue font-black hover:underline">§23.1</a>). Each Act passed under the current Government has expanded custody, none community capacity. Reversing that legislative direction is the precondition for moves 1–3 to land.</p>
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
 <li><span className="font-black">{accoSharePct}% of dollars for the majority First Nations in-custody cohort</span> (~65–75% across AIHW 2024-25 quarters). Frame your grants against this denominator. ACCOs deliver better outcomes; they don&apos;t get the dollars.</li>
 <li><span className="font-black">Evidence-vs-spend gap is real and quantifiable.</span> {money(r.groupConferencing)} group conferencing, the most-evidence-backed early intervention in the budget, versus {money(r.detention)} for detention services.</li>
 <li><span className="font-black">$1B+ committed to detention capacity expansion</span> (<a href="#vol-1" className="text-bauhaus-blue font-black hover:underline">§2</a>: Wacol $250M+ build + ~$150M ops first 3 yrs; Woodford up to $627.61M reported; Cairns TBD). Foundation giving is adjacent, not anchored, see <a href="#vol-3" className="text-bauhaus-blue font-black hover:underline">§11</a>.</li>
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
 <li><span className="font-black">Live coronial findings ({fmt(r.coronerFindings.length)} in-custody / YJ-flagged in <a href="#vol-7" className="text-bauhaus-blue hover:underline">§24</a>).</span> Pilkington 27 recommendations · Schafer prison-murder · Valera family-violence/suicide. PDFs link direct to the QLD Coroners Court source.</li>
 <li><span className="font-black">{fmt(r.officialBills.length)} live YJ bills tracked from parliament.qld.gov.au</span> with sponsor + party + status (<a href="#vol-7" className="text-bauhaus-blue hover:underline">§24.7</a>). Pair with the watchhouse refresh and the live ministerial-statement feed for any contemporary story.</li>
 <li><span className="font-black">Director networks in <a href="#vol-4" className="text-bauhaus-blue hover:underline">§14</a></span> connect QLD YJ orgs to national NGO boards, advocacy peaks, and government advisory committees. The shadow network is small.</li>
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
 <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Two ways to take this further</h2>
 <p className="text-bauhaus-black font-medium leading-relaxed max-w-3xl mb-5">
 The same pipeline that produced this report runs for any sector or organisation in Australia: multicultural peak bodies, ACCOs, foundations, lobbyists, federal procurement, place-based investment. Tell us what hit and what missed. Anonymously if you like.
 </p>
 <div className="flex flex-wrap gap-3 mb-5">
 <Link href="/feedback?subject=qld-youth-justice" className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">★ Send feedback (~2 min) →</Link>
 <Link href="/share/partner?ref=qld-youth-justice" className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-white text-bauhaus-black border-2 border-bauhaus-black hover:bg-bauhaus-canvas">Partner with us →</Link>
 </div>
 <p className="text-xs text-bauhaus-black/70 font-mono leading-relaxed max-w-3xl">
 Partnerships we&apos;re looking for: foundations co-funding sector reports · ACCO + community-controlled orgs that want their own version of this · journalists on a story · sector peaks pitching system change · researchers using the underlying dataset.
 </p>
 </section>

 <section className="text-center mb-8">
 <div className="text-xs font-mono text-bauhaus-muted">
 Watchhouse: refreshed twice daily from QPS · Funding: QLD state-budget &amp; Justice department disclosures · ACCO gap: <code>mv_yj_report_acco_gap</code> · ALMA: civil-society register · LGA: <code>lga_cross_system_stats</code> · NDIS: <code>v_ndis_youth_justice_overlay</code> · CTG: <code>v_ctg_youth_justice_progress</code> · Last loaded {new Date().toISOString().slice(0, 10)}
 </div>
 </section>
 </div>
 );
}



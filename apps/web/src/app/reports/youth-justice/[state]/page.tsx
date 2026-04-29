import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { FundingByProgramChart, StateComparisonChart, LgaFundingChart } from '../../_components/report-charts';
import { qldAnnouncementHrefForProgram } from '@/lib/reports/qld-youth-justice-announcements';
import {
  getFundingByProgram,
  getProgramsWithPartners,
  getTopOrgs,
  getAlmaInterventions,
  getAlmaCount,
  getFundingByLga,
  getAccoFundingGap,
  getFundingByRemoteness,
  getEvidenceCoverage,
  getEvidenceGapDetail,
  getHansardMentions,
  getYjLobbyingConnections,
  getYjRevolvingDoor,
  getStateDataDepth,
  getOutcomesMetrics,
  getStateComparisonMetrics,
  getRogsExpenditure,
  money,
  fmt,
} from '@/lib/services/report-service';

export const revalidate = 3600;

const STATE_META: Record<string, { name: string; description: string }> = {
  qld: { name: 'Queensland', description: 'Queensland has the highest First Nations overrepresentation (26x) and remand rate (86%) in Australia. $3.5B spent over 10 years with 317 children detained on an average day. This report maps who gets funded, what evidence exists, and who has political connections.' },
  nsw: { name: 'New South Wales', description: 'NSW detains 200 children on an average day with 22x Indigenous overrepresentation. $2.8B in 10-year ROGS spending, 72% unsentenced. The state with the highest Indigenous detention rate per 10,000 (32).' },
  vic: { name: 'Victoria', description: 'Victoria spends $7,123/day per child in detention — the highest in Australia. 120 children detained daily, 14x Indigenous overrepresentation. $3B total ROGS spending, the second-highest nationally.' },
  wa: { name: 'Western Australia', description: 'WA has 24x Indigenous overrepresentation and 78% of detained children are unsentenced. 145 children detained daily. $1.3B in 10-year spending with 4.2 per 10K detention rate.' },
  sa: { name: 'South Australia', description: 'SA has 20x Indigenous overrepresentation with 80 children detained daily. $560M in 10-year ROGS spending at $2,890/day per child in detention.' },
  nt: { name: 'Northern Territory', description: 'The NT has the highest detention rate in Australia (17 per 10K) with 62 children detained daily. 80% unsentenced. Despite 5x overrepresentation ratio, the NT\'s First Nations detention rate (25/10K) is among the highest.' },
  tas: { name: 'Tasmania', description: 'Tasmania detains 15 children on an average day at $3,400/day. $283M in 10-year ROGS spending with 70% on remand. One of the smallest youth justice systems nationally.' },
  act: { name: 'Australian Capital Territory', description: 'The ACT has the smallest youth justice system with 12 children detained daily, but the highest cost per day nationally ($5,200). 74% are unsentenced. $306M in 10-year ROGS spending.' },
};

export function generateStaticParams() {
  return Object.keys(STATE_META).map(state => ({ state }));
}

export function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  // Note: can't await in generateMetadata synchronously, but Next.js handles it
  return params.then(({ state }) => {
    const meta = STATE_META[state.toLowerCase()];
    if (!meta) return { title: 'Not Found' };
    return { title: `${meta.name} Youth Justice — CivicGraph` };
  });
}

type ProgramRow = { state?: string; program_name: string; grants: number; total: number; orgs: number };
type OrgRow = { recipient_name: string; recipient_abn: string | null; state: string | null; grants: number; total: number; gs_id: string | null };
type AlmaRow = { name: string; type: string | null; evidence_level: string | null; geography: string | null; portfolio_score: number | null; gs_id: string | null; org_name: string | null; org_abn: string | null };
type LgaRow = { lga_name: string; state: string; orgs: number; total_funding: number; seifa_decile: number | null };
type AccoGap = {
  org_type: string;
  orgs: number;
  total_funding: number;
  avg_per_recipient?: number;
  avg_grant: number;
  funding_rows?: number;
  funding_share_pct?: number;
};
type RemotenessRow = { remoteness: string; orgs: number; total: number; grants: number };
type CoverageRow = { total_interventions: number; with_evidence: number; without_evidence: number; coverage_pct: number };
type GapRow = { name: string; type: string | null; evidence_level: string | null; has_evidence: boolean; evidence_type: string | null; methodology: string | null; gs_id: string | null; org_abn: string | null };
type HansardRow = { speaker_name: string; speaker_party: string | null; speaker_electorate: string | null; sitting_date: string; subject: string | null; excerpt: string };
type LobbyRow = { canonical_name: string; gs_id: string | null; lobbyist_name: string | null; client_name: string | null; relationship_type: string };
type RevolvingDoorRow = {
  canonical_name: string; revolving_door_score: number; influence_vectors: number;
  total_donated: number; total_contracts: number; total_funded: number;
  parties_funded: string; distinct_buyers: number; is_community_controlled: boolean;
};
type PartnerRow = { state?: string; program_name: string; recipient_name: string; recipient_abn: string | null; total: number | null; grants: number; gs_id: string | null; is_community_controlled: boolean | null };
type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };
type ComparisonRow = { jurisdiction: string; metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null };
type RogsRow = { program_name: string; total: number; years: number };
type QldDeliveryCheck = {
  program: string;
  announcedTotal: number;
  announcedLabel: string;
  sourceLabel: string;
  sourceUrl: string;
  intent: string;
  matchTerms: string[];
  providerTerms?: string[];
  trackerKeys?: string[];
  evidence: Array<{
    kind: string;
    label: string;
    detail: string;
    sourceUrl: string;
  }>;
  dataNeeded: string[];
  note?: string;
};
type TrackerEvent = {
  tracker_key: string;
  stage: string;
  event_date: string;
  title: string;
  summary: string;
  source_kind: string;
  source_name: string;
  source_url?: string;
  provider_name?: string;
  site_names?: string[];
  evidence_strength?: string;
  mirror_status?: string;
  metadata?: Record<string, unknown>;
};

const STATE_CSV_COLUMNS: Record<string, string> = {
  NSW: 'NSW',
  VIC: 'Vic',
  QLD: 'Qld',
  WA: 'WA',
  SA: 'SA',
  TAS: 'Tas',
  ACT: 'ACT',
  NT: 'NT',
};

const STATE_SNAPSHOT_COVERAGE: Record<string, {
  yjRows: number;
  yjRecipients: number;
  yjDollars: number;
  nonRogsRows: number;
  nonRogsRecipients: number;
  nonRogsDollars: number;
  almaCount: number;
  evidenceTotal: number;
  evidenceWith: number;
  evidenceWithout: number;
  evidencePct: number;
}> = {
  ACT: { yjRows: 108, yjRecipients: 5, yjDollars: 1_598_611_612, nonRogsRows: 68, nonRogsRecipients: 1, nonRogsDollars: 986_194_612, almaCount: 15, evidenceTotal: 15, evidenceWith: 8, evidenceWithout: 7, evidencePct: 53 },
  NSW: { yjRows: 115, yjRecipients: 12, yjDollars: 14_853_975_435, nonRogsRows: 75, nonRogsRecipients: 8, nonRogsDollars: 9_161_174_435, almaCount: 68, evidenceTotal: 68, evidenceWith: 61, evidenceWithout: 7, evidencePct: 90 },
  NT: { yjRows: 108, yjRecipients: 5, yjDollars: 5_100_394_834, nonRogsRows: 68, nonRogsRecipients: 1, nonRogsDollars: 3_155_482_834, almaCount: 79, evidenceTotal: 79, evidenceWith: 55, evidenceWithout: 24, evidencePct: 70 },
  QLD: { yjRows: 4_818, yjRecipients: 1_480, yjDollars: 20_537_539_692, nonRogsRows: 4_776, nonRogsRecipients: 1_476, nonRogsDollars: 12_845_557_692, almaCount: 228, evidenceTotal: 228, evidenceWith: 224, evidenceWithout: 4, evidencePct: 98 },
  SA: { yjRows: 118, yjRecipients: 14, yjDollars: 2_988_615_366, nonRogsRows: 78, nonRogsRecipients: 10, nonRogsDollars: 1_869_097_366, almaCount: 31, evidenceTotal: 31, evidenceWith: 18, evidenceWithout: 13, evidencePct: 58 },
  TAS: { yjRows: 108, yjRecipients: 5, yjDollars: 1_590_421_134, nonRogsRows: 68, nonRogsRecipients: 1, nonRogsDollars: 1_024_657_134, almaCount: 39, evidenceTotal: 39, evidenceWith: 13, evidenceWithout: 26, evidencePct: 33 },
  VIC: { yjRows: 113, yjRecipients: 9, yjDollars: 15_989_687_347, nonRogsRows: 73, nonRogsRecipients: 5, nonRogsDollars: 10_029_145_347, almaCount: 54, evidenceTotal: 54, evidenceWith: 48, evidenceWithout: 6, evidencePct: 89 },
  WA: { yjRows: 108, yjRecipients: 6, yjDollars: 6_732_640_078, nonRogsRows: 68, nonRogsRecipients: 2, nonRogsDollars: 4_036_320_078, almaCount: 53, evidenceTotal: 53, evidenceWith: 44, evidenceWithout: 9, evidencePct: 83 },
};

const SNAPSHOT_STATE_METRICS: ComparisonRow[] = [
  { jurisdiction: 'ACT', metric_name: 'avg_daily_detention', metric_value: 12, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'National', metric_name: 'avg_daily_detention', metric_value: 950, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NSW', metric_name: 'avg_daily_detention', metric_value: 200, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NT', metric_name: 'avg_daily_detention', metric_value: 62, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'QLD', metric_name: 'avg_daily_detention', metric_value: 317, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'SA', metric_name: 'avg_daily_detention', metric_value: 80, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'TAS', metric_name: 'avg_daily_detention', metric_value: 15, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'VIC', metric_name: 'avg_daily_detention', metric_value: 120, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'WA', metric_name: 'avg_daily_detention', metric_value: 145, metric_unit: 'count', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'National', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 17, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NSW', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 22, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NT', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 5, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'QLD', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 26, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'SA', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 20, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'VIC', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 14, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'WA', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 24, metric_unit: 'ratio', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'ACT', metric_name: 'detention_rate_per_10k', metric_value: 2.2, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'National', metric_name: 'detention_rate_per_10k', metric_value: 3.4, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NSW', metric_name: 'detention_rate_per_10k', metric_value: 3.6, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NT', metric_name: 'detention_rate_per_10k', metric_value: 17, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'QLD', metric_name: 'detention_rate_per_10k', metric_value: 5.1, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'SA', metric_name: 'detention_rate_per_10k', metric_value: 2.8, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'TAS', metric_name: 'detention_rate_per_10k', metric_value: 3, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'VIC', metric_name: 'detention_rate_per_10k', metric_value: 1.4, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'WA', metric_name: 'detention_rate_per_10k', metric_value: 4.2, metric_unit: 'per_10k', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'ACT', metric_name: 'pct_unsentenced', metric_value: 74, metric_unit: 'percentage', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'National', metric_name: 'pct_unsentenced', metric_value: 75, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NSW', metric_name: 'pct_unsentenced', metric_value: 72, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NT', metric_name: 'pct_unsentenced', metric_value: 80, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'QLD', metric_name: 'pct_unsentenced', metric_value: 86, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'SA', metric_name: 'pct_unsentenced', metric_value: 68, metric_unit: 'percentage', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'TAS', metric_name: 'pct_unsentenced', metric_value: 70, metric_unit: 'percentage', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'VIC', metric_name: 'pct_unsentenced', metric_value: 65, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'WA', metric_name: 'pct_unsentenced', metric_value: 78, metric_unit: 'percent', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'ACT', metric_name: 'cost_per_day_detention', metric_value: 5200, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'National', metric_name: 'cost_per_day_detention', metric_value: 3635, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NSW', metric_name: 'cost_per_day_detention', metric_value: 3200, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'NT', metric_name: 'cost_per_day_detention', metric_value: 4800, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'QLD', metric_name: 'cost_per_day_detention', metric_value: 2162, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'SA', metric_name: 'cost_per_day_detention', metric_value: 2890, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'TAS', metric_name: 'cost_per_day_detention', metric_value: 3400, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'VIC', metric_name: 'cost_per_day_detention', metric_value: 7123, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
  { jurisdiction: 'WA', metric_name: 'cost_per_day_detention', metric_value: 2573, metric_unit: 'dollars', period: '2023-24', cohort: 'all' },
];

const QLD_DELIVERY_CHECKS: QldDeliveryCheck[] = [
  {
    program: 'Staying on Track',
    announcedTotal: 225_000_000,
    announcedLabel: '$225m over 5 years',
    sourceLabel: '2025-26 Budget Paper 4',
    sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf',
    intent: '12 months of post-release rehabilitation support for young people exiting detention.',
    matchTerms: ['staying on track'],
    providerTerms: ['life without barriers', 'jabalbina', 'namu collective', 'shine for kids', 'fearless towards success', 'anglicare', 'village support'],
    evidence: [
      { kind: 'Budget', label: 'Budget measure', detail: '$225m over 5 years for post-release rehabilitation support.', sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf' },
      { kind: 'Announcement', label: 'Budget media release', detail: 'Included in the $560m early intervention and rehabilitation package.', sourceUrl: 'https://statements.qld.gov.au/statements/102882' },
      { kind: 'Ministerial statement', label: 'First provider named', detail: 'Life Without Barriers named for the first Gold Coast Staying on Track program.', sourceUrl: 'https://statements.qld.gov.au/statements/103190' },
      { kind: 'Ministerial statement', label: 'South East rollout', detail: 'Fearless Towards Success, Anglicare Southern Queensland, and Village Support named for Ipswich, Inala, Somerset, and Lockyer Valley.', sourceUrl: 'https://statements.qld.gov.au/statements/103605' },
      { kind: 'Ministerial statement', label: 'Far North rollout', detail: 'Jabalbina Yalanji Aboriginal Corporation, Namu Collective, and Shine for Kids named for FNQ delivery.', sourceUrl: 'https://statements.qld.gov.au/statements/103621' },
      { kind: 'Ministerial statement', label: 'Townsville rollout', detail: 'Namu Collective named for the Townsville Staying on Track program.', sourceUrl: 'https://statements.qld.gov.au/statements/103667' },
    ],
    dataNeeded: ['Provider contract or grant row naming Staying on Track', 'Locations and delivery partners', 'Referral and completion volumes'],
  },
  {
    program: 'Circuit Breaker Sentencing',
    announcedTotal: 80_000_000,
    announcedLabel: '$80m over 4 years',
    sourceLabel: '2025-26 Budget Paper 4',
    sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf',
    intent: 'Court-sentenced intensive rehabilitation as an alternative to youth detention.',
    matchTerms: ['circuit breaker'],
    evidence: [
      { kind: 'Budget', label: 'Budget measure', detail: '$80m over 4 years for Circuit Breaker Sentencing.', sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf' },
      { kind: 'Announcement', label: 'Budget media release', detail: 'Named as part of the rehabilitation package.', sourceUrl: 'https://statements.qld.gov.au/statements/102882' },
    ],
    dataNeeded: ['Procurement or contract award', 'Operating model and eligible courts', 'Participant numbers and completion outcomes'],
  },
  {
    program: 'Youth Justice Schools',
    announcedTotal: 40_000_000,
    announcedLabel: '$40m over 2 years',
    sourceLabel: '2025-26 Budget SDS',
    sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-SDS-Department-of-Youth-Justice-and-Victim-Support.pdf',
    intent: 'Two schools for high-risk teens on youth justice orders in SEQ and North Queensland.',
    matchTerms: ['youth justice school'],
    providerTerms: ['ohana education', 'ohana for youth'],
    trackerKeys: ['crime-prevention-schools'],
    evidence: [
      { kind: 'Budget', label: 'Service Delivery Statement', detail: '$40m over 2 years for two Youth Justice Schools.', sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-SDS-Department-of-Youth-Justice-and-Victim-Support.pdf' },
      { kind: 'Announcement', label: 'Budget media release', detail: 'Named alongside Crime Prevention Schools in the 2025-26 package.', sourceUrl: 'https://statements.qld.gov.au/statements/102882' },
    ],
    dataNeeded: ['School operators or departmental delivery line', 'Confirmed sites', 'Enrolments, attendance, and transition outcomes'],
  },
  {
    program: 'Kickstarter early intervention',
    announcedTotal: 50_000_000,
    announcedLabel: '$50m over 4 years',
    sourceLabel: '2025-26 Budget Paper 4',
    sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf',
    intent: 'Research-backed early intervention models for at-risk young people.',
    matchTerms: ['kickstarter'],
    evidence: [
      { kind: 'Budget', label: 'Budget measure', detail: '$50m over 4 years for research-backed early intervention programs.', sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf' },
      { kind: 'Ministerial statement', label: 'Round one providers', detail: '11 early intervention programs across Brisbane, Logan and Ipswich shared $2.7m in round one.', sourceUrl: 'https://statements.qld.gov.au/statements/103461' },
      { kind: 'Ministerial statement', label: 'Cairns example', detail: 'A 20 January 2026 statement names a Cairns girls mentoring program.', sourceUrl: 'https://statements.qld.gov.au/statements/104349' },
      { kind: 'Ministerial statement', label: 'Townsville example', detail: 'A 20 January 2026 statement names a Townsville vocational pathway program.', sourceUrl: 'https://statements.qld.gov.au/statements/104341' },
      { kind: 'Ministerial statement', label: 'Wide Bay example', detail: 'An April 2026 statement says the government had delivered 49 new Kickstarter programs.', sourceUrl: 'https://statements.qld.gov.au/statements/104827' },
    ],
    dataNeeded: ['Complete provider list for the 49 new programs', 'Grant/contract amounts per provider', 'Evidence model used for each funded program'],
    note: 'Ministerial statements say 49 new Kickstarter programs had been delivered by 29 April 2026.',
  },
  {
    program: 'Gold Standard proven initiatives',
    announcedTotal: 65_000_000,
    announcedLabel: '$65m over 5 years',
    sourceLabel: '2025-26 Budget Paper 4',
    sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf',
    intent: 'Community-led and outcomes-focused programs that reduce youth offending.',
    matchTerms: ['gold standard', 'proven initiative'],
    evidence: [
      { kind: 'Budget', label: 'Budget measure', detail: '$65m over 5 years for Gold Standard proven initiatives.', sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf' },
      { kind: 'Announcement', label: 'Budget media release', detail: 'Named as part of the early intervention and rehabilitation package.', sourceUrl: 'https://statements.qld.gov.au/statements/102882' },
      { kind: 'Ministerial statement', label: 'Proven Initiatives EOI', detail: 'First $5m expression-of-interest round opened under the $65m Proven Initiatives program.', sourceUrl: 'https://statements.qld.gov.au/statements/103460' },
    ],
    dataNeeded: ['Definition of proven initiative', 'Provider list and selection method', 'Outcomes framework and reporting cadence'],
  },
  {
    program: 'Regional Reset',
    announcedTotal: 50_000_000,
    announcedLabel: '$50m over 4 years',
    sourceLabel: 'Ministerial statement, 23 Oct 2025',
    sourceUrl: 'https://statements.qld.gov.au/statements/103764',
    intent: 'Nine-location intensive early intervention program; Youth Insearch named for Central Queensland.',
    matchTerms: ['regional reset', 'youth insearch'],
    providerTerms: ['youth insearch'],
    evidence: [
      { kind: 'Announcement', label: 'Early tender process', detail: 'Stakeholder information sessions commenced for Regional Reset and Staying on Track within the government first 100 days.', sourceUrl: 'https://statements.qld.gov.au/statements/101911' },
      { kind: 'Announcement', label: 'Tenders opened', detail: 'Tenders opened for Regional Reset and Staying on Track in March 2025.', sourceUrl: 'https://statements.qld.gov.au/statements/102167' },
      { kind: 'Ministerial statement', label: 'Regional Reset launch', detail: '23 October 2025 statement describes nine target locations and names Youth Insearch for Central Queensland.', sourceUrl: 'https://statements.qld.gov.au/statements/103764' },
      { kind: 'Ministerial statement', label: 'Moreton Bay rollout', detail: '4 November 2025 statement names Youth Insearch for Moreton Bay Regional Reset delivery.', sourceUrl: 'https://statements.qld.gov.au/statements/103857' },
      { kind: 'Budget', label: 'Budget allocation', detail: '$50m over 4 years for the Regional Reset program.', sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf' },
    ],
    dataNeeded: ['Contracts for the nine locations', 'Named providers beyond the public example', 'Participation, completion, and reoffending indicators'],
    note: 'Statement identifies Youth Insearch delivery for Central Queensland, but the current funding table does not expose a matching provider row.',
  },
  {
    program: 'Crime Prevention Schools',
    announcedTotal: 50_000_000,
    announcedLabel: '$50m over 5 years',
    sourceLabel: '2025-26 Budget SDS',
    sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-SDS-Department-of-Youth-Justice-and-Victim-Support.pdf',
    intent: 'Re-engage young people who have disengaged from mainstream education and are at risk of crime.',
    matchTerms: ['crime prevention school'],
    providerTerms: ['men of business', 'ohana education', 'ohana for youth'],
    trackerKeys: ['crime-prevention-schools'],
    evidence: [
      { kind: 'Budget', label: 'Service Delivery Statement', detail: '$50m over 5 years for Crime Prevention Schools.', sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-SDS-Department-of-Youth-Justice-and-Victim-Support.pdf' },
      { kind: 'Announcement', label: 'Budget media release', detail: 'Named as one of the education-linked youth justice initiatives.', sourceUrl: 'https://statements.qld.gov.au/statements/102882' },
    ],
    dataNeeded: ['School/provider contract rows', 'Confirmed sites and enrolments', 'Education engagement and justice contact outcomes'],
  },
  {
    program: 'Youth Co-response Models',
    announcedTotal: 75_000_000,
    announcedLabel: '$75m over 4 years',
    sourceLabel: '2025-26 Budget Paper 4',
    sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf',
    intent: 'Target crime hotspots and enhance community safety.',
    matchTerms: ['co-response', 'co response'],
    evidence: [
      { kind: 'Budget', label: 'Budget measure', detail: '$75m over 4 years for Youth Co-response Models.', sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf' },
      { kind: 'Announcement', label: 'Budget media release', detail: 'Named in the 2025-26 youth justice package.', sourceUrl: 'https://statements.qld.gov.au/statements/102882' },
    ],
    dataNeeded: ['Police/department/provider delivery split', 'Hotspot locations', 'Callout, diversion, and repeat-contact indicators'],
  },
  {
    program: 'Intensive Case Management',
    announcedTotal: 38_800_000,
    announcedLabel: '$38.8m over 4 years',
    sourceLabel: '2025-26 Budget Paper 4',
    sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf',
    intent: 'Tailored evidence-based support for high-risk youth, including serious repeat offenders.',
    matchTerms: ['intensive case management'],
    evidence: [
      { kind: 'Budget', label: 'Budget measure', detail: '$38.8m over 4 years for Intensive Case Management.', sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf' },
      { kind: 'Announcement', label: 'Budget media release', detail: 'Named in the 2025-26 youth justice package.', sourceUrl: 'https://statements.qld.gov.au/statements/102882' },
      { kind: 'Ministerial statement', label: 'Existing ICM expansion evidence', detail: 'September 2024 statement says ICM expanded to Bundaberg, Redlands, Gladstone, Sunshine Coast and Emerald, supported by $3.5m.', sourceUrl: 'https://statements.qld.gov.au/statements/101546' },
    ],
    dataNeeded: ['Case-management provider or departmental cost centre', 'Eligible cohort definition', 'Active caseload and outcomes'],
  },
  {
    program: 'Bail Programs',
    announcedTotal: 44_300_000,
    announcedLabel: '$44.3m over 4 years',
    sourceLabel: '2025-26 Budget Paper 4',
    sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf',
    intent: 'Support bail compliance by young people; $24.4m additional plus $19.8m internal departmental funding.',
    matchTerms: ['bail'],
    evidence: [
      { kind: 'Budget', label: 'Budget measure', detail: '$24.4m additional and $19.8m internal departmental funding for Bail Programs.', sourceUrl: 'https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf' },
      { kind: 'Ministerial statement', label: 'Bail monitoring laws', detail: 'Statements in December 2025 and February 2026 describe stronger bail monitoring laws.', sourceUrl: 'https://statements.qld.gov.au/statements/104491' },
      { kind: 'Data', label: 'SQL delivery signal', detail: 'Current funding snapshot contains named bail-support rows and provider references.', sourceUrl: 'https://www.families.qld.gov.au/open-data' },
    ],
    dataNeeded: ['Separate 2025-26 bail rows from older bail records', 'Provider-by-location service model', 'Bail compliance, breach, and remand impact data'],
    note: 'The SQL match includes older and current bail-support rows, so this proves named delivery exists but not a clean 2025-26 acquittal.',
  },
];

let rogsExpenditureCache: Record<string, RogsRow[]> | null | undefined;

function findRogsCsvPath() {
  const candidates = [
    path.join(process.cwd(), 'data/rogs-youth-justice/youth-justice-2026.csv'),
    path.join(process.cwd(), '../data/rogs-youth-justice/youth-justice-2026.csv'),
    path.join(process.cwd(), '../../data/rogs-youth-justice/youth-justice-2026.csv'),
  ];
  return candidates.find(existsSync) ?? null;
}

function toDollarsFromThousands(value: string | undefined): number {
  if (!value || value.toLowerCase() === 'na') return 0;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) : 0;
}

function buildRogsExpenditureSnapshot() {
  if (rogsExpenditureCache !== undefined) return rogsExpenditureCache;

  const csvPath = findRogsCsvPath();
  if (!csvPath) {
    rogsExpenditureCache = null;
    return rogsExpenditureCache;
  }

  const records = parse(readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
  }) as Array<Record<string, string>>;

  const totals: Record<string, Record<string, { total: number; years: Set<string> }>> = {};

  for (const row of records) {
    if (row.Measure !== 'Government expenditure') continue;
    if (row.Unit !== "$'000") continue;
    if (row.Description1 !== 'Government real recurrent expenditure') continue;
    if (!/^\d{4}-\d{2}$/.test(row.Year)) continue;

    const programName =
      row.Service_Type === 'Detention-based supervision' && row.Description3 === 'Detention-based services'
        ? 'ROGS Youth Justice Detention-based supervision'
        : row.Service_Type === 'Community-based supervision' && row.Description3 === 'Community-based services'
          ? 'ROGS Youth Justice Community-based supervision'
          : row.Service_Type === 'Group conferencing' && row.Description3 === 'Group conferencing'
            ? 'ROGS Youth Justice Group conferencing'
            : null;

    if (!programName) continue;

    for (const [state, column] of Object.entries(STATE_CSV_COLUMNS)) {
      totals[state] = totals[state] || {};
      totals[state][programName] = totals[state][programName] || { total: 0, years: new Set<string>() };
      totals[state][programName].total += toDollarsFromThousands(row[column]);
      totals[state][programName].years.add(row.Year);
    }
  }

  rogsExpenditureCache = Object.fromEntries(
    Object.entries(totals).map(([state, programs]) => [
      state,
      Object.entries(programs)
        .map(([program_name, value]) => ({ program_name, total: value.total, years: value.years.size }))
        .sort((a, b) => b.total - a.total),
    ]),
  );
  return rogsExpenditureCache;
}

function loadQldTrackerEvents(): TrackerEvent[] {
  const candidates = [
    path.join(process.cwd(), 'data/tracker-evidence'),
    path.join(process.cwd(), '../data/tracker-evidence'),
    path.join(process.cwd(), '../../data/tracker-evidence'),
  ];
  const evidenceDir = candidates.find(existsSync);
  if (!evidenceDir) return [];

  return [
    'qld-crime-prevention-schools.json',
    'qld-watchhouse-support.json',
    'qld-detention-expansion.json',
  ].flatMap(fileName => {
    const filePath = path.join(evidenceDir, fileName);
    if (!existsSync(filePath)) return [];
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { tracker_key: string; events?: Array<Omit<TrackerEvent, 'tracker_key'>> };
      return (parsed.events || []).map(event => ({ ...event, tracker_key: parsed.tracker_key }));
    } catch {
      return [];
    }
  });
}

function eventMatchesCommitment(event: TrackerEvent, check: QldDeliveryCheck) {
  if (check.trackerKeys?.includes(event.tracker_key)) return true;
  const haystack = `${event.title} ${event.summary} ${event.provider_name || ''} ${(event.site_names || []).join(' ')} ${JSON.stringify(event.metadata || {})}`.toLowerCase();
  return [...check.matchTerms, ...(check.providerTerms || [])].some(term => haystack.includes(term));
}

function isBroadProviderSignal(programName: string) {
  const name = programName.toLowerCase();
  return name === 'social services'
    || name === 'general goods and services'
    || name === 'general goods & services'
    || name.includes('community and youth justice services')
    || name.includes('community, youth justice services')
    || name.includes('community & youth justice services');
}

function buildQldDeliveryChecks(programs: ProgramRow[], partners: PartnerRow[], trackerEvents: TrackerEvent[]) {
  return QLD_DELIVERY_CHECKS.map(check => {
    const matches = programs.filter(program => {
      const programName = program.program_name.toLowerCase();
      return check.matchTerms.some(term => programName.includes(term));
    });
    const providerMatches = check.providerTerms?.length
      ? partners.filter(row => {
          const haystack = `${row.program_name} ${row.recipient_name}`.toLowerCase();
          const rowProgramName = row.program_name.toLowerCase();
          const sameProgram = check.matchTerms.some(term => rowProgramName.includes(term));
          return (sameProgram || isBroadProviderSignal(row.program_name))
            && check.providerTerms?.some(term => haystack.includes(term));
        })
      : [];
    const trackerMatches = trackerEvents
      .filter(event => eventMatchesCommitment(event, check))
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
    const mirroredTrackerCount = trackerMatches.filter(event => event.mirror_status === 'mirrored').length;
    const visibleRows = matches.length > 0
      ? matches.map(row => ({
          label: row.program_name,
          total: Number(row.total || 0),
          rows: Number(row.grants || 0),
          orgs: Number(row.orgs || 0),
        }))
      : providerMatches.map(row => ({
          label: `${row.program_name} / ${row.recipient_name}`,
          total: Number(row.total || 0),
          rows: Number(row.grants || 0),
          orgs: 1,
        }));
    const capturedTotal = visibleRows.reduce((sum, row) => sum + row.total, 0);
    const capturedRows = visibleRows.reduce((sum, row) => sum + row.rows, 0);
    const capturedOrgs = visibleRows.reduce((sum, row) => sum + row.orgs, 0);
    const ratio = check.announcedTotal > 0 ? capturedTotal / check.announcedTotal : 0;
    const status =
      capturedTotal === 0
        ? mirroredTrackerCount > 0
          ? 'Mirrored source signal'
          : trackerMatches.length > 0
            ? 'Official evidence only'
            : 'Not yet visible in SQL'
        : matches.length === 0
          ? 'Provider SQL signal'
          : ratio >= 0.75
            ? 'Named SQL delivery visible'
            : 'Partial SQL signal';
    const evidenceStage =
      capturedTotal > 0
        ? matches.length > 0
          ? 'Announcement + budget + named SQL funding signal'
          : 'Announcement + budget + provider SQL signal'
        : mirroredTrackerCount > 0
          ? 'Announcement + budget + mirrored tracker evidence'
          : trackerMatches.length > 0
            ? 'Announcement + budget + official source trail'
            : 'Announcement + budget only';
    const sourceChain = [
      ...check.evidence,
      ...trackerMatches.map(event => ({
        kind: event.source_kind.replace(/_/g, ' '),
        label: event.title,
        detail: event.summary,
        sourceUrl: event.source_url || '/reports/youth-justice/qld/tracker',
      })),
      capturedTotal > 0
        ? {
            kind: 'Data',
            label: 'Current SQL match',
            detail: `${money(capturedTotal)} across ${fmt(capturedRows)} funding rows and ${fmt(capturedOrgs)} organisation references matched by ${matches.length > 0 ? 'program name' : 'named provider'}.`,
            sourceUrl: '/reports/youth-justice/qld',
          }
        : {
            kind: 'Data',
            label: 'Current SQL gap',
            detail: 'No matching program-name or named-provider row is visible in the current QLD youth-justice funding snapshot.',
            sourceUrl: '/reports/youth-justice/qld',
          },
    ];

    return {
      ...check,
      capturedTotal,
      capturedRows,
      capturedOrgs,
      matchedPrograms: visibleRows.map(row => row.label),
      status,
      evidenceStage,
      sourceChain,
      trackerMatches,
    };
  });
}

function loadStateFundingSnapshot(stateCode: string): {
  programs: ProgramRow[];
  topOrgs: OrgRow[];
  programPartners: PartnerRow[];
} {
  const candidates = [
    path.join(process.cwd(), 'data/report-snapshots/youth-justice.json'),
    path.join(process.cwd(), '../data/report-snapshots/youth-justice.json'),
    path.join(process.cwd(), '../../data/report-snapshots/youth-justice.json'),
  ];
  const snapshotPath = candidates.find(existsSync);
  if (!snapshotPath) return { programs: [], topOrgs: [], programPartners: [] };

  try {
    const parsed = JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
      report?: {
        statePrograms?: ProgramRow[];
        stateTopOrgs?: OrgRow[];
        stateProgramPartners?: PartnerRow[];
      };
    };
    const report = parsed.report || {};
    return {
      programs: (report.statePrograms || []).filter(row => row.state === stateCode),
      topOrgs: (report.stateTopOrgs || []).filter(row => row.state === stateCode),
      programPartners: (report.stateProgramPartners || []).filter(row => row.state === stateCode),
    };
  } catch {
    return { programs: [], topOrgs: [], programPartners: [] };
  }
}

function getSnapshotOutcomes(stateCode: string): MetricRow[] {
  return SNAPSHOT_STATE_METRICS
    .filter(row => row.jurisdiction === stateCode)
    .map(row => ({
      metric_name: row.metric_name,
      metric_value: row.metric_value,
      metric_unit: row.metric_unit,
      period: row.period,
      cohort: row.cohort,
      source: 'April 2026 report snapshot',
      notes: 'Generated snapshot used for fast state report rendering.',
    }));
}

async function getStateReport(stateCode: string) {
  const fallback = STATE_SNAPSHOT_COVERAGE[stateCode];
  const [
    programs,
    topOrgs,
    programPartners,
    almaInterventions,
    almaCount,
    lgaFunding,
    accoGap,
    remoteness,
    evidenceCoverage,
    evidenceGaps,
    hansard,
    lobbying,
    revolvingDoor,
    dataDepth,
    outcomes,
    comparison,
    rogsExpenditure,
  ] = await Promise.all([
    getFundingByProgram('youth-justice', stateCode),
    getTopOrgs('youth-justice', 50, stateCode),
    getProgramsWithPartners('youth-justice', stateCode),
    getAlmaInterventions('youth-justice', 25, stateCode),
    getAlmaCount('youth-justice', stateCode),
    getFundingByLga('youth-justice', 20, stateCode),
    getAccoFundingGap('youth-justice', stateCode),
    getFundingByRemoteness('youth-justice', stateCode),
    getEvidenceCoverage('youth-justice', stateCode),
    getEvidenceGapDetail('youth-justice', stateCode),
    getHansardMentions(stateCode, 20),
    getYjLobbyingConnections('youth-justice', stateCode),
    getYjRevolvingDoor('youth-justice', 10, stateCode),
    getStateDataDepth(stateCode),
    getOutcomesMetrics(stateCode),
    getStateComparisonMetrics([
      'detention_rate_per_10k', 'avg_daily_detention', 'indigenous_overrepresentation_ratio',
      'pct_unsentenced', 'detention_5yr_trend_pct', 'cost_per_day_detention',
    ]),
    getRogsExpenditure(stateCode),
  ]);

  const stateFundingSnapshot = loadStateFundingSnapshot(stateCode);
  const rawProgramRows = (programs as ProgramRow[] | null) || [];
  const programRows = rawProgramRows.length > 0 ? rawProgramRows : stateFundingSnapshot.programs;
  const rawTopOrgs = (topOrgs as OrgRow[] | null) || [];
  const finalTopOrgs = rawTopOrgs.length > 0 ? rawTopOrgs : stateFundingSnapshot.topOrgs;
  const rawProgramPartners = (programPartners as PartnerRow[] | null) || [];
  const finalProgramPartners = rawProgramPartners.length > 0 ? rawProgramPartners : stateFundingSnapshot.programPartners;
  const rawRogsExpenditure = (rogsExpenditure as RogsRow[] | null) || [];
  const snapshotRogsExpenditure = buildRogsExpenditureSnapshot()?.[stateCode] || [];
  const finalRogsExpenditure = rawRogsExpenditure.length > 0 ? rawRogsExpenditure : snapshotRogsExpenditure;
  const rawOutcomes = (outcomes as MetricRow[] | null) || [];
  const finalOutcomes = rawOutcomes.length > 0 ? rawOutcomes : getSnapshotOutcomes(stateCode);
  const rawComparison = (comparison as ComparisonRow[] | null) || [];
  const finalComparison = rawComparison.length > 0 ? rawComparison : SNAPSHOT_STATE_METRICS;
  const rawCoverage = ((evidenceCoverage as CoverageRow[] | null) || [])[0] || null;
  const finalCoverage = rawCoverage || (fallback ? {
    total_interventions: fallback.evidenceTotal,
    with_evidence: fallback.evidenceWith,
    without_evidence: fallback.evidenceWithout,
    coverage_pct: fallback.evidencePct,
  } : null);
  const totalFunding = programRows.reduce((s, p) => s + Number(p.total), 0);
  const totalOrgs = new Set(
    finalTopOrgs.map(o => o.recipient_name)
  ).size || fallback?.yjRecipients || 0;

  const dataNotes: string[] = [];
  if (rawProgramRows.length === 0 && stateFundingSnapshot.programs.length > 0) {
    dataNotes.push('Program, service-provider, and organisation tables are loaded from the live-derived report snapshot.');
  } else if (programRows.length === 0 && fallback) {
    dataNotes.push(`${stateCode} has ${fallback.yjRows.toLocaleString()} youth-justice funding rows in the live-derived snapshot while detailed program tables are being expanded.`);
  }
  if (rawRogsExpenditure.length === 0 && finalRogsExpenditure.length > 0) {
    dataNotes.push('ROGS expenditure is read from the indexed ROGS 2026 source file.');
  }
  if (rawOutcomes.length === 0 && finalOutcomes.length > 0) {
    dataNotes.push('Outcome metrics are using the April 2026 report snapshot for instant rendering.');
  }
  if (!rawCoverage && finalCoverage) {
    dataNotes.push('Evidence coverage is using April 2026 ALMA snapshot counts.');
  }

  // Group partners by program
  const partnersByProgram: Record<string, PartnerRow[]> = {};
  for (const p of finalProgramPartners) {
    if (!partnersByProgram[p.program_name]) partnersByProgram[p.program_name] = [];
    partnersByProgram[p.program_name].push(p);
  }

  return {
    programs: programRows,
    topOrgs: finalTopOrgs,
    programPartners: finalProgramPartners,
    partnersByProgram,
    almaInterventions: (almaInterventions as AlmaRow[] | null) || [],
    almaCount: almaCount || fallback?.almaCount || 0,
    lgaFunding: (lgaFunding as LgaRow[] | null) || [],
    accoGap: (accoGap as AccoGap[] | null) || [],
    remoteness: (remoteness as RemotenessRow[] | null) || [],
    coverage: finalCoverage,
    evidenceGaps: (evidenceGaps as GapRow[] | null) || [],
    hansard: (hansard as HansardRow[] | null) || [],
    lobbying: (lobbying as LobbyRow[] | null) || [],
    revolvingDoor: (revolvingDoor as RevolvingDoorRow[] | null) || [],
    depth: ((dataDepth as Array<{ total_records: number; sources: number; programs: number; recipients: number; earliest_year: string; latest_year: string }> | null) || [])[0] || null,
    outcomes: finalOutcomes,
    comparison: finalComparison,
    rogsExpenditure: finalRogsExpenditure,
    totalFunding: totalFunding || 0,
    totalOrgs,
    fallback,
    dataNotes,
  };
}

export default async function StateYouthJusticePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const stateKey = state.toLowerCase();
  const meta = STATE_META[stateKey];
  if (!meta) notFound();

  const stateCode = stateKey.toUpperCase();
  const report = await getStateReport(stateCode);
  const cc = report.accoGap.find(r => r.org_type === 'Community Controlled');
  const otherProviders = report.accoGap.find(r => r.org_type === 'Other service providers');

  // Metric helpers
  const om = report.outcomes;
  const m = (name: string, cohort?: string): number | null => {
    const c = cohort ?? 'all';
    const row = om.find(r => r.metric_name === name && r.cohort === c);
    if (!row && !cohort) {
      const alt = om.find(r => r.metric_name === name && r.cohort === 'indigenous');
      return alt?.metric_value ?? null;
    }
    return row?.metric_value ?? null;
  };

  // Comparison lookup — prefer 'all' cohort
  const comp: Record<string, Record<string, number>> = {};
  for (const row of report.comparison) {
    if (!comp[row.metric_name]) comp[row.metric_name] = {};
    const existing = comp[row.metric_name][row.jurisdiction];
    if (existing === undefined || row.cohort === 'all') {
      comp[row.metric_name][row.jurisdiction] = row.metric_value;
    }
  }
  const cv = (metric: string, jur: string) => comp[metric]?.[jur] ?? null;

  // ROGS total expenditure (10-year sum)
  const rogsTotal = report.rogsExpenditure.reduce((s, r) => s + Number(r.total), 0);
  const rogsDet = report.rogsExpenditure.find(r => r.program_name.includes('Detention'));
  const rogsCom = report.rogsExpenditure.find(r => r.program_name.includes('Community'));
  const rogsConf = report.rogsExpenditure.find(r => r.program_name.includes('conferencing'));
  const detPct = rogsTotal ? Math.round((Number(rogsDet?.total || 0) / rogsTotal) * 100) : 0;
  const comPct = rogsTotal ? Math.round((Number(rogsCom?.total || 0) / rogsTotal) * 100) : 0;

  const headlineFunding = rogsTotal || report.totalFunding;
  const qldTrackerEvents = stateCode === 'QLD' ? loadQldTrackerEvents() : [];
  const qldDeliveryChecks = stateCode === 'QLD' ? buildQldDeliveryChecks(report.programs, report.programPartners, qldTrackerEvents) : [];
  const qldNamedCaptured = qldDeliveryChecks.reduce((sum, row) => sum + row.capturedTotal, 0);
  const qldMissingChecks = qldDeliveryChecks.filter(row => row.capturedTotal === 0).length;
  const qldAnnouncedTotal = qldDeliveryChecks.reduce((sum, row) => sum + row.announcedTotal, 0);
  const qldNamedProgramChecks = qldDeliveryChecks.filter(row => row.status === 'Named SQL delivery visible' || row.status === 'Partial SQL signal').length;
  const qldProviderSignalChecks = qldDeliveryChecks.filter(row => row.status === 'Provider SQL signal').length;
  const qldReferenceOnlyChecks = qldDeliveryChecks.filter(row => row.capturedTotal === 0 && row.sourceChain.length > 1).length;
  const qldWorkingSurfaces = stateCode === 'QLD' ? [
    {
      href: '#delivery-ledger',
      kicker: 'Start here',
      title: 'Delivery ledger',
      body: 'Compare what government announced with what CivicGraph can currently see in SQL, sources, trackers, and missing proof.',
    },
    {
      href: '/reports/youth-justice/qld/announcements',
      kicker: 'Announcements',
      title: 'Commitment workspaces',
      body: 'Open one commitment at a time: source chain, service leads, provider questions, and next evidence to collect.',
    },
    {
      href: '/reports/youth-justice/qld/announcements/services',
      kicker: 'Suppliers',
      title: 'Supplier and service map',
      body: 'Flip the register around by organisation, ABN, contact path, service lane, and overlap across initiatives.',
    },
    {
      href: '/reports/youth-justice/qld/trackers',
      kicker: 'Trackers',
      title: 'Evidence trackers',
      body: 'Follow source timelines such as schools, watchhouses, detention expansion, tender traces, and mirror gaps.',
    },
    {
      href: '/reports/youth-justice/qld/watchhouse-data',
      kicker: 'Watch-houses',
      title: 'Daily custody signal',
      body: 'Read the QPS 6am and 6pm watch-house count beside detention, remand, court, order, and support-service baselines.',
    },
    {
      href: '/reports/youth-justice/qld/crime-prevention-schools',
      kicker: 'Investigation',
      title: 'Crime Prevention Schools',
      body: 'Use the deeper dossier when the question is about school providers, tender trails, and named sites.',
    },
  ] : [];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <Link href="/reports/youth-justice" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Youth Justice
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">State Deep Dive</span>
          <span className="text-[10px] font-bold text-white bg-bauhaus-black px-2 py-0.5 rounded-sm uppercase tracking-wider">{stateCode}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          {meta.name} Youth Justice
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {meta.description}
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="#justice-funding" className="border border-gray-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:border-bauhaus-blue hover:bg-blue-50 hover:text-bauhaus-blue">
            Funding table
          </Link>
          <Link href="#alma-evidence" className="border border-gray-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:border-bauhaus-blue hover:bg-blue-50 hover:text-bauhaus-blue">
            ALMA evidence
          </Link>
          <Link href="#political-connections" className="border border-gray-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:border-bauhaus-blue hover:bg-blue-50 hover:text-bauhaus-blue">
            Hansard / power
          </Link>
          <Link href={`/reports/youth-justice/${stateKey}/tracker`} className="border border-bauhaus-red bg-bauhaus-red px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white hover:bg-white hover:text-bauhaus-red">
            Schools tracker
          </Link>
          <Link href={`/reports/youth-justice/${stateKey}/trackers`} className="border border-bauhaus-black bg-bauhaus-black px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white hover:bg-white hover:text-bauhaus-black">
            All trackers
          </Link>
          {stateCode === 'QLD' ? (
            <Link href="/reports/youth-justice/qld/watchhouse-data" className="border border-bauhaus-red bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-red hover:bg-bauhaus-red hover:text-white">
              Watch-house data
            </Link>
          ) : null}
          {stateCode === 'QLD' ? (
            <Link href="/reports/youth-justice/qld/announcements" className="border border-bauhaus-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
              Announcements
            </Link>
          ) : null}
          {stateCode === 'QLD' ? (
            <Link href="/reports/youth-justice/qld/announcements/services" className="border border-bauhaus-blue bg-bauhaus-blue px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white hover:bg-white hover:text-bauhaus-blue">
              Supplier map
            </Link>
          ) : null}
          {stateCode === 'QLD' ? (
            <Link
              href="/reports/youth-justice/qld/crime-prevention-schools"
              className="border border-bauhaus-blue bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
            >
              CPS dossier
            </Link>
          ) : null}
        </div>
        {/* State navigation */}
        <div className="flex flex-wrap gap-2 mt-4">
          {['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'].map(s => (
            <Link key={s} href={`/reports/youth-justice/${s.toLowerCase()}`} className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 border-2 border-bauhaus-black rounded transition-colors ${s === stateCode ? 'bg-bauhaus-black text-white' : 'hover:bg-bauhaus-black hover:text-white'}`}>
              {s}
            </Link>
          ))}
        </div>
        {qldWorkingSurfaces.length > 0 && (
          <section className="mt-6 border-4 border-bauhaus-black bg-white p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">QLD working routes</div>
                <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Choose the surface for the job</h2>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-bauhaus-muted">
                The state page is the overview. Use these routes when you need to act: prove delivery, resolve suppliers, follow evidence, or prepare outreach.
              </p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {qldWorkingSurfaces.map((surface) => (
                <Link
                  key={surface.href}
                  href={surface.href}
                  className="group flex min-h-[170px] flex-col border-2 border-gray-200 bg-bauhaus-canvas p-4 hover:border-bauhaus-blue hover:bg-blue-50"
                >
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{surface.kicker}</div>
                  <div className="mt-2 text-lg font-black leading-tight text-bauhaus-black group-hover:text-bauhaus-blue">{surface.title}</div>
                  <p className="mt-2 text-xs leading-relaxed text-bauhaus-muted">{surface.body}</p>
                  <div className="mt-auto pt-4 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Open &rarr;</div>
                </Link>
              ))}
            </div>
          </section>
        )}
        {report.dataNotes.length > 0 && (
          <div className="mt-5 border-2 border-bauhaus-black bg-white rounded-sm p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[10px] font-black text-bauhaus-blue uppercase tracking-widest">Live-derived snapshot</div>
                <h2 className="text-lg font-black text-bauhaus-black mt-1">{stateCode} data is connected and cached for speed</h2>
                <p className="text-sm text-bauhaus-muted mt-1 max-w-3xl">
                  These state numbers are generated from the youth-justice source chain and cached so the report opens quickly while deeper tables keep being expanded.
                </p>
              </div>
              {report.fallback && (
                <div className="text-right text-xs text-bauhaus-muted">
                  <div className="font-black text-bauhaus-black">{report.fallback.yjRows.toLocaleString()} rows</div>
                  <div>{money(report.fallback.yjDollars)} tracked</div>
                </div>
              )}
            </div>
            <ul className="grid gap-1 text-xs text-bauhaus-muted leading-relaxed mt-3 border-t border-gray-200 pt-3">
              {report.dataNotes.map(note => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Data Coverage Banner */}
      {report.depth && report.depth.total_records < 1000 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-amber-500 text-lg mt-0.5">&#9888;</span>
          <div>
            <div className="text-sm font-bold text-amber-800">Limited data coverage</div>
            <p className="text-xs text-amber-700 mt-0.5">
              {stateCode} has {fmt(report.depth.total_records)} justice funding records across {report.depth.sources} sources
              ({report.depth.earliest_year}&ndash;{report.depth.latest_year}).
              Sections below may appear sparse. More data sources are being added.
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{money(headlineFunding)}</div>
          <div className="text-xs text-gray-500 mt-1">{stateCode} Youth Justice {rogsTotal ? '(ROGS 10yr)' : 'Funding'}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-blue-600">{m('avg_daily_detention')?.toLocaleString() ?? fmt(report.totalOrgs)}</div>
          <div className="text-xs text-gray-500 mt-1">{m('avg_daily_detention') ? 'Avg Daily Detention' : 'Funded Organisations'}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{m('indigenous_overrepresentation_ratio') ? `${m('indigenous_overrepresentation_ratio')}x` : report.almaCount}</div>
          <div className="text-xs text-gray-500 mt-1">{m('indigenous_overrepresentation_ratio') ? 'First Nations Overrepresentation' : 'ALMA Interventions'}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{report.coverage?.coverage_pct ?? '—'}%</div>
          <div className="text-xs text-gray-500 mt-1">Evidence Coverage</div>
        </div>
      </div>

      {/* Key Outcomes — from outcomes_metrics DB */}
      {om.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-red pb-2">
            Key Outcomes
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">AIHW Youth Justice 2023-24 &amp; ROGS 2026 data.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {m('detention_rate_per_10k') !== null && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-gray-800">{m('detention_rate_per_10k')}</div>
                <div className="text-[10px] text-gray-500">Detention rate per 10K</div>
              </div>
            )}
            {m('avg_daily_detention') !== null && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-gray-800">{m('avg_daily_detention')?.toLocaleString()}</div>
                <div className="text-[10px] text-gray-500">Avg daily detention</div>
              </div>
            )}
            {m('pct_first_nations_detention') !== null && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-red-600">{m('pct_first_nations_detention')}%</div>
                <div className="text-[10px] text-gray-500">First Nations in detention</div>
              </div>
            )}
            {m('pct_unsentenced') !== null && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-amber-600">{m('pct_unsentenced')}%</div>
                <div className="text-[10px] text-gray-500">Unsentenced (remand)</div>
              </div>
            )}
          </div>

          {/* State comparison chart — detention rate at a glance */}
          {(() => {
            const detRateData = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'NT', 'TAS', 'ACT']
              .map(j => ({ jurisdiction: j, metric_value: cv('detention_rate_per_10k', j) ?? 0 }))
              .filter(d => d.metric_value > 0);
            return detRateData.length >= 3 ? (
              <div className="mb-8">
                <StateComparisonChart
                  data={detRateData}
                  metricKey="detention_rate_per_10k"
                  label="Detention rate per 10,000 young people"
                  format="number"
                  highlightState={stateCode}
                />
              </div>
            ) : null;
          })()}

          {/* State comparison table */}
          {Object.keys(comp).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Metric</th>
                    {['QLD', 'NSW', 'VIC', 'WA', 'NT', 'National'].map(j => (
                      <th key={j} className={`text-right py-2 font-black uppercase tracking-wider text-xs ${j === stateCode ? 'text-red-600' : ''}`}>{j}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Detention rate (per 10K)', metric: 'detention_rate_per_10k', highlight: true },
                    { label: 'Avg daily detention', metric: 'avg_daily_detention', highlight: false },
                    { label: 'Indigenous overrepresentation', metric: 'indigenous_overrepresentation_ratio', suffix: 'x' },
                    { label: '% unsentenced (remand)', metric: 'pct_unsentenced', suffix: '%' },
                    { label: 'Cost per day (detention)', metric: 'cost_per_day_detention', prefix: '$' },
                    { label: '5-year trend', metric: 'detention_5yr_trend_pct', suffix: '%', signed: true },
                  ].map((row) => {
                    const jurisdictions = ['QLD', 'NSW', 'VIC', 'WA', 'NT', 'National'];
                    const vals = jurisdictions.map(j => cv(row.metric, j));
                    if (vals.every(v => v === null)) return null;
                    return (
                      <tr key={row.metric} className={`border-b border-gray-200 ${row.highlight ? 'bg-red-50' : ''}`}>
                        <td className="py-2 font-medium">{row.label}</td>
                        {jurisdictions.map((j, ji) => {
                          const v = vals[ji];
                          const isThis = j === stateCode;
                          let cls = 'py-2 text-right';
                          if (isThis) cls += ' font-black text-red-600';
                          else if (j === 'National') cls += ' font-bold';
                          const display = v !== null
                            ? `${row.signed && v > 0 ? '+' : ''}${row.prefix || ''}${row.metric === 'cost_per_day_detention' ? v.toLocaleString() : v}${row.suffix || ''}`
                            : '—';
                          return <td key={j} className={cls}>{display}</td>;
                        })}
                      </tr>
                    );
                  }).filter(Boolean)}
                </tbody>
              </table>
              <div className="text-[10px] text-gray-400 italic mt-2">
                Sources: AIHW Youth Justice in Australia 2023-24, ROGS 2026 Table 17A.
              </div>
            </div>
          )}
        </section>
      )}

      {/* ROGS Expenditure Breakdown */}
      {rogsTotal > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-2 border-b-4 border-bauhaus-black pb-2">
            Where the Money Goes (ROGS)
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">Productivity Commission ROGS 2026 — 10-year expenditure breakdown.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {rogsDet && (
              <div className={`border-2 rounded-xl p-5 text-center ${detPct > 60 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="text-2xl font-black text-gray-800">{detPct}%</div>
                <div className="text-xs text-gray-500 mt-1">Detention-based</div>
                <div className="text-xs font-bold text-gray-600 mt-1">{money(rogsDet.total)}</div>
              </div>
            )}
            {rogsCom && (
              <div className="border-2 border-emerald-200 bg-emerald-50 rounded-xl p-5 text-center">
                <div className="text-2xl font-black text-emerald-700">{comPct}%</div>
                <div className="text-xs text-gray-500 mt-1">Community-based</div>
                <div className="text-xs font-bold text-gray-600 mt-1">{money(rogsCom.total)}</div>
              </div>
            )}
            {rogsConf && (
              <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-5 text-center">
                <div className="text-2xl font-black text-blue-700">{100 - detPct - comPct}%</div>
                <div className="text-xs text-gray-500 mt-1">Group conferencing</div>
                <div className="text-xs font-bold text-gray-600 mt-1">{money(rogsConf.total)}</div>
              </div>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden flex">
            <div className="bg-red-400 h-4" style={{ width: `${detPct}%` }} />
            <div className="bg-emerald-400 h-4" style={{ width: `${comPct}%` }} />
            <div className="bg-blue-400 h-4" style={{ width: `${100 - detPct - comPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>Detention</span>
            <span>Community</span>
            <span>Conferencing</span>
          </div>
        </section>
      )}

      {/* QLD announced commitments vs captured delivery */}
      {stateCode === 'QLD' && qldDeliveryChecks.length > 0 && (
        <section id="delivery-ledger" className="mb-12 w-full max-w-full min-w-0 scroll-mt-28">
          <div className="w-full max-w-full overflow-hidden rounded-sm border-2 border-bauhaus-black bg-white">
            <div className="p-6 border-b-2 border-bauhaus-black bg-bauhaus-canvas">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] xl:items-start">
                <div className="min-w-0">
                  <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest">Announcement vs delivery</div>
                  <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-wider mt-1">
                    QLD youth justice delivery ledger
                  </h2>
                  <p className="text-sm text-bauhaus-muted mt-2 max-w-4xl leading-relaxed">
                    This is an accountability join. The left side is what Queensland Government has announced or budgeted.
                    The right side is what CivicGraph can currently see in SQL, tracker evidence, Hansard/QON traces, tender mirrors,
                    ministerial statements, and local source files. A visible amount is not always final acquittal proof; it is the
                    strongest current signal we can show until contracts, grant schedules, provider reports, and outcomes data line up.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-right text-xs">
                  <div className="border border-gray-200 bg-white p-3">
                    <div className="text-lg font-black text-bauhaus-black">{money(qldAnnouncedTotal)}</div>
                    <div className="text-bauhaus-muted">announced across ledger</div>
                  </div>
                  <div className="border border-gray-200 bg-white p-3">
                    <div className="text-lg font-black text-bauhaus-black">{money(qldNamedCaptured)}</div>
                    <div className="text-bauhaus-muted">visible SQL/provider signals</div>
                  </div>
                  <div className="border border-gray-200 bg-white p-3">
                    <div className="text-lg font-black text-bauhaus-blue">{qldNamedProgramChecks + qldProviderSignalChecks}</div>
                    <div className="text-bauhaus-muted">with SQL signal</div>
                  </div>
                  <div className="border border-gray-200 bg-white p-3">
                    <div className="text-lg font-black text-bauhaus-red">{qldMissingChecks}</div>
                    <div className="text-bauhaus-muted">no SQL signal yet</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
                <div className="border border-gray-200 bg-white p-4">
                  <div className="text-[10px] font-black text-bauhaus-blue uppercase tracking-widest">How to read this</div>
                  <p className="mt-2 text-sm text-bauhaus-muted leading-relaxed">
                    Start with the status column. <span className="font-bold text-bauhaus-black">Named SQL</span> means a program-name match exists.
                    <span className="font-bold text-bauhaus-black"> Provider SQL</span> means a named provider appears in a broad funding row, so it is useful
                    evidence but not clean program-level proof. <span className="font-bold text-bauhaus-black">Not yet visible</span> means the announcement is
                    real, but the delivery trail still needs a tender, contract, grant, Hansard, provider, or outcomes record.
                  </p>
                </div>
                <div className="border border-gray-200 bg-white p-4">
                  <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest">Current gaps</div>
                  <p className="mt-2 text-sm text-bauhaus-muted leading-relaxed">
                    {qldReferenceOnlyChecks} commitments have official references but no SQL amount yet. These are the best candidates for the next
                    scrape pass through QTenders, contract disclosures, grant recipient lists, Hansard questions on notice, and provider announcements.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                <a href="https://budget.qld.gov.au/files/Budget-2025-26-BP4-Budget-Measures.pdf" className="border border-bauhaus-black px-2 py-1 bg-white hover:bg-bauhaus-black hover:text-white">
                  Budget Paper 4
                </a>
                <a href="https://budget.qld.gov.au/files/Budget-2025-26-SDS-Department-of-Youth-Justice-and-Victim-Support.pdf" className="border border-bauhaus-black px-2 py-1 bg-white hover:bg-bauhaus-black hover:text-white">
                  Service Delivery Statement
                </a>
                <a href="https://cabinet.qld.gov.au/ministers-portfolios/assets/charter-letter/laura-gerber.pdf" className="border border-bauhaus-black px-2 py-1 bg-white hover:bg-bauhaus-black hover:text-white">
                  Minister charter
                </a>
                <a href="https://statements.qld.gov.au/statements/102882" className="border border-bauhaus-black px-2 py-1 bg-white hover:bg-bauhaus-black hover:text-white">
                  Budget media statement
                </a>
                <Link href="/reports/youth-justice/qld/trackers" className="border border-bauhaus-black px-2 py-1 bg-white hover:bg-bauhaus-black hover:text-white">
                  Tracker evidence
                </Link>
                <Link href="/reports/youth-justice/qld/crime-prevention-schools" className="border border-bauhaus-black px-2 py-1 bg-white hover:bg-bauhaus-black hover:text-white">
                  Crime Prevention Schools dossier
                </Link>
                <Link href="/reports/youth-justice/qld/announcements" className="border border-bauhaus-black px-2 py-1 bg-white hover:bg-bauhaus-black hover:text-white">
                  Announcement register
                </Link>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-5">
                {[
                  ['1', 'Announced', 'Minister or budget statement names the commitment.'],
                  ['2', 'Budgeted', 'Budget Paper or SDS assigns money and purpose.'],
                  ['3', 'Contracted', 'SQL shows provider, amount, program, and source URL.'],
                  ['4', 'Delivered', 'Provider or department reports activity by place/cohort.'],
                  ['5', 'Outcomes', 'AIHW, ROGS, ALMA, or evaluations show impact.'],
                ].map(([step, label, detail]) => (
                  <div key={step} className="border border-gray-200 bg-white p-3">
                    <div className="text-[10px] font-black text-bauhaus-blue uppercase tracking-widest">Step {step}</div>
                    <div className="text-xs font-black text-bauhaus-black uppercase tracking-wider mt-1">{label}</div>
                    <p className="text-[11px] text-bauhaus-muted leading-snug mt-1">{detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[1220px] text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black bg-bauhaus-black text-white">
                    <th className="text-left py-3 px-3 font-black uppercase tracking-wider text-[10px] w-[170px]">Commitment</th>
                    <th className="text-left py-3 px-3 font-black uppercase tracking-wider text-[10px] w-[230px]">What government says</th>
                    <th className="text-right py-3 px-3 font-black uppercase tracking-wider text-[10px] w-[120px]">Announced</th>
                    <th className="text-left py-3 px-3 font-black uppercase tracking-wider text-[10px] w-[235px]">What CivicGraph can see</th>
                    <th className="text-left py-3 px-3 font-black uppercase tracking-wider text-[10px] w-[180px]">Status meaning</th>
                    <th className="text-left py-3 px-3 font-black uppercase tracking-wider text-[10px] w-[285px]">References and missing proof</th>
                  </tr>
                </thead>
                <tbody>
                  {qldDeliveryChecks.map(check => (
                    <tr key={check.program} className="border-b border-gray-200 align-top hover:bg-gray-50">
                      <td className="py-4 px-3">
                        <Link href={qldAnnouncementHrefForProgram(check.program)} className="font-black text-bauhaus-blue hover:underline">
                          {check.program}
                        </Link>
                        <div className="text-[10px] text-bauhaus-muted mt-1">{check.sourceLabel}</div>
                        <a href={check.sourceUrl} className="mt-2 inline-flex text-[10px] font-black uppercase tracking-wider text-bauhaus-muted hover:text-bauhaus-blue">
                          Source &rarr;
                        </a>
                      </td>
                      <td className="py-4 px-3 text-bauhaus-muted leading-relaxed">
                        {check.intent}
                        {check.note ? <div className="mt-1 text-[11px] text-gray-500">{check.note}</div> : null}
                      </td>
                      <td className="py-4 px-3 text-right font-bold whitespace-nowrap">{check.announcedLabel}</td>
                      <td className="py-4 px-3">
                        <div className={`text-lg font-black ${check.capturedTotal > 0 ? 'text-bauhaus-black' : 'text-bauhaus-muted'}`}>
                          {check.capturedTotal > 0 ? money(check.capturedTotal) : '—'}
                        </div>
                        {check.capturedRows > 0 ? (
                          <div className="text-[10px] text-bauhaus-muted">{fmt(check.capturedRows)} rows · {fmt(check.capturedOrgs)} org refs</div>
                        ) : null}
                        <div className="mt-2 text-xs text-bauhaus-muted leading-relaxed">
                          {check.matchedPrograms.length > 0 ? check.matchedPrograms.slice(0, 2).join(', ') : 'No matching program-name or named-provider row in the current funding snapshot.'}
                          {check.matchedPrograms.length > 2 ? ` + ${check.matchedPrograms.length - 2} more` : ''}
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <span className={`inline-flex px-2 py-1 text-[10px] font-black uppercase tracking-wider border ${
                          check.capturedTotal === 0
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : check.status === 'Named SQL delivery visible'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-blue-300 bg-blue-50 text-blue-800'
                        }`}>
                          {check.status}
                        </span>
                        <p className="mt-2 text-xs text-bauhaus-muted leading-relaxed">
                          {check.status === 'Named SQL delivery visible'
                            ? 'A program-name match is visible in the funding data.'
                            : check.status === 'Partial SQL signal'
                              ? 'Some matching program rows exist, but they do not account for the full announced commitment.'
                              : check.status === 'Provider SQL signal'
                                ? 'A named provider appears in broad SQL funding rows. Useful evidence, but not a clean program acquittal.'
                                : check.status === 'Official evidence only'
                                  ? 'Official sources exist, but SQL does not yet show a matching delivery row.'
                                  : 'The announcement is sourced, but delivery is not visible in the current SQL snapshot.'}
                        </p>
                      </td>
                      <td className="py-4 px-3 text-xs text-bauhaus-muted leading-relaxed">
                        <div className="font-bold text-bauhaus-black">{check.evidenceStage}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {check.sourceChain.slice(0, 4).map((item, itemIndex) => (
                            <a
                              key={`${check.program}-ref-${item.label}-${itemIndex}`}
                              href={item.sourceUrl}
                              className="inline-flex border border-gray-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-bauhaus-blue hover:border-bauhaus-blue hover:bg-blue-50"
                            >
                              {item.kind}: {item.label}
                            </a>
                          ))}
                          {check.sourceChain.length > 4 ? (
                            <span className="inline-flex border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">
                              +{check.sourceChain.length - 4} refs
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 border-t border-gray-200 pt-2">
                          <div className="text-[10px] font-black uppercase tracking-wider text-bauhaus-red">Missing proof</div>
                          <div className="mt-1">
                            {check.dataNeeded.slice(0, 2).join('; ')}
                            {check.dataNeeded.length > 2 ? `; + ${check.dataNeeded.length - 2} more` : ''}
                          </div>
                        </div>
                        <details className="mt-2 group/evidence">
                          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-bauhaus-blue hover:text-bauhaus-black">
                            Full source chain and missing proof
                          </summary>
                          <div className="mt-2 border-l-2 border-bauhaus-blue pl-3">
                            <div className="space-y-2">
                              {check.sourceChain.map((item, itemIndex) => (
                                <div key={`${check.program}-${item.label}-${itemIndex}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider border border-gray-300 px-1 py-0.5 text-bauhaus-muted">
                                      {item.kind}
                                    </span>
                                    <a href={item.sourceUrl} className="font-bold text-bauhaus-blue hover:underline">
                                      {item.label}
                                    </a>
                                  </div>
                                  <p className="text-[11px] text-bauhaus-muted mt-0.5">{item.detail}</p>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-2 border-t border-gray-200">
                              <div className="text-[10px] font-black uppercase tracking-wider text-bauhaus-red">Needed next</div>
                              <ul className="mt-1 space-y-1">
                                {check.dataNeeded.map(item => (
                                  <li key={item} className="text-[11px] text-bauhaus-muted">- {item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 border-t-2 border-bauhaus-black bg-gray-50 p-4 text-xs text-bauhaus-muted leading-relaxed lg:grid-cols-3">
              <div>
                <div className="font-black text-bauhaus-black uppercase tracking-wider">What counts as proof</div>
                <p className="mt-1">
                  Program-name SQL is strongest. Provider SQL is a lead. Ministerial statements, Hansard, QONs, and tender mirrors explain the trail,
                  but they still need contract or grant rows before they become clean delivery evidence.
                </p>
              </div>
              <div>
                <div className="font-black text-bauhaus-black uppercase tracking-wider">What to be careful with</div>
                <p className="mt-1">
                  Broad rows such as <span className="font-bold">Social Services</span>, <span className="font-bold">Young People</span>, and
                  <span className="font-bold"> Community and Youth Justice Services...</span> are not clean program labels. Keep them visible, but do not
                  treat them as final proof.
                </p>
              </div>
              <div>
                <div className="font-black text-bauhaus-black uppercase tracking-wider">Best next action</div>
                <p className="mt-1">
                  Use the missing-proof list to drive the next scrape: QTenders awards, DYJVS contract disclosures, grant recipient lists,
                  Hansard/QON mentions, provider media releases, and outcome reporting by location.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Funding by Program */}
      {report.programs.length > 0 && (
        <section id="justice-funding" className="mb-12 scroll-mt-28">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Funding by Program
          </h2>
          {report.programs.length >= 3 && (
            <div className="mb-6">
              <FundingByProgramChart data={report.programs} />
            </div>
          )}
          <div className="space-y-0">
            {report.programs.map((p, i) => {
              const partners = report.partnersByProgram[p.program_name] || [];
              const shown = partners.slice(0, 30);
              const moreCount = p.orgs - shown.length;
              const programHref = `/reports/youth-justice/${stateKey}/program/${encodeURIComponent(p.program_name.toLowerCase().replace(/\s+/g, '-'))}`;
              return (
                <details key={i} className="border-b border-gray-200 group">
                  <summary className="flex items-center gap-2 py-2.5 px-2 bg-gray-50/80 hover:bg-gray-100 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <svg className="w-3 h-3 text-gray-400 transition-transform group-open:rotate-90 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-bold text-sm flex-1 min-w-0 truncate">{p.program_name}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{fmt(p.grants)} grants</span>
                    <span className="text-sm font-black flex-shrink-0 w-20 text-right">{money(p.total)}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0 w-12 text-right">{p.orgs} orgs</span>
                  </summary>
                  <div className="pl-7 pr-2 pb-2">
                    {shown.length > 0 ? (
                      <table className="w-full text-sm">
                        <tbody>
                          {shown.map((pt, j) => (
                            <tr key={j} className="border-b border-gray-100 hover:bg-blue-50/50">
                              <td className="py-1.5">
                                <span className="text-gray-400 mr-1.5">&rarr;</span>
                                {pt.gs_id ? (
                                  <Link href={`/entity/${pt.gs_id}`} className="text-bauhaus-blue hover:underline">{pt.recipient_name}</Link>
                                ) : pt.recipient_abn ? (
                                  <Link href={`/entity/AU-ABN-${pt.recipient_abn}`} className="text-bauhaus-blue hover:underline">{pt.recipient_name}</Link>
                                ) : (
                                  <Link href={`/search?q=${encodeURIComponent(pt.recipient_name)}`} className="text-bauhaus-blue hover:underline">{pt.recipient_name}</Link>
                                )}
                                {pt.is_community_controlled && (
                                  <span className="ml-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded uppercase">ACCO</span>
                                )}
                              </td>
                              <td className="py-1.5 text-right text-gray-500 w-16">{fmt(pt.grants)}</td>
                              <td className="py-1.5 text-right w-24">{money(pt.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-xs text-gray-400 italic py-1">
                        <Link href={programHref} className="text-bauhaus-blue hover:underline">View all {p.orgs} delivery partners &rarr;</Link>
                      </p>
                    )}
                    {moreCount > 0 && (
                      <div className="pt-1">
                        <Link href={programHref} className="text-xs text-bauhaus-blue hover:underline italic">
                          + {moreCount} more delivery partners &rarr;
                        </Link>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      {/* Top Funded Organisations */}
      {report.topOrgs.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Top Funded Organisations
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Organisation</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Grants</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.topOrgs.map((o, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2">
                      {o.gs_id ? (
                        <Link href={`/entity/${o.gs_id}`} className="font-medium text-bauhaus-blue hover:underline">
                          {o.recipient_name}
                        </Link>
                      ) : o.recipient_abn ? (
                        <Link href={`/entity/AU-ABN-${o.recipient_abn}`} className="font-medium text-bauhaus-blue hover:underline">
                          {o.recipient_name}
                        </Link>
                      ) : (
                        <Link href={`/search?q=${encodeURIComponent(o.recipient_name)}`} className="font-medium text-bauhaus-blue hover:underline">
                          {o.recipient_name}
                        </Link>
                      )}
                    </td>
                    <td className="py-2 text-right text-gray-600">{fmt(o.grants)}</td>
                    <td className="py-2 text-right font-bold">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ALMA Interventions */}
      {report.almaInterventions.length > 0 && (
        <section id="alma-evidence" className="mb-12 scroll-mt-28">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            ALMA Interventions ({report.almaCount})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.almaInterventions.map((a, i) => {
              const href = a.gs_id
                ? `/entity/${a.gs_id}`
                : a.org_abn
                  ? `/entity/AU-ABN-${a.org_abn}`
                  : null;
              const card = (
                <>
                  <div className="font-bold text-sm mb-1">{a.name}</div>
                  {a.org_name && a.org_name !== a.name && (
                    <div className="text-[11px] text-gray-500 mb-1.5">{a.org_name}</div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {a.type && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">{a.type}</span>
                    )}
                    {a.evidence_level && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">{a.evidence_level}</span>
                    )}
                    {a.geography && (
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{a.geography}</span>
                    )}
                  </div>
                </>
              );
              return href ? (
                <Link key={i} href={href} className="border border-gray-200 rounded-lg p-4 hover:border-bauhaus-blue hover:bg-blue-50/30 transition-colors block">
                  {card}
                </Link>
              ) : (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  {card}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {report.almaInterventions.length === 0 && report.almaCount > 0 && (
        <section id="alma-evidence" className="mb-12 scroll-mt-28">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            ALMA Interventions ({report.almaCount})
          </h2>
          <div className="border-2 border-bauhaus-blue rounded-sm p-4 bg-blue-50/40">
            <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider">Indexed, not loaded into this state report snapshot yet</h3>
            <p className="text-sm text-bauhaus-muted mt-2">
              The live ALMA index has {report.almaCount} {stateCode} youth-justice interventions for this state view. The next cache job needs to hydrate the intervention cards and source links so this section becomes browsable without slowing the page.
            </p>
          </div>
        </section>
      )}

      {/* Evidence Coverage */}
      {report.coverage && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Evidence Coverage
          </h2>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-4">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-sm font-bold">{report.coverage.with_evidence} of {report.coverage.total_interventions} interventions have formal evidence</span>
              <span className="text-sm font-black text-emerald-600">{report.coverage.coverage_pct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-emerald-500 rounded-full h-3 transition-all"
                style={{ width: `${report.coverage.coverage_pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{report.coverage.with_evidence} with evidence</span>
              <span>{report.coverage.without_evidence} without evidence</span>
            </div>
          </div>

          {report.evidenceGaps.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Intervention</th>
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Type</th>
                    <th className="text-center py-2 font-black uppercase tracking-wider text-xs">Evidence</th>
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {report.evidenceGaps.map((g, i) => {
                    const gapHref = g.gs_id
                      ? `/entity/${g.gs_id}`
                      : g.org_abn
                        ? `/entity/AU-ABN-${g.org_abn}`
                        : null;
                    return (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 font-medium">
                        {gapHref ? (
                          <Link href={gapHref} className="text-bauhaus-blue hover:underline">{g.name}</Link>
                        ) : (
                          g.name
                        )}
                      </td>
                      <td className="py-2 text-gray-600">{g.type || '—'}</td>
                      <td className="py-2 text-center">
                        {g.has_evidence ? (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">Yes</span>
                        ) : (
                          <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase">Gap</span>
                        )}
                      </td>
                      <td className="py-2 text-gray-600 text-xs">{g.methodology || '—'}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* LGA Funding */}
      {report.lgaFunding.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Funding by LGA
          </h2>
          {report.lgaFunding.length >= 3 && (
            <div className="mb-6">
              <LgaFundingChart data={report.lgaFunding} />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">LGA</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Orgs</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total Funding</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">SEIFA Decile</th>
                </tr>
              </thead>
              <tbody>
                {report.lgaFunding.map((l, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 font-medium">{l.lga_name}</td>
                    <td className="py-2 text-right text-gray-600">{l.orgs}</td>
                    <td className="py-2 text-right font-bold">{money(l.total_funding)}</td>
                    <td className="py-2 text-right">
                      {l.seifa_decile != null ? (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          l.seifa_decile <= 3 ? 'bg-red-100 text-red-700' :
                          l.seifa_decile <= 6 ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {l.seifa_decile}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ACCO Funding Gap */}
      {report.accoGap.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Community-Controlled Funding Gap
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cc && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                <div className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2">Community Controlled</div>
                <div className="text-2xl font-black">{money(cc.total_funding)}</div>
                <div className="text-sm text-gray-600">{cc.orgs} recipients, avg per recipient {money(cc.avg_per_recipient ?? cc.avg_grant)}</div>
                <div className="text-xs text-gray-500 mt-1">{cc.funding_share_pct ?? '—'}% of cached provider funding · {cc.funding_rows ?? '—'} rows</div>
              </div>
            )}
            {otherProviders && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <div className="text-xs font-black text-gray-600 uppercase tracking-wider mb-2">Other Service Providers</div>
                <div className="text-2xl font-black">{money(otherProviders.total_funding)}</div>
                <div className="text-sm text-gray-600">{otherProviders.orgs} recipients, avg per recipient {money(otherProviders.avg_per_recipient ?? otherProviders.avg_grant)}</div>
                <div className="text-xs text-gray-500 mt-1">{otherProviders.funding_share_pct ?? '—'}% of cached provider funding · {otherProviders.funding_rows ?? '—'} rows</div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Funding by Remoteness */}
      {report.remoteness.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Funding by Remoteness
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Remoteness</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Orgs</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Grants</th>
                </tr>
              </thead>
              <tbody>
                {report.remoteness.map((r, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 font-medium">{r.remoteness}</td>
                    <td className="py-2 text-right text-gray-600">{r.orgs}</td>
                    <td className="py-2 text-right font-bold">{money(r.total)}</td>
                    <td className="py-2 text-right text-gray-600">{fmt(r.grants)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Revolving Door */}
      {report.revolvingDoor.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
            Revolving Door
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">{stateCode} youth justice organisations with multiple influence vectors (donations, contracts, lobbying, funding).</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Organisation</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Score</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Vectors</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Donated</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Contracts</th>
                  <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Funded</th>
                </tr>
              </thead>
              <tbody>
                {report.revolvingDoor.map((r, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 font-medium">
                      {r.canonical_name}
                      {r.is_community_controlled && (
                        <span className="ml-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded uppercase">ACCO</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-bold">{r.revolving_door_score}</td>
                    <td className="py-2 text-right">{r.influence_vectors}</td>
                    <td className="py-2 text-right text-gray-600">{money(r.total_donated)}</td>
                    <td className="py-2 text-right text-gray-600">{money(r.total_contracts)}</td>
                    <td className="py-2 text-right text-gray-600">{money(r.total_funded)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Political Connections */}
      <section id="political-connections" className="mb-12 scroll-mt-28">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
          Political Connections
        </h2>

        {report.hansard.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">{stateCode} Hansard Mentions</h3>
            <div className="space-y-3">
              {report.hansard.map((h, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{h.speaker_name}</span>
                    {h.speaker_party && (
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase">{h.speaker_party}</span>
                    )}
                    {h.speaker_electorate && (
                      <span className="text-[10px] text-gray-500">{h.speaker_electorate}</span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">{h.sitting_date}</span>
                  </div>
                  {h.subject && <div className="text-xs font-bold text-bauhaus-blue mb-1">{h.subject}</div>}
                  <div className="text-xs text-gray-600 leading-relaxed">{h.excerpt}...</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.lobbying.length > 0 && (
          <div>
            <h3 className="text-sm font-black text-bauhaus-muted uppercase tracking-wider mb-3">Federal Lobbying Connections</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Entity</th>
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Lobbyist</th>
                    <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Client</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lobbying.map((l, i) => (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2">
                        {l.gs_id ? (
                          <Link href={`/entity/${l.gs_id}`} className="font-medium text-bauhaus-blue hover:underline">{l.canonical_name}</Link>
                        ) : (
                          <span className="font-medium">{l.canonical_name}</span>
                        )}
                      </td>
                      <td className="py-2 text-gray-600">{l.lobbyist_name || '—'}</td>
                      <td className="py-2 text-gray-600">{l.client_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {report.hansard.length === 0 && report.lobbying.length === 0 && (
          <p className="text-sm text-gray-500 italic">No political connection data available for {stateCode} youth justice organisations.</p>
        )}
      </section>

      {/* Graph Link */}
      <section className="mb-12">
        <div className="bg-bauhaus-black text-white rounded-xl p-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Network Graph</div>
            <div className="text-lg font-black">Explore {meta.name} Youth Justice funding flows</div>
            <p className="text-sm text-gray-400 mt-1">Interactive force-directed graph showing programs, recipients, and evidence links</p>
          </div>
          <Link
            href={`/graph?preset=${encodeURIComponent(stateCode + ' Youth Justice')}`}
            className="bg-bauhaus-red text-white font-black uppercase tracking-wider text-sm px-5 py-3 rounded hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            Open Graph
          </Link>
        </div>
      </section>
    </div>
  );
}

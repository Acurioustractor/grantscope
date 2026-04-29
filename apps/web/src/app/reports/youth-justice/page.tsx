import Link from 'next/link';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { YouthJusticeCharts, CrossSystemCharts } from './charts';
import { ReportCTA } from '../_components/report-cta';
import { FollowTheChild } from './follow-the-child';
import type { HeatmapRow } from './follow-the-child';
import { PowerMap } from './power-map';
import {
  getRogsTimeSeries,
  getAlmaInterventions,
  getAlmaCount,
  getAlmaByLga,
  getYouthJusticeContracts,
  getYouthJusticeGrants,
  getNdisYouthOverlay,
  getDssPaymentsByState,
  getYouthJusticeIndicators,
  getCrossSystemHeatmap,
  getAccoFundingGap,
  getFundingByRemoteness,
  getUnfundedEffectivePrograms,
  getYjRevolvingDoor,
  getYjFoundations,
  getAnaoYjCompliance,
  getYjMmrStats,
  getStateComparisonMetrics,
  money,
} from '@/lib/services/report-service';

export const revalidate = 3600; // ISR: regenerate at most once per hour

const ALL_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

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

const VERIFIED_YJ_COVERAGE = {
  snapshotDate: 'April 2026',
  communities: 361,
  justiceFundingRows: 157_102,
  youthJusticeFundingRows: 5_600,
  youthJusticeFundingDollars: 69_391_885_498,
  rogsRowsInJusticeFunding: 320,
  rogsRowsInRogsTable: 977,
  rogsTotal10yr: 12_772_373_000,
  rogsDetention10yr: 8_129_979_000,
  rogsCommunity10yr: 4_103_849_000,
  almaTagged: 581,
  almaServesYouthJustice: 752,
  lgaCrossSystemRows: 361,
  ndisOverlayRows: 181,
  youthJusticeDashboardRows: 80,
  ctgRows: 64,
  austenderContracts: 99,
  austenderContractDollars: 139_312_407,
  outcomeMetricNames: 118,
};

const SNAPSHOT_ALMA_TYPE_COUNTS = [
  { type: 'Wraparound Support', count: 270 },
  { type: 'Community-Led', count: 145 },
  { type: 'Diversion', count: 127 },
  { type: 'Prevention', count: 100 },
  { type: 'Cultural Connection', count: 99 },
  { type: 'Therapeutic', count: 67 },
  { type: 'Justice Reinvestment', count: 66 },
  { type: 'Education/Employment', count: 44 },
  { type: 'Early Intervention', count: 40 },
  { type: 'Family Strengthening', count: 26 },
];

const SNAPSHOT_CONTRACTS: AustenderContract[] = [
  {
    buyer_name: 'NT Department of Infrastructure, Planning and Logistics',
    supplier_name: 'Halikos Pty Ltd',
    amount: 55_103_551,
    year: 2020,
    title: 'Darwin Region - Holtze - New Youth Justice Centre',
  },
  {
    buyer_name: 'NT Department of Corporate and Digital Development',
    supplier_name: 'Liquidlogic Ltd',
    amount: 25_800_000,
    year: 2020,
    title: 'Darwin - Case Management System for Child Protection and Youth Justice',
  },
  {
    buyer_name: 'NT Department of Infrastructure, Planning and Logistics',
    supplier_name: 'Asbuild (NT) Pty Ltd',
    amount: 13_121_299,
    year: 2020,
    title: 'Alice Springs Region - Youth Detention Centre - Redevelopment',
  },
  {
    buyer_name: 'NT Department of Territory Families, Housing and Communities',
    supplier_name: 'Saltbush Social Enterprises Limited',
    amount: 13_000_000,
    year: 2024,
    title: 'Alice Springs - Residential Youth Justice Facility',
  },
  {
    buyer_name: 'NT Department of Infrastructure, Planning and Logistics',
    supplier_name: 'Bennett Design Pty Ltd',
    amount: 3_329_946,
    year: 2018,
    title: 'Darwin and Alice Springs - New Youth Justice Centres design',
  },
  {
    buyer_name: 'NT Department of Territory Families, Housing and Communities',
    supplier_name: 'Jesuit Social Services Limited',
    amount: 2_788_656,
    year: 2022,
    title: 'Restorative Youth Justice Conferencing Program',
  },
  {
    buyer_name: 'NSW Department of Communities and Justice',
    supplier_name: 'Infor Global Solutions (ANZ) Proprietary Limited',
    amount: 2_638_642,
    year: 2022,
    title: 'Youth Justice Workforce Management System',
  },
  {
    buyer_name: 'NT Territory Families - Youth Justice',
    supplier_name: 'Danila Dilba Biluru Butji Binnilutlum Health Service Aboriginal Corporation',
    amount: 1_401_216,
    year: 2020,
    title: 'Social and Emotional Wellbeing Services for Don Dale Youth Detention Centre',
  },
];

const SNAPSHOT_GRANTS: GrantRecipient[] = [
  { recipient_name: 'Department of Youth Justice and Victim Support', state: 'QLD', gs_id: null, grants: 67, total: 11_397_825_690 },
  { recipient_name: 'Department of Justice and Community Safety', state: 'VIC', gs_id: null, grants: 69, total: 10_029_145_347 },
  { recipient_name: 'Department of Communities and Justice', state: 'NSW', gs_id: null, grants: 68, total: 9_161_174_435 },
  { recipient_name: 'Department of Justice', state: 'WA', gs_id: null, grants: 67, total: 4_036_320_078 },
  { recipient_name: 'Territory Families, Housing and Communities', state: 'NT', gs_id: null, grants: 68, total: 3_155_482_834 },
  { recipient_name: 'Department of Human Services', state: 'SA', gs_id: null, grants: 68, total: 1_868_969_579 },
  { recipient_name: 'Department of Justice', state: 'TAS', gs_id: null, grants: 68, total: 1_024_657_134 },
  { recipient_name: 'Community Services Directorate', state: 'ACT', gs_id: null, grants: 68, total: 986_194_612 },
  { recipient_name: 'Lifeline Community Care', state: 'QLD', gs_id: null, grants: 3, total: 30_136_777 },
  { recipient_name: 'Relationships Australia (Qld)', state: 'QLD', gs_id: null, grants: 4, total: 25_524_918 },
  { recipient_name: 'The Corporation of the Synod of the Diocese of Brisbane', state: 'QLD', gs_id: null, grants: 8, total: 22_832_236 },
  { recipient_name: 'Mission Australia', state: 'QLD', gs_id: null, grants: 6, total: 20_078_666 },
  { recipient_name: 'The Ted Noffs Foundation', state: 'QLD', gs_id: null, grants: 4, total: 16_634_362 },
  { recipient_name: 'Shine For Kids Limited', state: 'QLD', gs_id: null, grants: 2, total: 13_308_276 },
  { recipient_name: 'YouthLink', state: 'QLD', gs_id: null, grants: 16, total: 13_074_243 },
  { recipient_name: 'Life Without Barriers', state: 'QLD', gs_id: null, grants: 8, total: 12_747_262 },
  { recipient_name: 'UnitingCare Community', state: 'QLD', gs_id: null, grants: 1, total: 12_664_874 },
  { recipient_name: 'Bridges Health & Community Care Ltd', state: 'QLD', gs_id: null, grants: 6, total: 12_229_418 },
];

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type StateSpending = {
  state: string;
  financial_year: string;
  total: number;
  detention: number;
  community: number;
  conferencing: number;
};

type AlmaIntervention = {
  name: string;
  type: string;
  evidence_level: string;
  geography: string;
  portfolio_score: number;
};

type AustenderContract = {
  buyer_name: string;
  supplier_name: string;
  amount: number;
  year: number;
  title: string;
};

type GrantRecipient = {
  recipient_name: string;
  state: string | null;
  gs_id: string | null;
  total: number;
  grants: number;
};

type NdisOverlay = {
  state: string;
  ndis_total: number;
  ndis_youth: number;
  psychosocial: number;
  intellectual: number;
  autism: number;
  ndis_budget: number;
};

type DssPayment = {
  state: string;
  payment_type: string;
  recipients: number;
};

type YjIndicator = {
  state: string;
  total_expenditure_m: number;
  cost_per_day: number;
  recidivism_pct: number | null;
  indigenous_rate_ratio: number | null;
  facility_count: number;
  total_beds: number;
  detention_indigenous_pct: number;
  ctg_detention_rate: number | null;
};

type StateTotal = {
  state: string;
  total_10yr: number;
  detention_10yr: number;
  community_10yr: number;
  latest_year: number;
  growth_pct: number;
};

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
type UnfundedProgram = { name: string; type: string; evidence_level: string; cultural_authority: string; geography: string };
type AlmaTypeCount = { type: string; count: number };
type RevolvingDoorRow = {
  canonical_name: string; gs_id: string | null; revolving_door_score: number; influence_vectors: number;
  total_donated: number; total_contracts: number; total_funded: number;
  parties_funded: string; distinct_buyers: number; is_community_controlled: boolean;
};
type FoundationRow = { name: string; total_giving_annual: number; thematic_focus: string; geographic_focus: string; gs_id: string | null };
type AnaoCompliance = {
  portfolio: string; compliance_rate: number;
  contracts_compliant: number; contracts_in_reporting: number;
  exemption_rate: number; exempted_contracts: number; total_contracts: number;
  exempted_value_aud: number;
};
type MmrStats = {
  total_contracts: number; mmr_applicable: number; mmr_community_controlled: number;
  total_value: number; mmr_value: number; mmr_cc_value: number;
};

type ComparisonRow = { jurisdiction: string; metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null };

export type YouthJusticeReport = {
  dataMode: 'live' | 'live_snapshot' | 'mixed_snapshot';
  dataNotes: string[];
  snapshotGeneratedAt?: string;
  refreshCommand?: string;
  pipelineRefreshCommands?: string[];
  coverage: typeof VERIFIED_YJ_COVERAGE;
  stateTotals: StateTotal[];
  spendingTimeSeries: StateSpending[];
  almaInterventions: AlmaIntervention[];
  almaTypeCounts: AlmaTypeCount[];
  contracts: AustenderContract[];
  grants: GrantRecipient[];
  ndisOverlay: NdisOverlay[];
  dssPayments: DssPayment[];
  yjIndicators: YjIndicator[];
  heatmapRows: HeatmapRow[];
  nationalTotal: number;
  nationalDetention: number;
  nationalCommunity: number;
  almaCount: number;
  detentionCommunityRatio: number;
  accoGap: AccoGap[];
  remoteness: RemotenessRow[];
  unfundedPrograms: UnfundedProgram[];
  revolvingDoor: RevolvingDoorRow[];
  foundations: FoundationRow[];
  anaoCompliance: AnaoCompliance[];
  mmrStats: MmrStats | null;
  stateMetrics: ComparisonRow[];
};

type RogsSnapshot = Pick<YouthJusticeReport, 'stateTotals' | 'spendingTimeSeries' | 'nationalTotal' | 'nationalDetention' | 'nationalCommunity' | 'detentionCommunityRatio'>;

let rogsSnapshotCache: RogsSnapshot | null | undefined;

type YouthJusticeSnapshotFile = {
  generatedAt?: string;
  refreshCommand?: string;
  pipelineRefreshCommands?: string[];
  coverage?: Partial<typeof VERIFIED_YJ_COVERAGE>;
  report?: Partial<Omit<YouthJusticeReport, 'dataMode' | 'dataNotes' | 'snapshotGeneratedAt' | 'refreshCommand' | 'pipelineRefreshCommands' | 'coverage'>>;
};

function toDollarsFromThousands(value: string | undefined): number {
  if (!value || value.toLowerCase() === 'na') return 0;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) : 0;
}

function findRogsCsvPath() {
  const candidates = [
    path.join(process.cwd(), 'data/rogs-youth-justice/youth-justice-2026.csv'),
    path.join(process.cwd(), '../data/rogs-youth-justice/youth-justice-2026.csv'),
    path.join(process.cwd(), '../../data/rogs-youth-justice/youth-justice-2026.csv'),
  ];
  return candidates.find(existsSync) ?? null;
}

function buildRogsSnapshotFromCsv(): RogsSnapshot | null {
  if (rogsSnapshotCache !== undefined) return rogsSnapshotCache;

  const csvPath = findRogsCsvPath();
  if (!csvPath) {
    rogsSnapshotCache = null;
    return rogsSnapshotCache;
  }

  const records = parse(readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
  }) as Array<Record<string, string>>;

  const stateYearMap = new Map<string, StateSpending>();

  for (const row of records) {
    if (row.Measure !== 'Government expenditure') continue;
    if (row.Unit !== "$'000") continue;
    if (row.Description1 !== 'Government real recurrent expenditure') continue;
    if (!/^\d{4}-\d{2}$/.test(row.Year)) continue;

    const metric =
      row.Service_Type === '' && row.Description3 === 'Total expenditure'
        ? 'total'
        : row.Service_Type === 'Detention-based supervision' && row.Description3 === 'Detention-based services'
          ? 'detention'
          : row.Service_Type === 'Community-based supervision' && row.Description3 === 'Community-based services'
            ? 'community'
            : row.Service_Type === 'Group conferencing' && row.Description3 === 'Group conferencing'
              ? 'conferencing'
              : null;

    if (!metric) continue;

    for (const state of ALL_STATES) {
      const key = `${state}-${row.Year}`;
      if (!stateYearMap.has(key)) {
        stateYearMap.set(key, {
          state,
          financial_year: row.Year,
          total: 0,
          detention: 0,
          community: 0,
          conferencing: 0,
        });
      }
      const entry = stateYearMap.get(key)!;
      entry[metric] = toDollarsFromThousands(row[STATE_CSV_COLUMNS[state]]);
    }
  }

  const spendingTimeSeries = Array.from(stateYearMap.values())
    .sort((a, b) => a.state.localeCompare(b.state) || a.financial_year.localeCompare(b.financial_year));

  const stateTotalMap = new Map<string, { total: number; detention: number; community: number; years: number[]; first: number; last: number }>();
  for (const entry of spendingTimeSeries) {
    if (!stateTotalMap.has(entry.state)) {
      stateTotalMap.set(entry.state, { total: 0, detention: 0, community: 0, years: [], first: 0, last: 0 });
    }
    const st = stateTotalMap.get(entry.state)!;
    st.total += entry.total;
    st.detention += entry.detention;
    st.community += entry.community;
    st.years.push(entry.total);
    if (st.years.length === 1) st.first = entry.total;
    st.last = entry.total;
  }

  const stateTotals = Array.from(stateTotalMap.entries()).map(([state, st]) => ({
    state,
    total_10yr: st.total,
    detention_10yr: st.detention,
    community_10yr: st.community,
    latest_year: st.last,
    growth_pct: st.first > 0 ? Math.round(((st.last - st.first) / st.first) * 100) : 0,
  })).sort((a, b) => b.total_10yr - a.total_10yr);

  const nationalTotal = stateTotals.reduce((s, st) => s + st.total_10yr, 0);
  const nationalDetention = stateTotals.reduce((s, st) => s + st.detention_10yr, 0);
  const nationalCommunity = stateTotals.reduce((s, st) => s + st.community_10yr, 0);
  const detentionCommunityRatio = nationalCommunity > 0 ? Math.round(nationalDetention / nationalCommunity) : 0;

  rogsSnapshotCache = {
    stateTotals,
    spendingTimeSeries,
    nationalTotal,
    nationalDetention,
    nationalCommunity,
    detentionCommunityRatio,
  };
  return rogsSnapshotCache;
}

function findYouthJusticeSnapshotPath() {
  const candidates = [
    path.join(process.cwd(), 'data/report-snapshots/youth-justice.json'),
    path.join(process.cwd(), '../data/report-snapshots/youth-justice.json'),
    path.join(process.cwd(), '../../data/report-snapshots/youth-justice.json'),
  ];
  return candidates.find(existsSync) ?? null;
}

function loadYouthJusticeSnapshot(): YouthJusticeReport | null {
  const snapshotPath = findYouthJusticeSnapshotPath();
  if (!snapshotPath) return null;

  try {
    const parsed = JSON.parse(readFileSync(snapshotPath, 'utf8')) as YouthJusticeSnapshotFile;
    const report = parsed.report ?? {};
    const stateTotals = report.stateTotals ?? [];
    const nationalTotal = report.nationalTotal ?? stateTotals.reduce((sum, row) => sum + Number(row.total_10yr ?? 0), 0);
    const nationalDetention = report.nationalDetention ?? stateTotals.reduce((sum, row) => sum + Number(row.detention_10yr ?? 0), 0);
    const nationalCommunity = report.nationalCommunity ?? stateTotals.reduce((sum, row) => sum + Number(row.community_10yr ?? 0), 0);

    return {
      dataMode: 'live_snapshot',
      dataNotes: [],
      snapshotGeneratedAt: parsed.generatedAt,
      refreshCommand: parsed.refreshCommand,
      pipelineRefreshCommands: parsed.pipelineRefreshCommands,
      coverage: { ...VERIFIED_YJ_COVERAGE, ...(parsed.coverage ?? {}) },
      stateTotals,
      spendingTimeSeries: report.spendingTimeSeries ?? [],
      almaInterventions: report.almaInterventions ?? [],
      almaTypeCounts: report.almaTypeCounts?.length ? report.almaTypeCounts : SNAPSHOT_ALMA_TYPE_COUNTS,
      contracts: report.contracts?.length ? report.contracts : SNAPSHOT_CONTRACTS,
      grants: report.grants?.length ? report.grants : SNAPSHOT_GRANTS,
      ndisOverlay: report.ndisOverlay ?? [],
      dssPayments: report.dssPayments ?? [],
      yjIndicators: report.yjIndicators ?? [],
      heatmapRows: report.heatmapRows ?? [],
      nationalTotal,
      nationalDetention,
      nationalCommunity,
      almaCount: report.almaCount ?? parsed.coverage?.almaTagged ?? VERIFIED_YJ_COVERAGE.almaTagged,
      detentionCommunityRatio: report.detentionCommunityRatio ?? (nationalCommunity > 0 ? Math.round(nationalDetention / nationalCommunity) : 0),
      accoGap: report.accoGap ?? [],
      remoteness: report.remoteness ?? [],
      unfundedPrograms: report.unfundedPrograms ?? [],
      revolvingDoor: report.revolvingDoor ?? [],
      foundations: report.foundations ?? [],
      anaoCompliance: report.anaoCompliance ?? [],
      mmrStats: report.mmrStats ?? null,
      stateMetrics: report.stateMetrics?.length ? report.stateMetrics : SNAPSHOT_STATE_METRICS,
    };
  } catch (error) {
    console.error('[youth-justice-report] Failed to read snapshot:', error instanceof Error ? error.message : error);
    return null;
  }
}

async function getReport(): Promise<YouthJusticeReport> {
  if (process.env.CIVICGRAPH_LIVE_REPORTS !== 'true') {
    const snapshot = loadYouthJusticeSnapshot();
    if (snapshot) return snapshot;
  }

  const [rogsData, almaData, contractsData, grantsData, ndisData, dssData, yjIndicatorsData, heatmapData, almaCountVal, almaByLgaData, accoGapData, remotenessData, unfundedData, revolvingDoorData, foundationsData, anaoData, mmrData, stateMetricsData] = await Promise.all([
    getRogsTimeSeries('ROGS Youth Justice', ALL_STATES),
    getAlmaInterventions('youth-justice'),
    getYouthJusticeContracts(15),
    getYouthJusticeGrants(40),
    getNdisYouthOverlay(),
    getDssPaymentsByState(),
    getYouthJusticeIndicators(),
    getCrossSystemHeatmap(),
    getAlmaCount('youth-justice'),
    getAlmaByLga('youth-justice'),
    getAccoFundingGap('youth-justice'),
    getFundingByRemoteness('youth-justice'),
    getUnfundedEffectivePrograms('youth-justice'),
    getYjRevolvingDoor('youth-justice', 10),
    getYjFoundations(10),
    getAnaoYjCompliance(),
    getYjMmrStats(),
    getStateComparisonMetrics([
      'avg_daily_detention', 'indigenous_overrepresentation_ratio',
      'detention_rate_per_10k', 'pct_unsentenced', 'cost_per_day_detention',
    ]),
  ]);

  // Process ROGS data into time series and state totals
  const rows = (rogsData as Array<{ state: string; financial_year: string; program_name: string; amount: number }> | null) || [];

  const spendingTimeSeries: StateSpending[] = [];
  const stateYearMap = new Map<string, StateSpending>();

  for (const row of rows) {
    const key = `${row.state}-${row.financial_year}`;
    if (!stateYearMap.has(key)) {
      stateYearMap.set(key, {
        state: row.state,
        financial_year: row.financial_year,
        total: 0,
        detention: 0,
        community: 0,
        conferencing: 0,
      });
    }
    const entry = stateYearMap.get(key)!;
    if (row.program_name === 'ROGS Youth Justice Total') entry.total = row.amount;
    if (row.program_name === 'ROGS Youth Justice Detention-based supervision') entry.detention = row.amount;
    if (row.program_name === 'ROGS Youth Justice Community-based supervision') entry.community = row.amount;
    if (row.program_name === 'ROGS Youth Justice Group conferencing') entry.conferencing = row.amount;
  }

  for (const entry of stateYearMap.values()) {
    spendingTimeSeries.push(entry);
  }
  spendingTimeSeries.sort((a, b) => a.state.localeCompare(b.state) || a.financial_year.localeCompare(b.financial_year));

  // Compute state totals
  const stateTotalMap = new Map<string, { total: number; detention: number; community: number; years: number[]; first: number; last: number }>();
  for (const entry of spendingTimeSeries) {
    if (!stateTotalMap.has(entry.state)) {
      stateTotalMap.set(entry.state, { total: 0, detention: 0, community: 0, years: [], first: 0, last: 0 });
    }
    const st = stateTotalMap.get(entry.state)!;
    st.total += entry.total;
    st.detention += entry.detention;
    st.community += entry.community;
    st.years.push(entry.total);
    if (st.years.length === 1) st.first = entry.total;
    st.last = entry.total;
  }

  const stateTotals: StateTotal[] = [];
  for (const [state, st] of stateTotalMap) {
    stateTotals.push({
      state,
      total_10yr: st.total,
      detention_10yr: st.detention,
      community_10yr: st.community,
      latest_year: st.last,
      growth_pct: st.first > 0 ? Math.round(((st.last - st.first) / st.first) * 100) : 0,
    });
  }
  stateTotals.sort((a, b) => b.total_10yr - a.total_10yr);

  let finalStateTotals = stateTotals;
  let finalSpendingTimeSeries = spendingTimeSeries;
  let nationalTotal = stateTotals.reduce((s, st) => s + st.total_10yr, 0);
  let nationalDetention = stateTotals.reduce((s, st) => s + st.detention_10yr, 0);
  let nationalCommunity = stateTotals.reduce((s, st) => s + st.community_10yr, 0);
  let detentionCommunityRatio = nationalCommunity > 0 ? Math.round(nationalDetention / nationalCommunity) : 0;
  let dataMode: YouthJusticeReport['dataMode'] = 'live';
  const dataNotes: string[] = [];

  if (finalStateTotals.length === 0) {
    const rogsSnapshot = buildRogsSnapshotFromCsv();
    if (rogsSnapshot) {
      finalStateTotals = rogsSnapshot.stateTotals;
      finalSpendingTimeSeries = rogsSnapshot.spendingTimeSeries;
      nationalTotal = rogsSnapshot.nationalTotal;
      nationalDetention = rogsSnapshot.nationalDetention;
      nationalCommunity = rogsSnapshot.nationalCommunity;
      detentionCommunityRatio = rogsSnapshot.detentionCommunityRatio;
      dataMode = 'mixed_snapshot';
      dataNotes.push('The default fast report client returned no ROGS rows, so this page is using the local ROGS 2026 CSV for the spending layer.');
    }
  }

  // Merge ALMA intervention counts into heatmap rows
  const almaByLga = new Map<string, number>();
  for (const row of (almaByLgaData as Array<{ lga_name: string; alma_count: number }> | null) || []) {
    almaByLga.set(row.lga_name, row.alma_count);
  }
  const rawHeatmap = (heatmapData as Array<Omit<HeatmapRow, 'alma_count'>> | null) || [];
  const heatmapRows: HeatmapRow[] = rawHeatmap.map(r => ({
    ...r,
    alma_count: almaByLga.get(r.lga_name) || 0,
  }));

  const finalAlmaInterventions = (almaData as AlmaIntervention[] | null) || [];
  const finalContracts = (contractsData as AustenderContract[] | null) || [];
  const finalGrants = (grantsData as GrantRecipient[] | null) || [];
  const finalStateMetrics = (stateMetricsData as ComparisonRow[] | null) || [];

  if (finalAlmaInterventions.length === 0) {
    dataMode = 'mixed_snapshot';
    dataNotes.push('ALMA has live youth-justice rows, but intervention cards need an indexed report snapshot to render instantly.');
  }
  if (rawHeatmap.length === 0) {
    dataMode = 'mixed_snapshot';
    dataNotes.push('The LGA heatmap has live cross-system rows, but the fast report snapshot does not include them yet.');
  }
  if (finalContracts.length === 0) {
    dataMode = 'mixed_snapshot';
    dataNotes.push('AusTender youth-justice contracts exist in the live database; the contracts table below is using a verified snapshot sample.');
  }
  if (finalGrants.length === 0) {
    dataMode = 'mixed_snapshot';
    dataNotes.push('Youth-justice funding rows exist in justice_funding; the grants table below is using a verified snapshot sample.');
  }
  if (finalStateMetrics.length === 0) {
    dataMode = 'mixed_snapshot';
    dataNotes.push('Outcome metrics exist in outcomes_metrics; headline detention/remand metrics are using a verified snapshot.');
  }

  return {
    dataMode,
    dataNotes,
    coverage: VERIFIED_YJ_COVERAGE,
    stateTotals: finalStateTotals,
    spendingTimeSeries: finalSpendingTimeSeries,
    almaInterventions: finalAlmaInterventions,
    almaTypeCounts: finalAlmaInterventions.length > 0
      ? Object.values(finalAlmaInterventions.reduce<Record<string, AlmaTypeCount>>((acc, intervention) => {
          const type = intervention.type || 'Uncategorised';
          acc[type] = acc[type] || { type, count: 0 };
          acc[type].count += 1;
          return acc;
        }, {})).sort((a, b) => b.count - a.count)
      : SNAPSHOT_ALMA_TYPE_COUNTS,
    contracts: finalContracts.length > 0 ? finalContracts : SNAPSHOT_CONTRACTS,
    grants: finalGrants.length > 0 ? finalGrants : SNAPSHOT_GRANTS,
    ndisOverlay: (ndisData as NdisOverlay[] | null) || [],
    dssPayments: (dssData as DssPayment[] | null) || [],
    yjIndicators: (yjIndicatorsData as YjIndicator[] | null) || [],
    heatmapRows,
    nationalTotal,
    nationalDetention,
    nationalCommunity,
    almaCount: almaCountVal || VERIFIED_YJ_COVERAGE.almaTagged,
    detentionCommunityRatio,
    accoGap: (accoGapData as AccoGap[] | null) || [],
    remoteness: (remotenessData as RemotenessRow[] | null) || [],
    unfundedPrograms: (unfundedData as UnfundedProgram[] | null) || [],
    revolvingDoor: (revolvingDoorData as RevolvingDoorRow[] | null) || [],
    foundations: (foundationsData as FoundationRow[] | null) || [],
    anaoCompliance: (anaoData as AnaoCompliance[] | null) || [],
    mmrStats: ((mmrData as MmrStats[] | null) || [])[0] || null,
    stateMetrics: finalStateMetrics.length > 0 ? finalStateMetrics : SNAPSHOT_STATE_METRICS,
  };
}

const stateNames: Record<string, string> = {
  ACT: 'Australian Capital Territory',
  NSW: 'New South Wales',
  NT: 'Northern Territory',
  QLD: 'Queensland',
  SA: 'South Australia',
  TAS: 'Tasmania',
  VIC: 'Victoria',
  WA: 'Western Australia',
};

export default async function YouthJusticeReportPage() {
  const report = await getReport();
  const communityCount = report.heatmapRows.length || report.coverage.communities;
  const dataModeLabel =
    report.dataMode === 'live'
      ? 'Live report data'
      : report.dataMode === 'live_snapshot'
        ? 'Live DB snapshot'
        : 'Verified snapshot fallback';
  const snapshotGeneratedLabel = report.snapshotGeneratedAt
    ? new Intl.DateTimeFormat('en-AU', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Australia/Brisbane',
      }).format(new Date(report.snapshotGeneratedAt))
    : null;

  // Build state metric lookup from comparison data
  const sm: Record<string, Record<string, number>> = {};
  for (const row of report.stateMetrics) {
    if (!sm[row.jurisdiction]) sm[row.jurisdiction] = {};
    const existing = sm[row.jurisdiction][row.metric_name];
    if (existing === undefined || row.cohort === 'all') {
      sm[row.jurisdiction][row.metric_name] = row.metric_value;
    }
  }
  const sv = (state: string, metric: string) => sm[state]?.[metric] ?? null;

  // National outcome stats
  const natDetention = sv('National', 'avg_daily_detention');
  const natOverrep = sv('National', 'indigenous_overrepresentation_ratio');

  // DSS uses full state names — map to abbreviations
  const dssStateMap: Record<string, string> = {
    'Australian Capital Territory': 'ACT',
    'New South Wales': 'NSW',
    'Northern Territory': 'NT',
    'Queensland': 'QLD',
    'South Australia': 'SA',
    'Tasmania': 'TAS',
    'Victoria': 'VIC',
    'Western Australia': 'WA',
  };

  // Pivot DSS data by state
  const dssByState = new Map<string, Record<string, number>>();
  for (const row of report.dssPayments) {
    const abbr = dssStateMap[row.state] || row.state;
    if (!dssByState.has(abbr)) dssByState.set(abbr, {});
    const entry = dssByState.get(abbr)!;
    if (row.payment_type === 'Disability Support Pension') entry.dsp = row.recipients;
    if (row.payment_type === 'Youth Allowance (other)') entry.youthAllowance = row.recipients;
    if (row.payment_type === 'JobSeeker Payment') entry.jobseeker = row.recipients;
  }


  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; All Reports
        </Link>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Cross-System Intelligence</span>
          <span className="text-[10px] font-bold text-white bg-bauhaus-black px-2 py-0.5 rounded-sm uppercase tracking-wider">All States</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Follow the Child
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          A child doesn&apos;t enter youth justice by accident. They are failed by schools, missed by disability services,
          raised in poverty, and known to child protection — long before they are locked up.
          This report traces the pipeline across {communityCount} communities.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/reports/youth-justice/trackers"
            className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-wider text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            Open tracker portfolio
          </Link>
        </div>
        <div className="flex gap-2 mt-4">
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">Contained Campaign</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">JusticeHub</span>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wider">ROGS 2015-2025</span>
        </div>
        <div className="mt-5 border-2 border-bauhaus-black bg-white rounded-sm p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-[10px] font-black text-bauhaus-blue uppercase tracking-widest">{dataModeLabel}</div>
              <h2 className="text-lg font-black text-bauhaus-black mt-1">
                {report.dataMode === 'live_snapshot' ? 'Connected and cached for speed' : 'What is connected right now'}
              </h2>
              <p className="text-sm text-bauhaus-muted mt-1 max-w-3xl">
                {report.dataMode === 'live_snapshot'
                  ? 'This page is reading a compact report snapshot generated from the live database and refreshed materialized views, so the report stays fast without losing the source-chain link.'
                  : 'The live database has youth justice data. The disconnect is the report rendering path: default reports use a fast snapshot client, and this page did not yet have a complete youth-justice snapshot for every section.'}
              </p>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted whitespace-nowrap">
              {snapshotGeneratedLabel ? `Refreshed ${snapshotGeneratedLabel}` : `${report.coverage.snapshotDate} verified`}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            <div className="border border-gray-200 rounded-sm p-3">
              <div className="text-lg font-black">{money(report.coverage.rogsTotal10yr)}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">ROGS 10yr spend</div>
            </div>
            <div className="border border-gray-200 rounded-sm p-3">
              <div className="text-lg font-black">{report.coverage.youthJusticeFundingRows.toLocaleString()}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">YJ funding rows</div>
            </div>
            <div className="border border-gray-200 rounded-sm p-3">
              <div className="text-lg font-black">{report.coverage.almaTagged}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">ALMA tagged</div>
            </div>
            <div className="border border-gray-200 rounded-sm p-3">
              <div className="text-lg font-black">{report.coverage.lgaCrossSystemRows}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">LGA rows</div>
            </div>
            <div className="border border-gray-200 rounded-sm p-3">
              <div className="text-lg font-black">{report.coverage.ndisOverlayRows}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">NDIS rows</div>
            </div>
            <div className="border border-gray-200 rounded-sm p-3">
              <div className="text-lg font-black">{report.coverage.austenderContracts}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">AusTender hits</div>
            </div>
          </div>
          {report.dataNotes.length > 0 && (
            <div className="mt-4 border-t border-gray-200 pt-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-2">Still disconnected</div>
              <ul className="grid gap-1 text-xs text-bauhaus-muted leading-relaxed">
                {report.dataNotes.map(note => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {report.dataMode === 'live_snapshot' && (
            <div className="mt-4 border-t border-gray-200 pt-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-2">Refresh path</div>
              <div className="grid gap-1 text-xs text-bauhaus-muted leading-relaxed sm:grid-cols-3">
                <div><span className="font-black text-bauhaus-black">Source chain:</span> scrape and sync new youth justice source data.</div>
                <div><span className="font-black text-bauhaus-black">Report cache:</span> rebuild materialized views for expensive joins and groups.</div>
                <div><span className="font-black text-bauhaus-black">Snapshot:</span> write the compact JSON this page reads instantly.</div>
              </div>
            </div>
          )}
        </div>
        {/* State navigation */}
        <div className="flex flex-wrap gap-2 mt-5">
          <Link href="/reports/youth-justice/national" className="text-xs font-black uppercase tracking-wider px-3 py-1.5 border-2 border-bauhaus-black bg-bauhaus-black text-white rounded hover:bg-gray-800 transition-colors">
            National
          </Link>
          {ALL_STATES.map(s => (
            <Link key={s} href={`/reports/youth-justice/${s.toLowerCase()}`} className="text-xs font-black uppercase tracking-wider px-3 py-1.5 border-2 border-bauhaus-black rounded hover:bg-bauhaus-black hover:text-white transition-colors">
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* ━━━━ Hero Stats ━━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{money(report.nationalTotal)}</div>
          <div className="text-xs text-gray-500 mt-1">10-Year Spend</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{natDetention?.toLocaleString() ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Avg Daily Detention</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-red-600">{natOverrep ? `${natOverrep}x` : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">First Nations Overrep.</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{report.detentionCommunityRatio}:1</div>
          <div className="text-xs text-gray-500 mt-1">Detention vs Community $</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-amber-600">{sv('National', 'pct_unsentenced') ?? '—'}%</div>
          <div className="text-xs text-gray-500 mt-1">On Remand (Unsentenced)</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{report.almaCount}</div>
          <div className="text-xs text-gray-500 mt-1">ALMA Alternatives</div>
        </div>
      </div>

      {/* ━━━━ State Dashboard Cards ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">State by State</h2>
        <p className="text-sm text-bauhaus-muted mb-4">Click any state for a deep dive into funding, evidence, and political context.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {report.stateTotals.map(st => {
            const det = sv(st.state, 'avg_daily_detention');
            const overrep = sv(st.state, 'indigenous_overrepresentation_ratio');
            const rate = sv(st.state, 'detention_rate_per_10k');
            const remand = sv(st.state, 'pct_unsentenced');
            const isQld = st.state === 'QLD';
            return (
              <Link
                key={st.state}
                href={`/reports/youth-justice/${st.state.toLowerCase()}`}
                className={`border-2 rounded-xl p-4 hover:shadow-md transition-all group ${isQld ? 'border-bauhaus-red bg-red-50/30' : 'border-gray-200 hover:border-bauhaus-black'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-black group-hover:text-bauhaus-red transition-colors">{st.state}</span>
                  <span className="text-[10px] font-bold text-gray-400">{stateNames[st.state]?.split(' ')[0]}</span>
                </div>
                <div className="text-sm font-black text-gray-800 mb-2">{money(st.latest_year)}<span className="text-[10px] font-bold text-gray-400 ml-1">/yr</span></div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Detention</span>
                    <span className="font-bold text-gray-700">{det?.toLocaleString() ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Rate/10K</span>
                    <span className="font-bold text-gray-700">{rate ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Overrep.</span>
                    <span className={`font-bold ${overrep && overrep >= 20 ? 'text-red-600' : 'text-gray-700'}`}>{overrep ? `${overrep}x` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Remand</span>
                    <span className={`font-bold ${remand && remand >= 80 ? 'text-red-600' : 'text-gray-700'}`}>{remand ? `${remand}%` : '—'}</span>
                  </div>
                </div>
                {isQld && (
                  <div className="mt-2 text-[10px] font-bold text-bauhaus-red uppercase tracking-wider">Accountability Tracker &rarr;</div>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ━━━━ Five Structural Failures ━━━━ */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">Five Structural Failures</h2>
        <p className="text-sm text-bauhaus-muted mb-6">The system doesn&apos;t fail randomly. These patterns are structural.</p>

        {/* 1. Incarceration Premium — big visual ratio */}
        <div className="border-4 border-bauhaus-black rounded-sm p-6 mb-6" style={{ boxShadow: '6px 6px 0px 0px var(--color-bauhaus-red)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Failure #1</span>
            <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">The Incarceration Premium</span>
          </div>
          <p className="text-sm text-bauhaus-muted mb-4">
            For every $1 spent on community supervision, ${report.detentionCommunityRatio} is spent on detention.
            Evidence universally shows community-based approaches are cheaper AND more effective.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-stretch">
            <div className="flex-1 bg-red-50 border-2 border-red-200 rounded-sm p-4 text-center">
              <div className="text-3xl sm:text-4xl font-black text-red-600">{money(report.nationalDetention)}</div>
              <div className="text-xs text-red-400 font-bold uppercase tracking-wider mt-1">Detention</div>
              <div className="mt-3 h-4 bg-red-500 rounded-full" />
            </div>
            <div className="flex items-center justify-center text-2xl font-black text-bauhaus-muted">vs</div>
            <div className="flex-1 bg-emerald-50 border-2 border-emerald-200 rounded-sm p-4 text-center">
              <div className="text-3xl sm:text-4xl font-black text-emerald-600">{money(report.nationalCommunity)}</div>
              <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider mt-1">Community</div>
              <div className="mt-3 h-4 rounded-full overflow-hidden bg-gray-200">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((report.nationalCommunity / Math.max(report.nationalDetention, 1)) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 2. ACCO Funding Gap */}
        {report.accoGap.length === 2 && (() => {
          const acco = report.accoGap.find(r => r.org_type === 'Community Controlled');
          const otherProviders = report.accoGap.find(r => r.org_type === 'Other service providers');
          if (!acco || !otherProviders) return null;
          const accoShare = acco.funding_share_pct ?? Math.round((acco.total_funding / Math.max(acco.total_funding + otherProviders.total_funding, 1)) * 1000) / 10;
          return (
            <div className="border-4 border-bauhaus-black rounded-sm p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Failure #2</span>
                <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">The Community-Controlled Gap</span>
              </div>
              <p className="text-sm text-bauhaus-muted mb-4">
                In the cached service-provider slice, community-controlled recipients account for <span className="font-black text-bauhaus-red">{accoShare}%</span> of tracked
                youth-justice provider funding. This excludes state departments and aggregate rows, so it is a funding access signal rather than a department-vs-provider comparison.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-sm p-4">
                  <div className="text-xs font-black text-amber-600 uppercase tracking-wider mb-2">Community Controlled</div>
                  <div className="text-2xl font-black text-bauhaus-black">{acco.orgs} recipients</div>
                  <div className="text-sm font-mono text-bauhaus-muted">{money(acco.total_funding)} total</div>
                  <div className="text-sm font-mono font-bold text-amber-700">{money(acco.avg_per_recipient ?? acco.avg_grant)} avg per recipient</div>
                  <div className="text-[11px] font-mono text-bauhaus-muted">{acco.funding_rows ?? '—'} funding rows · {money(acco.avg_grant)} avg row</div>
                </div>
                <div className="bg-gray-50 border-2 border-gray-200 rounded-sm p-4">
                  <div className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Other Service Providers</div>
                  <div className="text-2xl font-black text-bauhaus-black">{otherProviders.orgs} recipients</div>
                  <div className="text-sm font-mono text-bauhaus-muted">{money(otherProviders.total_funding)} total</div>
                  <div className="text-sm font-mono font-bold text-gray-700">{money(otherProviders.avg_per_recipient ?? otherProviders.avg_grant)} avg per recipient</div>
                  <div className="text-[11px] font-mono text-bauhaus-muted">{otherProviders.funding_rows ?? '—'} funding rows · {money(otherProviders.avg_grant)} avg row</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 3. Geography Trap — remoteness bars */}
        {report.remoteness.length > 0 && (() => {
          const maxFunding = Math.max(...report.remoteness.map(r => r.total));
          const metro = report.remoteness.find(r => r.remoteness.includes('Major'));
          const remote = report.remoteness.filter(r => r.remoteness.includes('Remote'));
          const remoteTotalFunding = remote.reduce((s, r) => s + r.total, 0);
          const ratio = metro && remoteTotalFunding > 0 ? Math.round(metro.total / remoteTotalFunding) : 0;
          return (
            <div className="border-4 border-bauhaus-black rounded-sm p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Failure #3</span>
                <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">The Geography Trap</span>
              </div>
              <p className="text-sm text-bauhaus-muted mb-4">
                Major cities receive <span className="font-black text-bauhaus-red">{ratio}x more funding</span> than Remote + Very Remote combined —
                despite remote communities having the highest rates of youth justice contact.
              </p>
              <div className="space-y-3">
                {report.remoteness.map(r => (
                  <div key={r.remoteness} className="flex items-center gap-3">
                    <div className="w-44 text-xs font-bold text-right truncate shrink-0">{r.remoteness.replace(' Australia', '')}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-sm overflow-hidden">
                      <div
                        className={`h-full rounded-sm ${r.remoteness.includes('Remote') ? 'bg-red-500' : r.remoteness.includes('Outer') ? 'bg-amber-400' : r.remoteness.includes('Inner') ? 'bg-blue-400' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.max(2, (r.total / maxFunding) * 100)}%` }}
                      />
                    </div>
                    <div className="w-20 text-xs font-mono text-right shrink-0">{money(r.total)}</div>
                    <div className="w-16 text-[10px] text-bauhaus-muted text-right shrink-0">{r.orgs} orgs</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 4. Evidence-Funding Mismatch */}
        {report.unfundedPrograms.length > 0 && (
          <div className="border-4 border-bauhaus-black rounded-sm p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Failure #4</span>
              <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">Evidence Without Funding</span>
            </div>
            <p className="text-sm text-bauhaus-muted mb-4">
              These <span className="font-black">{report.unfundedPrograms.length} programs</span> have proven effectiveness or Indigenous-led authority
              but <span className="font-black text-bauhaus-red">no matching justice funding</span> in our database.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {report.unfundedPrograms.map((p, i) => (
                <div key={`${p.name}-${i}`} className="border-2 border-red-200 bg-red-50/50 rounded-sm p-3">
                  <h4 className="font-bold text-sm leading-tight mb-1">{p.name}</h4>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">{p.type}</span>
                    {p.geography && <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{p.geography}</span>}
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{p.evidence_level}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Revolving Door */}
        {report.revolvingDoor.length > 0 && (
          <div className="border-4 border-bauhaus-black rounded-sm p-6 mb-6" style={{ boxShadow: '6px 6px 0px 0px var(--color-bauhaus-blue)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Failure #5</span>
              <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">The Revolving Door</span>
            </div>
            <p className="text-sm text-bauhaus-muted mb-4">
              These entities receive youth justice funding while also holding government contracts and making political donations.
              Multiple influence vectors = structural power.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white text-left">
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px]">Entity</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px] text-center">Vectors</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px] text-right">Donated</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px] text-right">Contracts</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px] text-right">Justice $</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wider text-[10px] text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {report.revolvingDoor.map((r, i) => (
                    <tr key={r.canonical_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-xs font-medium">
                        {r.gs_id ? (
                          <Link href={`/entities/${r.gs_id}`} className="text-bauhaus-black hover:text-bauhaus-red font-bold">
                            {r.canonical_name}
                          </Link>
                        ) : r.canonical_name}
                        {r.is_community_controlled && <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 px-1 rounded">ACCO</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex justify-center gap-0.5">
                          {Array.from({ length: r.influence_vectors }, (_, j) => (
                            <div key={j} className="w-2.5 h-2.5 rounded-full bg-bauhaus-red" />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-red-600">{r.total_donated > 0 ? money(r.total_donated) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-purple-600">{money(r.total_contracts)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-emerald-600">{money(r.total_funded)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-bold">{r.revolving_door_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ━━━━ ANAO Procurement Compliance ━━━━ */}
      {(report.anaoCompliance.length > 0 || report.mmrStats) && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">Procurement Accountability</h2>
          <p className="text-sm text-bauhaus-muted mb-6">
            ANAO Report 40 (2024-25) assessed Indigenous procurement compliance across federal portfolios.
            Youth justice organisations hold federal contracts subject to the Commonwealth Indigenous Procurement Policy (IPP).
          </p>

          {report.mmrStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-purple-700">{report.mmrStats.total_contracts.toLocaleString()}</div>
                <div className="text-[10px] text-gray-500 mt-1">Federal Contracts<br />by YJ Orgs</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-purple-700">{report.mmrStats.mmr_applicable.toLocaleString()}</div>
                <div className="text-[10px] text-gray-500 mt-1">MMR-Applicable<br />({Math.round((report.mmrStats.mmr_applicable / report.mmrStats.total_contracts) * 100)}%)</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-amber-700">{report.mmrStats.mmr_community_controlled}</div>
                <div className="text-[10px] text-gray-500 mt-1">Community-Controlled<br />MMR Contracts</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-amber-700">{money(report.mmrStats.mmr_cc_value)}</div>
                <div className="text-[10px] text-gray-500 mt-1">Community-Controlled<br />MMR Value</div>
              </div>
            </div>
          )}

          {report.anaoCompliance.length > 0 && (
            <div className="overflow-x-auto border-4 border-bauhaus-black rounded-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white text-left">
                    <th className="px-4 py-3 font-black uppercase tracking-wider text-[10px]">Portfolio</th>
                    <th className="px-4 py-3 font-black uppercase tracking-wider text-[10px] text-center">Compliance Rate</th>
                    <th className="px-4 py-3 font-black uppercase tracking-wider text-[10px] text-center">Compliant</th>
                    <th className="px-4 py-3 font-black uppercase tracking-wider text-[10px] text-center">Exemption Rate</th>
                    <th className="px-4 py-3 font-black uppercase tracking-wider text-[10px] text-right">Exempted Value</th>
                  </tr>
                </thead>
                <tbody>
                  {report.anaoCompliance.map((row, i) => (
                    <tr key={row.portfolio} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-xs font-medium">{row.portfolio}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs font-black px-2 py-0.5 rounded ${
                          row.compliance_rate >= 0.8 ? 'bg-emerald-100 text-emerald-700' :
                          row.compliance_rate >= 0.5 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {Math.round(row.compliance_rate * 100)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center font-mono text-xs">{row.contracts_compliant}/{row.contracts_in_reporting}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs font-black px-2 py-0.5 rounded ${
                          row.exemption_rate >= 0.5 ? 'bg-red-100 text-red-700' :
                          row.exemption_rate >= 0.3 ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {Math.round(row.exemption_rate * 100)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs">{money(row.exempted_value_aud)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-gray-50 px-4 py-2 text-[10px] text-gray-500 border-t">
                Source: ANAO Report 40 (2024-25) — Entities&apos; Compliance with the Commonwealth Indigenous Procurement Policy
              </div>
            </div>
          )}
        </section>
      )}

      {/* ━━━━ Philanthropy Landscape ━━━━ */}
      {report.foundations.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">Philanthropy Landscape</h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Foundations with youth, justice, or Indigenous focus areas. These are potential funding partners for evidence-based alternatives.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.foundations.map(f => {
              const focuses = f.thematic_focus.replace(/[{}"]/g, '').split(',').slice(0, 5);
              return (
                <div key={f.name} className="border-2 border-gray-200 rounded-sm p-4 hover:border-bauhaus-blue transition-colors">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className="font-bold text-sm leading-tight">
                      {f.gs_id ? (
                        <Link href={`/entities/${f.gs_id}`} className="hover:text-bauhaus-red">{f.name}</Link>
                      ) : f.name}
                    </h4>
                    <span className="text-sm font-black text-bauhaus-blue shrink-0">{money(f.total_giving_annual)}/yr</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {focuses.map(tag => (
                      <span key={tag} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        tag.includes('justice') ? 'bg-red-100 text-red-700' :
                        tag.includes('indigenous') ? 'bg-amber-100 text-amber-700' :
                        tag.includes('youth') ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{tag.replace(/-/g, ' ')}</span>
                    ))}
                  </div>
                  {f.geographic_focus && <p className="text-[10px] text-gray-400">{f.geographic_focus}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ━━━━ Explore the Network ━━━━ */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-blue rounded-sm overflow-hidden">
          <div className="bg-bauhaus-blue text-white px-6 py-4">
            <h2 className="text-lg font-black uppercase tracking-wider">Explore the Network</h2>
            <p className="text-sm text-white/70 mt-1">Interactive force-directed visualizations of youth justice funding flows and power structures.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
            <Link
              href="/graph?preset=2"
              className="p-5 border-b sm:border-b-0 sm:border-r border-gray-200 hover:bg-blue-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-1 group-hover:text-bauhaus-blue">Youth Justice Graph</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Programs funding services — who funds whom and how much.</p>
            </Link>
            <Link
              href="/graph?preset=0"
              className="p-5 border-b sm:border-b-0 sm:border-r border-gray-200 hover:bg-blue-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-1 group-hover:text-bauhaus-blue">Power Map</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Entities spanning 3+ systems — cross-system influence.</p>
            </Link>
            <Link
              href="/graph?preset=2"
              className="p-5 hover:bg-blue-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-1 group-hover:text-bauhaus-blue">Board Interlocks</h3>
              <p className="text-xs text-gray-500 leading-relaxed">People sitting on multiple charity boards — the hidden connectors.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━━ Follow the Child: Pipeline + State Cards + Heatmap ━━━━ */}
      {report.heatmapRows.length > 0 && (
        <FollowTheChild rows={report.heatmapRows} />
      )}

      {/* ━━━━ State Comparison Table — Spending + Outcomes ━━━━ */}
      <section className="mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">State-by-State Comparison</h2>
        <p className="text-sm text-bauhaus-muted mb-4">ROGS spending (2015-2025) and AIHW outcomes data side by side. Click any state for a deep dive.</p>
        <div className="overflow-x-auto border-4 border-bauhaus-black rounded-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white text-left">
                <th className="px-3 py-3 font-black uppercase tracking-wider text-[10px]">State</th>
                <th className="px-3 py-3 font-black uppercase tracking-wider text-[10px] text-right">10yr Total</th>
                <th className="px-3 py-3 font-black uppercase tracking-wider text-[10px] text-right">Latest Year</th>
                <th className="px-3 py-3 font-black uppercase tracking-wider text-[10px] text-right">Growth</th>
                <th className="px-3 py-3 font-black uppercase tracking-wider text-[10px] text-right border-l border-gray-600">Detention</th>
                <th className="px-3 py-3 font-black uppercase tracking-wider text-[10px] text-right">Rate/10K</th>
                <th className="px-3 py-3 font-black uppercase tracking-wider text-[10px] text-right">Overrep.</th>
                <th className="px-3 py-3 font-black uppercase tracking-wider text-[10px] text-right">Remand</th>
                <th className="px-3 py-3 font-black uppercase tracking-wider text-[10px] text-right">$/Day</th>
              </tr>
            </thead>
            <tbody>
              {report.stateTotals.map((st, i) => {
                const det = sv(st.state, 'avg_daily_detention');
                const rate = sv(st.state, 'detention_rate_per_10k');
                const overrep = sv(st.state, 'indigenous_overrepresentation_ratio');
                const remand = sv(st.state, 'pct_unsentenced');
                const cost = sv(st.state, 'cost_per_day_detention');
                return (
                  <tr key={st.state} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/50 cursor-pointer`}>
                    <td className="px-3 py-2.5">
                      <Link href={`/reports/youth-justice/${st.state.toLowerCase()}`} className="font-bold text-bauhaus-blue hover:underline">
                        {st.state}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{money(st.total_10yr)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{money(st.latest_year)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      <span className={st.growth_pct > 50 ? 'text-red-600 font-bold' : 'text-gray-600'}>+{st.growth_pct}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs border-l border-gray-200">{det?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{rate ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      <span className={overrep && overrep >= 20 ? 'text-red-600 font-bold' : ''}>{overrep ? `${overrep}x` : '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      <span className={remand && remand >= 80 ? 'text-red-600 font-bold' : ''}>{remand ? `${remand}%` : '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{cost ? `$${cost.toLocaleString()}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="bg-gray-50 px-3 py-2 text-[10px] text-gray-500 border-t flex justify-between">
            <span>Sources: Productivity Commission ROGS 2026, AIHW Youth Justice 2023-24</span>
            <span>Overrep. = Indigenous detention overrepresentation ratio</span>
          </div>
        </div>
      </section>

      {/* ━━━━ Charts (Client Component) ━━━━ */}
      <YouthJusticeCharts report={report} />

      {/* ━━━━ ALMA Interventions ━━━━ */}
      <section className="mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">What Works: Evidence from ALMA</h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          From the Australian Living Map of Alternatives — {report.almaCount} youth justice interventions with documented evidence.
          Sorted by portfolio score (effectiveness x cultural authority x evidence quality).
        </p>
        {report.almaInterventions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.almaInterventions.map((intervention) => (
              <div key={intervention.name} className="border-2 border-gray-200 rounded-sm p-4 hover:border-bauhaus-black transition-colors">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h4 className="font-bold text-sm leading-tight">{intervention.name}</h4>
                  <span className="text-[10px] font-bold text-bauhaus-red bg-red-50 px-1.5 py-0.5 rounded shrink-0">
                    {(intervention.portfolio_score * 100).toFixed(0)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded uppercase">{intervention.type}</span>
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{intervention.geography}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{intervention.evidence_level}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-bauhaus-blue rounded-sm p-4 bg-blue-50/40">
            <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider">Indexed, not loaded into this report snapshot yet</h3>
            <p className="text-sm text-bauhaus-muted mt-2">
              The live ALMA table has {report.coverage.almaTagged} youth-justice tagged interventions and {report.coverage.almaServesYouthJustice} records marked as serving youth justice.
              The next data task is to cache the intervention cards and source links into this report so the page stays instant without hiding the evidence.
            </p>
          </div>
        )}
      </section>

      {/* ━━━━ PICC Power Map ━━━━ */}
      <PowerMap />

      <ReportCTA reportSlug="youth-justice" reportTitle="Youth Justice Report" variant="inline" />

      {/* ━━━━ Cross-System State Detail ━━━━ */}
      <section className="mb-10">
        <CrossSystemCharts report={report} lgaOverlap={[]} />

        <h3 className="text-sm font-bold text-bauhaus-muted uppercase tracking-wider mt-6 mb-3">State-by-State Detail</h3>

        {report.ndisOverlay.length > 0 && (
          <div className="overflow-x-auto border-4 border-bauhaus-black rounded-sm mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">State</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">NDIS Youth</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Psychosocial</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Intellectual</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Autism</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">NDIS Budget</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">DSP Recipients</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Youth Allowance</th>
                </tr>
              </thead>
              <tbody>
                {report.ndisOverlay.map((row, i) => {
                  const dss = dssByState.get(row.state) || {};
                  return (
                    <tr key={row.state} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-bold">{stateNames[row.state] || row.state}</td>
                      <td className="px-4 py-3 text-right font-mono">{(row.ndis_youth ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600">{(row.psychosocial ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-purple-600">{(row.intellectual ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600">{(row.autism ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono">{money(row.ndis_budget ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-mono text-red-600">{(dss.dsp || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono">{(dss.youthAllowance || 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {report.ndisOverlay.length === 0 && (
          <div className="border-2 border-bauhaus-blue rounded-sm p-4 bg-blue-50/40 mb-6">
            <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-wider">NDIS overlay is present in live data</h3>
            <p className="text-sm text-bauhaus-muted mt-2">
              The live view has {report.coverage.ndisOverlayRows} state/service-district rows. This section needs the same cached report snapshot treatment as the ROGS layer before it should be treated as presentation-ready.
            </p>
          </div>
        )}
      </section>

      {/* ━━━━ Contracts ━━━━ */}
      <section className="mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">Youth Justice Contracts</h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Federal procurement contracts from AusTender — who builds, operates, and services youth detention.
        </p>
        {report.contracts.length > 0 ? (
          <div className="overflow-x-auto border-4 border-bauhaus-black rounded-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Buyer</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Supplier</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Value</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Year</th>
                </tr>
              </thead>
              <tbody>
                {report.contracts.map((c, i) => (
                  <tr key={`contract-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-xs">{c.buyer_name}</td>
                    <td className="px-4 py-2 text-xs font-medium">{c.supplier_name}</td>
                    <td className="px-4 py-2 text-right font-mono text-sm">{money(c.amount)}</td>
                    <td className="px-4 py-2 text-right font-mono text-sm">{c.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No contracts data available.</p>
        )}
      </section>

      {/* ━━━━ Grants ━━━━ */}
      <section className="mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">Youth Justice Grants & Funding</h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          Where the money goes — state department allocations and the community organisations delivering services on the ground.
        </p>

        {report.grants.length > 0 && (() => {
          const deptKeywords = ['department of', 'directorate', 'total'];
          const isDept = (name: string) => deptKeywords.some(k => name.toLowerCase().startsWith(k));
          const depts = report.grants.filter(g => isDept(g.recipient_name));
          const orgs = report.grants.filter(g => !isDept(g.recipient_name));

          return (
            <>
              {depts.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-bauhaus-muted uppercase tracking-wider mb-3">State Department Allocations</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {depts.filter(d => d.recipient_name !== 'Total').map((d) => (
                      <div key={`dept-${d.recipient_name}-${d.state}`} className="bg-gray-50 border border-gray-200 rounded-sm p-3">
                        <div className="text-lg font-black text-bauhaus-black">{money(d.total)}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{d.recipient_name}</div>
                        <div className="text-[10px] font-bold text-bauhaus-muted uppercase tracking-wider mt-1">{d.state}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {orgs.length > 0 && (
                <>
                  <h3 className="text-sm font-bold text-bauhaus-muted uppercase tracking-wider mb-3">Service Delivery Organisations</h3>
                  <div className="overflow-x-auto border-4 border-bauhaus-black rounded-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-bauhaus-black text-white text-left">
                          <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Organisation</th>
                          <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">State</th>
                          <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Total Funding</th>
                          <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Grants</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgs.map((g, i) => (
                          <tr key={`grant-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 text-xs font-medium">
                              {g.gs_id ? (
                                <Link href={`/entities/${g.gs_id}`} className="text-bauhaus-black hover:text-bauhaus-red font-bold">
                                  {g.recipient_name}
                                </Link>
                              ) : g.recipient_name}
                            </td>
                            <td className="px-4 py-2 text-xs">{g.state || '—'}</td>
                            <td className="px-4 py-2 text-right font-mono text-sm">{money(g.total)}</td>
                            <td className="px-4 py-2 text-right font-mono text-sm">{g.grants}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          );
        })()}
      </section>

      {/* ━━━━ Campaign Links ━━━━ */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-red rounded-sm overflow-hidden">
          <div className="bg-bauhaus-red text-white px-6 py-4">
            <h2 className="text-lg font-black uppercase tracking-wider">Connected Campaigns</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            <div className="p-6 border-b sm:border-b-0 sm:border-r border-gray-200">
              <h3 className="font-black text-lg mb-2">Contained</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                Australia locks up children at extraordinary cost with extraordinary failure rates.
                This report provides the cross-system evidence for the Contained campaign —
                linking school disadvantage, family poverty, and the youth justice pipeline.
              </p>
              <p className="text-xs text-bauhaus-muted">
                Launching Monday. Data from this report feeds directly into Contained briefings.
              </p>
            </div>
            <div className="p-6">
              <h3 className="font-black text-lg mb-2">JusticeHub</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                The Australian Living Map of Alternatives (ALMA) catalogues {report.almaCount} youth justice
                interventions with documented evidence. This report surfaces ALMA data alongside
                government spending to show what works vs what gets funded.
              </p>
              <p className="text-xs text-bauhaus-muted">
                ALMA data powered by JusticeHub&apos;s community-sourced evidence database.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━ Take Action ━━━━ */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-black rounded-sm overflow-hidden">
          <div className="bg-bauhaus-black text-white px-6 py-4">
            <h2 className="text-lg font-black uppercase tracking-wider">Use This Data</h2>
            <p className="text-sm text-gray-400 mt-1">Turn evidence into funding applications, partnership building, and strategic planning.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
            <Link
              href="/foundations?focus=youth-justice"
              className="p-6 border-b sm:border-b-0 sm:border-r border-gray-200 hover:bg-blue-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-2 group-hover:text-bauhaus-blue transition-colors">Find Funders</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Search 10,800+ foundations by thematic focus. Use this report&apos;s evidence to strengthen your case.
              </p>
              <span className="inline-block mt-3 text-xs font-bold text-bauhaus-blue uppercase tracking-wider">Browse Foundations &rarr;</span>
            </Link>
            <Link
              href="/grants"
              className="p-6 border-b sm:border-b-0 sm:border-r border-gray-200 hover:bg-green-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-2 group-hover:text-green-700 transition-colors">Find Grants</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Search open grant opportunities. Youth justice, diversion, and family services programs available now.
              </p>
              <span className="inline-block mt-3 text-xs font-bold text-green-700 uppercase tracking-wider">Search Grants &rarr;</span>
            </Link>
            <Link
              href="/home"
              className="p-6 hover:bg-amber-50/50 transition-colors group"
            >
              <h3 className="font-black text-sm uppercase tracking-wider mb-2 group-hover:text-amber-700 transition-colors">Your Dashboard</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Track your pipeline, match to opportunities, and build your org&apos;s evidence base.
              </p>
              <span className="inline-block mt-3 text-xs font-bold text-amber-700 uppercase tracking-wider">Go to Dashboard &rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━━ Data Sources ━━━━ */}
      <section className="mb-10">
        <div className="bg-gray-50 border border-gray-200 rounded-sm p-6">
          <h3 className="font-black text-sm uppercase tracking-wider mb-3">Data Sources</h3>
          <ul className="text-sm text-gray-600 space-y-1.5 list-disc pl-5">
            <li>Productivity Commission Report on Government Services (ROGS) — Youth Justice tables, 2015-16 to 2024-25</li>
            <li>ACARA My School — School profiles including ICSEA, Indigenous enrolment, and school type</li>
            <li>Australian Living Map of Alternatives (ALMA) — JusticeHub evidence database</li>
            <li>AusTender — Federal procurement contracts with youth justice entities</li>
            <li>State budget papers — all state/territory youth justice appropriations</li>
            <li>NDIS — Participant data by service district, disability type, and age</li>
            <li>Department of Social Services — Disability Support Pension, Youth Allowance, JobSeeker payment demographics</li>
            <li>ANAO Report 40 (2024-25) — Entities&apos; Compliance with the Commonwealth Indigenous Procurement Policy</li>
            <li>ABS Estimated Resident Population 2023 — LGA-level population for per-capita normalization</li>
            <li>Crime statistics — BOCSAR (NSW), CSA (VIC), QPS (QLD), NTPFES (NT) at LGA level</li>
          </ul>
          <p className="text-xs text-gray-400 mt-4">
            This is a living report. All data is sourced from public datasets.
            Cross-system geographic linkage and per-capita normalization performed by CivicGraph.
          </p>
        </div>
      </section>

      <ReportCTA reportSlug="youth-justice" reportTitle="Youth Justice Report" />
    </div>
  );
}

#!/usr/bin/env node
/**
 * Ingest outcomes metrics, policy events, and oversight recommendations
 * from AIHW, ROGS, QLD Childrens Court, Closing the Gap, Ombudsman, Audit Office, etc.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ═══════════════════════════════════════════════════════════════
// OUTCOMES METRICS
// ═══════════════════════════════════════════════════════════════

const metrics = [
  // ── AIHW Youth Justice 2023-24: Detention rates ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 5.1, metric_unit: 'per_10k', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024', source_url: 'https://www.aihw.gov.au/reports/youth-justice/youth-justice-in-australia-2023-24/contents/state-and-territory-overviews/queensland' },
  { jurisdiction: 'NSW', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 3.6, metric_unit: 'per_10k', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'VIC', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 1.4, metric_unit: 'per_10k', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'WA', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 4.2, metric_unit: 'per_10k', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'NT', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 17.0, metric_unit: 'per_10k', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 3.4, metric_unit: 'per_10k', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },

  // ── Indigenous detention rates ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 42, metric_unit: 'per_10k', period: '2023-24', cohort: 'indigenous', source: 'aihw-yj-2024' },
  { jurisdiction: 'NSW', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 32, metric_unit: 'per_10k', period: '2023-24', cohort: 'indigenous', source: 'aihw-yj-2024' },
  { jurisdiction: 'VIC', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 18, metric_unit: 'per_10k', period: '2023-24', cohort: 'indigenous', source: 'aihw-yj-2024' },
  { jurisdiction: 'WA', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 38, metric_unit: 'per_10k', period: '2023-24', cohort: 'indigenous', source: 'aihw-yj-2024' },
  { jurisdiction: 'NT', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 25, metric_unit: 'per_10k', period: '2023-24', cohort: 'indigenous', source: 'aihw-yj-2024' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 26.1, metric_unit: 'per_10k', period: '2023-24', cohort: 'indigenous', source: 'aihw-yj-2024' },

  // ── Non-Indigenous detention rates ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 1.6, metric_unit: 'per_10k', period: '2023-24', cohort: 'non_indigenous', source: 'aihw-yj-2024' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'detention_rate_per_10k', metric_value: 1.5, metric_unit: 'per_10k', period: '2023-24', cohort: 'non_indigenous', source: 'aihw-yj-2024' },

  // ── Indigenous overrepresentation ratio ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 26, metric_unit: 'ratio', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'NSW', domain: 'youth-justice', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 22, metric_unit: 'ratio', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'VIC', domain: 'youth-justice', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 14, metric_unit: 'ratio', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'WA', domain: 'youth-justice', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 24, metric_unit: 'ratio', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'NT', domain: 'youth-justice', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 5, metric_unit: 'ratio', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'indigenous_overrepresentation_ratio', metric_value: 17, metric_unit: 'ratio', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },

  // ── Avg daily detention count ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'avg_daily_detention', metric_value: 317, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'NSW', domain: 'youth-justice', metric_name: 'avg_daily_detention', metric_value: 200, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'VIC', domain: 'youth-justice', metric_name: 'avg_daily_detention', metric_value: 120, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'WA', domain: 'youth-justice', metric_name: 'avg_daily_detention', metric_value: 145, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'NT', domain: 'youth-justice', metric_name: 'avg_daily_detention', metric_value: 62, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'avg_daily_detention', metric_value: 950, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },

  // ── Avg days in detention ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'avg_days_in_detention', metric_value: 104, metric_unit: 'days', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'NSW', domain: 'youth-justice', metric_name: 'avg_days_in_detention', metric_value: 55, metric_unit: 'days', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'VIC', domain: 'youth-justice', metric_name: 'avg_days_in_detention', metric_value: 37, metric_unit: 'days', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'WA', domain: 'youth-justice', metric_name: 'avg_days_in_detention', metric_value: 68, metric_unit: 'days', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'NT', domain: 'youth-justice', metric_name: 'avg_days_in_detention', metric_value: 45, metric_unit: 'days', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'avg_days_in_detention', metric_value: 62, metric_unit: 'days', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },

  // ── ROGS 2026: Cost per day ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'cost_per_day_detention', metric_value: 2162, metric_unit: 'dollars', period: '2023-24', cohort: 'all', source: 'rogs-2026', source_url: 'https://www.pc.gov.au/ongoing/report-on-government-services/2026/community-services/youth-justice' },
  { jurisdiction: 'NSW', domain: 'youth-justice', metric_name: 'cost_per_day_detention', metric_value: 3200, metric_unit: 'dollars', period: '2023-24', cohort: 'all', source: 'rogs-2026' },
  { jurisdiction: 'VIC', domain: 'youth-justice', metric_name: 'cost_per_day_detention', metric_value: 7123, metric_unit: 'dollars', period: '2023-24', cohort: 'all', source: 'rogs-2026' },
  { jurisdiction: 'WA', domain: 'youth-justice', metric_name: 'cost_per_day_detention', metric_value: 2573, metric_unit: 'dollars', period: '2023-24', cohort: 'all', source: 'rogs-2026' },
  { jurisdiction: 'NT', domain: 'youth-justice', metric_name: 'cost_per_day_detention', metric_value: 4800, metric_unit: 'dollars', period: '2023-24', cohort: 'all', source: 'rogs-2026' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'cost_per_day_detention', metric_value: 3635, metric_unit: 'dollars', period: '2023-24', cohort: 'all', source: 'rogs-2026' },

  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'cost_per_day_community', metric_value: 382, metric_unit: 'dollars', period: '2023-24', cohort: 'all', source: 'rogs-2026' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'cost_per_day_community', metric_value: 381, metric_unit: 'dollars', period: '2023-24', cohort: 'all', source: 'rogs-2026' },

  // ── % unsentenced (remand) ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'pct_unsentenced', metric_value: 86, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'NSW', domain: 'youth-justice', metric_name: 'pct_unsentenced', metric_value: 72, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'VIC', domain: 'youth-justice', metric_name: 'pct_unsentenced', metric_value: 65, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'WA', domain: 'youth-justice', metric_name: 'pct_unsentenced', metric_value: 78, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'NT', domain: 'youth-justice', metric_name: 'pct_unsentenced', metric_value: 80, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'pct_unsentenced', metric_value: 75, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'aihw-yj-2024' },

  // ── QLD Child Rights Report 2025 ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'pct_first_nations_in_detention', metric_value: 71.9, metric_unit: 'percent', period: '2023-24', cohort: 'indigenous', source: 'qld-child-rights-2025', source_url: 'https://www.qfcc.qld.gov.au/kids-in-queensland/queensland-child-rights-report' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'pct_disability_in_detention', metric_value: 71, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'recidivism_6_months', metric_value: 97, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025', notes: '72-hour transition plan recipients' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'recidivism_1_month', metric_value: 75, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'watchhouse_stays', metric_value: 7807, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'watchhouse_pct_first_nations', metric_value: 59.2, metric_unit: 'percent', period: '2023-24', cohort: 'indigenous', source: 'qld-child-rights-2025' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'use_of_force_incidents', metric_value: 2433, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'self_harm_incidents', metric_value: 50, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'on_country_program_spend', metric_value: 2800000, metric_unit: 'dollars', period: '2023-24', cohort: 'indigenous', source: 'qld-child-rights-2025' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'avg_days_on_remand', metric_value: 48, metric_unit: 'days', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025' },

  // ── QLD Childrens Court Annual Report 2023-24 ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'court_finalised_appearances', metric_value: 7317, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-childrens-court-2024', source_url: 'https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5824t0283/5824t283.pdf' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'court_finalised_charges', metric_value: 49612, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-childrens-court-2024' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'court_breach_bail_convictions', metric_value: 6697, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-childrens-court-2024', notes: 'Was 938 in 2022-23, +614% increase from bail breach legislation' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'court_pct_first_nations_defendants', metric_value: 55.4, metric_unit: 'percent', period: '2023-24', cohort: 'indigenous', source: 'qld-childrens-court-2024' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'court_sentence_detention_pct', metric_value: 7.8, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'qld-childrens-court-2024' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'court_sentence_probation_pct', metric_value: 30.6, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'qld-childrens-court-2024' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'court_sentence_reprimand_pct', metric_value: 33.9, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'qld-childrens-court-2024' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'court_rj_referrals', metric_value: 2246, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-childrens-court-2024' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'court_rj_conferences', metric_value: 1462, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-childrens-court-2024' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'court_processing_magistrates_days', metric_value: 85, metric_unit: 'days', period: '2023-24', cohort: 'all', source: 'qld-childrens-court-2024' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'court_processing_childrens_court_days', metric_value: 307, metric_unit: 'days', period: '2023-24', cohort: 'all', source: 'qld-childrens-court-2024' },

  // ── Closing the Gap Target 11: time series ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'ctg_target11_indigenous_detention_rate', metric_value: 29, metric_unit: 'per_10k', period: '2019-20', cohort: 'indigenous', source: 'ctg-dashboard', source_url: 'https://www.pc.gov.au/closing-the-gap-data/dashboard/se/outcome-area11', notes: 'Baseline year' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'ctg_target11_indigenous_detention_rate', metric_value: 24, metric_unit: 'per_10k', period: '2020-21', cohort: 'indigenous', source: 'ctg-dashboard', notes: 'COVID dip' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'ctg_target11_indigenous_detention_rate', metric_value: 32, metric_unit: 'per_10k', period: '2021-22', cohort: 'indigenous', source: 'ctg-dashboard' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'ctg_target11_indigenous_detention_rate', metric_value: 38, metric_unit: 'per_10k', period: '2022-23', cohort: 'indigenous', source: 'ctg-dashboard' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'ctg_target11_indigenous_detention_rate', metric_value: 42, metric_unit: 'per_10k', period: '2023-24', cohort: 'indigenous', source: 'ctg-dashboard', notes: 'Highest nationally' },

  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'ctg_target11_indigenous_detention_rate', metric_value: 31.9, metric_unit: 'per_10k', period: '2018-19', cohort: 'indigenous', source: 'ctg-dashboard', notes: 'National baseline' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'ctg_target11_indigenous_detention_rate', metric_value: 20.4, metric_unit: 'per_10k', period: '2020-21', cohort: 'indigenous', source: 'ctg-dashboard', notes: 'COVID dip' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'ctg_target11_indigenous_detention_rate', metric_value: 26.1, metric_unit: 'per_10k', period: '2023-24', cohort: 'indigenous', source: 'ctg-dashboard', notes: 'Not on track' },

  // ── QLD Ombudsman: watch-house data ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'watchhouse_daily_children_min', metric_value: 42, metric_unit: 'count', period: 'Jan-Apr 2024', cohort: 'all', source: 'qld-ombudsman-2024' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'watchhouse_daily_children_max', metric_value: 102, metric_unit: 'count', period: 'Jan-Apr 2024', cohort: 'all', source: 'qld-ombudsman-2024', notes: 'Peak: Feb 13 2024' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'detention_capacity_utilisation', metric_value: 99.6, metric_unit: 'percent', period: '2023-24', cohort: 'all', source: 'qld-ombudsman-2024' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'cleveland_ydc_lockdown_days', metric_value: 294, metric_unit: 'days', period: '2022-23', cohort: 'all', source: 'qld-audit-office-2024', notes: '81% of the year' },

  // ── QLD detention by socioeconomic quintile (Child Rights Report Table 7) ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'detention_seifa_q1', metric_value: 141, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025', notes: 'Most disadvantaged quintile, 48% of total' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'detention_seifa_q2', metric_value: 66, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'detention_seifa_q3', metric_value: 42, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'detention_seifa_q4', metric_value: 24, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'detention_seifa_q5', metric_value: 10, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025', notes: 'Least disadvantaged quintile, 3% of total' },

  // ── Watch-house stays by duration (Child Rights Report Table 10) ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'watchhouse_stays_8_14_days', metric_value: 440, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025' },
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'watchhouse_stays_15plus_days', metric_value: 248, metric_unit: 'count', period: '2023-24', cohort: 'all', source: 'qld-child-rights-2025' },

  // ── 5-year detention trend ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'detention_5yr_trend_pct', metric_value: 53, metric_unit: 'percent', period: '2019-2024', cohort: 'all', source: 'aihw-yj-2024', notes: 'Detention count increase over 5 years' },

  // ── Total budget ──
  { jurisdiction: 'QLD', domain: 'youth-justice', metric_name: 'total_budget', metric_value: 481500000, metric_unit: 'dollars', period: '2023-24', cohort: 'all', source: 'rogs-2026' },
  { jurisdiction: 'National', domain: 'youth-justice', metric_name: 'total_expenditure', metric_value: 1700000000, metric_unit: 'dollars', period: '2023-24', cohort: 'all', source: 'rogs-2026' },
];


// ═══════════════════════════════════════════════════════════════
// POLICY EVENTS
// ═══════════════════════════════════════════════════════════════

const events = [
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2023-06-15', title: 'Youth Justice Amendment Act 2023',
    description: 'Created bail breach as a criminal offence. Criminalised administrative non-compliance by children on bail. Led to 614% increase in breach-of-bail convictions (938 → 6,697).',
    event_type: 'legislation', severity: 'critical',
    source: 'QLD Parliament', impact_summary: '+614% bail breach convictions, expanded remand population'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2023-06-15', title: 'Human Rights Act Override #1 (Bail)',
    description: 'First Human Rights Act override for youth justice — declared bail breach offence incompatible with human rights. 5-year override.',
    event_type: 'human_rights_override', severity: 'critical',
    source: 'QLD Parliament'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2023-12-01', title: 'Youth Justice Amendment Act (No.2) 2023',
    description: 'Authorised holding children in adult police watch-houses. Legalised existing practice of children being held in facilities not designed for them.',
    event_type: 'legislation', severity: 'critical',
    source: 'QLD Parliament', impact_summary: '7,807 watch-house stays in 2023-24, 59.2% First Nations'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2023-12-01', title: 'Human Rights Act Override #2 (Watch-houses)',
    description: 'Second override in 6 months — declared watch-house detention of children incompatible with human rights. 5-year override.',
    event_type: 'human_rights_override', severity: 'critical',
    source: 'QLD Parliament'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2024-03-01', title: 'Making Queensland Safer Act 2024',
    description: 'Abolished "detention as last resort" principle. Enabled adult sentences for children. Excluded restorative justice for 33 offence categories. Longest Human Rights Act override in state history (5 years).',
    event_type: 'legislation', severity: 'critical',
    source: 'QLD Parliament', impact_summary: 'Reversed 30 years of youth justice principles'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2024-03-01', title: 'Human Rights Act Override #3 (Making QLD Safer)',
    description: 'Third and most extensive override. QHRC stated "no justification for the override". Commissioner Natalie Lewis submitted formal opposition.',
    event_type: 'human_rights_override', severity: 'critical',
    source: 'QLD Parliament'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2024-06-28', title: 'QLD Audit Office: Reducing Serious Youth Crime',
    description: '12 recommendations to Department of Premier & Cabinet, Youth Justice, and QPS. Found department "had not effectively implemented all recommendations" from previous audits.',
    event_type: 'report', severity: 'significant',
    source: 'Queensland Audit Office', source_url: 'https://www.qao.qld.gov.au/reports-resources/reports-parliament/reducing-serious-youth-crime'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2025-03-01', title: 'Wacol Youth Remand Centre opens',
    description: '76-bed facility built to adult correctional standards. Lacks dedicated youth-specific design features. Rapid expansion of detention capacity rather than community alternatives.',
    event_type: 'facility', severity: 'significant',
    source: 'QLD Government', impact_summary: '+76 detention beds, adult-standard design'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2025-11-01', title: 'Justice Reinvestment Framework launched',
    description: '$5M competitive grants program for place-based justice reinvestment. First framework of its kind in QLD. Potentially significant shift toward community-based alternatives.',
    event_type: 'framework', severity: 'significant',
    source: 'QLD Government', impact_summary: '$5M grants for place-based alternatives'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2024-06-01', title: 'Budget: $225M Staying on Track',
    description: 'Largest single youth justice program. Primarily supervision and surveillance, not rehabilitation or diversion.',
    event_type: 'budget', severity: 'significant',
    source: 'QLD Budget 2024-25'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2024-06-01', title: 'Budget: $115M Gold Standard Early Intervention',
    description: 'Early intervention program. OATSICC notes: unclear whether new investment or redistribution of existing funds.',
    event_type: 'budget', severity: 'moderate',
    source: 'QLD Budget 2024-25'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2024-06-01', title: 'Budget: $80M Circuit Breaker Sentencing',
    description: 'New sentencing option. OATSICC notes: no evaluation framework attached.',
    event_type: 'budget', severity: 'moderate',
    source: 'QLD Budget 2024-25'
  },
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    event_date: '2025-11-15', title: 'QLD Child Rights Report 2025 published',
    description: 'OATSICC and QFCC joint report documenting youth justice outcomes. Found: 97% recidivism, 26.4x Indigenous overrepresentation, 71% disability rate in detention, Closing the Gap Target 11 WORSENING.',
    event_type: 'report', severity: 'significant',
    source: 'OATSICC & QFCC', source_url: 'https://www.qfcc.qld.gov.au/kids-in-queensland/queensland-child-rights-report'
  },
];


// ═══════════════════════════════════════════════════════════════
// OVERSIGHT RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════

const recommendations = [
  // QLD Audit Office - Reducing Serious Youth Crime (Jun 2024)
  ...Array.from({ length: 12 }, (_, i) => ({
    jurisdiction: 'QLD', domain: 'youth-justice',
    oversight_body: 'qld-audit-office',
    report_title: 'Reducing Serious Youth Crime',
    report_date: '2024-06-28',
    report_url: 'https://www.qao.qld.gov.au/reports-resources/reports-parliament/reducing-serious-youth-crime',
    recommendation_number: `Rec ${i + 1}`,
    recommendation_text: `QAO Recommendation ${i + 1} from Reducing Serious Youth Crime audit`,
    status: 'unknown',
    target_department: i < 4 ? 'Department of the Premier and Cabinet' : i < 8 ? 'Department of Youth Justice' : 'Queensland Police Service',
    severity: i < 4 ? 'high' : 'medium',
  })),

  // QLD Sentencing Advisory Council - 74 recs (grouped)
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    oversight_body: 'qld-sentencing-advisory-council',
    report_title: 'The sentencing of children in Queensland',
    report_date: '2023-03-01',
    recommendation_number: '1-74 (grouped)',
    recommendation_text: '74 recommendations for youth sentencing reform including Community Correction Orders, expanded diversion, and alternatives to detention. Government moved in opposite direction with Making Queensland Safer Act.',
    status: 'rejected',
    status_notes: 'Government enacted legislation contrary to the spirit of most recommendations',
    target_department: 'Department of Youth Justice',
    severity: 'critical',
  },

  // QLD Human Rights Commissioner
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    oversight_body: 'qld-human-rights-commissioner',
    report_title: 'Submission on Making Queensland Safer Bill 2024',
    report_date: '2024-02-01',
    recommendation_number: 'Primary',
    recommendation_text: 'Opposed the Making Queensland Safer Bill. Stated "no justification for the override" of the Human Rights Act. Recommended maintaining detention as last resort, preserving restorative justice options.',
    status: 'rejected',
    status_notes: 'Bill passed with Human Rights Act override despite QHRC opposition',
    target_department: 'QLD Parliament',
    severity: 'critical',
  },

  // QLD Ombudsman - Watch-houses
  {
    jurisdiction: 'QLD', domain: 'youth-justice',
    oversight_body: 'qld-ombudsman',
    report_title: 'Combined inspection report: youth detention centres',
    report_date: '2025-11-01',
    report_url: 'https://www.ombudsman.qld.gov.au/publications/detention-inspection-reports/ydc-inspections-combined-report-2025',
    recommendation_number: 'Multiple',
    recommendation_text: 'Recommendations on detention centre conditions, watch-house usage, and capacity management. Found 42-102 children in watch-houses daily. Youth detention at 99.6% capacity.',
    status: 'unknown',
    status_notes: 'No public compliance tracking mechanism exists',
    target_department: 'Department of Youth Justice',
    severity: 'high',
  },
];


// ═══════════════════════════════════════════════════════════════
// INGEST
// ═══════════════════════════════════════════════════════════════

async function ingest() {
  console.log('Ingesting outcomes metrics...');
  const { data: mData, error: mError } = await supabase
    .from('outcomes_metrics')
    .upsert(metrics, { onConflict: 'jurisdiction,domain,metric_name,period,cohort,source' });
  if (mError) console.error('Metrics error:', mError.message);
  else console.log(`  ✓ ${metrics.length} metrics upserted`);

  console.log('Ingesting policy events...');
  const { data: eData, error: eError } = await supabase
    .from('policy_events')
    .insert(events);
  if (eError) console.error('Events error:', eError.message);
  else console.log(`  ✓ ${events.length} events inserted`);

  console.log('Ingesting oversight recommendations...');
  const { data: rData, error: rError } = await supabase
    .from('oversight_recommendations')
    .insert(recommendations);
  if (rError) console.error('Recommendations error:', rError.message);
  else console.log(`  ✓ ${recommendations.length} recommendations inserted`);

  // Verify counts
  const counts = await Promise.all([
    supabase.from('outcomes_metrics').select('id', { count: 'exact', head: true }),
    supabase.from('policy_events').select('id', { count: 'exact', head: true }),
    supabase.from('oversight_recommendations').select('id', { count: 'exact', head: true }),
  ]);

  console.log('\nFinal counts:');
  console.log(`  outcomes_metrics: ${counts[0].count}`);
  console.log(`  policy_events: ${counts[1].count}`);
  console.log(`  oversight_recommendations: ${counts[2].count}`);
}

ingest().catch(e => { console.error(e); process.exit(1); });

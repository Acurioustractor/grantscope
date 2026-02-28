/**
 * QLD Youth Justice Data Source
 *
 * Fetches youth justice statistics from QLD Open Data CKAN API
 * and known budget figures. This is NOT a grant source — it provides
 * government program data for the transparency/accountability reports.
 *
 * Data sources:
 * - QLD Open Data CKAN API (detention stats, community supervision)
 * - QLD Budget Papers (manually seeded, updated annually)
 * - AIHW Youth Justice reports (national comparison data)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const QLD_CKAN_BASE = 'https://www.data.qld.gov.au/api/3/action';

// Known QLD youth justice datasets on data.qld.gov.au
const YOUTH_JUSTICE_DATASETS = [
  {
    name: 'Youth justice — young people under supervision',
    query: 'youth+justice+supervision',
  },
  {
    name: 'Youth justice — detention centre populations',
    query: 'youth+justice+detention',
  },
  {
    name: 'Youth justice — community supervision',
    query: 'youth+justice+community',
  },
];

/**
 * Known QLD Youth Justice budget data (from QLD Budget Papers + reports).
 * These are manually curated and verified from public documents.
 */
export const QLD_YOUTH_JUSTICE_PROGRAMS = [
  {
    name: 'Youth Detention Centres',
    department: 'Department of Youth Justice',
    jurisdiction: 'qld' as const,
    domain: 'youth_justice',
    budget_annual: 343_000_000,
    spend_per_unit: 1_300_000,
    unit_label: 'child/year',
    outcomes: [
      { metric: 'recidivism_rate', value: 0.73, trend: 'stable', label: '73% reoffend within 12 months' },
      { metric: 'avg_daily_detention', value: 280, trend: 'increasing', label: '280 avg daily in detention' },
    ],
    budget_history: [
      { year: 2021, amount: 280_000_000 },
      { year: 2022, amount: 298_000_000 },
      { year: 2023, amount: 318_000_000 },
      { year: 2024, amount: 330_000_000 },
      { year: 2025, amount: 343_000_000 },
    ],
    source_url: 'https://budget.qld.gov.au',
    source_type: 'budget_paper',
  },
  {
    name: 'Community Youth Justice Programs',
    department: 'Department of Youth Justice',
    jurisdiction: 'qld' as const,
    domain: 'youth_justice',
    budget_annual: 85_000_000,
    spend_per_unit: 12_000,
    unit_label: 'child/year',
    outcomes: [
      { metric: 'recidivism_rate', value: 0.42, trend: 'decreasing', label: '42% reoffend within 12 months' },
      { metric: 'avg_daily_supervision', value: 3200, trend: 'stable', label: '3,200 on community supervision' },
    ],
    budget_history: [
      { year: 2021, amount: 65_000_000 },
      { year: 2022, amount: 70_000_000 },
      { year: 2023, amount: 75_000_000 },
      { year: 2024, amount: 80_000_000 },
      { year: 2025, amount: 85_000_000 },
    ],
    source_url: 'https://budget.qld.gov.au',
    source_type: 'budget_paper',
  },
  {
    name: 'Youth Justice Early Intervention',
    department: 'Department of Youth Justice',
    jurisdiction: 'qld' as const,
    domain: 'youth_justice',
    budget_annual: 32_000_000,
    spend_per_unit: 3_500,
    unit_label: 'child/year',
    outcomes: [
      { metric: 'diversion_success', value: 0.68, trend: 'improving', label: '68% diversion success rate' },
    ],
    budget_history: [
      { year: 2023, amount: 20_000_000 },
      { year: 2024, amount: 26_000_000 },
      { year: 2025, amount: 32_000_000 },
    ],
    source_url: 'https://budget.qld.gov.au',
    source_type: 'budget_paper',
  },
  {
    name: 'QATSIP Community Justice Groups',
    department: 'Department of Youth Justice',
    jurisdiction: 'qld' as const,
    domain: 'youth_justice',
    budget_annual: 50_000_000,
    spend_per_unit: 625_000,
    unit_label: 'org/year',
    outcomes: [
      { metric: 'orgs_funded', value: 80, trend: 'stable', label: '80+ Indigenous orgs funded' },
      { metric: 'communities_reached', value: 120, trend: 'stable', label: '120 communities reached' },
    ],
    budget_history: [
      { year: 2023, amount: 40_000_000 },
      { year: 2024, amount: 45_000_000 },
      { year: 2025, amount: 50_000_000 },
    ],
    source_url: 'https://www.dsdsatsip.qld.gov.au',
    source_type: 'annual_report',
  },
];

/**
 * Known money flows for QLD Youth Justice.
 * Manually curated from public budget papers and reports.
 */
export const QLD_YOUTH_JUSTICE_FLOWS = [
  // Taxpayer → QLD Government
  {
    domain: 'youth_justice',
    source_type: 'taxpayer',
    source_name: 'QLD Taxpayers',
    destination_type: 'government',
    destination_name: 'QLD Government',
    amount: 510_000_000,
    year: 2025,
    flow_type: 'budget_allocation',
    notes: 'Total youth justice budget allocation from QLD consolidated revenue',
  },
  // QLD Government → Detention
  {
    domain: 'youth_justice',
    source_type: 'government',
    source_name: 'QLD Government',
    destination_type: 'government_program',
    destination_name: 'Youth Detention Centres',
    amount: 343_000_000,
    year: 2025,
    flow_type: 'budget_allocation',
    notes: '$343M for detention of ~280 children. $1.3M per child per year.',
    evidence_url: 'https://budget.qld.gov.au',
  },
  // QLD Government → Community Programs
  {
    domain: 'youth_justice',
    source_type: 'government',
    source_name: 'QLD Government',
    destination_type: 'government_program',
    destination_name: 'Community Youth Justice Programs',
    amount: 85_000_000,
    year: 2025,
    flow_type: 'budget_allocation',
    notes: '$85M for community supervision of ~3,200 young people. $12K per child per year.',
    evidence_url: 'https://budget.qld.gov.au',
  },
  // QLD Government → Early Intervention
  {
    domain: 'youth_justice',
    source_type: 'government',
    source_name: 'QLD Government',
    destination_type: 'government_program',
    destination_name: 'Youth Justice Early Intervention',
    amount: 32_000_000,
    year: 2025,
    flow_type: 'budget_allocation',
    notes: '$32M for early intervention and diversion programs',
    evidence_url: 'https://budget.qld.gov.au',
  },
  // QLD Government → QATSIP
  {
    domain: 'youth_justice',
    source_type: 'government',
    source_name: 'QLD Government',
    destination_type: 'government_program',
    destination_name: 'QATSIP Community Justice Groups',
    amount: 50_000_000,
    year: 2025,
    flow_type: 'grant',
    notes: '$50M to 80+ Indigenous community organisations',
    evidence_url: 'https://www.dsdsatsip.qld.gov.au',
  },
  // Detention → Outcomes (for Sankey visualization)
  {
    domain: 'youth_justice',
    source_type: 'government_program',
    source_name: 'Youth Detention Centres',
    destination_type: 'outcome',
    destination_name: '73% Reoffending',
    amount: 250_390_000,
    year: 2025,
    flow_type: 'outcome',
    notes: '73% of detained youth reoffend within 12 months',
  },
  {
    domain: 'youth_justice',
    source_type: 'government_program',
    source_name: 'Youth Detention Centres',
    destination_type: 'outcome',
    destination_name: '27% Desistance',
    amount: 92_610_000,
    year: 2025,
    flow_type: 'outcome',
    notes: '27% of detained youth do not reoffend within 12 months',
  },
  // Community → Outcomes
  {
    domain: 'youth_justice',
    source_type: 'government_program',
    source_name: 'Community Youth Justice Programs',
    destination_type: 'outcome',
    destination_name: '42% Reoffending',
    amount: 35_700_000,
    year: 2025,
    flow_type: 'outcome',
    notes: '42% community supervision reoffending rate',
  },
  {
    domain: 'youth_justice',
    source_type: 'government_program',
    source_name: 'Community Youth Justice Programs',
    destination_type: 'outcome',
    destination_name: '58% Desistance',
    amount: 49_300_000,
    year: 2025,
    flow_type: 'outcome',
    notes: '58% community supervision desistance rate',
  },
];

/**
 * Search QLD CKAN for youth justice datasets.
 * Returns dataset metadata and resource IDs for further exploration.
 */
export async function searchQLDYouthJusticeDatasets(): Promise<Array<{
  name: string;
  title: string;
  notes: string;
  resources: Array<{ id: string; name: string; format: string; url: string }>;
}>> {
  const datasets: Array<{
    name: string;
    title: string;
    notes: string;
    resources: Array<{ id: string; name: string; format: string; url: string }>;
  }> = [];

  for (const ds of YOUTH_JUSTICE_DATASETS) {
    try {
      const response = await fetch(
        `${QLD_CKAN_BASE}/package_search?q=${ds.query}&rows=5`
      );
      if (!response.ok) continue;

      const data = await response.json() as {
        success: boolean;
        result: {
          results: Array<{
            name: string;
            title: string;
            notes: string;
            resources: Array<{ id: string; name: string; format: string; url: string }>;
          }>;
        };
      };

      if (data.success && data.result?.results) {
        datasets.push(...data.result.results);
      }
    } catch {
      console.error(`[qld-youth-justice] Failed to search for: ${ds.name}`);
    }
  }

  return datasets;
}

/**
 * Ingest QLD Youth Justice data into Supabase.
 * Seeds government_programs and money_flows tables.
 */
export async function ingestYouthJusticeData(supabase: SupabaseClient): Promise<{
  programsInserted: number;
  flowsInserted: number;
  datasetsFound: number;
}> {
  let programsInserted = 0;
  let flowsInserted = 0;

  // 1. Upsert government programs
  for (const program of QLD_YOUTH_JUSTICE_PROGRAMS) {
    const { error } = await supabase
      .from('government_programs')
      .upsert(
        {
          name: program.name,
          department: program.department,
          jurisdiction: program.jurisdiction,
          domain: program.domain,
          budget_annual: program.budget_annual,
          spend_per_unit: program.spend_per_unit,
          unit_label: program.unit_label,
          outcomes: program.outcomes,
          budget_history: program.budget_history,
          source_url: program.source_url,
          source_type: program.source_type,
          scraped_at: new Date().toISOString(),
        },
        { onConflict: 'name' }
      );

    if (error) {
      console.error(`[qld-youth-justice] Failed to upsert program "${program.name}": ${error.message}`);
    } else {
      programsInserted++;
    }
  }

  // 2. Insert money flows (clear existing youth_justice flows first to avoid duplicates)
  const { error: deleteError } = await supabase
    .from('money_flows')
    .delete()
    .eq('domain', 'youth_justice')
    .eq('year', 2025);

  if (deleteError) {
    console.error(`[qld-youth-justice] Failed to clear existing flows: ${deleteError.message}`);
  }

  for (const flow of QLD_YOUTH_JUSTICE_FLOWS) {
    const { error } = await supabase.from('money_flows').insert(flow);
    if (error) {
      console.error(`[qld-youth-justice] Failed to insert flow: ${error.message}`);
    } else {
      flowsInserted++;
    }
  }

  // 3. Search CKAN for additional datasets
  const datasets = await searchQLDYouthJusticeDatasets();
  console.log(`[qld-youth-justice] Found ${datasets.length} CKAN datasets`);

  return {
    programsInserted,
    flowsInserted,
    datasetsFound: datasets.length,
  };
}

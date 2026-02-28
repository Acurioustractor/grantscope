/**
 * Money Flow Report Builder
 *
 * Transforms money_flows table data into Sankey diagram format
 * for visualization on the frontend.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface SankeyNode {
  id: string;
  label: string;
  type: string;   // 'taxpayer', 'government', 'government_program', 'outcome', etc.
  value?: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  label?: string;
  notes?: string;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  domain: string;
  year: number;
  totalAmount: number;
}

export interface ProgramComparison {
  name: string;
  budgetAnnual: number;
  spendPerUnit: number;
  unitLabel: string;
  outcomes: Array<{ metric: string; value: number; trend: string; label: string }>;
  budgetHistory: Array<{ year: number; amount: number }>;
}

export interface YouthJusticeReport {
  sankey: SankeyData;
  programs: ProgramComparison[];
  totalBudget: number;
  detentionCostPerChild: number;
  communityCostPerChild: number;
  costRatio: number;
  detentionRecidivism: number;
  communityRecidivism: number;
}

/**
 * Build Sankey diagram data from money_flows for a given domain and year.
 */
export async function buildSankeyData(
  supabase: SupabaseClient,
  domain: string,
  year: number
): Promise<SankeyData> {
  const { data: flows, error } = await supabase
    .from('money_flows')
    .select('*')
    .eq('domain', domain)
    .eq('year', year)
    .order('amount', { ascending: false });

  if (error) throw new Error(`Failed to fetch money flows: ${error.message}`);
  if (!flows?.length) return { nodes: [], links: [], domain, year, totalAmount: 0 };

  const nodeMap = new Map<string, SankeyNode>();
  const links: SankeyLink[] = [];

  for (const flow of flows) {
    const sourceId = `${flow.source_type}:${flow.source_name}`;
    const targetId = `${flow.destination_type}:${flow.destination_name}`;

    if (!nodeMap.has(sourceId)) {
      nodeMap.set(sourceId, { id: sourceId, label: flow.source_name, type: flow.source_type });
    }
    if (!nodeMap.has(targetId)) {
      nodeMap.set(targetId, { id: targetId, label: flow.destination_name, type: flow.destination_type });
    }

    links.push({
      source: sourceId,
      target: targetId,
      value: Number(flow.amount) || 0,
      label: flow.flow_type,
      notes: flow.notes,
    });
  }

  const totalAmount = flows
    .filter(f => f.source_type === 'taxpayer')
    .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  return {
    nodes: Array.from(nodeMap.values()),
    links,
    domain,
    year,
    totalAmount,
  };
}

/**
 * Build the full Youth Justice report data.
 */
export async function buildYouthJusticeReport(
  supabase: SupabaseClient,
  year = 2025
): Promise<YouthJusticeReport> {
  const sankey = await buildSankeyData(supabase, 'youth_justice', year);

  const { data: programs } = await supabase
    .from('government_programs')
    .select('*')
    .eq('domain', 'youth_justice')
    .eq('jurisdiction', 'qld')
    .order('budget_annual', { ascending: false });

  const programComparisons: ProgramComparison[] = (programs || []).map(p => ({
    name: p.name,
    budgetAnnual: Number(p.budget_annual) || 0,
    spendPerUnit: Number(p.spend_per_unit) || 0,
    unitLabel: p.unit_label || '',
    outcomes: (p.outcomes as Array<{ metric: string; value: number; trend: string; label: string }>) || [],
    budgetHistory: (p.budget_history as Array<{ year: number; amount: number }>) || [],
  }));

  const detention = programComparisons.find(p => p.name.includes('Detention'));
  const community = programComparisons.find(p => p.name.includes('Community Youth'));

  const detentionCost = detention?.spendPerUnit || 1_300_000;
  const communityCost = community?.spendPerUnit || 12_000;

  const detentionRecidivism = detention?.outcomes.find(o => o.metric === 'recidivism_rate')?.value || 0.73;
  const communityRecidivism = community?.outcomes.find(o => o.metric === 'recidivism_rate')?.value || 0.42;

  return {
    sankey,
    programs: programComparisons,
    totalBudget: programComparisons.reduce((sum, p) => sum + p.budgetAnnual, 0),
    detentionCostPerChild: detentionCost,
    communityCostPerChild: communityCost,
    costRatio: Math.round(detentionCost / communityCost),
    detentionRecidivism,
    communityRecidivism,
  };
}

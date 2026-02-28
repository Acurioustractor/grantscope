/**
 * Power Analysis — Concentration Metrics
 *
 * Calculates:
 * - Herfindahl-Hirschman Index (HHI) for giving concentration
 * - Gini coefficient for grant distribution
 * - Top foundation dominance metrics
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PowerMetrics {
  herfindahlIndex: number;        // 0-10000 (higher = more concentrated)
  herfindahlLabel: string;        // 'low', 'moderate', 'high'
  giniCoefficient: number;        // 0-1 (higher = more unequal)
  top10Share: number;             // % of total giving from top 10
  top50Share: number;             // % of total giving from top 50
  totalGiving: number;
  foundationCount: number;
  givingFoundationCount: number;
}

export interface FoundationPowerProfile {
  name: string;
  totalGiving: number;
  share: number;                  // % of total sector giving
  thematicFocus: string[];
  parentCompany: string | null;
}

export interface PowerReport {
  metrics: PowerMetrics;
  topFoundations: FoundationPowerProfile[];
  givingDistribution: Array<{
    percentile: string;
    percentOfFoundations: number;
    percentOfGiving: number;
    avgGiving: number;
  }>;
  thematicConcentration: Array<{
    theme: string;
    totalGiving: number;
    foundationCount: number;
    topFoundation: string;
  }>;
}

/**
 * Calculate Herfindahl-Hirschman Index.
 * HHI = sum of (market share %)^2 for each entity.
 * <1500 = low concentration, 1500-2500 = moderate, >2500 = high
 */
function calculateHHI(shares: number[]): { index: number; label: string } {
  const total = shares.reduce((s, v) => s + v, 0);
  if (total === 0) return { index: 0, label: 'low' };

  const hhi = shares.reduce((sum, value) => {
    const pct = (value / total) * 100;
    return sum + pct * pct;
  }, 0);

  const label = hhi < 1500 ? 'low' : hhi < 2500 ? 'moderate' : 'high';
  return { index: Math.round(hhi), label };
}

/**
 * Calculate Gini coefficient.
 * 0 = perfect equality, 1 = perfect inequality.
 */
function calculateGini(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;

  let sumDiffs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumDiffs += Math.abs(sorted[i] - sorted[j]);
    }
  }

  return sumDiffs / (2 * n * n * mean);
}

/**
 * Build the full Power Analysis report.
 */
export async function buildPowerReport(supabase: SupabaseClient): Promise<PowerReport> {
  // Get all foundations with giving data
  const { data: foundations, count } = await supabase
    .from('foundations')
    .select('name, total_giving_annual, thematic_focus, parent_company', { count: 'exact' })
    .not('total_giving_annual', 'is', null)
    .gt('total_giving_annual', 0)
    .order('total_giving_annual', { ascending: false });

  const givingFoundations = foundations || [];
  const givingValues = givingFoundations.map(f => Number(f.total_giving_annual) || 0);
  const totalGiving = givingValues.reduce((s, v) => s + v, 0);

  // HHI
  const hhi = calculateHHI(givingValues);

  // Gini
  const gini = calculateGini(givingValues);

  // Top N share
  const top10Giving = givingValues.slice(0, 10).reduce((s, v) => s + v, 0);
  const top50Giving = givingValues.slice(0, 50).reduce((s, v) => s + v, 0);

  const metrics: PowerMetrics = {
    herfindahlIndex: hhi.index,
    herfindahlLabel: hhi.label,
    giniCoefficient: Math.round(gini * 100) / 100,
    top10Share: totalGiving > 0 ? Math.round((top10Giving / totalGiving) * 100) : 0,
    top50Share: totalGiving > 0 ? Math.round((top50Giving / totalGiving) * 100) : 0,
    totalGiving,
    foundationCount: count || 0,
    givingFoundationCount: givingFoundations.length,
  };

  // Top foundations
  const topFoundations: FoundationPowerProfile[] = givingFoundations.slice(0, 20).map(f => ({
    name: f.name,
    totalGiving: Number(f.total_giving_annual) || 0,
    share: totalGiving > 0 ? Math.round(((Number(f.total_giving_annual) || 0) / totalGiving) * 1000) / 10 : 0,
    thematicFocus: f.thematic_focus || [],
    parentCompany: f.parent_company,
  }));

  // Distribution by quintile
  const quintileSize = Math.ceil(givingFoundations.length / 5);
  const quintileLabels = ['Bottom 20%', 'Lower 20%', 'Middle 20%', 'Upper 20%', 'Top 20%'];
  const givingDistribution = [];

  for (let i = 0; i < 5; i++) {
    const start = givingFoundations.length - ((i + 1) * quintileSize);
    const end = givingFoundations.length - (i * quintileSize);
    const chunk = givingValues.slice(Math.max(0, start), end);
    const chunkTotal = chunk.reduce((s, v) => s + v, 0);

    givingDistribution.push({
      percentile: quintileLabels[i],
      percentOfFoundations: 20,
      percentOfGiving: totalGiving > 0 ? Math.round((chunkTotal / totalGiving) * 100) : 20,
      avgGiving: chunk.length > 0 ? Math.round(chunkTotal / chunk.length) : 0,
    });
  }

  // Thematic concentration
  const themeMap = new Map<string, { total: number; count: number; top: string; topAmount: number }>();

  for (const f of givingFoundations) {
    const themes = (f.thematic_focus || ['unspecified']) as string[];
    const amount = Number(f.total_giving_annual) || 0;

    for (const theme of themes) {
      const existing = themeMap.get(theme) || { total: 0, count: 0, top: '', topAmount: 0 };
      existing.total += amount;
      existing.count += 1;
      if (amount > existing.topAmount) {
        existing.top = f.name;
        existing.topAmount = amount;
      }
      themeMap.set(theme, existing);
    }
  }

  const thematicConcentration = Array.from(themeMap.entries())
    .map(([theme, data]) => ({
      theme,
      totalGiving: data.total,
      foundationCount: data.count,
      topFoundation: data.top,
    }))
    .sort((a, b) => b.totalGiving - a.totalGiving)
    .slice(0, 15);

  return {
    metrics,
    topFoundations,
    givingDistribution,
    thematicConcentration,
  };
}

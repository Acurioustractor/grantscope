/**
 * Admin Burden Analysis
 *
 * Estimates the compliance cost for organizations of different sizes.
 * Based on ACNC reporting requirements and sector research.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminBurdenReport {
  tiers: AdminTier[];
  grantComplexity: GrantComplexityEstimate[];
  totalSectorAdminCost: number;
  avgTimePerDollar: number;  // hours per $1000 received
}

export interface AdminTier {
  label: string;
  revenueRange: string;
  orgCount: number;
  avgRevenue: number;
  avgAdminPercent: number;
  avgAdminCost: number;
  avgComplianceHours: number;
  hoursPerGrantApp: number;
  successRate: number;
}

export interface GrantComplexityEstimate {
  grantSize: string;
  typicalHours: number;
  typicalCost: number;
  successRate: number;
  effectiveHourlyReturn: number;
}

/**
 * Build admin burden report from community_orgs data.
 */
export async function buildAdminBurdenReport(supabase: SupabaseClient): Promise<AdminBurdenReport> {
  const { data: orgs } = await supabase
    .from('community_orgs')
    .select('annual_revenue, admin_burden_hours, admin_burden_cost')
    .not('annual_revenue', 'is', null);

  const allOrgs = (orgs || []).map(o => ({
    revenue: Number(o.annual_revenue) || 0,
    hours: Number(o.admin_burden_hours) || 0,
    cost: Number(o.admin_burden_cost) || 0,
  }));

  const tierDefs = [
    { label: 'Micro', range: '<$50K', min: 0, max: 50_000, hoursPerApp: 40, successRate: 0.08 },
    { label: 'Small', range: '$50K-$250K', min: 50_000, max: 250_000, hoursPerApp: 60, successRate: 0.12 },
    { label: 'Medium', range: '$250K-$1M', min: 250_000, max: 1_000_000, hoursPerApp: 80, successRate: 0.22 },
    { label: 'Large', range: '$1M+', min: 1_000_000, max: Infinity, hoursPerApp: 100, successRate: 0.35 },
  ];

  const tiers: AdminTier[] = tierDefs.map(def => {
    const inTier = allOrgs.filter(o => o.revenue >= def.min && o.revenue < def.max);
    const avgRevenue = inTier.length ? Math.round(inTier.reduce((s, o) => s + o.revenue, 0) / inTier.length) : 0;
    const avgCost = inTier.length ? Math.round(inTier.reduce((s, o) => s + o.cost, 0) / inTier.length) : 0;
    const avgHours = inTier.length ? Math.round(inTier.reduce((s, o) => s + o.hours, 0) / inTier.length) : 0;
    const avgPercent = avgRevenue > 0 ? Math.round((avgCost / avgRevenue) * 100) : 0;

    return {
      label: def.label,
      revenueRange: def.range,
      orgCount: inTier.length,
      avgRevenue,
      avgAdminPercent: avgPercent || (def.min < 250_000 ? 40 : 15),
      avgAdminCost: avgCost,
      avgComplianceHours: avgHours,
      hoursPerGrantApp: def.hoursPerApp,
      successRate: def.successRate,
    };
  });

  // Grant complexity estimates
  const grantComplexity: GrantComplexityEstimate[] = [
    { grantSize: '<$10K', typicalHours: 20, typicalCost: 1_500, successRate: 0.15, effectiveHourlyReturn: 0 },
    { grantSize: '$10K-$50K', typicalHours: 40, typicalCost: 3_000, successRate: 0.12, effectiveHourlyReturn: 0 },
    { grantSize: '$50K-$200K', typicalHours: 80, typicalCost: 6_000, successRate: 0.10, effectiveHourlyReturn: 0 },
    { grantSize: '$200K+', typicalHours: 150, typicalCost: 12_000, successRate: 0.08, effectiveHourlyReturn: 0 },
  ];

  // Calculate effective hourly return (expected value / hours)
  for (const gc of grantComplexity) {
    const avgGrant = gc.grantSize === '<$10K' ? 5_000
      : gc.grantSize === '$10K-$50K' ? 25_000
      : gc.grantSize === '$50K-$200K' ? 100_000
      : 300_000;
    const expectedValue = avgGrant * gc.successRate;
    gc.effectiveHourlyReturn = Math.round(expectedValue / gc.typicalHours);
  }

  const totalSectorAdminCost = allOrgs.reduce((s, o) => s + o.cost, 0);
  const totalHours = allOrgs.reduce((s, o) => s + o.hours, 0);
  const totalRevenue = allOrgs.reduce((s, o) => s + o.revenue, 0);

  return {
    tiers,
    grantComplexity,
    totalSectorAdminCost,
    avgTimePerDollar: totalRevenue > 0 ? Math.round((totalHours / (totalRevenue / 1000)) * 10) / 10 : 0,
  };
}

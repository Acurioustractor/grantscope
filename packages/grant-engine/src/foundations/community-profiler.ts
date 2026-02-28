/**
 * Community Org Profiler
 *
 * Profiles community organizations from ACNC data.
 * Identifies small grassroots orgs (revenue < $1M) and
 * estimates their admin burden and funding access.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CommunityOrgProfile {
  acnc_abn: string;
  name: string;
  website: string | null;
  description: string | null;
  domain: string[];
  geographic_focus: string[];
  annual_revenue: number | null;
  annual_funding_received: number | null;
  admin_burden_hours: number | null;
  admin_burden_cost: number | null;
  profile_confidence: 'low' | 'medium' | 'high';
}

/**
 * Estimate admin burden based on org size and reporting requirements.
 * Small orgs (<$250K) spend proportionally much more on compliance.
 */
export function estimateAdminBurden(annualRevenue: number | null): {
  hours: number;
  cost: number;
  percentOfRevenue: number;
} {
  if (!annualRevenue || annualRevenue <= 0) {
    return { hours: 0, cost: 0, percentOfRevenue: 0 };
  }

  // Based on Australian Charities and Not-for-profits Commission data:
  // Small charities (<$250K) spend ~40% of revenue on admin
  // Medium ($250K-$1M) spend ~25%
  // Large (>$1M) spend ~15%
  let adminPercent: number;
  let hoursPerYear: number;

  if (annualRevenue < 250_000) {
    adminPercent = 0.40;
    hoursPerYear = 500; // ~10 hrs/week on compliance
  } else if (annualRevenue < 1_000_000) {
    adminPercent = 0.25;
    hoursPerYear = 1000; // ~20 hrs/week, but with more staff
  } else {
    adminPercent = 0.15;
    hoursPerYear = 2000; // Dedicated admin staff
  }

  const cost = annualRevenue * adminPercent;
  return { hours: hoursPerYear, cost, percentOfRevenue: adminPercent * 100 };
}

/**
 * Infer domains from ACNC activity descriptions.
 */
function inferDomains(name: string, description: string | null): string[] {
  const text = `${name} ${description || ''}`.toLowerCase();
  const domains: string[] = [];

  if (/youth|juvenile|young people|children/.test(text)) domains.push('youth');
  if (/justice|legal|diversion/.test(text)) domains.push('youth_justice');
  if (/indigenous|aboriginal|torres strait|first nations/.test(text)) domains.push('indigenous');
  if (/mental health|wellbeing|counsel/.test(text)) domains.push('mental_health');
  if (/health|medical|hospital/.test(text)) domains.push('health');
  if (/education|school|training|literacy/.test(text)) domains.push('education');
  if (/housing|homeless|shelter/.test(text)) domains.push('housing');
  if (/disabilit/.test(text)) domains.push('disability');
  if (/environment|conservation|land/.test(text)) domains.push('environment');
  if (/arts?|cultur|creative/.test(text)) domains.push('arts');
  if (/communit/.test(text)) domains.push('community');

  return domains.length ? domains : ['general'];
}

/**
 * Infer geographic focus from ACNC data.
 */
function inferGeography(name: string, description: string | null): string[] {
  const text = `${name} ${description || ''}`.toLowerCase();
  const geo: string[] = [];

  if (/queensland|qld|brisbane|gold coast|cairns|townsville/.test(text)) geo.push('AU-QLD');
  if (/new south wales|nsw|sydney/.test(text)) geo.push('AU-NSW');
  if (/victoria|vic|melbourne/.test(text)) geo.push('AU-VIC');
  if (/western australia|wa|perth/.test(text)) geo.push('AU-WA');
  if (/south australia|sa|adelaide/.test(text)) geo.push('AU-SA');
  if (/tasmania|tas|hobart/.test(text)) geo.push('AU-TAS');
  if (/northern territory|nt|darwin/.test(text)) geo.push('AU-NT');
  if (/act|canberra/.test(text)) geo.push('AU-ACT');
  if (/national|australia-wide|across australia/.test(text)) geo.push('AU-National');

  return geo.length ? geo : ['AU'];
}

/**
 * Import community orgs from ACNC foundations data.
 * Filters for small orgs (revenue < $1M, not already in foundations as major players).
 */
export async function importCommunityOrgs(
  supabase: SupabaseClient,
  options: { limit?: number; domain?: string } = {}
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const limit = options.limit || 500;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Get foundations that are small community orgs (not already profiled as major foundations)
  const query = supabase
    .from('foundations')
    .select('acnc_abn, name, website, description, thematic_focus, geographic_focus, acnc_data')
    .or('total_giving_annual.is.null,total_giving_annual.lt.1000000')
    .order('name')
    .limit(limit);

  const { data: foundations, error: fetchError } = await query;

  if (fetchError) {
    return { imported: 0, skipped: 0, errors: [fetchError.message] };
  }

  if (!foundations?.length) {
    return { imported: 0, skipped: 0, errors: [] };
  }

  for (const f of foundations) {
    const acncData = f.acnc_data as Record<string, unknown> | null;
    const revenue = acncData?.total_revenue ? Number(acncData.total_revenue) : null;

    // Skip if revenue > $1M (not a small community org)
    if (revenue && revenue > 1_000_000) {
      skipped++;
      continue;
    }

    // Filter by domain if specified
    const domains = inferDomains(f.name, f.description);
    if (options.domain && !domains.includes(options.domain)) {
      skipped++;
      continue;
    }

    const adminBurden = estimateAdminBurden(revenue);
    const geography = inferGeography(f.name, f.description);

    const { error } = await supabase
      .from('community_orgs')
      .upsert({
        acnc_abn: f.acnc_abn,
        name: f.name,
        website: f.website,
        description: f.description,
        domain: domains,
        geographic_focus: geography,
        annual_revenue: revenue,
        admin_burden_hours: adminBurden.hours,
        admin_burden_cost: adminBurden.cost,
        profile_confidence: 'low',
        enriched_at: new Date().toISOString(),
      }, { onConflict: 'acnc_abn' });

    if (error) {
      errors.push(`Failed to import ${f.name}: ${error.message}`);
    } else {
      imported++;
    }
  }

  return { imported, skipped, errors };
}

import { getServiceSupabase } from '@/lib/supabase';
import { SimulatorClient } from './simulator-client';

export const dynamic = 'force-dynamic';

async function getSimulatorData() {
  const supabase = getServiceSupabase();

  // Sector distribution
  const { data: foundationsWithFocus } = await supabase
    .from('foundations')
    .select('thematic_focus, total_giving_annual')
    .not('thematic_focus', 'is', null)
    .not('total_giving_annual', 'is', null)
    .limit(5000);

  const sectorMap = new Map<string, { count: number; totalGiving: number }>();
  for (const f of foundationsWithFocus || []) {
    for (const sector of (f.thematic_focus as string[]) || []) {
      const existing = sectorMap.get(sector) || { count: 0, totalGiving: 0 };
      existing.count++;
      existing.totalGiving += (f.total_giving_annual as number) || 0;
      sectorMap.set(sector, existing);
    }
  }
  const sectors = Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector: sector.charAt(0).toUpperCase() + sector.slice(1).replace(/_/g, ' '),
      count: data.count,
      avgGiving: data.count > 0 ? Math.round(data.totalGiving / data.count) : 0,
      totalGiving: Math.round(data.totalGiving),
    }))
    .sort((a, b) => b.totalGiving - a.totalGiving);

  // Geographic distribution
  const { data: foundationsWithGeo } = await supabase
    .from('foundations')
    .select('geographic_focus, total_giving_annual')
    .not('geographic_focus', 'is', null)
    .not('total_giving_annual', 'is', null)
    .limit(5000);

  const geoMap = new Map<string, { count: number; totalGiving: number }>();
  for (const f of foundationsWithGeo || []) {
    for (const geo of (f.geographic_focus as string[]) || []) {
      const existing = geoMap.get(geo) || { count: 0, totalGiving: 0 };
      existing.count++;
      existing.totalGiving += (f.total_giving_annual as number) || 0;
      geoMap.set(geo, existing);
    }
  }
  const geography = Array.from(geoMap.entries())
    .map(([region, data]) => ({
      region,
      code: region,
      count: data.count,
      totalGiving: Math.round(data.totalGiving),
    }))
    .sort((a, b) => b.totalGiving - a.totalGiving);

  // Tiers
  const { data: allFoundations } = await supabase
    .from('foundations')
    .select('total_giving_annual')
    .not('total_giving_annual', 'is', null)
    .limit(10000);

  const tierDefs = [
    { tier: 'Major ($5M+)', min: 5000000, max: Infinity },
    { tier: 'Large ($1-5M)', min: 1000000, max: 5000000 },
    { tier: 'Medium ($250K-1M)', min: 250000, max: 1000000 },
    { tier: 'Small ($50-250K)', min: 50000, max: 250000 },
    { tier: 'Micro (<$50K)', min: 0, max: 50000 },
  ];

  const tiers = tierDefs.map(td => {
    const matching = (allFoundations || []).filter(f => {
      const g = f.total_giving_annual as number;
      return g >= td.min && g < td.max;
    });
    const totalGiving = matching.reduce((sum, f) => sum + (f.total_giving_annual as number), 0);
    return {
      tier: td.tier,
      count: matching.length,
      avgGiving: matching.length > 0 ? Math.round(totalGiving / matching.length) : 0,
      totalGiving: Math.round(totalGiving),
    };
  });

  // Sources
  const { data: grantSources } = await supabase
    .from('grant_opportunities')
    .select('source, amount_max')
    .limit(5000);

  const sourceMap = new Map<string, { count: number; totalFunding: number; type: string }>();
  for (const g of grantSources || []) {
    const source = (g.source as string) || 'Unknown';
    const existing = sourceMap.get(source) || { count: 0, totalFunding: 0, type: 'government' };
    existing.count++;
    existing.totalFunding += (g.amount_max as number) || 0;
    if (source.toLowerCase().includes('foundation')) existing.type = 'philanthropy';
    sourceMap.set(source, existing);
  }
  const sources = Array.from(sourceMap.entries())
    .map(([source, data]) => ({ source, ...data }))
    .sort((a, b) => b.totalFunding - a.totalFunding);

  return { sectors, geography, tiers, sources };
}

export default async function SimulatorPage() {
  const data = await getSimulatorData();
  return <SimulatorClient {...data} />;
}

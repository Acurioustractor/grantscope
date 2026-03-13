import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import { resolveSubscriptionTier } from '@/lib/subscription';
import GoodsIntelligenceClient from './goods-intelligence-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Goods Intelligence | CivicGraph',
  description:
    'Community intelligence, supply chain economics, and procurement pipeline for Goods on Country.',
};

type CommunityRow = {
  id: string;
  community_name: string;
  state: string;
  postcode: string | null;
  remoteness: string | null;
  latitude: number;
  longitude: number;
  estimated_population: number | null;
  main_language: string | null;
  land_council: string | null;
  community_type: string | null;
  freight_corridor: string | null;
  nearest_staging_hub: string | null;
  estimated_freight_cost_per_kg: number | null;
  last_mile_method: string | null;
  priority: string;
  demand_beds: number;
  demand_washers: number;
  assets_deployed: number;
  assets_active: number;
  assets_overdue: number;
  buyer_entity_count: number;
  total_local_entities: number;
  data_sources: string[] | null;
  agil_code: string | null;
};

type ProductRow = {
  slug: string;
  name: string;
  category: string;
  status: string;
  material_cost_aud: number;
  manufacturing_cost_aud: number;
  wholesale_price_aud: number;
  typical_delivered_cost_remote: number;
  goods_delivered_cost_remote: number;
  idiot_index: number;
  cost_advantage_pct: number;
  expected_lifespan_months: number;
  weight_kg: number;
  common_failure_modes: string[] | null;
};

type CorridorStat = {
  freight_corridor: string;
  communities: number;
  total_pop: number | null;
  avg_freight_cost: number;
};

type StateSummary = {
  state: string;
  communities: number;
  with_population: number;
  total_pop: number | null;
  with_entities: number;
};

export type GoodsIntelligenceData = {
  communities: CommunityRow[];
  products: ProductRow[];
  corridors: CorridorStat[];
  stateSummary: StateSummary[];
  totals: {
    communities: number;
    withPopulation: number;
    totalPopulation: number;
    withEntities: number;
    totalEntities: number;
    totalAssets: number;
    assetsOverdue: number;
    signals: number;
  };
};

async function sql(query: string) {
  const db = getServiceSupabase();
  const { data, error } = await db.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL: ${error.message}`);
  return (data || []) as Record<string, unknown>[];
}

async function loadData(): Promise<GoodsIntelligenceData> {
  // Load communities (all 1546)
  const communityRows: CommunityRow[] = [];
  for (const state of ['NT', 'WA', 'QLD', 'SA', 'NSW', 'TAS', 'VIC', 'ACT']) {
    const rows = await sql(`
      SELECT id, community_name, state, postcode, remoteness, latitude, longitude,
             estimated_population, main_language, land_council, community_type,
             freight_corridor, nearest_staging_hub, estimated_freight_cost_per_kg,
             last_mile_method, priority, demand_beds, demand_washers,
             assets_deployed, assets_active, assets_overdue,
             buyer_entity_count, total_local_entities, data_sources, agil_code
      FROM goods_communities
      WHERE state = '${state}'
      ORDER BY estimated_population DESC NULLS LAST
    `);
    communityRows.push(...(rows as unknown as CommunityRow[]));
  }

  // Load products
  const products = (await sql(`
    SELECT slug, name, category, status, material_cost_aud, manufacturing_cost_aud,
           wholesale_price_aud, typical_delivered_cost_remote, goods_delivered_cost_remote,
           idiot_index, cost_advantage_pct, expected_lifespan_months, weight_kg,
           common_failure_modes
    FROM goods_products
    ORDER BY status ASC, slug
  `)) as unknown as ProductRow[];

  // Load corridor stats
  const corridors = (await sql(`
    SELECT freight_corridor, COUNT(*) as communities,
      SUM(estimated_population) as total_pop,
      AVG(estimated_freight_cost_per_kg) as avg_freight_cost
    FROM goods_communities
    WHERE freight_corridor IS NOT NULL
    GROUP BY freight_corridor
    ORDER BY communities DESC
  `)) as unknown as CorridorStat[];

  // State summary
  const stateSummary = (await sql(`
    SELECT state, COUNT(*) as communities,
      COUNT(CASE WHEN estimated_population > 0 THEN 1 END) as with_population,
      SUM(estimated_population) as total_pop,
      COUNT(CASE WHEN total_local_entities > 0 THEN 1 END) as with_entities
    FROM goods_communities
    GROUP BY state
    ORDER BY communities DESC
  `)) as unknown as StateSummary[];

  // Totals
  const [t] = await sql(`
    SELECT COUNT(*) as communities,
      COUNT(CASE WHEN estimated_population > 0 THEN 1 END) as with_population,
      COALESCE(SUM(estimated_population), 0) as total_population,
      COUNT(CASE WHEN total_local_entities > 0 THEN 1 END) as with_entities,
      COALESCE(SUM(total_local_entities), 0) as total_entities,
      COALESCE(SUM(assets_deployed), 0) as total_assets,
      COALESCE(SUM(assets_overdue), 0) as assets_overdue
    FROM goods_communities
  `);
  const [s] = await sql(`SELECT COUNT(*) as count FROM goods_procurement_signals WHERE status = 'new'`);

  return {
    communities: communityRows,
    products,
    corridors,
    stateSummary,
    totals: {
      communities: Number(t.communities),
      withPopulation: Number(t.with_population),
      totalPopulation: Number(t.total_population),
      withEntities: Number(t.with_entities),
      totalEntities: Number(t.total_entities),
      totalAssets: Number(t.total_assets),
      assetsOverdue: Number(t.assets_overdue),
      signals: Number(s.count),
    },
  };
}

export default async function GoodsIntelligencePage() {
  const authSupabase = await createSupabaseServer();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/goods-intelligence');
  }

  const serviceDb = getServiceSupabase();
  const orgContext = await getCurrentOrgProfileContext(serviceDb, user.id);
  const tier = resolveSubscriptionTier(orgContext.profile?.subscription_plan);

  const data = await loadData();
  return <GoodsIntelligenceClient data={data} tier={tier} />;
}

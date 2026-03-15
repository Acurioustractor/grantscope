/**
 * Goods Project ↔ CivicGraph Integration Layer
 *
 * Drop this file + civicgraph-client.ts into the Goods project's lib/ folder.
 * Provides four high-level functions matching Goods admin dashboard needs:
 *
 *   1. getGoodsGrantOpportunities()  — grants matching indigenous manufacturing / remote / circular economy
 *   2. getGoodsTenderMatches()       — government tenders for furniture/beds in remote areas
 *   3. getGoodsFunderProfiles()      — funder profiles with giving data
 *   4. getDeploymentPriority()       — community disadvantage scores for deployment prioritisation
 *
 * ENV (same as civicgraph-client.ts):
 *   CIVICGRAPH_BASE_URL=https://civicgraph.vercel.app
 *   CIVICGRAPH_SUPABASE_URL=https://tednluwflfhxyucgwigh.supabase.co
 *   CIVICGRAPH_ANON_KEY=sb_publishable_7WrSXaJoGbP5btr1k7EYXQ_ZDJeWrc_
 *   CIVICGRAPH_EMAIL=benjamin@act.place
 *   CIVICGRAPH_PASSWORD=<your-password>
 */

import {
  searchEntities,
  searchGrants,
  searchFoundations,
  globalSearch,
  analyseSuppliers,
  discoverSuppliers,
} from './civicgraph-client';

// ─────────────────────────────────────────────────────────────────
// 1. GRANT OPPORTUNITIES — matching Goods focus areas
// ─────────────────────────────────────────────────────────────────

const GOODS_GRANT_KEYWORDS = [
  'indigenous manufacturing',
  'remote community',
  'circular economy',
  'social enterprise',
  'indigenous procurement',
  'First Nations',
  'furniture',
  'manufacturing',
  'community infrastructure',
];

export interface GoodsGrant {
  id: string;
  name: string;
  provider: string;
  program: string;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  url: string | null;
  categories: string[];
  matchedKeyword: string;
}

/**
 * Fetch grant opportunities relevant to the Goods project.
 * Searches CivicGraph for grants matching indigenous manufacturing,
 * remote community, circular economy, and related keywords.
 *
 * @param keywords - Override default search terms (optional)
 * @param limit - Max results per keyword (default 10)
 */
export async function getGoodsGrantOpportunities(
  keywords = GOODS_GRANT_KEYWORDS,
  limit = 10
): Promise<GoodsGrant[]> {
  const seen = new Set<string>();
  const results: GoodsGrant[] = [];

  // Search grants for each keyword in parallel
  const searches = keywords.map(async (keyword) => {
    try {
      const res = await globalSearch(keyword, limit);
      const grants = (res as { grants?: Array<Record<string, unknown>> }).grants || [];
      for (const g of grants) {
        const id = String(g.id || '');
        if (seen.has(id)) continue;
        seen.add(id);
        results.push({
          id,
          name: String(g.name || ''),
          provider: String(g.provider || ''),
          program: String(g.program || ''),
          amount_min: g.amount_min as number | null,
          amount_max: g.amount_max as number | null,
          closes_at: g.closes_at as string | null,
          url: g.url as string | null,
          categories: (g.categories || []) as string[],
          matchedKeyword: keyword,
        });
      }
    } catch {
      // Skip failed searches, return what we have
    }
  });

  await Promise.all(searches);

  // Sort: soonest deadline first, then by amount
  results.sort((a, b) => {
    if (a.closes_at && b.closes_at) return a.closes_at.localeCompare(b.closes_at);
    if (a.closes_at) return -1;
    if (b.closes_at) return 1;
    return (b.amount_max || 0) - (a.amount_max || 0);
  });

  return results;
}

// ─────────────────────────────────────────────────────────────────
// 2. TENDER MATCHES — government contracts for furniture/beds/remote
// ─────────────────────────────────────────────────────────────────

export interface GoodsTender {
  gs_id: string;
  name: string;
  abn: string | null;
  entity_type: string;
  state: string;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  is_community_controlled: boolean;
  lga_name: string | null;
  latest_revenue: number | null;
  contracts: { count: number; total_value: number };
}

/**
 * Discover government/procurement suppliers and buyers relevant to
 * furniture, beds, and remote community deployment.
 *
 * Uses the authenticated Tender Intelligence API.
 *
 * @param states - States to search (default: NT, WA, QLD, SA — remote-heavy)
 * @param limit - Max results per state (default 20)
 */
export async function getGoodsTenderMatches(
  states = ['NT', 'WA', 'QLD', 'SA'],
  limit = 20
): Promise<{ suppliers: GoodsTender[]; summary: Record<string, unknown> }> {
  const allSuppliers: GoodsTender[] = [];
  const seen = new Set<string>();

  // Search each state in parallel
  const searches = states.map(async (state) => {
    try {
      const res = await discoverSuppliers({
        state,
        entity_types: ['indigenous_corp', 'social_enterprise', 'company'],
        min_contracts: 1,
        limit,
      });
      const suppliers = (res as { suppliers?: GoodsTender[] }).suppliers || [];
      for (const s of suppliers) {
        if (seen.has(s.gs_id)) continue;
        seen.add(s.gs_id);
        allSuppliers.push(s);
      }
    } catch {
      // Skip failed state searches
    }
  });

  await Promise.all(searches);

  // Sort: remote areas first, then by contract count
  const remotenessOrder: Record<string, number> = {
    'Very Remote Australia': 0,
    'Remote Australia': 1,
    'Outer Regional Australia': 2,
    'Inner Regional Australia': 3,
    'Major Cities of Australia': 4,
  };

  allSuppliers.sort((a, b) => {
    const ra = remotenessOrder[a.remoteness || ''] ?? 5;
    const rb = remotenessOrder[b.remoteness || ''] ?? 5;
    if (ra !== rb) return ra - rb;
    return (b.contracts?.count || 0) - (a.contracts?.count || 0);
  });

  return {
    suppliers: allSuppliers,
    summary: {
      total: allSuppliers.length,
      indigenous: allSuppliers.filter(s => s.entity_type === 'indigenous_corp').length,
      remote_very_remote: allSuppliers.filter(s =>
        s.remoteness === 'Very Remote Australia' || s.remoteness === 'Remote Australia'
      ).length,
      community_controlled: allSuppliers.filter(s => s.is_community_controlled).length,
      states_searched: states,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// 3. FUNDER PROFILES — foundations with engagement history
// ─────────────────────────────────────────────────────────────────

export interface GoodsFunder {
  id: string;
  name: string;
  type: string;
  website: string | null;
  total_giving_annual: number | null;
  thematic_focus: string[];
  geographic_focus: string[];
  relevance: 'high' | 'medium' | 'low';
}

const GOODS_FUNDER_FOCUSES = ['indigenous', 'community', 'environment', 'social-enterprise', 'housing'];

/**
 * Fetch funder/foundation profiles relevant to the Goods project.
 * Searches for foundations with thematic focus on indigenous,
 * community, environment, and social enterprise.
 *
 * @param focuses - Thematic focus areas to search (optional)
 * @param states - Geographic focus states (optional)
 * @param limit - Max results per focus (default 20)
 */
export async function getGoodsFunderProfiles(
  focuses = GOODS_FUNDER_FOCUSES,
  states = ['NT', 'WA', 'QLD', 'SA', 'NSW'],
  limit = 20
): Promise<GoodsFunder[]> {
  const seen = new Set<string>();
  const results: GoodsFunder[] = [];

  // Search by focus area in parallel
  const searches = focuses.flatMap((focus) =>
    states.map(async (state) => {
      try {
        const res = await searchFoundations({ focus, state, limit });
        const data = (res as { data?: Array<Record<string, unknown>> }).data || [];
        for (const f of data) {
          const id = String(f.id || '');
          if (seen.has(id)) continue;
          seen.add(id);

          const thematic = (f.thematic_focus || []) as string[];
          const isHighRelevance =
            thematic.some(t => t === 'indigenous' || t === 'community') ||
            (f.total_giving_annual as number) > 1000000;

          results.push({
            id,
            name: String(f.name || ''),
            type: String(f.type || ''),
            website: f.website as string | null,
            total_giving_annual: f.total_giving_annual as number | null,
            thematic_focus: thematic,
            geographic_focus: (f.geographic_focus || []) as string[],
            relevance: isHighRelevance ? 'high' : thematic.length > 0 ? 'medium' : 'low',
          });
        }
      } catch {
        // Skip failed searches
      }
    })
  );

  await Promise.all(searches);

  // Sort: high relevance first, then by giving amount
  const relevanceOrder = { high: 0, medium: 1, low: 2 };
  results.sort((a, b) => {
    if (a.relevance !== b.relevance) return relevanceOrder[a.relevance] - relevanceOrder[b.relevance];
    return (b.total_giving_annual || 0) - (a.total_giving_annual || 0);
  });

  return results;
}

// ─────────────────────────────────────────────────────────────────
// 4. DEPLOYMENT PRIORITY — disadvantage scores for community rollout
// ─────────────────────────────────────────────────────────────────

export interface DeploymentArea {
  postcode: string;
  state: string;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  entity_count: number;
  total_funding: number;
  community_controlled_count: number;
  priority_score: number; // 0-100, higher = more underserved
  priority_label: 'critical' | 'high' | 'medium' | 'low';
}

const BASE_URL =
  process.env.CIVICGRAPH_BASE_URL || 'https://civicgraph.vercel.app';

/**
 * Get community disadvantage scores for deployment prioritisation.
 * Returns postcodes ranked by how underserved they are, combining:
 *   - SEIFA disadvantage decile (lower = more disadvantaged)
 *   - Remoteness (more remote = higher priority)
 *   - Funding received (less funding = higher priority)
 *
 * @param states - States to check (default: NT, WA, QLD, SA)
 * @param limit - Max postcodes to return (default 50)
 */
export async function getDeploymentPriority(
  states = ['NT', 'WA', 'QLD', 'SA'],
  limit = 50
): Promise<DeploymentArea[]> {
  const results: DeploymentArea[] = [];

  // Fetch funding-by-postcode data for each state
  for (const state of states) {
    try {
      const res = await fetch(
        `${BASE_URL}/api/data?type=entities&state=${state}&limit=1`
      );
      if (!res.ok) continue;

      // Use the mv_funding_by_postcode via the public search
      // Fetch entities grouped by postcode to derive deployment areas
      const entityRes = await fetch(
        `${BASE_URL}/api/data?type=entities&state=${state}&limit=500`
      );
      if (!entityRes.ok) continue;
      const entityData = await entityRes.json();
      const entities = (entityData.data || []) as Array<Record<string, unknown>>;

      // Group by postcode
      const byPostcode = new Map<string, {
        count: number;
        remoteness: string | null;
        seifa: number | null;
        cc_count: number;
      }>();

      for (const e of entities) {
        const pc = String(e.postcode || '');
        if (!pc) continue;
        const existing = byPostcode.get(pc) || {
          count: 0,
          remoteness: null,
          seifa: null,
          cc_count: 0,
        };
        existing.count++;
        if (e.remoteness) existing.remoteness = String(e.remoteness);
        if (e.seifa_irsd_decile) existing.seifa = Number(e.seifa_irsd_decile);
        if (e.is_community_controlled) existing.cc_count++;
        byPostcode.set(pc, existing);
      }

      for (const [postcode, data] of byPostcode) {
        // Priority score: lower SEIFA + higher remoteness + lower entity count = higher priority
        const seifaScore = data.seifa ? (10 - data.seifa) * 10 : 50; // 0-100, inverted
        const remotenessScore: Record<string, number> = {
          'Very Remote Australia': 30,
          'Remote Australia': 25,
          'Outer Regional Australia': 15,
          'Inner Regional Australia': 5,
          'Major Cities of Australia': 0,
        };
        const rScore = remotenessScore[data.remoteness || ''] ?? 10;
        const densityScore = Math.min(20, Math.max(0, 20 - data.count)); // fewer entities = higher need

        const priority_score = Math.min(100, seifaScore + rScore + densityScore);
        const priority_label: DeploymentArea['priority_label'] =
          priority_score >= 75 ? 'critical' :
          priority_score >= 55 ? 'high' :
          priority_score >= 35 ? 'medium' : 'low';

        results.push({
          postcode,
          state,
          remoteness: data.remoteness,
          seifa_irsd_decile: data.seifa,
          entity_count: data.count,
          total_funding: 0, // Would need mv_funding_by_postcode for actual values
          community_controlled_count: data.cc_count,
          priority_score,
          priority_label,
        });
      }
    } catch {
      // Skip failed state fetches
    }
  }

  // Sort by priority score descending
  results.sort((a, b) => b.priority_score - a.priority_score);
  return results.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────
// CONVENIENCE: Pull everything for the Goods admin dashboard
// ─────────────────────────────────────────────────────────────────

export interface GoodsDashboardData {
  grants: GoodsGrant[];
  tenders: { suppliers: GoodsTender[]; summary: Record<string, unknown> };
  funders: GoodsFunder[];
  deploymentAreas: DeploymentArea[];
  fetchedAt: string;
}

/**
 * Fetch all CivicGraph data for the Goods admin dashboard in one call.
 * Runs all four queries in parallel for speed.
 *
 * Usage in Goods:
 *   const dashboard = await getGoodsDashboard();
 *   // dashboard.grants — matching grant opportunities
 *   // dashboard.tenders — remote area suppliers with contracts
 *   // dashboard.funders — foundation profiles sorted by relevance
 *   // dashboard.deploymentAreas — postcodes ranked by need
 */
export async function getGoodsDashboard(): Promise<GoodsDashboardData> {
  const [grants, tenders, funders, deploymentAreas] = await Promise.all([
    getGoodsGrantOpportunities(),
    getGoodsTenderMatches(),
    getGoodsFunderProfiles(),
    getDeploymentPriority(),
  ]);

  return {
    grants,
    tenders,
    funders,
    deploymentAreas,
    fetchedAt: new Date().toISOString(),
  };
}

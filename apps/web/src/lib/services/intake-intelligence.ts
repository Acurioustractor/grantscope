import { getServiceSupabase } from '@/lib/supabase';

/**
 * Intake Intelligence Engine
 *
 * Matches founder ideas against CivicGraph data:
 * - Landscape: existing orgs in their space
 * - Evidence: ALMA interventions matching their approach
 * - Funding: grants, foundations, government spend
 * - Area profile: community snapshot (SEIFA, demographics, funding levels)
 * - Entity type: personalised recommendation
 *
 * ALL queries use parameterised supabase-js — no exec_sql string interpolation.
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface LandscapeOrg {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  sector: string;
  state: string;
  lga_name: string | null;
  postcode: string | null;
  is_community_controlled: boolean;
}

export interface AlmaMatch {
  id: string;
  name: string;
  type: string;
  evidence_level: string;
  target_cohort: string | null;
  description: string | null;
  cultural_authority: string | null;
}

export interface GrantMatch {
  id: string;
  name: string;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  closes_at: string | null;
  provider: string | null;
  categories: string[] | null;
  focus_areas: string[] | null;
  url: string | null;
}

export interface FoundationMatch {
  id: string;
  name: string;
  total_giving_annual: number | null;
  thematic_focus: string[] | null;
  geographic_focus: string | null;
  description: string | null;
  website: string | null;
}

export interface AreaProfile {
  postcode: string;
  locality: string | null;
  state: string;
  lga_name: string | null;
  remoteness: string | null;
  seifa_score: number | null;
  seifa_decile: number | null;
  entity_count: number;
  total_funding: number;
}

export interface EntityTypeScore {
  type: string;
  label: string;
  score: number;
  pros: string[];
  cons: string[];
}

export interface IntakeIntelligence {
  landscape: LandscapeOrg[];
  evidence: AlmaMatch[];
  grants: GrantMatch[];
  foundations: FoundationMatch[];
  areaProfile: AreaProfile | null;
  entityTypes: EntityTypeScore[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Landscape Matching
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function matchLandscape(opts: {
  state?: string;
  lga?: string;
  postcode?: string;
  sector?: string;
  issueAreas?: string[];
}): Promise<LandscapeOrg[]> {
  const supabase = getServiceSupabase();

  let query = supabase
    .from('gs_entities')
    .select('gs_id, canonical_name, entity_type, sector, state, lga_name, postcode, is_community_controlled')
    .limit(15);

  // Filter by location (most specific first)
  if (opts.postcode) {
    query = query.eq('postcode', opts.postcode);
  } else if (opts.lga) {
    query = query.eq('lga_name', opts.lga);
  } else if (opts.state) {
    query = query.eq('state', opts.state);
  }

  // Filter by sector
  if (opts.sector) {
    query = query.eq('sector', opts.sector);
  }

  // Prefer community-controlled orgs
  query = query.order('is_community_controlled', { ascending: false });

  const { data, error } = await query;
  if (error || !data) return [];

  return data as LandscapeOrg[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Evidence Matching (ALMA)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function matchEvidence(opts: {
  interventionTypes?: string[];
  issueAreas?: string[];
  keywords?: string[];
}): Promise<AlmaMatch[]> {
  const supabase = getServiceSupabase();

  let query = supabase
    .from('alma_interventions')
    .select('id, name, type, evidence_level, target_cohort, description, cultural_authority')
    .limit(10);

  // Filter by intervention type
  if (opts.interventionTypes && opts.interventionTypes.length > 0) {
    query = query.in('type', opts.interventionTypes);
  }

  // Filter by topic tags if issue areas provided
  if (opts.issueAreas && opts.issueAreas.length > 0) {
    query = query.overlaps('topics', opts.issueAreas);
  }

  // Order by evidence level (strongest first)
  query = query.order('evidence_level', { ascending: false });

  const { data, error } = await query;
  if (error || !data) return [];

  return data as AlmaMatch[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Funding Matching
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function matchFunding(opts: {
  issueAreas?: string[];
  state?: string;
}): Promise<GrantMatch[]> {
  const supabase = getServiceSupabase();

  let query = supabase
    .from('grant_opportunities')
    .select('id, name, description, amount_min, amount_max, deadline, closes_at, provider, categories, focus_areas, url')
    .or('deadline.gte.now(),closes_at.gte.now(),deadline.is.null')
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(10);

  const { data, error } = await query;
  if (error || !data) return [];

  // Client-side relevance filtering (since overlaps on text[] is limited)
  const issueSet = new Set((opts.issueAreas ?? []).map(a => a.toLowerCase()));
  if (issueSet.size === 0) return data as GrantMatch[];

  const scored = (data as GrantMatch[]).map(g => {
    let score = 0;
    for (const cat of g.categories ?? []) {
      if (issueSet.has(cat.toLowerCase())) score += 2;
    }
    for (const fa of g.focus_areas ?? []) {
      if (issueSet.has(fa.toLowerCase())) score += 1;
      // Partial match
      for (const issue of issueSet) {
        if (fa.toLowerCase().includes(issue) || issue.includes(fa.toLowerCase())) score += 0.5;
      }
    }
    return { ...g, _score: score };
  });

  return scored
    .sort((a, b) => b._score - a._score)
    .slice(0, 10)
    .map(({ _score, ...g }) => g);
}

export async function matchFoundations(opts: {
  issueAreas?: string[];
  state?: string;
}): Promise<FoundationMatch[]> {
  const supabase = getServiceSupabase();

  let query = supabase
    .from('foundations')
    .select('id, name, total_giving_annual, thematic_focus, geographic_focus, description, website')
    .not('enriched_at', 'is', null)
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(20);

  const { data, error } = await query;
  if (error || !data) return [];

  // Client-side relevance filtering on thematic_focus array
  const issueSet = new Set((opts.issueAreas ?? []).map(a => a.toLowerCase()));
  if (issueSet.size === 0) return (data as FoundationMatch[]).slice(0, 10);

  const scored = (data as FoundationMatch[]).map(f => {
    let score = 0;
    const focus = (f.thematic_focus ?? []).map(t => t.toLowerCase());
    for (const t of focus) {
      for (const issue of issueSet) {
        if (t.includes(issue) || issue.includes(t)) score += 2;
      }
    }
    // Geographic match
    if (opts.state && f.geographic_focus?.toLowerCase().includes(opts.state.toLowerCase())) {
      score += 1;
    }
    return { ...f, _score: score };
  });

  return scored
    .sort((a, b) => b._score - a._score)
    .slice(0, 10)
    .map(({ _score, ...f }) => f);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Area Profile (Community Snapshot)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getAreaProfile(postcode: string): Promise<AreaProfile | null> {
  const supabase = getServiceSupabase();

  // Get postcode geo data
  const { data: geo } = await supabase
    .from('postcode_geo')
    .select('postcode, locality, state, lga_name, remoteness_2021')
    .eq('postcode', postcode)
    .limit(1)
    .maybeSingle();

  if (!geo) return null;

  // Get SEIFA data
  const { data: seifa } = await supabase
    .from('seifa_2021')
    .select('score, decile_national')
    .eq('postcode', postcode)
    .eq('index_type', 'irsd')
    .limit(1)
    .maybeSingle();

  // Get funding summary from materialised view
  const { data: funding } = await supabase
    .from('mv_funding_by_postcode')
    .select('entity_count, total_funding')
    .eq('postcode', postcode)
    .limit(1)
    .maybeSingle();

  return {
    postcode: geo.postcode,
    locality: geo.locality,
    state: geo.state,
    lga_name: geo.lga_name,
    remoteness: geo.remoteness_2021,
    seifa_score: seifa?.score ?? null,
    seifa_decile: seifa?.decile_national ?? null,
    entity_count: funding?.entity_count ?? 0,
    total_funding: funding?.total_funding ?? 0,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Entity Type Recommendation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface EntityTypeFactors {
  wantsGrantAccess?: boolean;
  wantsToTrade?: boolean;
  wantsDGR?: boolean;
  culturalGovernanceImportant?: boolean;
  speedToLaunch?: boolean;
  independence?: boolean;
  founderIsIndigenous?: boolean;
}

const ENTITY_TYPES = [
  {
    type: 'charity',
    label: 'Registered Charity (ACNC)',
    weights: { wantsGrantAccess: 3, wantsToTrade: 1, wantsDGR: 3, culturalGovernanceImportant: 1, speedToLaunch: 1, independence: 1, founderIsIndigenous: 1 },
    pros: ['Full grant access', 'DGR status for tax-deductible donations', 'Public trust and credibility', 'Access to philanthropy'],
    cons: ['Governance overhead (board, reporting)', '3-6 months to register', 'Cannot distribute profits', 'ACNC compliance requirements'],
  },
  {
    type: 'social_enterprise',
    label: 'Social Enterprise',
    weights: { wantsGrantAccess: 1, wantsToTrade: 3, wantsDGR: 0, culturalGovernanceImportant: 1, speedToLaunch: 2, independence: 2, founderIsIndigenous: 1 },
    pros: ['Can trade and earn revenue', 'Flexible structure', 'B-Corp certification available', 'Social mission baked in'],
    cons: ['Limited grant access', 'No DGR status', 'Harder to attract donations', 'Less formal recognition'],
  },
  {
    type: 'pty',
    label: 'Company (PTY LTD)',
    weights: { wantsGrantAccess: 0, wantsToTrade: 3, wantsDGR: 0, culturalGovernanceImportant: 0, speedToLaunch: 3, independence: 3, founderIsIndigenous: 0 },
    pros: ['Fastest to register (1-2 days)', 'Full control', 'Can pivot freely', 'Contract and trade immediately'],
    cons: ['No grant access', 'No DGR', 'No charity tax concessions', 'Social mission not legally protected'],
  },
  {
    type: 'indigenous_corp',
    label: 'Indigenous Corporation (ORIC)',
    weights: { wantsGrantAccess: 3, wantsToTrade: 1, wantsDGR: 2, culturalGovernanceImportant: 3, speedToLaunch: 1, independence: 2, founderIsIndigenous: 3 },
    pros: ['Cultural governance built in', 'Strong grant access for Indigenous programs', 'Community ownership model', 'ORIC support and training'],
    cons: ['ORIC reporting requirements', 'Must have Indigenous membership majority', 'Longer setup process', 'Specific compliance framework'],
  },
  {
    type: 'coop',
    label: 'Co-operative',
    weights: { wantsGrantAccess: 1, wantsToTrade: 2, wantsDGR: 0, culturalGovernanceImportant: 1, speedToLaunch: 1, independence: 2, founderIsIndigenous: 1 },
    pros: ['Democratic member ownership', 'Can trade and distribute to members', 'Community governance', 'Growing support ecosystem'],
    cons: ['Complex to set up', 'Limited grant access', 'Requires multiple members', 'Less common in social sector'],
  },
];

export function recommendEntityType(factors: EntityTypeFactors): EntityTypeScore[] {
  return ENTITY_TYPES.map(et => {
    let score = 0;
    for (const [key, weight] of Object.entries(et.weights)) {
      if (factors[key as keyof EntityTypeFactors]) {
        score += weight;
      }
    }
    return {
      type: et.type,
      label: et.label,
      score,
      pros: et.pros,
      cons: et.cons,
    };
  }).sort((a, b) => b.score - a.score);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Full Intelligence Fetch (parallel)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getIntakeIntelligence(opts: {
  issueAreas?: string[];
  state?: string;
  postcode?: string;
  lga?: string;
  interventionTypes?: string[];
  entityFactors?: EntityTypeFactors;
}): Promise<IntakeIntelligence> {
  const [landscape, evidence, grants, foundations, areaProfile] = await Promise.all([
    matchLandscape({
      state: opts.state,
      lga: opts.lga,
      postcode: opts.postcode,
      issueAreas: opts.issueAreas,
    }),
    matchEvidence({
      interventionTypes: opts.interventionTypes,
      issueAreas: opts.issueAreas,
    }),
    matchFunding({
      issueAreas: opts.issueAreas,
      state: opts.state,
    }),
    matchFoundations({
      issueAreas: opts.issueAreas,
      state: opts.state,
    }),
    opts.postcode ? getAreaProfile(opts.postcode) : Promise.resolve(null),
  ]);

  const entityTypes = recommendEntityType(opts.entityFactors ?? {});

  return { landscape, evidence, grants, foundations, areaProfile, entityTypes };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Formatting helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function formatMoney(n: number | null): string {
  if (!n) return 'Unknown';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

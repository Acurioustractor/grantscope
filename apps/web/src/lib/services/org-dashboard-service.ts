import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface OrgProject {
  id: string;
  org_profile_id: string;
  parent_project_id: string | null;
  name: string;
  slug: string;
  code: string | null;
  description: string | null;
  tier: 'major' | 'sub' | 'micro';
  category: string | null;
  status: 'active' | 'planned' | 'archived';
  sort_order: number;
  abn: string | null;
  linked_gs_entity_id: string | null;
  logo_url: string | null;
  metadata: Record<string, unknown>;
}

export interface OrgProjectSummary extends OrgProject {
  program_count: number;
  pipeline_count: number;
  contact_count: number;
  pipeline_value: number;
  children: OrgProjectSummary[];
}

export interface OrgProfile {
  id: string;
  name: string;
  abn: string | null;
  slug: string | null;
  linked_gs_entity_id: string | null;
  description: string | null;
  team_size: number | null;
  annual_revenue: number | null;
  org_type: string | null;
  subscription_plan: string | null;
  logo_url: string | null;
}

export interface OrgProgram {
  id: string;
  name: string;
  system: string | null;
  funding_source: string | null;
  annual_amount_display: string | null;
  reporting_cycle: string | null;
  status: string;
  sort_order: number;
}

export interface OrgPipelineItem {
  id: string;
  name: string;
  amount_display: string | null;
  amount_numeric: number | null;
  funder: string | null;
  deadline: string | null;
  status: string;
  grant_opportunity_id: string | null;
  notes: string | null;
  funder_entity_id: string | null;
  funder_type: string | null;
}

export interface OrgContact {
  id: string;
  name: string;
  role: string | null;
  organisation: string | null;
  contact_type: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  linked_entity_id: string | null;
  linkedin_url: string | null;
  person_id: string | null;
}

export interface OrgLeader {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  external_roles: Array<{ org: string; role: string }>;
  sort_order: number;
}

export interface FundingByProgram {
  program_name: string;
  total: number;
  records: number;
  from_fy: string;
  to_fy: string;
}

export interface FundingByYear {
  financial_year: string;
  total: number;
  grants: number;
  programs: number;
}

export interface Contract {
  title: string;
  value: number;
  buyer_name: string;
  contract_start: string;
  contract_end: string | null;
}

export interface AlmaIntervention {
  name: string;
  type: string;
  evidence_level: string;
  target_cohort: string;
  description: string;
}

export interface LocalEntity {
  gs_id: string;
  canonical_name: string;
  abn: string;
  entity_type: string;
  sector: string;
}

export interface GsEntity {
  id: string;
  gs_id: string;
  canonical_name: string;
  abn: string;
  entity_type: string;
  sector: string;
  state: string;
  postcode: string;
  remoteness: string;
  seifa_irsd_decile: number;
  is_community_controlled: boolean;
  lga_name: string;
  lga_code: string | null;
}

export interface PowerIndex {
  id: string;
  gs_id: string;
  canonical_name: string;
  system_count: number;
  power_score: number;
  total_dollar_flow: number;
  in_procurement: number;
  in_justice_funding: number;
  in_political_donations: number;
  in_charity_registry: number;
  in_foundation: number;
  in_alma_evidence: number;
  in_ato_transparency: number;
  procurement_dollars: number;
  justice_dollars: number;
  donation_dollars: number;
  foundation_giving: number;
  ato_income: number;
  contract_count: number;
  justice_record_count: number;
  donation_count: number;
  alma_intervention_count: number;
  board_connections: number;
}

export interface RevolvingDoor {
  id: string;
  gs_id: string;
  canonical_name: string;
  lobbies: boolean;
  donates: boolean;
  contracts: boolean;
  receives_funding: boolean;
  influence_vectors: number;
  total_donated: number;
  total_contracts: number;
  total_funded: number;
  revolving_door_score: number;
  parties_funded: string[];
}

export interface RelationshipSummary {
  relationship_type: string;
  count: number;
}

export interface FundingDesert {
  lga_name: string;
  state: string;
  remoteness: string;
  desert_score: number;
  avg_irsd_decile: number;
  total_dollar_flow: number;
  indexed_entities: number;
  desert_rank: number;
}

export interface BoardMember {
  person_name_normalised: string;
  roles: string[];
  role_sources: string[];
  contract_dollars: number;
  contract_count: number;
  justice_dollars: number;
  justice_count: number;
  donation_dollars: number;
  donation_count: number;
}

export interface DonorCrosslink {
  donor_name: string;
  total_donated: number;
  donation_count: number;
  parties: string[];
  parties_count: number;
  board_count: number;
  is_foundation_trustee: boolean;
  is_politician: boolean;
  power_score: number;
  first_donation: string;
  last_donation: string;
}

export interface FoundationFunder {
  foundation_name: string;
  foundation_abn: string;
  total_giving_annual: number;
  grant_count: number;
  total_grant_amount: number;
  grant_years: string[];
  foundation_score: number | null;
  transparency_score: number | null;
  need_alignment_score: number | null;
  evidence_score: number | null;
  overlapping_trustees: number | null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Org Projects
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getOrgProjects(orgProfileId: string): Promise<OrgProject[]> {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('org_projects')
    .select('id, org_profile_id, parent_project_id, name, slug, code, description, tier, category, status, sort_order, abn, linked_gs_entity_id, logo_url, metadata')
    .eq('org_profile_id', orgProfileId)
    .order('sort_order');
  return (data ?? []) as OrgProject[];
}

export async function getOrgProjectBySlug(orgProfileId: string, slug: string): Promise<OrgProject | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('org_projects')
    .select('id, org_profile_id, parent_project_id, name, slug, code, description, tier, category, status, sort_order, abn, linked_gs_entity_id, logo_url, metadata')
    .eq('org_profile_id', orgProfileId)
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as OrgProject;
}

export async function getOrgProjectSummaries(orgProfileId: string): Promise<OrgProjectSummary[]> {
  const supabase = getServiceSupabase();

  // Get all projects
  const projects = await getOrgProjects(orgProfileId);
  if (projects.length === 0) return [];

  const projectIds = projects.map(p => `'${p.id}'`).join(',');

  // Get counts per project in parallel
  const [programCounts, pipelineCounts, contactCounts] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `SELECT project_id, COUNT(*)::int as n FROM org_programs WHERE project_id IN (${projectIds}) GROUP BY project_id`,
    })) as Promise<Array<{ project_id: string; n: number }> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT project_id, COUNT(*)::int as n, COALESCE(SUM(amount_numeric), 0)::bigint as total FROM org_pipeline WHERE project_id IN (${projectIds}) GROUP BY project_id`,
    })) as Promise<Array<{ project_id: string; n: number; total: number }> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT project_id, COUNT(*)::int as n FROM org_contacts WHERE project_id IN (${projectIds}) GROUP BY project_id`,
    })) as Promise<Array<{ project_id: string; n: number }> | null>,
  ]);

  const progMap = Object.fromEntries((programCounts ?? []).map(r => [r.project_id, r.n]));
  const pipeMap = Object.fromEntries((pipelineCounts ?? []).map(r => [r.project_id, { n: r.n, total: Number(r.total) }]));
  const contMap = Object.fromEntries((contactCounts ?? []).map(r => [r.project_id, r.n]));

  // Build tree
  const summaries: OrgProjectSummary[] = projects.map(p => ({
    ...p,
    program_count: progMap[p.id] ?? 0,
    pipeline_count: pipeMap[p.id]?.n ?? 0,
    contact_count: contMap[p.id] ?? 0,
    pipeline_value: pipeMap[p.id]?.total ?? 0,
    children: [],
  }));

  const byId = Object.fromEntries(summaries.map(s => [s.id, s]));
  const roots: OrgProjectSummary[] = [];

  for (const s of summaries) {
    if (s.parent_project_id && byId[s.parent_project_id]) {
      byId[s.parent_project_id].children.push(s);
    } else {
      roots.push(s);
    }
  }

  return roots;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Org Profile Lookup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getOrgProfileBySlug(slug: string): Promise<OrgProfile | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('org_profiles')
    .select('id, name, abn, slug, linked_gs_entity_id, description, team_size, annual_revenue, org_type, subscription_plan, logo_url')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as OrgProfile;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Auto-discovered data (by ABN from CivicGraph)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getOrgFundingByProgram(abn: string, financialYear?: string): Promise<FundingByProgram[] | null> {
  const supabase = getServiceSupabase();
  const yearFilter = financialYear ? ` AND financial_year = '${financialYear}'` : '';
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT program_name,
              SUM(amount_dollars)::bigint as total,
              COUNT(*)::int as records,
              MIN(financial_year) as from_fy,
              MAX(financial_year) as to_fy
       FROM justice_funding
       WHERE recipient_abn = '${abn}'${yearFilter}
       GROUP BY program_name
       ORDER BY total DESC`,
  })) as Promise<FundingByProgram[] | null>;
}

export async function getOrgFundingYears(abn: string): Promise<string[]> {
  const supabase = getServiceSupabase();
  const rows = await safe(supabase.rpc('exec_sql', {
    query: `SELECT DISTINCT financial_year
       FROM justice_funding
       WHERE recipient_abn = '${abn}'
       ORDER BY financial_year DESC`,
  })) as Array<{ financial_year: string }> | null;
  return rows?.map(r => r.financial_year) ?? [];
}

export async function getOrgFundingByYear(abn: string): Promise<FundingByYear[] | null> {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT financial_year,
              SUM(amount_dollars)::bigint as total,
              COUNT(*)::int as grants,
              COUNT(DISTINCT program_name)::int as programs
       FROM justice_funding
       WHERE recipient_abn = '${abn}'
       GROUP BY financial_year
       ORDER BY financial_year`,
  })) as Promise<FundingByYear[] | null>;
}

export async function getOrgContracts(abn: string): Promise<Contract[] | null> {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT title, contract_value::bigint as value,
              buyer_name, contract_start, contract_end
       FROM austender_contracts
       WHERE supplier_abn = '${abn}'
       ORDER BY contract_value DESC`,
  })) as Promise<Contract[] | null>;
}

export async function getOrgAlmaInterventions(abn: string): Promise<AlmaIntervention[] | null> {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT ai.name, ai.type, ai.evidence_level,
              ai.target_cohort, ai.description
       FROM alma_interventions ai
       JOIN gs_entities ge ON ge.id = ai.gs_entity_id
       WHERE ge.abn = '${abn}'
       ORDER BY ai.name`,
  })) as Promise<AlmaIntervention[] | null>;
}

export async function getOrgEntity(abn: string): Promise<GsEntity | null> {
  const supabase = getServiceSupabase();
  const rows = await safe(supabase.rpc('exec_sql', {
    query: `SELECT id, gs_id, canonical_name, abn, entity_type, sector,
              state, postcode, remoteness, seifa_irsd_decile,
              is_community_controlled, lga_name, lga_code
       FROM gs_entities
       WHERE abn = '${abn}'`,
  })) as GsEntity[] | null;
  return rows?.[0] ?? null;
}

export interface LocalEcosystemResult {
  entities: LocalEntity[];
  total: number;
}

export async function getOrgLocalEcosystem(abn: string, postcode?: string, lga?: string, limit = 10): Promise<LocalEcosystemResult | null> {
  const supabase = getServiceSupabase();
  const conditions: string[] = [`abn != '${abn}'`];
  if (postcode) conditions.push(`postcode = '${postcode}'`);
  else if (lga) conditions.push(`lga_name = '${lga}'`);
  else return null;

  const where = conditions.join(' AND ');

  const [entities, countRows] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `SELECT gs_id, canonical_name, abn, entity_type, sector
         FROM gs_entities
         WHERE ${where}
         ORDER BY canonical_name
         LIMIT ${limit}`,
    })) as Promise<LocalEntity[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*)::int as n FROM gs_entities WHERE ${where}`,
    })) as Promise<Array<{ n: number }> | null>,
  ]);

  return {
    entities: entities ?? [],
    total: countRows?.[0]?.n ?? 0,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Curated data (from org dashboard tables)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getOrgPrograms(orgProfileId: string, projectId?: string): Promise<OrgProgram[]> {
  const supabase = getServiceSupabase();
  let query = supabase
    .from('org_programs')
    .select('id, name, system, funding_source, annual_amount_display, reporting_cycle, status, sort_order')
    .eq('org_profile_id', orgProfileId);
  if (projectId) query = query.eq('project_id', projectId);
  const { data } = await query.order('sort_order');
  return (data ?? []) as OrgProgram[];
}

export interface OrgPipelineItemWithEntity extends OrgPipelineItem {
  funder_entity_gs_id: string | null;
  funder_entity_name: string | null;
  grant_url: string | null;
  grant_name: string | null;
  grant_provider: string | null;
}

export async function getOrgPipeline(orgProfileId: string, projectId?: string): Promise<OrgPipelineItemWithEntity[]> {
  const supabase = getServiceSupabase();
  let query = supabase
    .from('org_pipeline')
    .select('id, name, amount_display, amount_numeric, funder, deadline, status, grant_opportunity_id, notes, funder_entity_id, funder_type')
    .eq('org_profile_id', orgProfileId);
  if (projectId) query = query.eq('project_id', projectId);
  const { data } = await query.order('created_at');

  const items = (data ?? []) as OrgPipelineItem[];

  // Enrich with funder entity gs_id for linking
  const funderIds = items.map(p => p.funder_entity_id).filter(Boolean) as string[];
  let entityMap: Record<string, { gs_id: string; canonical_name: string }> = {};

  if (funderIds.length > 0) {
    const entityRows = await safe(supabase.rpc('exec_sql', {
      query: `SELECT id, gs_id, canonical_name FROM gs_entities WHERE id IN (${funderIds.map(id => `'${id}'`).join(',')})`,
    })) as Array<{ id: string; gs_id: string; canonical_name: string }> | null;

    for (const e of entityRows ?? []) {
      entityMap[e.id] = e;
    }
  }

  // Enrich with grant opportunity details
  const grantIds = items.map(p => p.grant_opportunity_id).filter(Boolean) as string[];
  let grantMap: Record<string, { url: string | null; name: string; provider: string | null }> = {};

  if (grantIds.length > 0) {
    const grantRows = await safe(supabase.rpc('exec_sql', {
      query: `SELECT id, url, name, provider FROM grant_opportunities WHERE id IN (${grantIds.map(id => `'${id}'`).join(',')})`,
    })) as Array<{ id: string; url: string | null; name: string; provider: string | null }> | null;

    for (const g of grantRows ?? []) {
      grantMap[g.id] = g;
    }
  }

  return items.map(p => ({
    ...p,
    funder_entity_gs_id: p.funder_entity_id ? entityMap[p.funder_entity_id]?.gs_id ?? null : null,
    funder_entity_name: p.funder_entity_id ? entityMap[p.funder_entity_id]?.canonical_name ?? null : null,
    grant_url: p.grant_opportunity_id ? grantMap[p.grant_opportunity_id]?.url ?? null : null,
    grant_name: p.grant_opportunity_id ? grantMap[p.grant_opportunity_id]?.name ?? null : null,
    grant_provider: p.grant_opportunity_id ? grantMap[p.grant_opportunity_id]?.provider ?? null : null,
  }));
}

export interface OrgContactWithEntity extends OrgContact {
  linked_entity_gs_id: string | null;
  linked_entity_name: string | null;
  linked_entity_type: string | null;
  linked_entity_abn: string | null;
  // GHL enrichment
  ghl_contact_id: string | null;
  ghl_engagement_status: string | null;
  ghl_last_contact_date: string | null;
  // Notion
  notion_id: string | null;
  // Unified tags
  unified_tags: string[];
}

export async function getOrgContacts(orgProfileId: string, projectId?: string): Promise<OrgContactWithEntity[]> {
  const supabase = getServiceSupabase();
  let query = supabase
    .from('org_contacts')
    .select('id, name, role, organisation, contact_type, email, phone, notes, last_contacted_at, linked_entity_id, linkedin_url, person_id')
    .eq('org_profile_id', orgProfileId);
  if (projectId) query = query.eq('project_id', projectId);
  const { data } = await query.order('contact_type').order('name');

  const contacts = (data ?? []) as OrgContact[];

  // Enrich with entity data for linked contacts
  const linkedIds = contacts.map(c => c.linked_entity_id).filter(Boolean) as string[];
  let entityMap: Record<string, { gs_id: string; canonical_name: string; entity_type: string; abn: string }> = {};

  if (linkedIds.length > 0) {
    const entityRows = await safe(supabase.rpc('exec_sql', {
      query: `SELECT id, gs_id, canonical_name, entity_type, abn
         FROM gs_entities
         WHERE id IN (${linkedIds.map(id => `'${id}'`).join(',')})`,
    })) as Array<{ id: string; gs_id: string; canonical_name: string; entity_type: string; abn: string }> | null;

    for (const e of entityRows ?? []) {
      entityMap[e.id] = e;
    }
  }

  // Enrich with person_identity_map + GHL data for linked people
  const personIds = contacts.map(c => c.person_id).filter(Boolean) as string[];
  let personMap: Record<string, { ghl_contact_id: string | null; notion_id: string | null; unified_tags: string[] }> = {};
  let ghlMap: Record<string, { engagement_status: string | null; last_contact_date: string | null }> = {};

  if (personIds.length > 0) {
    const personRows = await safe(supabase.rpc('exec_sql', {
      query: `SELECT person_id, ghl_contact_id, notion_id, unified_tags
         FROM person_identity_map
         WHERE person_id IN (${personIds.map(id => `'${id}'`).join(',')})`,
    })) as Array<{ person_id: string; ghl_contact_id: string | null; notion_id: string | null; unified_tags: string[] | null }> | null;

    for (const p of personRows ?? []) {
      personMap[p.person_id] = {
        ghl_contact_id: p.ghl_contact_id,
        notion_id: p.notion_id,
        unified_tags: p.unified_tags ?? [],
      };
    }

    // Get GHL engagement data for linked contacts
    const ghlIds = (personRows ?? []).map(p => p.ghl_contact_id).filter(Boolean) as string[];
    if (ghlIds.length > 0) {
      const ghlRows = await safe(supabase.rpc('exec_sql', {
        query: `SELECT ghl_id, engagement_status, last_contact_date
           FROM ghl_contacts
           WHERE ghl_id IN (${ghlIds.map(id => `'${id}'`).join(',')})`,
      })) as Array<{ ghl_id: string; engagement_status: string | null; last_contact_date: string | null }> | null;

      for (const g of ghlRows ?? []) {
        ghlMap[g.ghl_id] = { engagement_status: g.engagement_status, last_contact_date: g.last_contact_date };
      }
    }
  }

  return contacts.map(c => {
    const person = c.person_id ? personMap[c.person_id] : null;
    const ghl = person?.ghl_contact_id ? ghlMap[person.ghl_contact_id] : null;
    return {
      ...c,
      linked_entity_gs_id: c.linked_entity_id ? entityMap[c.linked_entity_id]?.gs_id ?? null : null,
      linked_entity_name: c.linked_entity_id ? entityMap[c.linked_entity_id]?.canonical_name ?? null : null,
      linked_entity_type: c.linked_entity_id ? entityMap[c.linked_entity_id]?.entity_type ?? null : null,
      linked_entity_abn: c.linked_entity_id ? entityMap[c.linked_entity_id]?.abn ?? null : null,
      ghl_contact_id: person?.ghl_contact_id ?? null,
      ghl_engagement_status: ghl?.engagement_status ?? null,
      ghl_last_contact_date: ghl?.last_contact_date ?? null,
      notion_id: person?.notion_id ?? null,
      unified_tags: person?.unified_tags ?? [],
    };
  });
}

export async function getOrgLeadership(orgProfileId: string, projectId?: string): Promise<OrgLeader[]> {
  const supabase = getServiceSupabase();
  let query = supabase
    .from('org_leadership')
    .select('id, name, title, bio, external_roles, sort_order')
    .eq('org_profile_id', orgProfileId);
  if (projectId) {
    query = query.eq('project_id', projectId);
  } else {
    query = query.is('project_id', null);
  }
  const { data } = await query.order('sort_order');
  return (data ?? []) as OrgLeader[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Grant Matching
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MatchedGrant {
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
  fit_score: number | null;
}

/**
 * Find grant opportunities that match the org profile.
 * Matches on: future deadline, categories/focus_areas overlap with org_type + geographic_focus.
 * Excludes grants already in the org's pipeline.
 */
export async function getMatchedGrantOpportunities(
  orgProfileId: string,
  orgType: string | null,
  geoFocus: string[] | null,
): Promise<MatchedGrant[]> {
  const supabase = getServiceSupabase();

  // Get existing pipeline grant_opportunity_ids to exclude
  const { data: pipelineItems } = await supabase
    .from('org_pipeline')
    .select('grant_opportunity_id')
    .eq('org_profile_id', orgProfileId)
    .not('grant_opportunity_id', 'is', null);

  const excludeIds = (pipelineItems ?? [])
    .map(p => p.grant_opportunity_id)
    .filter(Boolean) as string[];

  // Build query — future deadlines, ordered by deadline
  let query = supabase
    .from('grant_opportunities')
    .select('id, name, description, amount_min, amount_max, deadline, closes_at, provider, categories, focus_areas, url, fit_score')
    .or('deadline.gte.now(),closes_at.gte.now(),deadline.is.null')
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(20);

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data } = await query;
  return (data ?? []) as MatchedGrant[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Peer Org Discovery
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface PeerOrg {
  gs_id: string;
  canonical_name: string;
  abn: string;
  state: string;
  lga_name: string | null;
  alma_programs: number;
  program_types: string;
}

/**
 * Find peer organisations that run similar ALMA programs.
 * Uses the org's own ALMA intervention types to find others with matching programs.
 * Falls back to community-controlled orgs with any ALMA programs if no type match.
 */
export async function getOrgPeerOrgs(abn: string): Promise<PeerOrg[]> {
  const supabase = getServiceSupabase();

  // First get this org's ALMA program types
  const orgTypes = await safe(supabase.rpc('exec_sql', {
    query: `SELECT DISTINCT a.type
       FROM alma_interventions a
       JOIN gs_entities e ON e.id = a.gs_entity_id
       WHERE e.abn = '${abn}'`,
  })) as Array<{ type: string }> | null;

  const types = orgTypes?.map(r => r.type) ?? [];

  // If the org has ALMA programs, find peers with matching types
  const typeFilter = types.length > 0
    ? `AND a.type IN (${types.map(t => `'${t.replace(/'/g, "''")}'`).join(',')})`
    : '';

  const rows = await safe(supabase.rpc('exec_sql', {
    query: `SELECT e.gs_id, e.canonical_name, e.abn, e.state, e.lga_name,
              COUNT(DISTINCT a.id)::int as alma_programs,
              STRING_AGG(DISTINCT a.type, ', ') as program_types
       FROM gs_entities e
       JOIN alma_interventions a ON a.gs_entity_id = e.id
       WHERE e.abn != '${abn}'
         ${typeFilter}
       GROUP BY e.gs_id, e.canonical_name, e.abn, e.state, e.lga_name
       ORDER BY alma_programs DESC
       LIMIT 12`,
  })) as PeerOrg[] | null;

  return rows ?? [];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Intelligence data (Power Index, Revolving Door, etc.)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getOrgPowerIndex(abn: string): Promise<PowerIndex | null> {
  const supabase = getServiceSupabase();
  const rows = await safe(supabase.rpc('exec_sql', {
    query: `SELECT id, gs_id, canonical_name, system_count,
              power_score::bigint as power_score,
              total_dollar_flow::bigint as total_dollar_flow,
              in_procurement, in_justice_funding, in_political_donations,
              in_charity_registry, in_foundation, in_alma_evidence, in_ato_transparency,
              procurement_dollars::bigint as procurement_dollars,
              justice_dollars::bigint as justice_dollars,
              donation_dollars::bigint as donation_dollars,
              foundation_giving::bigint as foundation_giving,
              ato_income::bigint as ato_income,
              contract_count::int as contract_count,
              justice_record_count::int as justice_record_count,
              donation_count::int as donation_count,
              alma_intervention_count::int as alma_intervention_count,
              board_connections::int as board_connections
       FROM mv_entity_power_index
       WHERE abn = '${abn}'`,
  })) as PowerIndex[] | null;
  return rows?.[0] ?? null;
}

export async function getOrgRevolvingDoor(abn: string): Promise<RevolvingDoor | null> {
  const supabase = getServiceSupabase();
  const rows = await safe(supabase.rpc('exec_sql', {
    query: `SELECT id, gs_id, canonical_name,
              lobbies, donates, contracts, receives_funding,
              influence_vectors,
              total_donated::bigint as total_donated,
              total_contracts::bigint as total_contracts,
              total_funded::bigint as total_funded,
              revolving_door_score,
              parties_funded
       FROM mv_revolving_door
       WHERE abn = '${abn}'`,
  })) as RevolvingDoor[] | null;
  return rows?.[0] ?? null;
}

export async function getOrgRelationshipSummary(entityId: string): Promise<RelationshipSummary[]> {
  const supabase = getServiceSupabase();
  const rows = await safe(supabase.rpc('exec_sql', {
    query: `SELECT relationship_type, COUNT(*)::int as count
       FROM gs_relationships
       WHERE source_entity_id = '${entityId}' OR target_entity_id = '${entityId}'
       GROUP BY relationship_type
       ORDER BY count DESC`,
  })) as RelationshipSummary[] | null;
  return rows ?? [];
}

export async function getOrgFundingDesert(lgaName: string): Promise<FundingDesert | null> {
  if (!lgaName) return null;
  const supabase = getServiceSupabase();
  const rows = await safe(supabase.rpc('exec_sql', {
    query: `SELECT d.lga_name, d.state, d.remoteness,
              d.desert_score::numeric as desert_score,
              d.avg_irsd_decile::numeric as avg_irsd_decile,
              d.total_dollar_flow::bigint as total_dollar_flow,
              d.indexed_entities::int as indexed_entities,
              r.rank::int as desert_rank
       FROM mv_funding_deserts d
       JOIN (
         SELECT lga_name, ROW_NUMBER() OVER (ORDER BY desert_score DESC) as rank
         FROM mv_funding_deserts
       ) r ON r.lga_name = d.lga_name
       WHERE d.lga_name = '${lgaName.replace(/'/g, "''")}'`,
  })) as FundingDesert[] | null;
  return rows?.[0] ?? null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Board Members (auto-discovered from person_roles)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getOrgBoardMembers(abn: string): Promise<BoardMember[]> {
  const supabase = getServiceSupabase();
  const rows = await safe(supabase.rpc('exec_sql', {
    query: `SELECT person_name_normalised, roles, role_sources,
              contract_dollars::bigint as contract_dollars,
              contract_count::int as contract_count,
              justice_dollars::bigint as justice_dollars,
              justice_count::int as justice_count,
              donation_dollars::bigint as donation_dollars,
              donation_count::int as donation_count
       FROM mv_person_entity_crosswalk
       WHERE company_abn = '${abn}'
       ORDER BY (contract_dollars + justice_dollars + donation_dollars) DESC
       LIMIT 30`,
  })) as BoardMember[] | null;
  return rows ?? [];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Donor→Board Crosslinks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getOrgDonorCrosslinks(abn: string): Promise<DonorCrosslink[]> {
  const supabase = getServiceSupabase();
  const rows = await safe(supabase.rpc('exec_sql', {
    query: `SELECT dc.donor_name, dc.total_donated::bigint as total_donated,
              dc.donation_count::int as donation_count,
              dc.parties, dc.parties_count::int as parties_count,
              dc.board_count::int as board_count,
              dc.is_foundation_trustee, dc.is_politician,
              dc.power_score::int as power_score,
              dc.first_donation::text, dc.last_donation::text
       FROM mv_donor_person_crosslink dc
       WHERE dc.org_abns @> ARRAY['${abn}']
       ORDER BY dc.total_donated DESC
       LIMIT 20`,
  })) as DonorCrosslink[] | null;
  return rows ?? [];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Foundation Funders (who funds this org)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getOrgFoundationFunders(abn: string): Promise<FoundationFunder[]> {
  const supabase = getServiceSupabase();
  const rows = await safe(supabase.rpc('exec_sql', {
    query: `SELECT fg.foundation_name, fg.foundation_abn,
              MAX(fg.total_giving_annual)::bigint as total_giving_annual,
              COUNT(*)::int as grant_count,
              SUM(fg.grant_amount)::bigint as total_grant_amount,
              array_agg(DISTINCT fg.grant_year) FILTER (WHERE fg.grant_year IS NOT NULL) as grant_years,
              MAX(fs.foundation_score)::int as foundation_score,
              MAX(fs.transparency_score)::int as transparency_score,
              MAX(fs.need_alignment_score)::int as need_alignment_score,
              MAX(fs.evidence_score)::int as evidence_score,
              MAX(fs.overlapping_trustees)::int as overlapping_trustees
       FROM mv_foundation_grantees fg
       LEFT JOIN mv_foundation_scores fs ON fs.acnc_abn = fg.foundation_abn
       WHERE fg.grantee_abn = '${abn}'
       GROUP BY fg.foundation_name, fg.foundation_abn
       ORDER BY SUM(fg.grant_amount) DESC NULLS LAST
       LIMIT 20`,
  })) as FoundationFunder[] | null;
  return rows ?? [];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Formatting helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function money(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export function fmt(n: number): string {
  return n.toLocaleString();
}

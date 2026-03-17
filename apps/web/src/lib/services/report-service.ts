import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

type Topic = 'youth-justice' | 'child-protection' | 'ndis' | 'family-services' | 'indigenous' | 'legal-services' | 'diversion' | 'prevention';

function topicFilter(topic: Topic): string {
  return `topics @> ARRAY['${topic}']::text[]`;
}

/**
 * Funding by state for a topic from justice_funding
 */
export async function getFundingByState(topic: Topic) {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT state,
              COUNT(*)::int as grants,
              SUM(amount_dollars)::bigint as total,
              COUNT(DISTINCT recipient_name)::int as orgs
       FROM justice_funding
       WHERE ${topicFilter(topic)}
       GROUP BY state
       ORDER BY total DESC`,
  })) as Promise<Array<{ state: string; grants: number; total: number; orgs: number }> | null>;
}

/**
 * Top funded programs for a topic
 */
export async function getTopPrograms(topic: Topic, limit = 15) {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT program_name, state,
              COUNT(*)::int as grants,
              SUM(amount_dollars)::bigint as total
       FROM justice_funding
       WHERE ${topicFilter(topic)}
       GROUP BY program_name, state
       ORDER BY total DESC
       LIMIT ${limit}`,
  })) as Promise<Array<{ program_name: string; state: string; grants: number; total: number }> | null>;
}

/**
 * Top funded organisations for a topic, with entity linking
 */
export async function getTopOrgs(topic: Topic, limit = 25) {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT jf.recipient_name,
              jf.recipient_abn,
              jf.state,
              COUNT(*)::int as grants,
              SUM(jf.amount_dollars)::bigint as total,
              e.gs_id
       FROM justice_funding jf
       LEFT JOIN gs_entities e ON e.abn = jf.recipient_abn AND jf.recipient_abn IS NOT NULL
       WHERE jf.${topicFilter(topic)}
       GROUP BY jf.recipient_name, jf.recipient_abn, jf.state, e.gs_id
       ORDER BY total DESC
       LIMIT ${limit}`,
  })) as Promise<Array<{
    recipient_name: string;
    recipient_abn: string | null;
    state: string | null;
    grants: number;
    total: number;
    gs_id: string | null;
  }> | null>;
}

/**
 * ALMA interventions for a topic
 */
export async function getAlmaInterventions(topic: Topic, limit = 25) {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT name, type, evidence_level, geography, portfolio_score::float
       FROM alma_interventions
       WHERE ${topicFilter(topic)}
       ORDER BY portfolio_score DESC NULLS LAST
       LIMIT ${limit}`,
  })) as Promise<Array<{
    name: string;
    type: string | null;
    evidence_level: string | null;
    geography: string | null;
    portfolio_score: number | null;
  }> | null>;
}

/**
 * ALMA intervention count for a topic
 */
export async function getAlmaCount(topic: Topic): Promise<number> {
  const supabase = getServiceSupabase();
  const data = await safe(supabase.rpc('exec_sql', {
    query: `SELECT COUNT(*)::int as cnt FROM alma_interventions WHERE ${topicFilter(topic)}`,
  }));
  return (data as Array<{ cnt: number }> | null)?.[0]?.cnt ?? 0;
}

/**
 * Austender contracts matching a topic by title keywords
 */
export async function getContractStats(keywords: string[]) {
  const supabase = getServiceSupabase();
  const where = keywords.map(k => `title ILIKE '%${k}%'`).join(' OR ');
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT COUNT(*)::int as contracts,
              SUM(contract_value)::bigint as total_value
       FROM austender_contracts
       WHERE ${where}`,
  })) as Promise<Array<{ contracts: number; total_value: number }> | null>;
}

/**
 * Funding by LGA with SEIFA overlay — uses entity+relationship JOINs
 * with topic-tagged justice_funding for safety
 */
export async function getFundingByLga(topic: Topic, limit = 20) {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT e.lga_name, e.state,
              COUNT(DISTINCT e.gs_id)::int as orgs,
              SUM(jf.amount_dollars)::bigint as total_funding,
              MIN(e.seifa_irsd_decile)::int as seifa_decile
       FROM justice_funding jf
       JOIN gs_entities e ON e.abn = jf.recipient_abn AND jf.recipient_abn IS NOT NULL
       WHERE jf.${topicFilter(topic)}
         AND e.lga_name IS NOT NULL
       GROUP BY e.lga_name, e.state
       ORDER BY total_funding DESC
       LIMIT ${limit}`,
  })) as Promise<Array<{
    lga_name: string;
    state: string;
    orgs: number;
    total_funding: number;
    seifa_decile: number | null;
  }> | null>;
}

/**
 * Cross-system organisations: entities appearing in multiple topics.
 * Uses justice_funding topic tags instead of ILIKE on gs_relationships.
 */
export async function getCrossSystemOrgs(primaryTopic: Topic, crossTopics: Topic[], limit = 20) {
  const supabase = getServiceSupabase();

  // Build CTEs for each topic using justice_funding.topics (indexed, fast)
  const primaryCte = `
    primary_orgs AS (
      SELECT DISTINCT e.id, e.gs_id, e.canonical_name, e.entity_type, e.state
      FROM gs_entities e
      JOIN justice_funding jf ON jf.recipient_abn = e.abn AND e.abn IS NOT NULL
      WHERE jf.${topicFilter(primaryTopic)}
    )`;

  const crossCtes = crossTopics.map((t, i) => `
    cross_${i} AS (
      SELECT DISTINCT e.id
      FROM gs_entities e
      JOIN justice_funding jf ON jf.recipient_abn = e.abn AND e.abn IS NOT NULL
      WHERE jf.${topicFilter(t)}
    )`);

  const topicLabels: Record<string, string> = {
    'child-protection': 'Child Protection',
    'youth-justice': 'Youth Justice',
    'ndis': 'NDIS',
    'family-services': 'Family Services',
    'indigenous': 'Indigenous',
    'legal-services': 'Legal Services',
  };

  const systemArrayParts = crossTopics.map((t, i) =>
    `CASE WHEN c${i}.id IS NOT NULL THEN '${topicLabels[t] || t}' END`
  );

  const crossJoins = crossTopics.map((_, i) =>
    `LEFT JOIN cross_${i} c${i} ON c${i}.id = p.id`
  );

  const crossWhere = crossTopics.map((_, i) => `c${i}.id IS NOT NULL`).join(' OR ');

  const query = `
    WITH ${primaryCte}, ${crossCtes.join(',')}
    , org_systems AS (
      SELECT p.gs_id, p.canonical_name, p.entity_type, p.state,
             ARRAY_REMOVE(ARRAY[
               '${topicLabels[primaryTopic] || primaryTopic}',
               ${systemArrayParts.join(', ')}
             ], NULL) as systems,
             COALESCE(SUM(jf.amount_dollars), 0)::bigint as total_funding
      FROM primary_orgs p
      ${crossJoins.join('\n      ')}
      LEFT JOIN justice_funding jf ON jf.recipient_abn = (
        SELECT abn FROM gs_entities WHERE id = p.id
      )
      WHERE ${crossWhere}
      GROUP BY p.gs_id, p.canonical_name, p.entity_type, p.state,
               ${crossTopics.map((_, i) => `c${i}.id`).join(', ')}
    )
    SELECT * FROM org_systems
    ORDER BY array_length(systems, 1) DESC, total_funding DESC
    LIMIT ${limit}
  `;

  return safe(supabase.rpc('exec_sql', { query })) as Promise<Array<{
    gs_id: string;
    canonical_name: string;
    entity_type: string | null;
    state: string | null;
    systems: string[];
    total_funding: number;
  }> | null>;
}

/**
 * School disadvantage profiles by LGA (for city-level reports)
 */
export async function getSchoolProfiles(lgaNames: string[]) {
  const supabase = getServiceSupabase();
  const lgaList = lgaNames.map(l => `'${l.replace(/'/g, "''")}'`).join(',');
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT lga_name, state,
              COUNT(*)::int as schools,
              ROUND(AVG(icsea_value))::int as avg_icsea,
              COUNT(*) FILTER (WHERE icsea_value < 900)::int as low_icsea,
              ROUND(AVG(indigenous_pct)::numeric, 1)::float as avg_indig_pct,
              ROUND(SUM(total_enrolments))::int as total_students
       FROM acara_schools
       WHERE lga_name IN (${lgaList})
       GROUP BY lga_name, state ORDER BY avg_icsea`,
  })) as Promise<Array<{
    lga_name: string;
    state: string;
    schools: number;
    avg_icsea: number;
    low_icsea: number;
    avg_indig_pct: number;
    total_students: number;
  }> | null>;
}

/**
 * Provider contracts for specific entity UUIDs
 */
export async function getProviderContracts(entityIds: string[], limit = 20) {
  const idList = entityIds.map(id => `'${id}'`).join(',');
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT s.canonical_name as source, t.canonical_name as target,
              r.amount::float, r.year::int, r.dataset, r.relationship_type
       FROM gs_relationships r
       JOIN gs_entities s ON s.id = r.source_entity_id
       JOIN gs_entities t ON t.id = r.target_entity_id
       WHERE (r.target_entity_id IN (${idList})
              OR r.source_entity_id IN (${idList}))
         AND r.amount > 0
       ORDER BY r.amount DESC LIMIT ${limit}`,
  })) as Promise<Array<{
    source: string;
    target: string;
    amount: number;
    year: number;
    dataset: string;
    relationship_type: string;
  }> | null>;
}

/**
 * ROGS time series data for a topic
 */
export async function getRogsTimeSeries(programPrefix: string, states: string[]) {
  const supabase = getServiceSupabase();
  const stateList = states.map(s => `'${s}'`).join(',');
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT state, financial_year, program_name, amount_dollars::bigint as amount
       FROM justice_funding
       WHERE program_name LIKE '${programPrefix}%'
         AND state IN (${stateList})
       ORDER BY state, financial_year, program_name`,
  })) as Promise<Array<{
    state: string;
    financial_year: string;
    program_name: string;
    amount: number;
  }> | null>;
}

/**
 * Youth justice contracts from AusTender (direct query, no gs_relationships JOIN)
 */
export async function getYouthJusticeContracts(limit = 15) {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT buyer_name, supplier_name, contract_value::bigint as amount,
              EXTRACT(YEAR FROM contract_start)::int as year, title
       FROM austender_contracts
       WHERE title ILIKE '%youth%justice%'
          OR title ILIKE '%juvenile%detention%'
          OR title ILIKE '%youth%detention%'
       ORDER BY contract_value DESC
       LIMIT ${limit}`,
  })) as Promise<Array<{
    buyer_name: string;
    supplier_name: string;
    amount: number;
    year: number;
    title: string;
  }> | null>;
}

/**
 * Youth justice grant recipients (non-ROGS, from justice_funding)
 */
export async function getYouthJusticeGrants(limit = 15) {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT recipient_name, state,
              SUM(amount_dollars)::bigint as total,
              COUNT(*)::int as grants
       FROM justice_funding
       WHERE topics @> ARRAY['youth-justice']::text[]
         AND program_name NOT LIKE 'ROGS%'
       GROUP BY recipient_name, state
       ORDER BY total DESC
       LIMIT ${limit}`,
  })) as Promise<Array<{
    recipient_name: string;
    state: string | null;
    total: number;
    grants: number;
  }> | null>;
}

/**
 * NDIS youth justice overlay — participants, budgets, disability types by state
 */
export async function getNdisYouthOverlay() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT state,
              SUM(total_participants)::bigint as ndis_total,
              SUM(youth_participants)::bigint as ndis_youth,
              SUM(psychosocial_participants)::bigint as psychosocial,
              SUM(intellectual_disability_participants)::bigint as intellectual,
              SUM(autism_participants)::bigint as autism,
              SUM(total_annual_budget)::bigint as ndis_budget
       FROM v_ndis_youth_justice_overlay
       WHERE state != 'OT'
       GROUP BY state
       ORDER BY ndis_budget DESC`,
  })) as Promise<Array<{
    state: string;
    ndis_total: number;
    ndis_youth: number;
    psychosocial: number;
    intellectual: number;
    autism: number;
    ndis_budget: number;
  }> | null>;
}

/**
 * DSS welfare payments by state for youth-relevant types
 */
export async function getDssPaymentsByState() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT state, payment_type,
              SUM(recipient_count)::int as recipients
       FROM dss_payment_demographics
       WHERE payment_type IN ('Disability Support Pension','Youth Allowance (other)','JobSeeker Payment')
         AND geography_type = 'state'
         AND state NOT IN ('Unknown')
       GROUP BY state, payment_type
       ORDER BY state, payment_type`,
  })) as Promise<Array<{
    state: string;
    payment_type: string;
    recipients: number;
  }> | null>;
}

/**
 * DSS welfare payments at LGA level — cross-system overlap with school disadvantage
 */
export async function getDssPaymentsByLga(lgaNames: string[]) {
  const supabase = getServiceSupabase();
  const lgaList = lgaNames.map(l => `'${l.replace(/'/g, "''")}'`).join(',');
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT p.lga_name, d.payment_type,
              SUM(d.recipient_count)::int as recipients
       FROM dss_payment_demographics d
       JOIN (SELECT DISTINCT lga_code, lga_name FROM postcode_geo WHERE lga_name IN (${lgaList})) p
         ON p.lga_code = d.geography_code
       WHERE d.geography_type = 'lga'
         AND d.payment_type IN ('Disability Support Pension','Youth Allowance (other)','JobSeeker Payment')
       GROUP BY p.lga_name, d.payment_type
       ORDER BY p.lga_name, d.payment_type`,
  })) as Promise<Array<{
    lga_name: string;
    payment_type: string;
    recipients: number;
  }> | null>;
}

/**
 * Youth justice system indicators by state — detention costs, recidivism, Indigenous overrepresentation
 */
export async function getYouthJusticeIndicators() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT d.state,
              ROUND(d.total_expenditure_m)::int as total_expenditure_m,
              ROUND(d.cost_per_detention)::int as cost_per_day,
              r.recidivism_pct::int as recidivism_pct,
              ROUND(d.indigenous_rate_ratio, 1)::float as indigenous_rate_ratio,
              d.facility_count::int,
              d.total_beds::int,
              ROUND(d.facility_indigenous_pct)::int as detention_indigenous_pct,
              c.actual_rate::float as ctg_detention_rate
       FROM v_youth_justice_state_dashboard d
       LEFT JOIN v_ctg_youth_justice_progress c
         ON c.state = d.state AND c.financial_year = d.financial_year
       LEFT JOIN LATERAL (
         SELECT recidivism_pct FROM v_youth_justice_state_dashboard
         WHERE state = d.state AND recidivism_pct IS NOT NULL
         ORDER BY financial_year DESC LIMIT 1
       ) r ON true
       WHERE d.financial_year = '2023-24'
       ORDER BY d.total_expenditure_m DESC`,
  })) as Promise<Array<{
    state: string;
    total_expenditure_m: number;
    cost_per_day: number;
    recidivism_pct: number | null;
    indigenous_rate_ratio: number | null;
    facility_count: number;
    total_beds: number;
    detention_indigenous_pct: number;
    ctg_detention_rate: number | null;
  }> | null>;
}

/**
 * Crime stats by LGA — total incidents and rates
 */
export async function getCrimeStatsLga(lgaNames: string[]) {
  const supabase = getServiceSupabase();
  const lgaList = lgaNames.map(l => `'${l.replace(/'/g, "''")}'`).join(',');
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT lga_name, state,
              SUM(incidents)::int as total_incidents,
              ROUND(AVG(rate_per_100k))::int as avg_rate_per_100k
       FROM crime_stats_lga
       WHERE lga_name IN (${lgaList})
       GROUP BY lga_name, state
       ORDER BY avg_rate_per_100k DESC`,
  })) as Promise<Array<{
    lga_name: string;
    state: string;
    total_incidents: number;
    avg_rate_per_100k: number;
  }> | null>;
}

/**
 * Cross-system heatmap — all LGAs from pre-computed lga_cross_system_stats
 */
export async function getCrossSystemHeatmap() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT
              lga_name, state, COALESCE(population, 0)::int AS population,
              COALESCE(low_icsea_schools, 0)::int AS low_icsea,
              COALESCE(avg_icsea, 0)::int AS avg_icsea,
              COALESCE(school_count, 0)::int AS schools,
              COALESCE(indigenous_pct, 0)::float AS indigenous_pct,
              CASE WHEN population > 0 THEN ROUND(dsp_recipients::numeric / population * 1000) ELSE 0 END::int AS dsp_rate,
              CASE WHEN population > 0 THEN ROUND(jobseeker_recipients::numeric / population * 1000) ELSE 0 END::int AS jobseeker_rate,
              CASE WHEN population > 0 THEN ROUND(youth_allowance_recipients::numeric / population * 1000) ELSE 0 END::int AS youth_allowance_rate,
              COALESCE(cost_per_detention_day, 0)::int AS cost_per_day,
              recidivism_pct::int AS recidivism_pct,
              COALESCE(indigenous_rate_ratio, 0)::float AS indigenous_rate_ratio,
              COALESCE(detention_indigenous_pct, 0)::int AS detention_indigenous_pct,
              CASE WHEN population > 0 THEN ROUND(ndis_youth_participants::numeric / population * 1000) ELSE 0 END::int AS ndis_rate,
              COALESCE(crime_rate_per_100k, 0)::int AS crime_rate
       FROM lga_cross_system_stats
       WHERE school_count > 0 OR dsp_recipients > 0 OR ndis_youth_participants > 0
       ORDER BY lga_name`,
  })) as Promise<Array<{
    lga_name: string;
    state: string;
    population: number;
    low_icsea: number;
    avg_icsea: number;
    schools: number;
    indigenous_pct: number;
    dsp_rate: number;
    jobseeker_rate: number;
    youth_allowance_rate: number;
    cost_per_day: number;
    recidivism_pct: number | null;
    indigenous_rate_ratio: number;
    detention_indigenous_pct: number;
    ndis_rate: number;
    crime_rate: number;
  }> | null>;
}

/**
 * ALMA intervention count by LGA — for service desert detection
 */
export async function getAlmaByLga(topic: Topic) {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT ge.lga_name, COUNT(*)::int as alma_count
            FROM alma_interventions ai
            JOIN gs_entities ge ON ge.id = ai.gs_entity_id
            WHERE ai.${topicFilter(topic)} AND ge.lga_name IS NOT NULL
            GROUP BY ge.lga_name`,
  })) as Promise<Array<{ lga_name: string; alma_count: number }> | null>;
}

/**
 * Utility: format money
 */
export function money(n: number | null): string {
  if (!n) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

/**
 * Utility: format number with commas
 */
export function fmt(n: number): string {
  return n.toLocaleString('en-AU');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PICC Entity Dashboard Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PICC_ABN = '14640793728';

/**
 * PICC funding by program (recent)
 */
export async function getPiccFundingByProgram() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT program_name,
              SUM(amount_dollars)::bigint as total,
              COUNT(*)::int as records,
              MIN(financial_year) as from_fy,
              MAX(financial_year) as to_fy
       FROM justice_funding
       WHERE recipient_abn = '${PICC_ABN}'
       GROUP BY program_name
       ORDER BY total DESC`,
  })) as Promise<Array<{
    program_name: string;
    total: number;
    records: number;
    from_fy: string;
    to_fy: string;
  }> | null>;
}

/**
 * PICC funding by year (time series)
 */
export async function getPiccFundingByYear() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT financial_year,
              SUM(amount_dollars)::bigint as total,
              COUNT(*)::int as grants,
              COUNT(DISTINCT program_name)::int as programs
       FROM justice_funding
       WHERE recipient_abn = '${PICC_ABN}'
       GROUP BY financial_year
       ORDER BY financial_year`,
  })) as Promise<Array<{
    financial_year: string;
    total: number;
    grants: number;
    programs: number;
  }> | null>;
}

/**
 * PICC contracts from AusTender
 */
export async function getPiccContracts() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT title, contract_value::bigint as value,
              buyer_name, contract_start, contract_end
       FROM austender_contracts
       WHERE supplier_abn = '${PICC_ABN}'
       ORDER BY contract_value DESC`,
  })) as Promise<Array<{
    title: string;
    value: number;
    buyer_name: string;
    contract_start: string;
    contract_end: string | null;
  }> | null>;
}

/**
 * PICC ALMA interventions
 */
export async function getPiccAlmaInterventions() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT ai.name, ai.type, ai.evidence_level,
              ai.target_cohort, ai.description
       FROM alma_interventions ai
       JOIN gs_entities ge ON ge.id = ai.gs_entity_id
       WHERE ge.abn = '${PICC_ABN}'
       ORDER BY ai.name`,
  })) as Promise<Array<{
    name: string;
    type: string;
    evidence_level: string;
    target_cohort: string;
    description: string;
  }> | null>;
}

/**
 * PICC entity details
 */
export async function getPiccEntity() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT gs_id, canonical_name, abn, entity_type, sector,
              state, postcode, remoteness, seifa_irsd_decile,
              is_community_controlled, lga_name
       FROM gs_entities
       WHERE abn = '${PICC_ABN}'`,
  })) as Promise<Array<{
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
  }> | null>;
}

/**
 * Related Palm Island entities
 */
export async function getPalmIslandEntities() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT gs_id, canonical_name, abn, entity_type, sector
       FROM gs_entities
       WHERE (canonical_name ILIKE '%palm island%' OR postcode = '4816')
         AND abn != '${PICC_ABN}'
       ORDER BY canonical_name
       LIMIT 20`,
  })) as Promise<Array<{
    gs_id: string;
    canonical_name: string;
    abn: string;
    entity_type: string;
    sector: string;
  }> | null>;
}

/**
 * PICC leadership from org_leadership table
 */
export async function getPiccLeadership() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT name, title, bio, external_roles, sort_order
       FROM org_leadership
       WHERE org_profile_id = 'a1b2c3d4-0000-4000-8000-01cc0f11e001'
       ORDER BY sort_order`,
  })) as Promise<Array<{
    name: string;
    title: string;
    bio: string | null;
    external_roles: Array<{ org: string; role: string }>;
    sort_order: number;
  }> | null>;
}

/**
 * Matched grant opportunities for PICC (upcoming, matching their focus areas)
 */
export async function getPiccMatchedGrants() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT id, name, amount_min, amount_max, deadline, categories, foundation_id
       FROM grant_opportunities
       WHERE deadline > CURRENT_DATE
         AND (
           'indigenous' = ANY(categories)
           OR 'health' = ANY(categories)
           OR 'community' = ANY(categories)
           OR 'youth' = ANY(categories)
         )
       ORDER BY deadline ASC
       LIMIT 15`,
  })) as Promise<Array<{
    id: string;
    name: string;
    amount_min: number | null;
    amount_max: number | null;
    deadline: string;
    categories: string[];
    foundation_id: string | null;
  }> | null>;
}

/**
 * PICC funding by year (from gs_relationships for the funding flow chart)
 */
export async function getPiccPipeline() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT p.name, p.amount_display, p.amount_numeric, p.funder, p.deadline,
              p.status, p.notes, p.funder_type, p.grant_opportunity_id,
              f.id as foundation_id
       FROM org_pipeline p
       JOIN org_profiles o ON o.id = p.org_profile_id
       LEFT JOIN gs_entities e ON e.id = p.funder_entity_id
       LEFT JOIN foundations f ON f.acnc_abn = e.abn
       WHERE o.abn = '14640793728'
       ORDER BY CASE p.status
         WHEN 'submitted' THEN 1 WHEN 'upcoming' THEN 2 WHEN 'prospect' THEN 3 ELSE 4
       END, p.deadline`,
  })) as Promise<Array<{
    name: string;
    amount_display: string;
    amount_numeric: number | null;
    funder: string;
    deadline: string;
    status: string;
    notes: string | null;
    funder_type: string | null;
    grant_opportunity_id: string | null;
    foundation_id: string | null;
  }> | null>;
}

export async function getPiccPeerOrgs() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT DISTINCT e.canonical_name, e.abn, e.state, e.lga_name,
              COUNT(DISTINCT a.id)::int as alma_programs,
              STRING_AGG(DISTINCT a.type, ', ') as program_types
       FROM gs_entities e
       JOIN alma_interventions a ON a.gs_entity_id = e.gs_id
       WHERE a.type IN ('Cultural Connection', 'Community-Led', 'Wraparound Support', 'Diversion', 'Family Strengthening')
         AND e.is_community_controlled = true
         AND e.abn != '14640793728'
       GROUP BY e.canonical_name, e.abn, e.state, e.lga_name
       ORDER BY alma_programs DESC
       LIMIT 12`,
  })) as Promise<Array<{
    canonical_name: string;
    abn: string;
    state: string;
    lga_name: string | null;
    alma_programs: number;
    program_types: string;
  }> | null>;
}

export async function getPiccFundingFlow() {
  const supabase = getServiceSupabase();
  return safe(supabase.rpc('exec_sql', {
    query: `SELECT year, SUM(amount)::bigint as total, COUNT(*)::int as grants
       FROM gs_relationships
       WHERE (source_entity_id = '18fc2705-463c-4b27-8dbd-0ca79c640582'
              OR target_entity_id = '18fc2705-463c-4b27-8dbd-0ca79c640582')
         AND amount IS NOT NULL
         AND year IS NOT NULL
       GROUP BY year ORDER BY year`,
  })) as Promise<Array<{
    year: number;
    total: number;
    grants: number;
  }> | null>;
}

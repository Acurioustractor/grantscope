import { getServiceSupabase } from '@/lib/supabase';

type Topic = 'youth-justice' | 'child-protection' | 'ndis' | 'family-services' | 'indigenous' | 'legal-services' | 'diversion' | 'prevention';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safe<T = any>(p: PromiseLike<{ data: T; error: any }>): Promise<T | null> {
  try {
    const result = await p;
    if (result.error) return null;
    return result.data;
  } catch {
    return null;
  }
}

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

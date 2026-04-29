import { NextRequest, NextResponse } from 'next/server';
import { MINIMAX_CHAT_MODEL, OPENAI_CHAT_MODEL } from '@/lib/ai-models';
import { getServiceSupabase } from '@/lib/supabase';
import { cleanSqlOutput, validateSql } from '@/lib/sql-validation';

export const maxDuration = 30;

const SCHEMA_CONTEXT = `
You are a SQL query generator for CivicGraph, an Australian community sector data platform.
You have access to these PostgreSQL tables:

## gs_entities (~159K rows) — the entity graph
Columns: id (uuid), entity_type (text: charity, company, foundation, indigenous_corp, social_enterprise, government_body, political_party), canonical_name (text), abn (text), gs_id (text), state (text), postcode (text), sector (text), remoteness (text: 'Major Cities of Australia', 'Inner Regional Australia', 'Outer Regional Australia', 'Remote Australia', 'Very Remote Australia'), seifa_irsd_decile (smallint 1-10, 1=most disadvantaged), is_community_controlled (boolean), lga_name (text), lga_code (text), latest_revenue (numeric), latest_assets (numeric)

## gs_relationships (~1.08M rows) — links between entities
Columns: id, source_entity_id (uuid->gs_entities.id), target_entity_id (uuid->gs_entities.id), relationship_type (text: 'contract', 'donation', 'grant', 'subsidiary_of', 'lobbies_for'), amount (numeric), year (integer), dataset (text)

## austender_contracts (~770K rows) — federal government contracts
Columns: id, title, contract_value (numeric), buyer_name, supplier_name, supplier_abn, contract_start (date), contract_end (date), category, procurement_method

## justice_funding (~71K rows) — justice/community sector grants
Columns: id, recipient_name, recipient_abn, gs_entity_id (uuid), program_name, amount_dollars (numeric), state (text), financial_year (text like '2023-24'), sector, funding_type, location, topics (text[] — indexed array of topic tags)
Topic values: 'youth-justice', 'child-protection', 'ndis', 'family-services', 'indigenous', 'legal-services', 'diversion', 'prevention', 'wraparound', 'community-led'
Use: WHERE topics @> ARRAY['topic-name']::text[] for topic filtering (fast, GIN-indexed)

## political_donations (~312K rows) — AEC political donation disclosures
Columns: id, donor_name, donor_abn, donation_to (text — party name), amount (numeric), financial_year (text)

## alma_interventions (~1,155 rows) — evidence-based interventions (Australian Living Map of Alternatives)
Columns: id, name, type (text: 'Wraparound Support', 'Cultural Connection', 'Prevention', 'Diversion', 'Community-Led', etc.), description, evidence_level, cultural_authority, target_cohort, geography, portfolio_score (numeric), gs_entity_id (uuid), topics (text[])

## alma_evidence (~570 rows) — evidence records linked to ALMA interventions
Columns: id, intervention_id (->alma_interventions.id), evidence_type (text: 'Program evaluation', 'Policy analysis', 'Case study', 'Community-led research', 'Quasi-experimental', 'RCT'), methodology, sample_size, effect_size

## alma_outcomes (~506 rows) — outcomes measured for interventions
Columns: id, intervention_id (->alma_interventions.id), outcome_type, measurement_method, indicators

## acnc_charities (~66K rows) — ACNC charity register
Columns: abn, name, charity_size (text: 'Small', 'Medium', 'Large'), state, postcode, purposes (text), beneficiaries (text)

## foundations (~10.8K rows) — giving foundations
Columns: id, name, acnc_abn, website, description, total_giving_annual, thematic_focus (text[]), geographic_focus (text[])

## ato_tax_transparency (~24K rows) — ATO corporate tax data
Columns: entity_name, abn, total_income (numeric), taxable_income (numeric), tax_payable (numeric), report_year (int)

## person_roles (~5.4K rows) — board members and officers
Columns: id, person_name, person_name_normalised, role_type (text: director, secretary, officer, chair, ceo, trustee, board_member, etc.), entity_id (uuid), entity_name, company_acn, appointment_date, cessation_date, source, confidence

## Materialized Views (pre-computed, fast):
- mv_entity_power_index (~83K rows): id, canonical_name, abn, entity_type, system_count (int 1-7), power_score, in_procurement, in_justice_funding, in_donations, in_charity, in_foundation, in_alma_evidence, in_ato, is_community_controlled
- mv_funding_deserts (~1.6K rows): lga_name, state, remoteness, avg_irsd_score, min_irsd_decile, avg_irsd_decile, indexed_entities, community_controlled_entities, procurement_entities, justice_entities, alma_entities, ndis_entities, procurement_dollars, justice_dollars, donation_dollars, total_dollar_flow, total_funding_all_sources, avg_system_count, avg_power_score, ndis_participants, desert_score (higher = more underserved)
- mv_revolving_door (~4.7K rows): id, canonical_name, revolving_door_score, influence_vectors, total_donated, total_contracts, total_funded, parties_funded, is_community_controlled
- mv_board_interlocks: person_name, entities (text[]), shared_board_count
- v_youth_justice_state_dashboard: financial_year, state, total_expenditure_m, cost_per_detention, recidivism_pct, completion_pct, indigenous_rate_ratio, facility_count, total_beds, facility_indigenous_pct. Use this for state youth justice expenditure/spend questions.

## Key relationships:
- gs_entities.abn joins to most tables (austender_contracts.supplier_abn, justice_funding.recipient_abn, political_donations.donor_abn, acnc_charities.abn)
- gs_entities.id joins to justice_funding.gs_entity_id, alma_interventions.gs_entity_id, person_roles.entity_id
- gs_relationships links entities via source_entity_id/target_entity_id
- alma_evidence.intervention_id -> alma_interventions.id
- alma_outcomes.intervention_id -> alma_interventions.id

## Rules:
1. Always return SELECT queries only. Never INSERT, UPDATE, DELETE, DROP, or ALTER.
2. Always LIMIT results to 100 max unless the user asks for counts/aggregates.
3. For money amounts, cast to bigint for readability: SUM(amount)::bigint
4. Use ILIKE for name searches, not exact match.
5. For "last N years" of financial_year, use text patterns like '2023-24', '2024-25'.
6. Current financial year is 2025-26. Previous is 2024-25.
7. Return only the SQL query, no explanation. No markdown code blocks.
8. For entity lookups, prefer returning gs_id, canonical_name, entity_type, and relevant amounts.
9. If the question is about a specific place, join to postcode_geo or filter by state.
10. For "community-controlled" or "Indigenous" orgs, use is_community_controlled = true OR entity_type = 'indigenous_corp'.
11. For topic filtering on justice_funding or alma_interventions, use: topics @> ARRAY['topic-name']::text[]
12. Use materialized views when they answer the question directly — they are pre-computed and fast.
13. For power/influence questions, use mv_entity_power_index or mv_revolving_door.
14. For funding desert/gap questions, use mv_funding_deserts.
15. For board interlock questions, use mv_board_interlocks or person_roles.
16. For "how much does [state] spend on youth justice", use v_youth_justice_state_dashboard, not justice_funding.
`;

type YouthJusticeSpendRow = {
  financial_year: string;
  state: string;
  total_expenditure_m: number | string | null;
  cost_per_detention: number | string | null;
  facility_count: number | string | null;
  total_beds: number | string | null;
  indigenous_rate_ratio: number | string | null;
};

type PowerScoreRow = {
  gs_id: string | null;
  canonical_name: string;
  entity_type: string | null;
  abn: string | null;
  state: string | null;
  lga_name: string | null;
  system_count: number | string | null;
  power_score: number | string | null;
  procurement_dollars: number | string | null;
  justice_dollars: number | string | null;
  donation_dollars: number | string | null;
  total_dollar_flow: number | string | null;
};

type JusticeFundingRankRow = {
  gs_id: string | null;
  canonical_name: string;
  entity_type: string | null;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  is_community_controlled: boolean | null;
  justice_dollars: number | string | null;
  justice_record_count: number | string | null;
};

const STATE_ALIASES: Record<string, string> = {
  qld: 'QLD',
  queensland: 'QLD',
  nsw: 'NSW',
  'new south wales': 'NSW',
  vic: 'VIC',
  victoria: 'VIC',
  wa: 'WA',
  'western australia': 'WA',
  sa: 'SA',
  'south australia': 'SA',
  nt: 'NT',
  'northern territory': 'NT',
  tas: 'TAS',
  tasmania: 'TAS',
  act: 'ACT',
  'australian capital territory': 'ACT',
};

// Verified from mv_entity_power_index on 2026-04-29. Keep the homepage example
// instant; live ORDER BY power_score over the large materialized view can take
// 20s+ in local dev despite the index.
const TOP_POWER_SCORE_SNAPSHOT = [
  {
    rank: 1,
    gs_id: 'AU-ABN-64804735113',
    canonical_name: 'La Trobe University',
    entity_type: 'foundation',
    state: 'VIC',
    lga_name: 'Darebin',
    power_score: 21,
    system_count: 6,
    total_dollar_flow: 64988171,
    procurement_dollars: 62866817,
    justice_dollars: 545638,
    donation_dollars: 1575716,
  },
  {
    rank: 2,
    gs_id: 'AU-ABN-90952801237',
    canonical_name: 'Macquarie University',
    entity_type: 'foundation',
    state: 'NSW',
    lga_name: 'Ryde',
    power_score: 21,
    system_count: 6,
    total_dollar_flow: 31037100,
    procurement_dollars: 28359970,
    justice_dollars: 194314,
    donation_dollars: 2482816,
  },
  {
    rank: 3,
    gs_id: 'AU-ABN-53014069881',
    canonical_name: 'Western Sydney University',
    entity_type: 'foundation',
    state: 'NSW',
    lga_name: 'Penrith',
    power_score: 20,
    system_count: 6,
    total_dollar_flow: 60527361,
    procurement_dollars: 58298993,
    justice_dollars: 22076,
    donation_dollars: 2206292,
  },
  {
    rank: 4,
    gs_id: 'AU-ABN-61616369313',
    canonical_name: 'Murdoch University',
    entity_type: 'foundation',
    state: 'WA',
    lga_name: 'Melville',
    power_score: 20,
    system_count: 6,
    total_dollar_flow: 55451979,
    procurement_dollars: 52434202,
    justice_dollars: 1821443,
    donation_dollars: 1196334,
  },
  {
    rank: 5,
    gs_id: 'AU-ABN-13628586699',
    canonical_name: 'Swinburne University Of Technology',
    entity_type: 'foundation',
    state: 'VIC',
    lga_name: 'Boroondara',
    power_score: 19,
    system_count: 5,
    total_dollar_flow: 42724002,
    procurement_dollars: 40669245,
    justice_dollars: 542159,
    donation_dollars: 1512598,
  },
  {
    rank: 6,
    gs_id: 'AU-ABN-83791724622',
    canonical_name: 'Queensland University Of Technology',
    entity_type: 'foundation',
    state: 'QLD',
    lga_name: 'Brisbane',
    power_score: 19,
    system_count: 5,
    total_dollar_flow: 79655706,
    procurement_dollars: 74227723,
    justice_dollars: 3588923,
    donation_dollars: 1839060,
  },
  {
    rank: 7,
    gs_id: 'AU-ABN-12377614012',
    canonical_name: 'Monash University',
    entity_type: 'foundation',
    state: 'VIC',
    lga_name: 'Monash',
    power_score: 19,
    system_count: 5,
    total_dollar_flow: 188511713,
    procurement_dollars: 152889243,
    justice_dollars: 32688217,
    donation_dollars: 2934254,
  },
  {
    rank: 8,
    gs_id: 'AU-ABN-75792454315',
    canonical_name: 'The University Of New England',
    entity_type: 'foundation',
    state: 'NSW',
    lga_name: 'Armidale',
    power_score: 19,
    system_count: 5,
    total_dollar_flow: 50506063,
    procurement_dollars: 48252222,
    justice_dollars: 754451,
    donation_dollars: 1499390,
  },
  {
    rank: 9,
    gs_id: 'AU-ABN-49781030034',
    canonical_name: 'Royal Melbourne Institute Of Technology',
    entity_type: 'foundation',
    state: 'VIC',
    lga_name: 'Melbourne',
    power_score: 19,
    system_count: 5,
    total_dollar_flow: 98812992,
    procurement_dollars: 96069170,
    justice_dollars: 849454,
    donation_dollars: 1894368,
  },
  {
    rank: 10,
    gs_id: 'AU-ABN-78106094461',
    canonical_name: 'Griffith University',
    entity_type: 'foundation',
    state: 'QLD',
    lga_name: 'Brisbane',
    power_score: 19,
    system_count: 5,
    total_dollar_flow: 103468505,
    procurement_dollars: 82844214,
    justice_dollars: 19145861,
    donation_dollars: 1478430,
  },
] as const;

function detectState(question: string): string | null {
  const q = question.toLowerCase();
  const matchedAlias = Object.keys(STATE_ALIASES)
    .sort((a, b) => b.length - a.length)
    .find(alias => new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i').test(q));
  return matchedAlias ? STATE_ALIASES[matchedAlias] : null;
}

function formatAud(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: amount >= 1_000_000 ? 1 : 0,
    notation: amount >= 1_000_000 ? 'compact' : 'standard',
  }).format(amount);
}

function formatNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function detectLimit(question: string, fallback = 10): number {
  const match = question.match(/\b(?:top|first)\s+(\d{1,3})\b/i);
  if (!match) return fallback;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 25));
}

function detectEntityType(question: string): string | null {
  const q = question.toLowerCase();
  if (/\bcharit(?:y|ies)\b/.test(q)) return 'charity';
  if (/\bfoundations?\b/.test(q)) return 'foundation';
  if (/\b(indigenous|aboriginal|first nations)\s+(corporations?|corps?|org(?:anisation)?s?)\b/.test(q)) {
    return 'indigenous_corp';
  }
  if (/\bcompanies?\b/.test(q)) return 'company';
  return null;
}

function detectRemotenessFilter(question: string): string[] | null {
  const q = question.toLowerCase();
  if (/\bvery\s+remote\b/.test(q)) return ['Very Remote Australia'];
  if (/\bremote\b/.test(q)) return ['Remote Australia', 'Very Remote Australia'];
  if (/\bouter\s+regional\b/.test(q)) return ['Outer Regional Australia'];
  if (/\binner\s+regional\b/.test(q)) return ['Inner Regional Australia'];
  if (/\bmajor\s+cities\b/.test(q)) return ['Major Cities of Australia'];
  return null;
}

function formatDisplayValue(key: string, value: unknown): string {
  const numeric = formatNumber(value);
  if (numeric !== null) {
    if (/(amount|dollars|funding|income|flow|revenue|assets|cost|expenditure)/i.test(key)) {
      return formatAud(numeric);
    }
    return numeric.toLocaleString('en-AU');
  }
  return String(value ?? 'unknown');
}

function humanizeFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function buildDeterministicExplanation(question: string, results: unknown, count: number): string {
  const rows = Array.isArray(results) ? results as Array<Record<string, unknown>> : [];
  if (count === 0 || rows.length === 0) {
    return `No rows matched "${question}".`;
  }

  const first = rows[0];
  const entries = Object.entries(first).filter(([, value]) => value !== null && value !== undefined);
  if (count === 1 && entries.length === 1) {
    const [key, value] = entries[0];
    return `${humanizeFieldName(key)}: ${formatDisplayValue(key, value)}.`;
  }

  const name = typeof first.canonical_name === 'string'
    ? first.canonical_name
    : typeof first.recipient_name === 'string'
      ? first.recipient_name
      : typeof first.name === 'string'
        ? first.name
        : null;
  const amountKey = Object.keys(first).find(key => /(amount|dollars|funding|flow|income|revenue|assets|expenditure)/i.test(key));
  if (name && amountKey) {
    return `${name} is the first result, with ${humanizeFieldName(amountKey).toLowerCase()} of ${formatDisplayValue(amountKey, first[amountKey])}. ${count.toLocaleString('en-AU')} rows matched.`;
  }

  return `${count.toLocaleString('en-AU')} ${count === 1 ? 'row' : 'rows'} matched.`;
}

async function answerJusticeFundingRankingQuestion(question: string) {
  const normalized = question.toLowerCase();
  const asksJusticeFunding =
    /\bjustice\s+funding\b/.test(normalized) ||
    (/\bjustice\b/.test(normalized) && /\b(funding|funded|grants?|money)\b/.test(normalized));
  const asksRanking =
    /\b(which|top|most|highest|rank|ranking|largest)\b/.test(normalized) &&
    /\b(charit(?:y|ies)|org(?:anisation|anization|s)?|entities|recipients|corporations?|companies|foundations?)\b/.test(normalized);

  if (!asksJusticeFunding || !asksRanking) {
    return null;
  }

  const state = detectState(question);
  const entityType = detectEntityType(question);
  const remoteness = detectRemotenessFilter(question);

  // Keep this preset scoped to constrained questions. Broad national rankings can
  // still use the LLM path once the user asks for a more general analysis.
  if (!state && !entityType && !remoteness) {
    return null;
  }

  const limit = detectLimit(question, 20);
  const supabase = getServiceSupabase();
  let query = supabase
    .from('mv_entity_power_index')
    .select('gs_id, canonical_name, entity_type, state, postcode, remoteness, is_community_controlled, justice_dollars, justice_record_count')
    .gt('justice_dollars', 0)
    .order('justice_dollars', { ascending: false })
    .limit(limit);

  const whereParts = ['justice_dollars > 0'];
  if (state) {
    query = query.eq('state', state);
    whereParts.push(`state = '${state}'`);
  }
  if (entityType) {
    query = query.eq('entity_type', entityType);
    whereParts.push(`entity_type = '${entityType}'`);
  }
  if (remoteness?.length) {
    query = query.in('remoteness', remoteness);
    whereParts.push(`remoteness IN (${remoteness.map(r => `'${r}'`).join(', ')})`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[/api/ask] preset justice funding ranking failed:', error.message);
    return null;
  }

  const rows = (data || []) as JusticeFundingRankRow[];
  if (rows.length === 0) {
    return NextResponse.json({
      question,
      generated_sql: `SELECT gs_id, canonical_name, entity_type, state, postcode, remoteness, is_community_controlled,
       justice_dollars::bigint AS total_justice_funding, justice_record_count::int AS records
FROM mv_entity_power_index
WHERE ${whereParts.join('\n  AND ')}
ORDER BY justice_dollars DESC
LIMIT ${limit}`,
      results: [],
      count: 0,
      explanation: 'No matching entities with indexed justice funding were found for those filters.',
    });
  }

  const results = rows.map((row, index) => ({
    rank: index + 1,
    gs_id: row.gs_id,
    canonical_name: row.canonical_name,
    entity_type: row.entity_type,
    state: row.state,
    postcode: row.postcode,
    remoteness: row.remoteness,
    is_community_controlled: row.is_community_controlled,
    total_justice_funding: Math.round(formatNumber(row.justice_dollars) || 0),
    records: Math.round(formatNumber(row.justice_record_count) || 0),
  }));

  const top = results[0];
  const scope = [
    remoteness ? remoteness.join(' / ') : null,
    state,
    entityType ? entityType.replace(/_/g, ' ') : null,
  ].filter(Boolean).join(' ');
  const explanation = `${top.canonical_name} is the highest ranked ${scope || 'matching'} entity by indexed justice funding, with ${formatAud(top.total_justice_funding)} across ${top.records} records. The result uses the precomputed power index so this type of constrained ranking stays fast.`;

  return NextResponse.json({
    question,
    generated_sql: `SELECT gs_id, canonical_name, entity_type, state, postcode, remoteness, is_community_controlled,
       justice_dollars::bigint AS total_justice_funding, justice_record_count::int AS records
FROM mv_entity_power_index
WHERE ${whereParts.join('\n  AND ')}
ORDER BY justice_dollars DESC
LIMIT ${limit}`,
    results,
    count: results.length,
    explanation,
  });
}

async function answerPowerScoreQuestion(question: string) {
  const normalized = question.toLowerCase();
  const asksPowerScore =
    /\b(power\s+score|power\s+index|top\s+\d+\s+entities)\b/.test(normalized) &&
    /\b(top|rank|ranking|entities|organisations|organizations)\b/.test(normalized);

  if (!asksPowerScore) {
    return null;
  }

  const limit = detectLimit(question);
  if (limit <= TOP_POWER_SCORE_SNAPSHOT.length) {
    const results = TOP_POWER_SCORE_SNAPSHOT.slice(0, limit);
    const top = results[0];
    const explanation = `${top.canonical_name} currently has the highest power score (${top.power_score}) across ${top.system_count} systems, with ${formatAud(top.total_dollar_flow)} in indexed dollar flow. The top ${results.length} list is dominated by large universities that appear across procurement, justice funding, donations, charity, and foundation datasets.`;

    return NextResponse.json({
      question,
      generated_sql: `-- April 2026 verified homepage snapshot.
SELECT gs_id, canonical_name, entity_type, state, lga_name, system_count, power_score,
       procurement_dollars, justice_dollars, donation_dollars, total_dollar_flow
FROM mv_entity_power_index
WHERE system_count >= 1
ORDER BY power_score DESC NULLS LAST
LIMIT ${limit}`,
      results,
      count: results.length,
      explanation,
    });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('mv_entity_power_index')
    .select('gs_id,canonical_name,entity_type,abn,state,lga_name,system_count,power_score,procurement_dollars,justice_dollars,donation_dollars,total_dollar_flow')
    .gte('system_count', 1)
    .order('power_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[/api/ask] preset power score failed:', error.message);
    return null;
  }

  const results = ((data || []) as PowerScoreRow[]).map((row, index) => ({
    rank: index + 1,
    gs_id: row.gs_id,
    canonical_name: row.canonical_name,
    entity_type: row.entity_type,
    state: row.state,
    lga_name: row.lga_name,
    power_score: formatNumber(row.power_score),
    system_count: formatNumber(row.system_count),
    total_dollar_flow: Math.round(formatNumber(row.total_dollar_flow) || 0),
    procurement_dollars: Math.round(formatNumber(row.procurement_dollars) || 0),
    justice_dollars: Math.round(formatNumber(row.justice_dollars) || 0),
    donation_dollars: Math.round(formatNumber(row.donation_dollars) || 0),
  }));

  if (results.length === 0) return null;

  const top = results[0];
  const explanation = `${top.canonical_name} currently has the highest power score (${top.power_score}) across ${top.system_count} systems, with ${formatAud(top.total_dollar_flow)} in indexed dollar flow. The top ${results.length} list is dominated by large universities that appear across procurement, justice funding, donations, charity, and foundation datasets.`;

  return NextResponse.json({
    question,
    generated_sql: `SELECT gs_id, canonical_name, entity_type, abn, state, lga_name, system_count, power_score,
       procurement_dollars, justice_dollars, donation_dollars, total_dollar_flow
FROM mv_entity_power_index
WHERE system_count >= 1
ORDER BY power_score DESC NULLS LAST
LIMIT ${limit}`,
    results,
    count: results.length,
    explanation,
  });
}

async function answerKnownQuestion(question: string) {
  const powerScoreAnswer = await answerPowerScoreQuestion(question);
  if (powerScoreAnswer) {
    return powerScoreAnswer;
  }

  const justiceFundingRankingAnswer = await answerJusticeFundingRankingQuestion(question);
  if (justiceFundingRankingAnswer) {
    return justiceFundingRankingAnswer;
  }

  const normalized = question.toLowerCase();
  const asksYouthJusticeSpend =
    /\byouth\s+justice\b/.test(normalized) &&
    /\b(spend|spent|spending|expenditure|cost|costs|funding)\b/.test(normalized);
  const state = detectState(question);

  if (!asksYouthJusticeSpend || !state) {
    return null;
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('v_youth_justice_state_dashboard')
    .select('financial_year,state,total_expenditure_m,cost_per_detention,facility_count,total_beds,indigenous_rate_ratio')
    .eq('state', state)
    .order('financial_year', { ascending: false })
    .limit(5);

  if (error) {
    console.error('[/api/ask] preset youth justice spend failed:', error.message);
    return null;
  }

  const rows = (data || []) as YouthJusticeSpendRow[];
  if (rows.length === 0) return null;

  const results = rows.map(row => {
    const expenditureM = formatNumber(row.total_expenditure_m) || 0;
    const costPerDay = formatNumber(row.cost_per_detention);
    return {
      financial_year: row.financial_year,
      state: row.state,
      total_expenditure_aud: Math.round(expenditureM * 1_000_000),
      total_expenditure_m: Number(expenditureM.toFixed(3)),
      cost_per_detention_day: costPerDay !== null ? Math.round(costPerDay) : null,
      facilities: formatNumber(row.facility_count),
      beds: formatNumber(row.total_beds),
      indigenous_rate_ratio: formatNumber(row.indigenous_rate_ratio),
    };
  });

  const latest = results[0];
  const previous = results[1];
  const previousText = previous
    ? `, up from ${formatAud(previous.total_expenditure_aud)} in ${previous.financial_year}`
    : '';
  const explanation = `${state} youth justice expenditure is ${formatAud(latest.total_expenditure_aud)} in ${latest.financial_year}${previousText}. The latest dashboard also shows a detention cost of ${formatAud(latest.cost_per_detention_day || 0)} per day, ${latest.facilities || 0} facilities, and ${latest.beds || 0} beds.`;

  return NextResponse.json({
    question,
    generated_sql: `SELECT financial_year, state, total_expenditure_m, cost_per_detention, facility_count, total_beds, indigenous_rate_ratio
FROM v_youth_justice_state_dashboard
WHERE state = '${state}'
ORDER BY financial_year DESC
LIMIT 5`,
    results,
    count: results.length,
    explanation,
  });
}

export async function POST(request: NextRequest) {
  let body: { question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { question } = body;

  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  if (question.length > 500) {
    return NextResponse.json({ error: 'question too long (max 500 chars)' }, { status: 400 });
  }

  const knownAnswer = await answerKnownQuestion(question);
  if (knownAnswer) {
    return knownAnswer;
  }

  // LLM provider: prefer OpenAI (works from Vercel), fall back to MiniMax
  const openaiKey = process.env.OPENAI_API_KEY;
  const minimaxKey = process.env.MINIMAX_API_KEY;
  const useOpenAI = !!openaiKey;
  const apiKey = openaiKey || minimaxKey;
  if (!apiKey) {
    return NextResponse.json({ error: 'No LLM API key configured (OPENAI_API_KEY or MINIMAX_API_KEY)' }, { status: 500 });
  }

  const baseUrl = useOpenAI
    ? 'https://api.openai.com/v1'
    : (process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1');
  const model = useOpenAI ? OPENAI_CHAT_MODEL : MINIMAX_CHAT_MODEL;

  // Step 1: Generate SQL from natural language
  const sqlAbort = AbortController ? new AbortController() : undefined;
  const sqlTimeout = setTimeout(() => sqlAbort?.abort(), 15_000);

  let llmResponse: Response;
  try {
    llmResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: SCHEMA_CONTEXT,
          },
          {
            role: 'user',
            content: `Generate a PostgreSQL query for this question:\n${question}`,
          },
        ],
      }),
      signal: sqlAbort?.signal,
    });
  } catch (e) {
    clearTimeout(sqlTimeout);
    console.error(`[/api/ask] ${model} SQL generation failed:`, e instanceof Error ? e.message : e);
    const isTimeout = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json(
      { error: isTimeout ? 'LLM timed out — please try again' : 'LLM connection failed' },
      { status: 504 }
    );
  }
  clearTimeout(sqlTimeout);

  if (!llmResponse.ok) {
    const err = await llmResponse.text();
    console.error(`[/api/ask] ${model} returned error:`, llmResponse.status, err.slice(0, 300));
    return NextResponse.json({ error: 'LLM error', details: err.slice(0, 200) }, { status: 502 });
  }

  const llmJson = await llmResponse.json();
  const sqlRaw = (llmJson.choices?.[0]?.message?.content || '').trim();

  const sql = cleanSqlOutput(sqlRaw);
  const validation = validateSql(sql);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, generated_sql: sql },
      { status: 400 }
    );
  }
  const finalSql = validation.sql;
  console.log('[/api/ask] Generated SQL:', finalSql.slice(0, 300));

  // Step 2: Execute the query
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc('exec_sql', { query: finalSql });

  if (error) {
    console.error('[/api/ask] exec_sql failed:', error.message);
    return NextResponse.json(
      { error: 'Query execution failed', details: error.message, generated_sql: finalSql },
      { status: 400 }
    );
  }

  const results = data || [];
  const count = Array.isArray(results) ? results.length : 0;

  const explanation = buildDeterministicExplanation(question, results, count);

  return NextResponse.json({
    question,
    generated_sql: finalSql,
    results,
    count,
    explanation,
  });
}

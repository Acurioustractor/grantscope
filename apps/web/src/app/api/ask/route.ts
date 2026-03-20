import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

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
`;

export async function POST(request: NextRequest) {
  const { question } = await request.json();

  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  if (question.length > 500) {
    return NextResponse.json({ error: 'question too long (max 500 chars)' }, { status: 400 });
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'MINIMAX_API_KEY not configured' }, { status: 500 });
  }

  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1';

  // Step 1: Generate SQL from natural language
  const llmResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2',
      max_tokens: 1000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `${SCHEMA_CONTEXT}\n\nGenerate a PostgreSQL query for this question:\n${question}`,
        },
      ],
    }),
  });

  if (!llmResponse.ok) {
    const err = await llmResponse.text();
    return NextResponse.json({ error: 'LLM error', details: err }, { status: 502 });
  }

  const llmJson = await llmResponse.json();
  const sqlRaw = (llmJson.choices?.[0]?.message?.content || '').trim();

  // Strip <think> blocks, markdown code blocks, and trailing semicolons
  const sql = sqlRaw
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
    .replace(/^```sql\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
    .replace(/;\s*$/, '');

  // Safety: only allow SELECT/WITH
  const sqlUpper = sql.toUpperCase().replace(/\s+/g, ' ').trim();
  if (!sqlUpper.startsWith('SELECT') && !sqlUpper.startsWith('WITH')) {
    return NextResponse.json(
      { error: 'Only SELECT queries are allowed', generated_sql: sql },
      { status: 400 }
    );
  }

  // Block dangerous keywords
  const blocked = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXECUTE'];
  for (const kw of blocked) {
    const pattern = new RegExp(`\\b${kw}\\b`, 'i');
    if (pattern.test(sql.replace(/'[^']*'/g, ''))) {
      return NextResponse.json(
        { error: `Blocked keyword: ${kw}`, generated_sql: sql },
        { status: 400 }
      );
    }
  }

  // Auto-append LIMIT if missing
  const hasLimit = /\bLIMIT\b/i.test(sql);
  const finalSql = hasLimit ? sql : `${sql} LIMIT 100`;

  // Step 2: Execute the query
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc('exec_sql', { query: finalSql });

  if (error) {
    return NextResponse.json(
      { error: 'Query execution failed', details: error.message, generated_sql: finalSql },
      { status: 400 }
    );
  }

  const results = data || [];
  const count = Array.isArray(results) ? results.length : 0;

  // Step 3: Generate plain-English explanation
  let explanation = '';
  try {
    const explainResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2',
        max_tokens: 500,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: `The user asked: "${question}"\n\nThe SQL query returned ${count} rows. Here are the first 10 results:\n${JSON.stringify(Array.isArray(results) ? results.slice(0, 10) : results, null, 2)}\n\nWrite a 2-3 sentence plain-English summary of what the data shows. Be specific with numbers and names. Use Australian dollar formatting (e.g. $1.2M). Do not mention SQL or databases.`,
          },
        ],
      }),
    });

    if (explainResponse.ok) {
      const explainJson = await explainResponse.json();
      explanation = explainJson.choices?.[0]?.message?.content || '';
    }
  } catch {
    // Non-critical — return results without explanation
  }

  return NextResponse.json({
    question,
    generated_sql: finalSql,
    results,
    count,
    explanation,
  });
}

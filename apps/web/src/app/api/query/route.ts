import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

const SCHEMA_CONTEXT = `
You are a SQL query generator for CivicGraph, an Australian community sector data platform.
You have access to these PostgreSQL tables:

## gs_entities (~99K rows) — the entity graph
Columns: id (uuid), entity_type (text: charity, company, foundation, indigenous_corp, social_enterprise, government_body, political_party), canonical_name (text), abn (text), gs_id (text), state (text), postcode (text), sector (text), remoteness (text: 'Major Cities of Australia', 'Inner Regional Australia', 'Outer Regional Australia', 'Remote Australia', 'Very Remote Australia'), seifa_irsd_decile (smallint 1-10, 1=most disadvantaged), is_community_controlled (boolean), lga_name (text), lga_code (text), latest_revenue (numeric), latest_assets (numeric)

## gs_relationships (~200K rows) — links between entities
Columns: id, source_entity_id (uuid→gs_entities.id), target_entity_id (uuid→gs_entities.id), relationship_type (text: 'contract', 'donation', 'grant', 'subsidiary_of'), amount (numeric), year (integer), dataset (text)

## austender_contracts (~670K rows) — federal government contracts
Columns: id, title, contract_value (numeric), buyer_name, supplier_name, supplier_abn, contract_start (date), contract_end (date), category, procurement_method

## justice_funding (~53K rows) — justice/community sector grants
Columns: id, recipient_name, recipient_abn, program_name, amount_dollars (numeric), state (text), financial_year (text like '2023-24'), sector, funding_type, location

## political_donations (~313K rows) — AEC political donation disclosures
Columns: id, donor_name, donor_abn, donation_to (text — party name), amount (numeric), financial_year (text)

## social_enterprises (~10K rows)
Columns: id, name, abn, source_primary (text: 'supply-nation', 'social-traders', 'oric', 'buyability', 'b-corp', 'acnc-classified'), postcode, state, sector (text[]), business_model, is_indigenous (boolean)

## foundations (~11K rows)
Columns: id, name, acnc_abn, website, description, total_giving_annual, thematic_focus (text[]), geographic_focus (text[])

## grant_opportunities (~18K rows)
Columns: id, name, description, amount_min, amount_max, deadline (date), status (text), categories (text[]), focus_areas (text[])

## postcode_geo (~12K rows)
Columns: postcode, locality, state, remoteness_2021, lga_name, lga_code

## acnc_charities (~65K rows)
Columns: abn, name, charity_size (text: 'Small', 'Medium', 'Large'), state, postcode, purposes (text), beneficiaries (text)

## Key relationships:
- gs_entities.abn joins to most tables (austender_contracts.supplier_abn, justice_funding.recipient_abn, political_donations.donor_abn, social_enterprises.abn, acnc_charities.abn)
- gs_relationships links entities via source_entity_id/target_entity_id
- postcode_geo.postcode joins to gs_entities.postcode

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
`;

export async function POST(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;

  const { question } = await request.json();

  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  if (question.length > 500) {
    return NextResponse.json({ error: 'question too long (max 500 chars)' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  // Step 1: Generate SQL from natural language
  const llmResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
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
  const sqlRaw = (llmJson.content?.[0]?.text || '').trim();

  // Strip markdown code blocks and trailing semicolons
  const sql = sqlRaw
    .replace(/^```sql\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
    .replace(/;\s*$/, '');

  // Safety: only allow SELECT
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
    // Check for keyword as a standalone word (not inside a string literal)
    const pattern = new RegExp(`\\b${kw}\\b`, 'i');
    if (pattern.test(sql.replace(/'[^']*'/g, ''))) {
      return NextResponse.json(
        { error: `Blocked keyword: ${kw}`, generated_sql: sql },
        { status: 400 }
      );
    }
  }

  // Step 2: Execute the query
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });

  if (error) {
    return NextResponse.json(
      { error: 'Query execution failed', details: error.message, generated_sql: sql },
      { status: 400 }
    );
  }

  return NextResponse.json({
    question,
    generated_sql: sql,
    results: data || [],
    count: Array.isArray(data) ? data.length : 0,
  });
}

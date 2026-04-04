#!/usr/bin/env node
/**
 * kb-civicgraph-tool.mjs
 *
 * Exposes CivicGraph live database as a JSON tool for the kb agent.
 * Called by the Python kb CLI when Gemma 4 requests a civicgraph_query().
 *
 * Usage (called by kb tool loop, not directly):
 *   node --env-file=.env scripts/kb-civicgraph-tool.mjs \
 *     --query-type=foundations \
 *     --topic="youth justice" \
 *     --limit=10
 *
 * Query types:
 *   foundations       Top foundations funding a topic/sector/geography
 *   contracts         Government contracts awarded in a domain
 *   donor_contractors Entities that donated politically AND hold contracts
 *   grants            Open grant opportunities matching a topic
 *   entity            Profile + relationships for a named entity or ABN
 *   justice_funding   Justice-sector-specific funding data (ROGS, QLD YJ, etc.)
 *   board_interlocks  Board member overlaps between entities in a domain
 *
 * Output: JSON to stdout, one object with { query_type, topic, results, meta }
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  process.stdout.write(JSON.stringify({
    error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env',
    hint: 'Run from grantscope root: node --env-file=.env scripts/kb-civicgraph-tool.mjs ...'
  }));
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Arg parsing ──────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, ...v] = a.slice(2).split('=');
      return [k.replace(/-/g, '_'), v.join('=') || 'true'];
    })
);

const QUERY_TYPE = args.query_type || 'foundations';
const TOPIC      = (args.topic || '').toLowerCase().trim();
const ENTITY     = args.entity || args.name || '';
const ABN        = args.abn || '';
const STATE      = (args.state || '').toUpperCase();
const LIMIT      = Math.min(parseInt(args.limit || '10'), 25);

// ─── Topic → keyword expansion ────────────────────────────────────────────────
// Map natural language topics to DB-searchable terms

const TOPIC_MAP = {
  'youth justice':        ['youth justice', 'juvenile', 'young offender', 'diversion', 'detention', 'youth crime'],
  'justice':              ['justice', 'legal', 'corrections', 'criminal', 'prison', 'court', 'bail'],
  'housing':              ['housing', 'homelessness', 'shelter', 'accommodation', 'tenancy'],
  'indigenous':           ['indigenous', 'aboriginal', 'first nations', 'torres strait', 'ATSI', 'ACCO'],
  'disability':           ['disability', 'NDIS', 'accessible', 'inclusion'],
  'mental health':        ['mental health', 'wellbeing', 'psychological', 'psychiatry'],
  'community':            ['community', 'social enterprise', 'grassroots', 'neighbourhood'],
  'environment':          ['environment', 'climate', 'sustainability', 'renewable', 'conservation'],
  'education':            ['education', 'school', 'literacy', 'training', 'vocational'],
  'health':               ['health', 'medical', 'hospital', 'aged care', 'primary care'],
};

function expandTopic(topic) {
  if (!topic) return [];
  const normalized = topic.toLowerCase();
  // Direct match
  for (const [key, terms] of Object.entries(TOPIC_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return terms;
    }
  }
  // Partial match
  const matched = [];
  for (const [key, terms] of Object.entries(TOPIC_MAP)) {
    if (terms.some(t => normalized.includes(t.split(' ')[0]))) {
      matched.push(...terms);
    }
  }
  if (matched.length) return [...new Set(matched)];
  // Fallback: use topic words directly
  return topic.split(/\s+/).filter(w => w.length > 3);
}

// ─── Query implementations ────────────────────────────────────────────────────

async function queryFoundations() {
  const keywords = expandTopic(TOPIC);
  const searchTerm = keywords[0] || TOPIC;

  // Search foundations by thematic_focus, description, or name
  let query = db
    .from('foundations')
    .select('name, acnc_abn, description, giving_philosophy, thematic_focus, geographic_focus, total_giving_annual, avg_grant_size, website, state')
    .not('description', 'is', null)
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  // Filter by thematic focus if we have keywords
  if (keywords.length > 0) {
    // Use OR across multiple keyword approaches
    const orClauses = keywords.slice(0, 3).map(k =>
      `thematic_focus.cs.{"${k}"},description.ilike.%${k}%`
    ).join(',');
    query = query.or(orClauses);
  }

  if (STATE) {
    query = query.contains('geographic_focus', [STATE]);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    query_type: 'foundations',
    topic: TOPIC,
    count: data?.length || 0,
    results: (data || []).map(f => ({
      name: f.name,
      abn: f.acnc_abn,
      annual_giving: f.total_giving_annual ? `$${Number(f.total_giving_annual).toLocaleString()}` : null,
      avg_grant: f.avg_grant_size ? `$${Number(f.avg_grant_size).toLocaleString()}` : null,
      themes: f.thematic_focus || [],
      geography: f.geographic_focus || [],
      description: f.description?.slice(0, 200),
      giving_philosophy: f.giving_philosophy?.slice(0, 150),
      website: f.website,
    })),
    meta: { keywords_used: keywords.slice(0, 3) }
  };
}

async function queryContracts() {
  const keywords = expandTopic(TOPIC);
  const searchTerms = keywords.slice(0, 2);

  if (!searchTerms.length) {
    return { error: 'Provide --topic for contract search' };
  }

  // Search contracts by description
  const orClause = searchTerms.map(k => `description.ilike.%${k}%`).join(',');

  let query = db
    .from('austender_contracts')
    .select('supplier_name, supplier_abn, agency_name, description, contract_value, contract_start, contract_end, procurement_method, category')
    .or(orClause)
    .not('contract_value', 'is', null)
    .order('contract_value', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  const { data, error } = await query;
  if (error) return { error: error.message };

  const totalValue = (data || []).reduce((s, r) => s + Number(r.contract_value || 0), 0);

  return {
    query_type: 'contracts',
    topic: TOPIC,
    count: data?.length || 0,
    total_value: `$${totalValue.toLocaleString()}`,
    results: (data || []).map(c => ({
      supplier: c.supplier_name,
      supplier_abn: c.supplier_abn,
      agency: c.agency_name,
      description: c.description?.slice(0, 150),
      value: c.contract_value ? `$${Number(c.contract_value).toLocaleString()}` : null,
      start: c.contract_start,
      end: c.contract_end,
      category: c.category,
      method: c.procurement_method,
    })),
    meta: { keywords_used: searchTerms }
  };
}

async function queryDonorContractors() {
  // Entities that donated politically AND hold government contracts
  // Core CivicGraph insight: the 140-entity finding
  const keywords = expandTopic(TOPIC);
  const searchTerm = keywords[0] || TOPIC;

  // Join political_donations with austender_contracts on donor_abn = supplier_abn
  // Filter by topic in contract description or entity name
  const { data, error } = await db.rpc('exec_sql', {
    sql: `
      SELECT
        d.donor_name,
        d.donor_abn,
        SUM(d.amount) as total_donated,
        COUNT(DISTINCT d.donation_to) as parties_donated_to,
        STRING_AGG(DISTINCT d.donation_to, ', ') as parties,
        SUM(c.contract_value) as total_contracts,
        COUNT(DISTINCT c.id) as contract_count,
        MAX(c.contract_start) as latest_contract,
        ROUND(SUM(c.contract_value) / NULLIF(SUM(d.amount), 0), 1) as contract_per_donation_dollar
      FROM political_donations d
      JOIN austender_contracts c ON d.donor_abn = c.supplier_abn
      WHERE (
        c.description ILIKE '%${searchTerm.replace(/'/g, "''")}%'
        OR d.donor_name ILIKE '%${searchTerm.replace(/'/g, "''")}%'
      )
      AND d.donor_abn IS NOT NULL
      AND c.contract_value > 0
      GROUP BY d.donor_name, d.donor_abn
      ORDER BY total_contracts DESC
      LIMIT ${LIMIT}
    `
  }).catch(() => ({ data: null, error: { message: 'RPC not available' } }));

  // Fallback: simple join approach
  if (error || !data) {
    const { data: donors } = await db
      .from('political_donations')
      .select('donor_name, donor_abn, amount, donation_to, financial_year')
      .not('donor_abn', 'is', null)
      .ilike('donor_name', `%${searchTerm}%`)
      .order('amount', { ascending: false })
      .limit(LIMIT);

    return {
      query_type: 'donor_contractors',
      topic: TOPIC,
      note: 'Simplified result — full crossover analysis requires mv_gs_donor_contractors view',
      count: donors?.length || 0,
      results: (donors || []).map(d => ({
        donor: d.donor_name,
        abn: d.donor_abn,
        amount: d.amount ? `$${Number(d.amount).toLocaleString()}` : null,
        donated_to: d.donation_to,
        year: d.financial_year,
      }))
    };
  }

  return {
    query_type: 'donor_contractors',
    topic: TOPIC,
    count: data?.length || 0,
    results: (data || []).map(r => ({
      entity: r.donor_name,
      abn: r.donor_abn,
      total_donated: `$${Number(r.total_donated).toLocaleString()}`,
      parties: r.parties,
      total_contracts: `$${Number(r.total_contracts).toLocaleString()}`,
      contract_count: r.contract_count,
      ratio: r.contract_per_donation_dollar,
      latest_contract: r.latest_contract,
    })),
    meta: {
      insight: 'High ratio = entity received many times more in contracts than it donated to political parties'
    }
  };
}

async function queryGrants() {
  const keywords = expandTopic(TOPIC);
  const orClause = keywords.slice(0, 3).map(k =>
    `title.ilike.%${k}%,description.ilike.%${k}%,focus_areas.cs.{"${k}"}`
  ).join(',');

  let query = db
    .from('grant_opportunities')
    .select('title, provider, max_amount, min_amount, closes_at, status, focus_areas, geography, description, url')
    .or(orClause || `title.ilike.%${TOPIC}%`)
    .in('status', ['open', 'ongoing', 'upcoming'])
    .order('closes_at', { ascending: true, nullsFirst: false })
    .limit(LIMIT);

  if (STATE) {
    query = query.or(`geography.ilike.%${STATE}%,geography.ilike.%national%`);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    query_type: 'grants',
    topic: TOPIC,
    count: data?.length || 0,
    results: (data || []).map(g => ({
      title: g.title,
      provider: g.provider,
      max_amount: g.max_amount ? `$${Number(g.max_amount).toLocaleString()}` : null,
      closes: g.closes_at,
      status: g.status,
      focus_areas: g.focus_areas,
      geography: g.geography,
      description: g.description?.slice(0, 150),
      url: g.url,
    })),
  };
}

async function queryEntity() {
  const nameSearch = ENTITY || TOPIC;
  if (!nameSearch) return { error: 'Provide --entity=<name> or --abn=<ABN>' };

  let query = db
    .from('gs_entities')
    .select('id, canonical_name, entity_type, abn, description, sector, state, lga_name, is_community_controlled, source_count, source_datasets')
    .limit(5);

  if (ABN) {
    query = query.eq('abn', ABN);
  } else {
    query = query.ilike('canonical_name', `%${nameSearch}%`);
  }

  const { data: entities, error } = await query;
  if (error) return { error: error.message };
  if (!entities?.length) return { query_type: 'entity', topic: nameSearch, count: 0, results: [] };

  // Get relationships for the top match
  const topEntity = entities[0];
  const { data: rels } = await db
    .from('gs_relationships')
    .select('relationship_type, target_id, amount, source')
    .eq('source_id', topEntity.id)
    .order('amount', { ascending: false, nullsFirst: false })
    .limit(15);

  return {
    query_type: 'entity',
    topic: nameSearch,
    count: entities.length,
    results: entities.map((e, i) => ({
      name: e.canonical_name,
      abn: e.abn,
      type: e.entity_type,
      sector: e.sector,
      state: e.state,
      description: e.description?.slice(0, 200),
      community_controlled: e.is_community_controlled,
      appears_in: e.source_count,
      datasets: e.source_datasets,
      ...(i === 0 && rels?.length ? {
        top_relationships: rels.slice(0, 8).map(r => ({
          type: r.relationship_type,
          amount: r.amount ? `$${Number(r.amount).toLocaleString()}` : null,
          source: r.source,
        }))
      } : {})
    }))
  };
}

async function queryJusticeFunding() {
  const { data, error } = await db
    .from('justice_funding')
    .select('program_name, jurisdiction, funding_type, amount, financial_year, organisation, abn, notes')
    .or(TOPIC ? `program_name.ilike.%${TOPIC}%,notes.ilike.%${TOPIC}%,organisation.ilike.%${TOPIC}%` : 'program_name.neq.null')
    .not('amount', 'is', null)
    .order('amount', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (error) return { error: error.message };

  const totalFunding = (data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const byJurisdiction = {};
  for (const r of (data || [])) {
    byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + Number(r.amount || 0);
  }

  return {
    query_type: 'justice_funding',
    topic: TOPIC || 'all',
    count: data?.length || 0,
    total_funding: `$${totalFunding.toLocaleString()}`,
    by_jurisdiction: Object.entries(byJurisdiction)
      .sort((a, b) => b[1] - a[1])
      .map(([j, v]) => ({ jurisdiction: j, total: `$${v.toLocaleString()}` })),
    results: (data || []).map(r => ({
      program: r.program_name,
      jurisdiction: r.jurisdiction,
      type: r.funding_type,
      amount: r.amount ? `$${Number(r.amount).toLocaleString()}` : null,
      year: r.financial_year,
      org: r.organisation,
      abn: r.abn,
    }))
  };
}

async function queryBoardInterlocks() {
  const keyword = ENTITY || TOPIC;
  if (!keyword) return { error: 'Provide --topic or --entity for board interlock search' };

  const { data, error } = await db
    .from('mv_board_interlocks')
    .select('*')
    .or(`entity_a_name.ilike.%${keyword}%,entity_b_name.ilike.%${keyword}%`)
    .order('shared_director_count', { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (error) {
    // Fallback to person_roles
    const { data: fallback } = await db
      .from('person_roles')
      .select('person_name, entity_name, role, abn')
      .ilike('entity_name', `%${keyword}%`)
      .limit(LIMIT);

    return {
      query_type: 'board_interlocks',
      topic: keyword,
      count: fallback?.length || 0,
      results: (fallback || []).map(r => ({
        person: r.person_name,
        entity: r.entity_name,
        role: r.role,
      })),
      note: 'Person roles for this entity (full interlock view not available)'
    };
  }

  return {
    query_type: 'board_interlocks',
    topic: keyword,
    count: data?.length || 0,
    results: (data || []).map(r => ({
      entity_a: r.entity_a_name,
      entity_b: r.entity_b_name,
      shared_directors: r.shared_director_count,
      directors: r.shared_directors,
    }))
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const HANDLERS = {
  foundations:       queryFoundations,
  contracts:         queryContracts,
  donor_contractors: queryDonorContractors,
  grants:            queryGrants,
  entity:            queryEntity,
  justice_funding:   queryJusticeFunding,
  board_interlocks:  queryBoardInterlocks,
};

const handler = HANDLERS[QUERY_TYPE];
if (!handler) {
  process.stdout.write(JSON.stringify({
    error: `Unknown query_type: ${QUERY_TYPE}`,
    valid_types: Object.keys(HANDLERS)
  }));
  process.exit(1);
}

try {
  const result = await handler();
  process.stdout.write(JSON.stringify(result, null, 2));
} catch (err) {
  process.stdout.write(JSON.stringify({ error: err.message }));
  process.exit(1);
}

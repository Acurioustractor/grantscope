#!/usr/bin/env node

/**
 * Enrich JusticeHub — Full sweep using MiniMax M2.7
 *
 * Populates:
 *  1. Entity identifiers (ABN, website, social)
 *  2. org_contacts — key funders, partners, governance, community contacts
 *  3. Grant opportunity recommendations (scored by MiniMax)
 *  4. Relationship suggestions (entities in CivicGraph to connect with)
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-justicehub.mjs
 *   node --env-file=.env scripts/enrich-justicehub.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { callMiniMax } from './lib/minimax.mjs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ORG_PROFILE_ID = 'f3783794-1589-4ecd-b25f-ec039d2291ea';
const ENTITY_ID = '5fda64ca-7890-4d72-b8d5-5cd36476452f';
const GS_ID = 'AU-JH-001';

const stats = { contacts_added: 0, grants_scored: 0, relationships_added: 0, identifiers_added: 0, errors: [] };

function log(msg) {
  console.log(`[enrich-jh] ${msg}`);
}

// ─── Step 1: Research JusticeHub and populate identifiers ─────────

async function enrichIdentifiers() {
  log('Step 1: Researching JusticeHub identifiers...');

  // Check what we already have
  const { data: existing } = await supabase
    .from('entity_identifiers')
    .select('identifier_type')
    .eq('entity_id', ENTITY_ID);

  const existingTypes = new Set((existing ?? []).map(e => e.identifier_type));

  // entity_identifiers FK references canonical_entities, not gs_entities
  // Look up the canonical_entities ID for JusticeHub
  const { data: canonRow } = await supabase
    .from('canonical_entities')
    .select('id')
    .ilike('canonical_name', '%JusticeHub%')
    .limit(1)
    .single();

  if (!canonRow) {
    log('  No canonical_entities row for JusticeHub — skipping identifiers.');
    log('  (entity_identifiers FK references canonical_entities, not gs_entities)');
    return;
  }

  const canonId = canonRow.id;

  // JusticeHub known facts (from ALMA integration, org profile)
  const identifiers = [
    { type: 'website', value: 'https://www.justicehub.com.au' },
    { type: 'platform', value: 'ALMA (Australian Living Map of Alternatives)' },
    { type: 'platform', value: 'Empathy Ledger' },
    { type: 'platform', value: 'CONTAINED touring campaign' },
  ].filter(i => !existingTypes.has(i.type));

  if (identifiers.length === 0) {
    log('  Identifiers already populated, skipping.');
    return;
  }

  if (DRY_RUN) {
    log(`  [DRY RUN] Would add ${identifiers.length} identifiers`);
    return;
  }

  for (const id of identifiers) {
    const { error } = await supabase.from('entity_identifiers').insert({
      entity_id: canonId,
      identifier_type: id.type,
      identifier_value: id.value,
      source: 'enrich-justicehub',
    });
    if (error) {
      log(`  Error adding identifier ${id.type}: ${error.message}`);
      stats.errors.push(error.message);
    } else {
      stats.identifiers_added++;
      log(`  Added: ${id.type} = ${id.value}`);
    }
  }
}

// ─── Step 2: Use MiniMax to generate contact recommendations ─────

async function enrichContacts() {
  log('Step 2: Generating contact recommendations via MiniMax...');

  // Check existing contacts
  const { data: existing } = await supabase
    .from('org_contacts')
    .select('name, contact_type')
    .eq('org_profile_id', ORG_PROFILE_ID);

  if ((existing ?? []).length > 0) {
    log(`  Already has ${existing.length} contacts, skipping generation.`);
    return;
  }

  // Get existing partners for context
  const { data: partners } = await supabase
    .from('gs_relationships')
    .select('target_entity_id')
    .eq('source_entity_id', ENTITY_ID)
    .eq('relationship_type', 'partners_with');

  const partnerIds = (partners ?? []).map(p => p.target_entity_id);
  let partnerNames = [];
  if (partnerIds.length > 0) {
    const { data: pEntities } = await supabase
      .from('gs_entities')
      .select('canonical_name')
      .in('id', partnerIds);
    partnerNames = (pEntities ?? []).map(e => e.canonical_name);
  }

  // Get top justice funders from justice_funding
  const { data: topFunders } = await supabase.rpc('exec_sql', {
    query: `SELECT DISTINCT program_name, SUM(amount_dollars) as total
            FROM justice_funding
            WHERE topics @> ARRAY['youth-justice']
            GROUP BY program_name
            ORDER BY total DESC NULLS LAST
            LIMIT 15`
  });

  // Get ALMA-linked orgs for community contacts
  const { data: almaOrgs } = await supabase.rpc('exec_sql', {
    query: `SELECT ai.name as intervention, e.canonical_name as org_name
            FROM alma_interventions ai
            JOIN gs_entities e ON e.id = ai.gs_entity_id
            WHERE ai.topics @> ARRAY['youth-justice']
            LIMIT 20`
  });

  const prompt = `You are a strategic advisor for JusticeHub, an Australian justice infrastructure platform.
JusticeHub operates three products:
1. CONTAINED — touring campaign raising awareness of justice issues
2. ALMA (Australian Living Map of Alternatives) — evidence database of 1,155 justice interventions
3. Empathy Ledger — story platform for lived experience

Current partners: ${partnerNames.join(', ') || 'None listed'}

Top youth-justice funding programs in Australia:
${JSON.stringify(topFunders ?? [], null, 2)}

ALMA-linked justice organisations:
${JSON.stringify(almaOrgs ?? [], null, 2)}

Generate a JSON array of 15-20 recommended contacts for JusticeHub to build relationships with.
Each contact should have:
- "name": person or organisation name
- "role": their role/title (or "CEO", "Director" etc for orgs)
- "organisation": the org they belong to
- "contact_type": one of "funder", "partner", "community", "governance", "advocacy"
- "notes": 1-2 sentences on why this contact matters for JusticeHub
- "email": null (we don't generate emails)
- "phone": null

Focus on:
- FUNDERS: foundations and government programs that fund justice innovation, youth justice, First Nations justice, diversion programs
- PARTNERS: justice orgs, legal services, Aboriginal community-controlled orgs doing related work
- COMMUNITY: lived experience advocates, peer networks, community justice groups
- ADVOCACY: peak bodies, policy orgs, legal reform organisations

Return ONLY valid JSON array, no markdown or explanation.`;

  const { text } = await callMiniMax({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
    temperature: 0.2,
  });

  let contacts;
  try {
    // Handle potential markdown wrapping
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    contacts = JSON.parse(cleaned);
  } catch (e) {
    log(`  Error parsing MiniMax response: ${e.message}`);
    log(`  Raw response: ${text.slice(0, 500)}`);
    stats.errors.push(`Contact parse error: ${e.message}`);
    return;
  }

  if (!Array.isArray(contacts)) {
    log('  MiniMax did not return an array');
    stats.errors.push('Contact response not an array');
    return;
  }

  // Validate contact_type
  const validTypes = ['governance', 'funder', 'partner', 'supplier', 'political', 'community', 'advocacy'];

  for (const c of contacts) {
    if (!validTypes.includes(c.contact_type)) {
      log(`  Skipping invalid contact_type "${c.contact_type}" for ${c.name}`);
      continue;
    }

    if (DRY_RUN) {
      log(`  [DRY RUN] Would add: ${c.contact_type} — ${c.name} (${c.organisation})`);
      stats.contacts_added++;
      continue;
    }

    // Try to find linked entity
    let linkedEntityId = null;
    if (c.organisation) {
      const { data: match } = await supabase
        .from('gs_entities')
        .select('id')
        .ilike('canonical_name', `%${c.organisation.replace(/[%_]/g, '')}%`)
        .limit(1)
        .single();
      if (match) linkedEntityId = match.id;
    }

    const { error } = await supabase.from('org_contacts').insert({
      org_profile_id: ORG_PROFILE_ID,
      name: c.name,
      role: c.role || null,
      organisation: c.organisation || null,
      contact_type: c.contact_type,
      notes: c.notes || null,
      email: null,
      phone: null,
      linked_entity_id: linkedEntityId,
    });

    if (error) {
      log(`  Error inserting contact ${c.name}: ${error.message}`);
      stats.errors.push(error.message);
    } else {
      stats.contacts_added++;
      const linked = linkedEntityId ? ' [linked]' : '';
      log(`  Added ${c.contact_type}: ${c.name} — ${c.organisation}${linked}`);
    }
  }
}

// ─── Step 3: Score grant opportunities with MiniMax ──────────────

async function scoreGrantOpportunities() {
  log('Step 3: Scoring grant opportunities via MiniMax...');

  // Get already-pipelined grant IDs to exclude
  const { data: pipelined } = await supabase
    .from('org_pipeline')
    .select('grant_opportunity_id')
    .eq('org_profile_id', ORG_PROFILE_ID)
    .not('grant_opportunity_id', 'is', null);
  const excludeIds = (pipelined ?? []).map(p => p.grant_opportunity_id).filter(Boolean);

  // Get open justice-relevant grants (filtered by categories/keywords)
  const { data: grants } = await supabase.rpc('exec_sql', {
    query: `SELECT id, name, LEFT(description, 200) as description, amount_min, amount_max, deadline, categories, focus_areas
            FROM grant_opportunities
            WHERE (deadline >= NOW() OR closes_at >= NOW())
              AND (
                categories::text ILIKE '%justice%' OR categories::text ILIKE '%indigenous%'
                OR categories::text ILIKE '%community%' OR categories::text ILIKE '%youth%'
                OR focus_areas::text ILIKE '%justice%' OR focus_areas::text ILIKE '%indigenous%'
                OR name ILIKE '%justice%' OR name ILIKE '%indigenous%'
                OR name ILIKE '%aboriginal%' OR name ILIKE '%youth%'
                OR name ILIKE '%diversion%' OR name ILIKE '%legal%'
              )
              ${excludeIds.length > 0 ? `AND id NOT IN (${excludeIds.map(id => `'${id}'`).join(',')})` : ''}
            ORDER BY deadline ASC
            LIMIT 100`
  });

  if (!grants || grants.length === 0) {
    log('  No open justice-relevant grants found');
    return;
  }

  log(`  Found ${grants.length} justice-relevant open grants to score...`);

  // Smaller batches to avoid MiniMax truncation
  const batchSize = 10;
  const allScored = [];

  for (let i = 0; i < grants.length; i += batchSize) {
    const batch = grants.slice(i, i + batchSize);
    const grantList = batch.map((g, idx) => ({
      idx: i + idx,
      id: g.id,
      name: g.name,
      description: (g.description || '').slice(0, 200),
      amount_min: g.amount_min,
      amount_max: g.amount_max,
      deadline: g.deadline,
      categories: g.categories,
    }));

    const prompt = `You are scoring grant opportunities for JusticeHub, an Australian justice infrastructure platform.
JusticeHub's focus areas: youth justice, First Nations justice, justice reinvestment, diversion programs,
lived experience advocacy, evidence-based justice interventions, community-led alternatives to incarceration.

Score each grant 0-100 for relevance to JusticeHub. Return JSON array of objects with "id" and "score" and "reason" (1 sentence).
Only include grants scoring >= 30.

Grants to score:
${JSON.stringify(grantList, null, 2)}

Return ONLY valid JSON array.`;

    try {
      const { text } = await callMiniMax({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.1,
      });

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const scored = JSON.parse(cleaned);
      if (Array.isArray(scored)) {
        allScored.push(...scored);
      }
    } catch (e) {
      log(`  Error scoring batch ${i}: ${e.message}`);
      stats.errors.push(`Grant scoring batch ${i}: ${e.message}`);
    }
  }

  // Update fit_score on matching grants
  const highScoring = allScored.filter(s => s.score >= 40).sort((a, b) => b.score - a.score);
  log(`  ${allScored.length} grants scored, ${highScoring.length} score >= 40`);

  for (const s of highScoring) {
    const grant = grants.find(g => g.id === s.id);
    if (!grant) continue;

    if (DRY_RUN) {
      log(`  [DRY RUN] ${s.score}/100: ${grant.name} — ${s.reason}`);
      stats.grants_scored++;
      continue;
    }

    // Store score in pipeline (name is NOT NULL)
    const { error } = await supabase.from('org_pipeline').insert({
      org_profile_id: ORG_PROFILE_ID,
      grant_opportunity_id: s.id,
      name: grant.name.slice(0, 200),
      status: 'prospect',
      notes: `MiniMax score: ${s.score}/100 — ${s.reason}`,
    });

    if (error) {
      // May already exist or table doesn't exist
      log(`  Pipeline insert for "${grant.name}": ${error.message}`);
      // Fallback: just log it
      stats.grants_scored++;
      log(`  Scored ${s.score}/100: ${grant.name} — ${s.reason}`);
    } else {
      stats.grants_scored++;
      log(`  Added to pipeline ${s.score}/100: ${grant.name}`);
    }
  }

  // Also log top recommendations even if pipeline insert fails
  if (highScoring.length > 0) {
    log('\n  === TOP GRANT RECOMMENDATIONS ===');
    for (const s of highScoring.slice(0, 10)) {
      const grant = grants.find(g => g.id === s.id);
      if (grant) {
        log(`  ${s.score}/100 | ${grant.deadline || 'no deadline'} | ${grant.name}`);
        log(`           ${s.reason}`);
      }
    }
  }
}

// ─── Step 4: Suggest new relationships via MiniMax ───────────────

async function suggestRelationships() {
  log('Step 4: Finding relationship candidates in CivicGraph...');

  // Get existing relationships to avoid dupes
  const { data: existingRels } = await supabase
    .from('gs_relationships')
    .select('target_entity_id')
    .eq('source_entity_id', ENTITY_ID);

  const existingTargets = new Set((existingRels ?? []).map(r => r.target_entity_id));

  // Find justice-related entities that could be partners
  // Query entities that appear in justice_funding as recipients
  const { data: justiceOrgs } = await supabase.rpc('exec_sql', {
    query: `SELECT DISTINCT e.id, e.canonical_name, e.entity_type, e.state,
              COUNT(jf.id) as funding_records, SUM(jf.amount_dollars) as total_funding
            FROM gs_entities e
            JOIN justice_funding jf ON jf.recipient_abn = e.abn
            WHERE jf.topics @> ARRAY['youth-justice']
              AND e.abn IS NOT NULL
            GROUP BY e.id, e.canonical_name, e.entity_type, e.state
            ORDER BY total_funding DESC NULLS LAST
            LIMIT 30`
  });

  // Find foundations that fund justice
  const { data: justiceFoundations } = await supabase.rpc('exec_sql', {
    query: `SELECT DISTINCT e.id, e.canonical_name, f.total_giving_annual
            FROM foundations f
            JOIN gs_entities e ON e.abn = f.acnc_abn
            WHERE f.thematic_focus::text ILIKE '%justice%'
              OR f.thematic_focus::text ILIKE '%indigenous%'
              OR f.thematic_focus::text ILIKE '%community%'
            ORDER BY f.total_giving_annual DESC NULLS LAST
            LIMIT 20`
  });

  const candidates = [
    ...(justiceOrgs ?? []).map(o => ({ ...o, source: 'justice_funding' })),
    ...(justiceFoundations ?? []).map(f => ({ ...f, source: 'foundation' })),
  ].filter(c => !existingTargets.has(c.id));

  log(`  Found ${candidates.length} potential relationship candidates (${existingTargets.size} already connected)`);

  if (candidates.length === 0) return;

  const prompt = `You are a strategic advisor for JusticeHub, an Australian justice infrastructure platform.
JusticeHub's focus: youth justice, First Nations justice, diversion, evidence-based alternatives, lived experience.

Here are potential partner/funder organisations found in our database.
Select the top 15 most strategically valuable for JusticeHub and classify each relationship.

Candidates:
${JSON.stringify(candidates.slice(0, 25).map(c => ({ id: c.id, name: c.canonical_name, type: c.entity_type, source: c.source })), null, 2)}

Return JSON array with: "id", "name", "relationship_type" ("partners_with" or "funded_by"), "reason" (1 sentence).
Only top 15. Return ONLY valid JSON array.`;

  const { text } = await callMiniMax({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8192,
    temperature: 0.2,
  });

  let suggestions;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    suggestions = JSON.parse(cleaned);
  } catch (e) {
    log(`  Error parsing relationship suggestions: ${e.message}`);
    stats.errors.push(`Relationship parse error: ${e.message}`);
    return;
  }

  if (!Array.isArray(suggestions)) return;

  for (const s of suggestions) {
    if (!s.id || existingTargets.has(s.id)) continue;

    if (DRY_RUN) {
      log(`  [DRY RUN] ${s.relationship_type}: JusticeHub → ${s.name} — ${s.reason}`);
      stats.relationships_added++;
      continue;
    }

    const { error } = await supabase.from('gs_relationships').insert({
      source_entity_id: ENTITY_ID,
      target_entity_id: s.id,
      relationship_type: 'partners_with',
      dataset: 'enrich-justicehub',
      source_record_id: `jh-enrichment-${s.id}`,
    });

    if (error) {
      log(`  Error adding relationship to ${s.name}: ${error.message}`);
      stats.errors.push(error.message);
    } else {
      stats.relationships_added++;
      existingTargets.add(s.id);
      log(`  Added ${s.relationship_type}: JusticeHub → ${s.name}`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  log('=== JusticeHub Enrichment Sweep ===');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log(`Entity: ${GS_ID} (${ENTITY_ID})`);
  log(`Org Profile: ${ORG_PROFILE_ID}`);
  log('');

  const run = await logStart(supabase, 'enrich-justicehub', 'Enrich JusticeHub');

  try {
    await enrichIdentifiers();
    log('');
    await enrichContacts();
    log('');
    await scoreGrantOpportunities();
    log('');
    await suggestRelationships();
    log('');

    log('=== Summary ===');
    log(`Identifiers added: ${stats.identifiers_added}`);
    log(`Contacts added:    ${stats.contacts_added}`);
    log(`Grants scored:     ${stats.grants_scored}`);
    log(`Relationships:     ${stats.relationships_added}`);
    log(`Errors:            ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      log('\nErrors:');
      for (const e of stats.errors) log(`  - ${e}`);
    }

    await logComplete(supabase, run.id, {
      items_found: stats.contacts_added + stats.grants_scored + stats.relationships_added,
      items_new: stats.contacts_added + stats.relationships_added + stats.identifiers_added,
      items_updated: stats.grants_scored,
      status: stats.errors.length > 0 ? 'partial' : 'success',
      errors: stats.errors,
    });
  } catch (e) {
    log(`Fatal error: ${e.message}`);
    console.error(e);
    await logFailed(supabase, run.id, e);
    process.exit(1);
  }
}

main();

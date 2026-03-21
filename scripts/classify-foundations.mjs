#!/usr/bin/env node

/**
 * classify-foundations.mjs
 *
 * Uses LLM to reclassify remaining 'grantmaker' foundations into accurate types.
 * Processes in batches of 50 names to minimize API calls.
 *
 * Usage:
 *   node --env-file=.env scripts/classify-foundations.mjs [--dry-run] [--apply]
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = !process.argv.includes('--apply');
const MINIMAX_KEY = process.env.MINIMAX_API_KEY;

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const VALID_TYPES = [
  'philanthropic_foundation',  // Actual grantmaking foundations (PAFs, PuAFs, family, corporate)
  'international_aid',         // Overseas aid / development orgs
  'service_delivery',          // Direct service providers (disability, housing, health, youth)
  'research_body',             // CRCs, research institutes, science infrastructure
  'peak_body',                 // Sector peak bodies, advocacy orgs, professional associations
  'religious_organisation',    // Churches, religious charities, faith-based (non-service)
  'emergency_relief',          // Disaster relief, fire brigades, emergency funds
  'health_charity',            // Disease-specific charities (cancer, diabetes, MS, etc.)
  'environmental',             // Conservation, wildlife, environmental advocacy
  'arts_culture',              // Arts, museums, cultural organisations
  'sport_recreation',          // Sporting bodies, surf lifesaving, RSL
  'education_body',            // Schools, training bodies, scholarship funds
  'indigenous_organisation',   // Aboriginal land councils, ACCHOs, indigenous peak bodies
  'community_foundation',      // Community foundations, giving circles, regional funds
  'primary_health_network',    // PHNs and health networks
  'animal_welfare',            // RSPCA, animal protection
  'other',                     // Doesn't fit any category
];

async function callMinimax(prompt, maxTokens = 4000) {
  if (!MINIMAX_KEY) throw new Error('MINIMAX_API_KEY not set');
  const resp = await fetch('https://api.minimaxi.chat/v1/text/chatcompletion_v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_KEY}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.05,
    }),
  });
  if (!resp.ok) throw new Error(`MiniMax ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

async function classifyBatch(names) {
  const prompt = `You are classifying Australian charitable organisations by type. For each organisation name, assign exactly ONE type from this list:

TYPES:
- philanthropic_foundation: Actual grantmaking foundations that give money to other orgs (Private Ancillary Funds, Public Ancillary Funds, family foundations, corporate foundations). Key signal: the name contains "foundation", "trust", "fund" AND the org's purpose is to give grants.
- international_aid: Overseas aid, development, humanitarian relief orgs (e.g., World Vision, CARE, Oxfam, Islamic Relief)
- service_delivery: Direct service providers — disability, housing, aged care, youth services, community health, family support, employment
- research_body: CRCs, research institutes, science infrastructure, clinical trials
- peak_body: Sector peak bodies, professional associations, advocacy coalitions, networks
- religious_organisation: Churches, religious orders, faith-based orgs (NOT religious charities that deliver services)
- emergency_relief: Disaster relief funds, fire brigade trusts, SES, emergency aid
- health_charity: Disease-specific charities — cancer councils, diabetes, MS, mental health orgs
- environmental: Conservation, wildlife, land management, environmental advocacy (Landcare, Greenpeace, Sea Shepherd)
- arts_culture: Arts organisations, museums, film/documentary, cultural programs
- sport_recreation: Sporting bodies, surf lifesaving, RSL, recreation clubs
- education_body: Schools, training boards, scholarship funds focused on student support
- indigenous_organisation: Aboriginal land councils, ACCHOs, indigenous community orgs, native title
- community_foundation: Community foundations, regional giving circles, community trusts that pool donations
- primary_health_network: PHNs, health collaboratives, Medicare Locals
- animal_welfare: RSPCA, animal rescue, wildlife protection
- other: Doesn't clearly fit any category

IMPORTANT RULES:
- "Foundation" in the name does NOT automatically mean philanthropic_foundation. Many service delivery orgs have "foundation" in their name.
- A philanthropic_foundation's PRIMARY purpose is giving grants to OTHER organisations.
- If an org delivers services directly to people (housing, disability, health care), it's service_delivery even if it has "foundation" in the name.
- Religious orders that run services (Sisters of St John of God, Centacare) = service_delivery, not religious_organisation.

Classify each organisation. Return ONLY a JSON object mapping name → type. No other text.

Organisations:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;

  const response = await callMinimax(prompt, 4000);

  // Extract JSON from response
  const match = response.match(/\{[\s\S]*\}/);
  if (!match) {
    log(`  Failed to parse LLM response`);
    return {};
  }

  try {
    const result = JSON.parse(match[0]);
    // Validate types
    const validated = {};
    for (const [name, type] of Object.entries(result)) {
      if (VALID_TYPES.includes(type)) {
        validated[name] = type;
      } else {
        validated[name] = 'other';
      }
    }
    return validated;
  } catch (e) {
    log(`  JSON parse error: ${e.message}`);
    return {};
  }
}

async function main() {
  log(`Foundation Type Classification (LLM-assisted)`);
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}\n`);

  // Get all remaining grantmakers
  const { data: foundations, error } = await db.from('foundations')
    .select('id, name, acnc_abn, total_giving_annual')
    .eq('type', 'grantmaker')
    .order('total_giving_annual', { ascending: false, nullsFirst: false });

  if (error) {
    log(`Error: ${error.message}`);
    process.exit(1);
  }

  log(`Found ${foundations.length} foundations to classify\n`);

  const BATCH_SIZE = 40;
  const typeCounts = {};
  let classified = 0;
  let updated = 0;

  for (let i = 0; i < foundations.length; i += BATCH_SIZE) {
    const batch = foundations.slice(i, i + BATCH_SIZE);
    const names = batch.map(f => f.name);

    log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(foundations.length / BATCH_SIZE)} (${names.length} names)...`);

    const classifications = await classifyBatch(names);

    for (const f of batch) {
      const newType = classifications[f.name];
      if (!newType) continue;

      classified++;
      typeCounts[newType] = (typeCounts[newType] || 0) + 1;

      if (!DRY_RUN && newType !== 'other') {
        const { error: updateError } = await db.from('foundations')
          .update({ type: newType })
          .eq('id', f.id);

        if (updateError) {
          log(`  Error updating ${f.name}: ${updateError.message}`);
        } else {
          updated++;
        }
      }
    }

    await sleep(2000); // rate limit
  }

  log('\n═══════════════════════════════════════');
  log('CLASSIFICATION RESULTS');
  log('═══════════════════════════════════════');

  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sorted) {
    log(`  ${type.padEnd(28)} ${count}`);
  }

  log(`\n  Total classified: ${classified}/${foundations.length}`);
  log(`  Updated in DB:    ${DRY_RUN ? '0 (dry run)' : updated}`);
  log('═══════════════════════════════════════');
}

main().catch(e => { console.error(e); process.exit(1); });

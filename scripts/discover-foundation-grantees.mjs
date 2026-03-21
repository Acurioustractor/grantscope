#!/usr/bin/env node

/**
 * discover-foundation-grantees.mjs
 *
 * LLM-assisted grantee discovery: scrapes foundation websites and uses AI
 * to extract grantee names, then matches against gs_entities.
 *
 * Uses the readiness view to find foundations that have ABN + entity but no grantees,
 * then scrapes their website for grant recipient information.
 *
 * Usage:
 *   node --env-file=.env scripts/discover-foundation-grantees.mjs [--dry-run] [--apply] [--limit=10] [--verbose]
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = !process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '10');
const MINIMAX_KEY = process.env.MINIMAX_API_KEY;

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const USER_AGENT = 'CivicGraph/1.0 (research; civicgraph.au)';

function curl(url, timeout = 15) {
  try {
    const escaped = url.replace(/'/g, "'\\''");
    return execSync(
      `curl -sL --max-time ${timeout} --max-redirs 3 -H 'User-Agent: ${USER_AGENT}' '${escaped}'`,
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: (timeout + 5) * 1000 }
    );
  } catch { return null; }
}

function extractTextFromHtml(html, maxChars = 12000) {
  if (!html) return '';
  // Strip scripts, styles, nav, footer
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, maxChars);
}

async function callMinimax(prompt, maxTokens = 2000) {
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
      temperature: 0.1,
    }),
  });
  if (!resp.ok) throw new Error(`MiniMax ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

async function discoverGranteesFromWebsite(foundationName, websiteUrl) {
  // Normalize URL
  if (!websiteUrl.startsWith('http')) websiteUrl = 'https://' + websiteUrl;

  // Try common grantee/partner pages
  const pagePaths = [
    '', // homepage
    '/grants', '/our-grants', '/grant-recipients',
    '/partners', '/our-partners', '/who-we-fund',
    '/grantees', '/funded-projects', '/our-work',
    '/impact', '/annual-report', '/recipients',
  ];

  let allText = '';
  let pagesScraped = 0;

  for (const path of pagePaths) {
    const url = websiteUrl.replace(/\/$/, '') + path;
    const html = curl(url);
    if (html && html.length > 500) {
      const text = extractTextFromHtml(html, 6000);
      if (text.length > 200) {
        allText += `\n--- PAGE: ${path || '/'} ---\n${text}\n`;
        pagesScraped++;
      }
    }
    if (allText.length > 20000) break;
    await sleep(500); // polite crawl delay
  }

  if (allText.length < 300) return [];

  // Use LLM to extract grantee names
  const prompt = `You are analyzing the website content of "${foundationName}", an Australian philanthropic foundation.

Extract ALL organisation names that appear to be grant recipients, funded partners, or grantees of this foundation.

Rules:
- Only include Australian organisations (charities, nonprofits, community groups, Indigenous organisations, research centres)
- Do NOT include the foundation itself, its board members, staff, or parent company
- Do NOT include government departments or agencies
- Do NOT include international organisations unless they have Australian operations
- Include the full legal name where possible
- If no grantees are found, return an empty array

Website content:
${allText.slice(0, 15000)}

Return ONLY a JSON array of organisation name strings, no other text. Example: ["Org A", "Org B"]`;

  try {
    const response = await callMinimax(prompt);
    // Extract JSON array from response
    const match = response.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const names = JSON.parse(match[0]);
    return Array.isArray(names) ? names.filter(n => typeof n === 'string' && n.length > 2) : [];
  } catch (e) {
    log(`  LLM error for ${foundationName}: ${e.message}`);
    return [];
  }
}

async function matchGranteeToEntity(granteeName) {
  // Strategy 1: Direct name match
  const { data: direct } = await db.from('gs_entities')
    .select('id, gs_id, canonical_name, abn, entity_type')
    .ilike('canonical_name', `%${granteeName}%`)
    .limit(3);

  if (direct?.length === 1) return direct[0];

  // Strategy 2: ACNC charity lookup
  const { data: acnc } = await db.from('acnc_charities')
    .select('abn, name')
    .ilike('name', `%${granteeName}%`)
    .limit(3);

  if (acnc?.length === 1) {
    const { data: entity } = await db.from('gs_entities')
      .select('id, gs_id, canonical_name, abn, entity_type')
      .eq('abn', acnc[0].abn)
      .limit(1);
    if (entity?.[0]) return entity[0];
  }

  // Strategy 3: Fuzzy trigram match (if available)
  if (direct?.length > 1) {
    // Pick best match by shortest name (most specific)
    return direct.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
  }

  return null;
}

async function insertGrantEdge(foundationEntityId, granteeEntityId, foundationAbn, granteeAbn, foundationName, granteeName) {
  if (DRY_RUN) return true;

  // Check if edge already exists
  const { data: existing } = await db.from('gs_relationships')
    .select('id')
    .eq('source_entity_id', foundationEntityId)
    .eq('target_entity_id', granteeEntityId)
    .eq('dataset', 'foundation_grantees')
    .limit(1);

  if (existing?.length) return false; // already exists

  const { error } = await db.from('gs_relationships').insert({
    source_entity_id: foundationEntityId,
    target_entity_id: granteeEntityId,
    relationship_type: 'funder_grantee',
    dataset: 'foundation_grantees',
    source_name: foundationName,
    target_name: granteeName,
    source_abn: foundationAbn,
    target_abn: granteeAbn,
    confidence: 'scraped',
  });

  if (error) {
    log(`  INSERT error: ${error.message}`);
    return false;
  }
  return true;
}

async function main() {
  const run = await logStart(db, 'discover-foundation-grantees', 'Discover Foundation Grantees');
  const runId = run?.id;

  log(`Foundation Grantee Discovery (LLM-assisted)`);
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'} | Limit: ${LIMIT}`);
  log('');

  // Get foundations ready for grantee discovery from readiness view
  const { data: foundations, error } = await db.rpc('exec_sql', {
    query: `SELECT name, acnc_abn, total_giving_annual::bigint, type, gs_id
            FROM mv_foundation_readiness
            WHERE has_abn AND has_entity AND NOT has_grantees
              AND type IN ('corporate_foundation','trust','private_ancillary_fund','public_ancillary_fund')
              AND total_giving_annual > 500000
            ORDER BY total_giving_annual DESC
            LIMIT ${LIMIT}`
  });

  if (error) {
    log(`Error querying readiness view: ${error.message}`);
    await logFailed(db, runId, error.message);
    process.exit(1);
  }

  const rows = typeof foundations === 'string' ? JSON.parse(foundations) : foundations;
  log(`Found ${rows.length} foundations to process\n`);

  // Get website URLs for these foundations
  const abns = rows.map(r => r.acnc_abn);
  const { data: websites } = await db.from('foundations')
    .select('acnc_abn, website')
    .in('acnc_abn', abns);

  const websiteMap = {};
  for (const w of websites || []) {
    if (w.website) websiteMap[w.acnc_abn] = w.website;
  }

  let totalDiscovered = 0;
  let totalMatched = 0;
  let totalNew = 0;
  let skippedNoWebsite = 0;

  for (const f of rows) {
    const website = websiteMap[f.acnc_abn];
    if (!website) {
      log(`⏭ ${f.name} — no website, skipping`);
      skippedNoWebsite++;
      continue;
    }

    log(`🔍 ${f.name} ($${(f.total_giving_annual / 1e6).toFixed(1)}M) — ${website}`);

    // Get foundation entity
    const { data: fEntity } = await db.from('gs_entities')
      .select('id, gs_id, canonical_name, abn')
      .eq('abn', f.acnc_abn)
      .limit(1);

    if (!fEntity?.[0]) {
      log(`  ⚠ No entity found for ABN ${f.acnc_abn}`);
      continue;
    }

    const granteeNames = await discoverGranteesFromWebsite(f.name, website);
    log(`  Found ${granteeNames.length} potential grantees from website`);
    totalDiscovered += granteeNames.length;

    if (VERBOSE && granteeNames.length > 0) {
      log(`  Names: ${granteeNames.slice(0, 10).join(', ')}${granteeNames.length > 10 ? '...' : ''}`);
    }

    let matched = 0;
    let newEdges = 0;

    for (const name of granteeNames) {
      const entity = await matchGranteeToEntity(name);
      if (entity) {
        matched++;
        const inserted = await insertGrantEdge(
          fEntity[0].id, entity.id,
          f.acnc_abn, entity.abn,
          f.name, entity.canonical_name
        );
        if (inserted) newEdges++;
        if (VERBOSE) log(`    ✅ ${name} → ${entity.canonical_name} (${entity.gs_id})${inserted ? ' [NEW]' : ''}`);
      } else {
        if (VERBOSE) log(`    ❌ ${name} — no match`);
      }
      await sleep(100); // rate limit DB queries
    }

    totalMatched += matched;
    totalNew += newEdges;
    log(`  Matched: ${matched}/${granteeNames.length} | New edges: ${newEdges}`);
    log('');

    await sleep(1000); // polite delay between foundations
  }

  log('═══════════════════════════════════════');
  log(`SUMMARY`);
  log(`  Foundations processed: ${rows.length - skippedNoWebsite}`);
  log(`  Skipped (no website): ${skippedNoWebsite}`);
  log(`  Grantees discovered:  ${totalDiscovered}`);
  log(`  Matched to entities:  ${totalMatched} (${totalDiscovered ? Math.round(100 * totalMatched / totalDiscovered) : 0}%)`);
  log(`  New edges:            ${totalNew}`);
  log(`  Mode:                 ${DRY_RUN ? 'DRY RUN (use --apply to insert)' : 'APPLIED'}`);
  log('═══════════════════════════════════════');

  await logComplete(db, runId, { items_found: totalDiscovered, items_new: totalNew });
}

main().catch(e => { console.error(e); process.exit(1); });

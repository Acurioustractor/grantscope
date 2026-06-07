#!/usr/bin/env node

/**
 * Classify Community Directory Orgs as Social Enterprise Candidates
 *
 * Pre-filters community_directory_orgs (sacommunity / mycommunitydirectory)
 * for social-enterprise signals (op shops, supported employment, "social
 * enterprise" mentions), groups site-level rows into parent orgs, then uses
 * the multi-provider LLM round-robin (same pattern as
 * classify-acnc-social-enterprises.mjs) to confirm SE status before
 * inserting into social_enterprises.
 *
 * Usage:
 *   node --env-file=.env scripts/classify-directory-se-candidates.mjs [--apply] [--state=SA] [--source=sacommunity] [--limit=300] [--min-confidence=0.7]
 *
 * Flags:
 *   --apply            Actually insert into social_enterprises (dry-run by default)
 *   --state=XX         Filter directory orgs by state (default SA)
 *   --source=KEY       Directory source (default sacommunity)
 *   --limit=N          Max candidate GROUPS to classify (default 300)
 *   --min-confidence=N Minimum confidence to insert (default 0.7)
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { MINIMAX_CHAT_COMPLETIONS_URL } from './lib/minimax.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const STATE = process.argv.find(a => a.startsWith('--state='))?.split('=')[1] || 'SA';
const SOURCE = process.argv.find(a => a.startsWith('--source='))?.split('=')[1] || 'sacommunity';
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '300');
const MIN_CONFIDENCE = parseFloat(process.argv.find(a => a.startsWith('--min-confidence='))?.split('=')[1] || '0.7');
const CONCURRENCY = 5;
const RATE_LIMIT_DELAY_MS = 500;
// LLM verdicts persist here so quota-exhausted runs resume instead of re-billing
const CACHE_PATH = 'data/classify-dir-se-cache.jsonl';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[classify-dir-se] ${msg}`);
}

// ---------------------------------------------------------------------------
// LLM Providers — round-robin with fallback (same as classify-acnc-social-enterprises)
// ---------------------------------------------------------------------------
const PROVIDERS = [
  { name: 'minimax', baseUrl: MINIMAX_CHAT_COMPLETIONS_URL, model: 'MiniMax-M2.7', envKey: 'MINIMAX_API_KEY', disabled: false },
  { name: 'anthropic', baseUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001', envKey: 'ANTHROPIC_API_KEY', disabled: false, isAnthropic: true },
  { name: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY', disabled: false },
  { name: 'deepseek', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY', disabled: false },
  { name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY', disabled: false },
];

let currentProviderIndex = 0;

function buildPrompt(group) {
  const sites = group.rows.length > 1 ? `\nSites/locations: ${group.rows.map(r => r.suburb).filter(Boolean).slice(0, 8).join(', ')}` : '';
  return `You are classifying Australian community organisations as social enterprises. A social enterprise is an organisation that:
- Trades goods/services to fulfil its mission (not just fundraising or free services)
- Has a primary social, cultural, or environmental purpose
- Reinvests majority of profit into its mission

Op shops, supported-employment workshops (ADEs), training cafes, and community recycling enterprises ARE social enterprises. Sports clubs, schools, churches, government services, and free community services are NOT.

Based on this organisation's directory listing, classify it:

Name: ${group.baseName}
Directory category: ${group.rep.service_type || 'Not specified'}
Description: ${(group.rep.description || 'Not specified').slice(0, 500)}
State: ${group.rep.state || 'Unknown'}
Suburb: ${group.rep.suburb || 'Unknown'}${sites}

Respond with JSON only:
{
  "is_social_enterprise": true or false,
  "confidence": 0.0 to 1.0,
  "sector": ["one or more of: employment, housing, disability, environment, education, health, arts, food, indigenous, community-development, aged-care, youth, retail, other"],
  "business_model": "brief description of how they trade/operate commercially, or null if not a social enterprise"
}

Keep the JSON answer under 80 tokens and do not include commentary outside the JSON object.`;
}

async function classifyWithLLM(group) {
  const prompt = buildPrompt(group);
  let lastError = null;

  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const provider = PROVIDERS[(currentProviderIndex + attempt) % PROVIDERS.length];
    if (provider.disabled) continue;

    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;

    try {
      const headers = { 'Content-Type': 'application/json' };
      let body;

      if (provider.isAnthropic) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body = JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 500,
        });
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
        const requestBody = {
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: provider.name === 'minimax' ? 1200 : 500,
          response_format: { type: 'json_object' },
        };

        if (provider.name === 'minimax') {
          requestBody.extra_body = { reasoning_split: true };
        }

        body = JSON.stringify(requestBody);
      }

      const response = await fetch(provider.baseUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(provider.name === 'minimax' ? 45000 : 30000),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 401 || /invalid api key|authorized_error|unauthorized/i.test(err)) {
          log(`${provider.name} auth failed -- disabling`);
          provider.disabled = true;
          continue;
        }
        if (response.status === 429 || response.status === 402 ||
            err.includes('rate_limit') || err.includes('quota') ||
            err.includes('Insufficient Balance') || err.includes('credit balance')) {
          log(`${provider.name} rate limited/quota -- disabling`);
          provider.disabled = true;
          continue;
        }
        log(`${provider.name} error ${response.status}: ${err.slice(0, 100)}`);
        continue;
      }

      const json = await response.json();

      if (json.base_resp?.status_code && json.base_resp.status_code !== 0) {
        log(`${provider.name} API error: ${json.base_resp.status_msg || 'unknown'} -- disabling`);
        provider.disabled = true;
        continue;
      }

      const text = provider.isAnthropic
        ? (json.content?.[0]?.text || '')
        : (json.choices?.[0]?.message?.content || '');

      const stripped = text
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/<answer>/gi, '')
        .replace(/<\/answer>/gi, '')
        .replace(/`{3,}json\s*/gi, '')
        .replace(/`{3,}\s*/g, '')
        .trim();
      const preferredText = text.includes('</think>')
        ? text.split('</think>').pop().trim()
        : stripped;

      let jsonStr = preferredText || stripped;
      const firstBrace = jsonStr.indexOf('{');
      if (firstBrace >= 0) jsonStr = jsonStr.slice(firstBrace);
      else jsonStr = '';

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log(`${provider.name} no JSON found for ${group.baseName}`);
        lastError = `${provider.name}: no JSON found`;
        provider.badJsonCount = (provider.badJsonCount || 0) + 1;
        if (provider.badJsonCount >= 3) {
          log(`${provider.name} bad JSON threshold reached -- disabling`);
          provider.disabled = true;
        }
        continue;
      }

      const cleaned = jsonMatch[0]
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        log(`${provider.name} JSON parse error for ${group.baseName}`);
        lastError = `${provider.name}: JSON parse error`;
        provider.badJsonCount = (provider.badJsonCount || 0) + 1;
        if (provider.badJsonCount >= 3) {
          log(`${provider.name} bad JSON threshold reached -- disabling`);
          provider.disabled = true;
        }
        continue;
      }

      currentProviderIndex = (currentProviderIndex + attempt + 1) % PROVIDERS.length;

      return {
        provider: provider.name,
        is_social_enterprise: !!parsed.is_social_enterprise,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        sector: Array.isArray(parsed.sector)
          ? parsed.sector
          : typeof parsed.sector === 'string' && parsed.sector.trim().length > 0
            ? [parsed.sector.trim()]
            : [],
        business_model: typeof parsed.business_model === 'string' ? parsed.business_model : null,
      };

    } catch (err) {
      log(`${provider.name} error: ${err.message?.slice(0, 100) || String(err)}`);
      lastError = `${provider.name}: ${err.message?.slice(0, 160) || String(err)}`;
      continue;
    }
  }

  throw new Error(lastError || 'All LLM providers exhausted');
}

// ---------------------------------------------------------------------------
// Name helpers
// ---------------------------------------------------------------------------

/** Strip site/location suffix: "Lifeline Op Shop - Victor Harbor" -> "Lifeline Op Shop" */
function baseName(name) {
  let base = name.split(/\s+[-–—]\s+/)[0].trim();
  // Trailing ", Kingston South East" style location suffix
  const commaIdx = base.lastIndexOf(',');
  if (commaIdx > 0 && base.length - commaIdx <= 30) base = base.slice(0, commaIdx).trim();
  return base || name.trim();
}

/**
 * Entity types that are not social enterprises even when they trade —
 * service clubs, emergency services, churches (unless the listing IS the shop).
 */
function isBlockedEntityType(name) {
  if (/\b(op.?shop|opportunity shop|family store|bazaar|enterprise)\b/i.test(name)) return false;
  return /\b(rotary club|lions club|apex club|country fire service|cathedral|church|parish|congregation)\b/i.test(name);
}

/** Normalize for dedupe comparison against existing social_enterprises */
function normName(name) {
  return name
    .toLowerCase()
    .replace(/\b(incorporated|inc|limited|ltd|pty|co-operative|cooperative|assoc|association)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Verdict cache — append-only JSONL keyed by source|state|normalized name
// ---------------------------------------------------------------------------

function cacheKey(group) {
  return `${SOURCE}|${STATE}|${normName(group.baseName)}`;
}

function loadCache() {
  const cache = new Map();
  if (!fs.existsSync(CACHE_PATH)) return cache;
  for (const line of fs.readFileSync(CACHE_PATH, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.key) cache.set(entry.key, entry);
    } catch { /* skip corrupt line */ }
  }
  return cache;
}

function appendCache(group, result) {
  const entry = {
    key: cacheKey(group),
    name: group.baseName,
    abn: group.rep.abn || null,
    result,
  };
  fs.appendFileSync(CACHE_PATH, JSON.stringify(entry) + '\n');
}

// ---------------------------------------------------------------------------
// Data fetch
// ---------------------------------------------------------------------------

async function fetchCandidates() {
  // OR-group of SE signals; nested and() for the enterprise+employment combo
  const orFilter = [
    'service_type.ilike.%opportunity shop%',
    'service_type.ilike.%supported employment%',
    'service_type.ilike.%sheltered workshop%',
    'description.ilike.%social enterprise%',
    'description.ilike.%supported employment%',
    'description.ilike.%work experience and job creation%',
    'description.ilike.%opportunity shop%',
    'name.ilike.%op shop%',
    'name.ilike.%opportunity shop%',
    'and(name.ilike.%enterprise%,service_type.ilike.%employment%)',
  ].join(',');

  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('community_directory_orgs')
      .select('id, name, description, service_type, website, abn, suburb, state, postcode, source, source_url')
      .eq('state', STATE)
      .eq('source', SOURCE)
      .or(orFilter)
      .order('name')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Candidate fetch error: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function fetchExistingSEs() {
  const abns = new Set();
  const names = new Set();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('social_enterprises')
      .select('abn, name, state')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Existing SE fetch error: ${error.message}`);
    for (const r of data || []) {
      if (r.abn) abns.add(r.abn.replace(/\s/g, ''));
      if (r.name) names.add(`${normName(r.name)}|${r.state || ''}`);
    }
    if (!data || data.length < PAGE) break;
  }
  return { abns, names };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log(`Starting directory SE candidate classification`);
  log(`  state=${STATE}, source=${SOURCE}, limit=${LIMIT}, min-confidence=${MIN_CONFIDENCE}, apply=${APPLY}`);

  const run = await logStart(supabase, 'classify-directory-se-candidates', 'Classify Directory SE Candidates');

  try {
    const candidates = await fetchCandidates();
    log(`Pre-filter matched ${candidates.length} directory rows`);

    // Group site-level rows into parent orgs by base name
    const groups = new Map();
    let blocked = 0;
    for (const row of candidates) {
      if (isBlockedEntityType(row.name)) { blocked++; continue; }
      const key = normName(baseName(row.name));
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { baseName: baseName(row.name), rows: [] });
      groups.get(key).rows.push(row);
    }
    if (blocked > 0) log(`Blocked ${blocked} rows by entity type (service clubs, emergency services, churches)`);
    // Representative row: prefer one with an ABN, then one with a description
    for (const g of groups.values()) {
      g.rep = g.rows.find(r => r.abn) || g.rows.find(r => r.description) || g.rows[0];
    }

    // Merge name-groups that share an ABN — same parent org listed under
    // variant names (e.g. "ADRA Op Shop" vs "ADRA Op Shop & Community Pantry")
    const byAbn = new Map();
    for (const [key, g] of groups) {
      const abn = g.rep.abn?.replace(/\s/g, '');
      if (!abn) continue;
      if (byAbn.has(abn)) {
        const target = byAbn.get(abn);
        target.rows.push(...g.rows);
        if (g.baseName.length < target.baseName.length) target.baseName = g.baseName;
        groups.delete(key);
      } else {
        byAbn.set(abn, g);
      }
    }
    log(`Grouped into ${groups.size} parent orgs`);

    // Dedupe against existing social_enterprises
    const existing = await fetchExistingSEs();
    let skippedAbn = 0;
    let skippedName = 0;
    const toClassify = [];
    for (const g of groups.values()) {
      const abn = g.rep.abn?.replace(/\s/g, '');
      if (abn && existing.abns.has(abn)) { skippedAbn++; continue; }
      if (existing.names.has(`${normName(g.baseName)}|${g.rep.state || ''}`)) { skippedName++; continue; }
      toClassify.push(g);
    }
    log(`Dedupe: ${skippedAbn} skipped by ABN, ${skippedName} by name+state — ${toClassify.length} to classify`);

    const cache = loadCache();
    const cachedGroups = toClassify.filter(g => cache.has(cacheKey(g)));
    const freshGroups = toClassify.filter(g => !cache.has(cacheKey(g)));
    log(`Verdict cache: ${cachedGroups.length} already judged, ${freshGroups.length} need LLM`);

    const work = freshGroups.slice(0, LIMIT);
    if (work.length === 0 && cachedGroups.length === 0) {
      log('Nothing to classify');
      await logComplete(supabase, run.id, { items_found: 0, items_new: 0 });
      return;
    }

    let totalChecked = 0;
    let classifiedAsSE = 0;
    let inserted = 0;
    let errors = 0;
    const runErrors = [];
    const sectorCounts = {};
    const providerCounts = {};
    const classifications = [];

    async function handleVerdict(group, result) {
      providerCounts[result.provider] = (providerCounts[result.provider] || 0) + 1;

      if (!(result.is_social_enterprise && result.confidence >= MIN_CONFIDENCE)) return;
      classifiedAsSE++;

      for (const s of result.sector) {
        sectorCounts[s] = (sectorCounts[s] || 0) + 1;
      }

      classifications.push({
        name: group.baseName,
        abn: group.rep.abn || null,
        confidence: result.confidence,
        sector: result.sector,
        business_model: result.business_model,
        sites: group.rows.length,
        suburb: group.rep.suburb,
      });

      if (APPLY) {
        const payload = {
          name: group.baseName,
          abn: group.rep.abn?.replace(/\s/g, '') || null,
          source_primary: `${SOURCE}-classified`,
          sources: {
            [SOURCE]: {
              service_type: group.rep.service_type,
              source_url: group.rep.source_url,
              sites: group.rows.map(r => ({ name: r.name, suburb: r.suburb, postcode: r.postcode })).slice(0, 50),
            },
            llm_classification: { confidence: result.confidence, business_model: result.business_model },
          },
          description: group.rep.description?.slice(0, 1000) || null,
          website: group.rep.website || null,
          city: group.rep.suburb || null,
          postcode: group.rep.postcode || null,
          state: group.rep.state || STATE,
          sector: result.sector,
          business_model: result.business_model,
        };

        const { error: insertErr } = await supabase
          .from('social_enterprises')
          .insert(payload);

        if (insertErr) {
          if (/duplicate key value/i.test(insertErr.message)) {
            log(`Duplicate social enterprise skipped for ${group.baseName}`);
          } else {
            log(`Insert error for ${group.baseName}: ${insertErr.message}`);
            errors++;
            if (runErrors.length < 25) runErrors.push(`Insert error for ${group.baseName}: ${insertErr.message}`);
          }
        } else {
          inserted++;
        }
      }
    }

    // Replay cached verdicts first — no LLM cost
    for (const group of cachedGroups) {
      totalChecked++;
      await handleVerdict(group, cache.get(cacheKey(group)).result);
    }

    for (let i = 0; i < work.length; i += CONCURRENCY) {
      const batch = work.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (group) => {
          const result = await classifyWithLLM(group);
          await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
          return { group, result };
        })
      );

      for (const res of results) {
        totalChecked++;

        if (res.status === 'rejected') {
          errors++;
          if (runErrors.length < 25) runErrors.push(res.reason?.message || res.reason);
          log(`Error: ${res.reason?.message || res.reason}`);
          if (String(res.reason).includes('All LLM providers exhausted')) {
            log('All providers exhausted -- stopping (verdicts so far are cached; re-run to resume)');
            printSummary(totalChecked, classifiedAsSE, inserted, errors, sectorCounts, providerCounts);
            if (!APPLY) printDryRun(classifications);
            await logComplete(supabase, run.id, {
              items_found: totalChecked,
              items_new: inserted,
              status: 'partial',
              errors: runErrors,
            });
            return;
          }
          continue;
        }

        const { group, result } = res.value;
        if (!result) {
          errors++;
          continue;
        }

        appendCache(group, result);
        await handleVerdict(group, result);
      }

      if (totalChecked % 25 === 0 || totalChecked === work.length) {
        log(`Progress: ${totalChecked}/${work.length} checked, ${classifiedAsSE} classified as SE, ${errors} errors`);
        log(`  Providers: ${Object.entries(providerCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }
    }

    printSummary(totalChecked, classifiedAsSE, inserted, errors, sectorCounts, providerCounts);

    if (!APPLY) printDryRun(classifications);

    await logComplete(supabase, run.id, {
      items_found: totalChecked,
      items_new: inserted,
      items_updated: classifiedAsSE,
      status: errors > 0 ? 'partial' : 'success',
      errors: runErrors,
    });

  } catch (err) {
    log(`Fatal error: ${err.message}`);
    await logFailed(supabase, run.id, err);
    process.exit(1);
  }
}

function printDryRun(classifications) {
  if (classifications.length === 0) return;
  log('\n--- DRY RUN: Classifications (would insert) ---');
  for (const c of classifications) {
    log(`  ${c.name}${c.sites > 1 ? ` [${c.sites} sites]` : ''} (ABN: ${c.abn || 'none'})`);
    log(`    Confidence: ${c.confidence}, Sector: ${c.sector.join(', ')}, Suburb: ${c.suburb || '?'}`);
    log(`    Business model: ${c.business_model || 'N/A'}`);
  }
  log('\nRe-run with --apply to insert these records.');
}

function printSummary(totalChecked, classifiedAsSE, inserted, errors, sectorCounts, providerCounts) {
  log('\n========== SUMMARY ==========');
  log(`Total checked:       ${totalChecked}`);
  log(`Classified as SE:    ${classifiedAsSE}`);
  log(`Inserted:            ${inserted}`);
  log(`Errors:              ${errors}`);
  log(`Classification rate: ${totalChecked > 0 ? ((classifiedAsSE / totalChecked) * 100).toFixed(1) : 0}%`);
  log('');
  log('Sector breakdown:');
  const sorted = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]);
  for (const [sector, count] of sorted) {
    log(`  ${sector}: ${count}`);
  }
  log('');
  log('Provider usage:');
  for (const [provider, count] of Object.entries(providerCounts)) {
    log(`  ${provider}: ${count}`);
  }
  log('=============================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

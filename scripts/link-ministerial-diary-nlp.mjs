#!/usr/bin/env node
/**
 * link-ministerial-diary-nlp.mjs
 *
 * Entity linking for ministerial diary entries using reverse-lookup strategy:
 * Instead of extracting org names from messy text (unreliable with OCR artifacts),
 * we load known entity names and search for them within the diary text.
 *
 * Strategy:
 * 1. Fix OCR artifacts in diary text (space-insertions, split years)
 * 2. Build a lookup of ~10K high-relevance entities (orgs, not persons)
 * 3. Search each diary entry for matching entity names
 * 4. Also parse "Person, Role at Org" patterns for direct extraction
 *
 * Usage:
 *   node --env-file=.env scripts/link-ministerial-diary-nlp.mjs [--dry-run] [--verbose]
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ── OCR artifact fixer ──────────────────────────────────────────────
function fixOcr(text) {
  if (!text) return '';
  return text
    // Fix split years: "202 5" → "2025", "20 25" → "2025"
    .replace(/\b(20)\s+(2[0-9])\b/g, '$1$2')
    .replace(/\b(202)\s+(\d)\b/g, '$1$2')
    // Fix common OCR splits (specific known cases)
    .replace(/For\s+tescue/gi, 'Fortescue')
    .replace(/Andr\s+ew/gi, 'Andrew')
    .replace(/Fra\s+ser/gi, 'Fraser')
    .replace(/Ca\s+binet/gi, 'Cabinet')
    .replace(/Fe\s+bruary/gi, 'February')
    .replace(/Augu\s+st/gi, 'August')
    .replace(/Febr\s+uary/gi, 'February')
    .replace(/Septem\s+ber/gi, 'September')
    .replace(/Octo\s+ber/gi, 'October')
    .replace(/Novem\s+ber/gi, 'November')
    .replace(/Decem\s+ber/gi, 'December')
    // Fix OCR spaces in common words: "Departmentof" → "Department of"
    .replace(/Departmentof/g, 'Department of')
    .replace(/Premierand/g, 'Premier and')
    .replace(/Mayorof/g, 'Mayor of')
    .replace(/CEOof/g, 'CEO of')
    // Fix artifacts: " -" → "-"
    .replace(/\s+-\s*/g, '-')
    .replace(/\s+,/g, ',')
    // Normalize whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Internal meeting filter ─────────────────────────────────────────
function isInternalMeeting(org) {
  if (!org) return true;
  const t = fixOcr(org).toLowerCase();
  // Entries starting with "Hon" are minister-to-minister meetings (not external orgs)
  if (/^hon\s/i.test(t)) return true;
  // Entries starting with dates are PDF artifacts
  if (/^\d{1,2}\s+\w+\s+\d{4}\s/i.test(t)) return true;
  // Entries starting with "Deputy" or "Acting" + govt role
  if (/^(deputy|acting)\s+(director|commissioner|police)/i.test(t)) return true;
  // Commissioner meetings are internal govt
  if (/^commissioner,?\s/i.test(t)) return true;
  // Director-General meetings
  if (/^(di\s*rector|d-g)/i.test(t)) return true;
  // Entries starting with numbers + meeting refs (CBRC, etc.)
  if (/^(5\s+premier|cbrc)/i.test(t)) return true;
  // Diplomatic meetings (His/Her Excellency) — valid but unlikely to match entities
  if (/^(his|her)\s+excellency/i.test(t)) return true;
  // "Cabinet Ministers" + other people — these are multi-party internal meetings
  if (/^cabinet ministers/i.test(t)) return true;

  // If the entire text is just internal meeting types
  const stripped = t
    .replace(/\b(ministerial staff|cabinet ministers?|government ministers?|departmental staff|pre-cabinet|briefing|weather|portfolio matters?|acting director-general|deputy director-general|director-general|a\/director-general|acting police commissioner|acting commissioner|deputy commissioner|acting victims commissioner|state disaster coordinator)\b/gi, '')
    .replace(/\b(department of \w[\w\s,]*)/gi, '') // Remove department refs
    .replace(/\b(hon\s+\w+\s+\w+\s+mp)\b/gi, '') // Remove Hon X Y MP
    .replace(/\b\w+\s+mp\b/gi, '') // Remove "Name MP"
    .replace(/\b(member for \w+)\b/gi, '') // Remove "Member for X"
    .replace(/[,\s]+/g, ' ').trim();
  return stripped.length < 10;
}

// ── Load high-relevance entities for lookup ─────────────────────────
async function loadEntityLookup() {
  log('Loading entity lookup table...');

  // Load orgs (not persons) with names ≥ 6 chars to avoid false positives
  // Focus on entity types likely to meet ministers
  const types = ['company', 'charity', 'ngo', 'government', 'statutory_body',
    'university', 'industry_body', 'union', 'foundation', 'lobby_firm',
    'local_government', 'state_government', 'federal_government',
    'political_party', 'media', 'corporation', 'trust', 'cooperative',
    'association', 'consortium', 'peak_body', 'research_institute'];

  const entities = [];
  // Paginate in batches of 1000 (PostgREST limit)
  for (const type of types) {
    let offset = 0;
    while (true) {
      const { data, error } = await db
        .from('gs_entities')
        .select('id, canonical_name, abn, entity_type')
        .eq('entity_type', type)
        .gte('canonical_name', '      ') // name ≥ 6 chars (hacky but works)
        .range(offset, offset + 999);

      if (error || !data?.length) break;
      entities.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }
  }

  // Also load entities that are specifically lobbyists/lobby firms
  const { data: lobbyists } = await db
    .from('gs_entities')
    .select('id, canonical_name, abn, entity_type')
    .ilike('canonical_name', '%lobby%')
    .limit(500);
  if (lobbyists?.length) entities.push(...lobbyists);

  log(`Loaded ${entities.length} entities for lookup`);

  // Build name→entity map, keyed by uppercase name
  // Only include names ≥ 6 chars to avoid false matches
  const lookup = new Map();
  for (const e of entities) {
    const name = e.canonical_name?.trim();
    if (!name || name.length < 6) continue;
    const key = name.toUpperCase();
    // Prefer entities with ABNs (more reliable)
    if (!lookup.has(key) || (e.abn && !lookup.get(key).abn)) {
      lookup.set(key, e);
    }
  }

  log(`${lookup.size} unique entity names in lookup`);
  return lookup;
}

// ── Manual known-org aliases ────────────────────────────────────────
// These handle cases where diary text uses abbreviated/informal names
const MANUAL_ALIASES = {
  'QUT': 'QUEENSLAND UNIVERSITY OF TECHNOLOGY',
  'RACQ': 'THE ROYAL AUTOMOBILE CLUB OF QUEENSLAND LTD',
  'BOM': 'BUREAU OF METEOROLOGY',
  'QPS': 'QUEENSLAND POLICE SERVICE',
  'LGAQ': 'LOCAL GOVERNMENT ASSOCIATION OF QUEENSLAND',
  'CFMEU': 'CONSTRUCTION FORESTRY MARITIME MINING AND ENERGY UNION',
  'FORTESCUE': 'FORTESCUE METALS GROUP LTD',
  'FORTESCUE METALS': 'FORTESCUE METALS GROUP LTD',
  'VILLAGE ROADSHOW': 'VILLAGE ROADSHOW LIMITED',
  'INSURANCE COUNCIL OF AUSTRALIA': 'INSURANCE COUNCIL OF AUSTRALIA',
  'UNITED WORKERS UNION': 'UNITED WORKERS UNION',
  'CLONTARF FOUNDATION': 'CLONTARF FOUNDATION',
  'ISLAMIC COLLEGE OF BRISBANE': 'ISLAMIC COLLEGE OF BRISBANE',
  'QUEENSLAND TEACHERS UNION': 'QUEENSLAND TEACHERS UNION',
  'ERNST & YOUNG': 'ERNST & YOUNG',
  'TOWNSVILLE ENTERPRISE': 'TOWNSVILLE ENTERPRISE LIMITED',
  'BRISBANE FESTIVAL': 'BRISBANE FESTIVAL LTD',
  'SUNCORP': 'SUNCORP GROUP LIMITED',
  'ADANI': 'ADANI MINING PTY LTD',
  'TELSTRA': 'TELSTRA LIMITED',
  'QANTAS': 'QANTAS AIRWAYS LIMITED',
  'RIO TINTO': 'RIO TINTO LIMITED',
  'BHP': 'BHP GROUP LIMITED',
  'SANTOS': 'SANTOS LIMITED',
  'ORIGIN ENERGY': 'ORIGIN ENERGY LIMITED',
  'CANSTRUCT': 'CANSTRUCT PTY LTD',
};

// ── Search for entity names in diary text ───────────────────────────
function findEntityInText(text, lookup) {
  const cleaned = fixOcr(text).toUpperCase();

  // First check manual aliases
  for (const [alias, canonical] of Object.entries(MANUAL_ALIASES)) {
    if (cleaned.includes(alias)) {
      // Try to find the canonical name in lookup
      const entity = lookup.get(canonical);
      if (entity) return { entity, matchedVia: `alias: ${alias}` };
      // If not in lookup, try ILIKE search later
      return { aliasMatch: canonical, matchedVia: `alias: ${alias}` };
    }
  }

  // Skip entity names that are commonly embedded as context, not meeting targets
  const CONTEXT_NOISE = [
    'DEPARTMENT OF THE PREMIER AND CAB',
    'DEPARTMENT OF NATURAL RESOURCES',
    'DEPARTMENT OF TRANSPORT',
    'DEPARTMENT OF EDUCATION',
    'DEPARTMENT OF JUSTICE',
    'DEPARTMENT OF HEALTH',
    'QUEENSLAND POLICE SERVICE',  // handled via alias instead
    'QUEENSLAND CORRECTIVE SERVICES', // handled via alias
    'BRISBANE CITY COUNCIL', // too common as location context
    'COMMUNITY GRO INC', // truncated name, false positive
  ];

  // Search for known entity names in the text
  // Sort by name length (longest first) to avoid partial matches
  const candidates = [];

  for (const [name, entity] of lookup) {
    if (name.length < 15) continue; // Skip short names (too many false positives)
    if (entity.entity_type === 'person') continue; // Skip person entities
    if (CONTEXT_NOISE.some(n => name.startsWith(n))) continue;
    if (cleaned.includes(name)) {
      candidates.push({ entity, name, matchedVia: 'exact_in_text' });
    }
  }

  if (candidates.length > 0) {
    // Pick longest match (most specific)
    candidates.sort((a, b) => b.name.length - a.name.length);
    return candidates[0];
  }

  return null;
}

// ── Fallback: try to extract and search via Supabase ILIKE ──────────
async function fallbackSearch(text) {
  const cleaned = fixOcr(text);

  // Try to extract org name from common patterns
  const patterns = [
    // "Person, CEO at OrgName"
    /(?:CEO|Chair|Director|President|Managing Director)\s+(?:at|of|,)\s+([A-Z][A-Za-z\s&'.-]+?)(?:\s*,|\s*$)/i,
    // "Person, OrgName" where OrgName has org-like suffix
    /,\s+([A-Z][A-Za-z\s&'.-]*(?:Ltd|Pty|Inc|Foundation|Association|University|Council|Trust|Group|Union|Commission|Authority|Institute|Board|Australia|Queensland|Services|Network)(?:\s+\w+)?)/i,
    // Full text is an org name
    /^([A-Z][A-Za-z\s&'.-]*(?:Ltd|Pty|Foundation|Association|University|Council|Trust|Group|Union|Commission|Authority|Institute|Board))/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const orgName = match[1].trim();
      if (orgName.length < 6) continue;

      const { data } = await db
        .from('gs_entities')
        .select('id, canonical_name, abn, entity_type')
        .ilike('canonical_name', `%${orgName}%`)
        .neq('entity_type', 'person')
        .limit(3);

      // Filter to non-person entities and verify the match is reasonable
      const filtered = (data || []).filter(d =>
        d.entity_type !== 'person' &&
        // Name similarity check: entity name shouldn't be wildly different length
        d.canonical_name.length < orgName.length * 3
      );
      if (filtered.length === 1) {
        return { entity: filtered[0], matchedVia: `fallback: "${orgName}"` };
      }
      if (filtered.length > 1) {
        const best = filtered.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
        return { entity: best, matchedVia: `fallback: "${orgName}"` };
      }
    }
  }

  // Try searching for multi-word proper nouns in the text
  // Extract sequences of capitalized words that might be org names
  const properNouns = cleaned.match(/(?:[A-Z][a-z]+(?:\s+(?:of|the|and|for)\s+)?){2,5}[A-Z][a-z]+/g);
  if (properNouns) {
    for (const noun of properNouns) {
      if (noun.length < 10) continue;
      // Skip person-like names (first last format)
      if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(noun)) continue;

      const { data } = await db
        .from('gs_entities')
        .select('id, canonical_name, abn, entity_type')
        .ilike('canonical_name', `%${noun}%`)
        .neq('entity_type', 'person')
        .limit(3);

      if (data?.length === 1) {
        return { entity: data[0], matchedVia: `proper_noun: "${noun}"` };
      }
    }
  }

  return null;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  log(`Ministerial Diary NLP Entity Linker (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`);

  // Load entity lookup table
  const lookup = await loadEntityLookup();

  // Fetch ALL unlinked entries (paginate past PostgREST 1000-row limit)
  const entries = [];
  let offset = 0;
  while (true) {
    const { data, error } = await db
      .from('civic_ministerial_diaries')
      .select('id, organisation, who_met, minister_name, meeting_date, purpose')
      .is('linked_entity_id', null)
      .not('organisation', 'is', null)
      .order('organisation')
      .range(offset, offset + 999);

    if (error) { log(`Error: ${error.message}`); process.exit(1); }
    if (!data?.length) break;
    entries.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  log(`${entries.length} unlinked entries`);

  let linked = 0;
  let skippedInternal = 0;
  let noMatch = 0;
  const matches = [];
  const unmatched = [];

  for (const entry of entries) {
    if (isInternalMeeting(entry.organisation)) {
      skippedInternal++;
      continue;
    }

    // Step 1: Try in-memory lookup (fast)
    let result = findEntityInText(entry.organisation, lookup);

    // Step 2: If alias matched but entity not in lookup, try DB search
    if (result?.aliasMatch && !result?.entity) {
      const { data } = await db
        .from('gs_entities')
        .select('id, canonical_name, abn, entity_type')
        .ilike('canonical_name', `%${result.aliasMatch}%`)
        .neq('entity_type', 'person')
        .limit(3);

      if (data?.length) {
        const best = data.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
        result = { entity: best, matchedVia: result.matchedVia };
      } else {
        result = null;
      }
    }

    // Step 3: Fallback to regex extraction + DB search
    if (!result) {
      result = await fallbackSearch(entry.organisation);
    }

    if (result?.entity) {
      matches.push({
        diary_id: entry.id,
        raw: entry.organisation.substring(0, 80),
        entity: result.entity.canonical_name,
        entity_id: result.entity.id,
        minister: entry.minister_name,
        via: result.matchedVia,
      });

      if (!DRY_RUN) {
        const { error: updateErr } = await db
          .from('civic_ministerial_diaries')
          .update({ linked_entity_id: result.entity.id })
          .eq('id', entry.id);

        if (updateErr) log(`  UPDATE ERROR: ${updateErr.message}`);
      }
      linked++;
    } else {
      noMatch++;
      const cleaned = fixOcr(entry.organisation).substring(0, 80);
      unmatched.push(cleaned);
      if (VERBOSE) log(`  ✗ "${cleaned}"`);
    }
  }

  // Results
  log('\n── Results ──────────────────────────────────');
  log(`Total entries:      ${entries.length}`);
  log(`Skipped (internal): ${skippedInternal}`);
  log(`Linked:             ${linked}`);
  log(`No match:           ${noMatch}`);
  log(`Link rate:          ${((linked / (entries.length - skippedInternal)) * 100).toFixed(1)}%`);

  if (matches.length) {
    log('\n── Matches ──────────────────────────────────');
    for (const m of matches) {
      log(`  ✓ ${m.entity} ← "${m.raw.substring(0, 60)}" [${m.via}] (${m.minister})`);
    }
  }

  if (unmatched.length && (VERBOSE || unmatched.length <= 20)) {
    log('\n── Unmatched ────────────────────────────────');
    for (const u of unmatched.slice(0, 50)) {
      log(`  ✗ "${u}"`);
    }
    if (unmatched.length > 50) log(`  ... and ${unmatched.length - 50} more`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

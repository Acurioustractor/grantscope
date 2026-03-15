#!/usr/bin/env node

/**
 * Contact → Entity Linkage Engine (Relationship Flywheel — Stage 2: LINK)
 *
 * Bridges CRM contacts (ghl_contacts) to CivicGraph entities (gs_entities).
 * Three linkage methods, run in priority order:
 *   1. Email domain match — contact email domain ↔ entity website domain
 *   2. Company name fuzzy match — pg_trgm similarity on company_name ↔ canonical_name
 *   3. ABN match — contact company ABN ↔ entity ABN (if available)
 *
 * Usage:
 *   node --env-file=.env scripts/link-contacts-to-entities.mjs [--dry-run] [--limit=100]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Free email domains to exclude from matching
const FREE_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com',
  'me.com', 'live.com', 'bigpond.com', 'optusnet.com.au', 'bigpond.net.au',
  'aol.com', 'protonmail.com', 'fastmail.com', 'zoho.com', 'mail.com',
  'ymail.com', 'outlook.com.au', 'live.com.au', 'hotmail.com.au',
  'yahoo.com.au', 'internode.on.net', 'adam.com.au', 'ozemail.com.au',
  'tpg.com.au', 'dodo.com.au', 'westnet.com.au', 'iinet.net.au',
]);

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/**
 * Paginated fetch — Supabase caps at 1000 rows per query
 */
async function fetchAll(table, select, filters = {}) {
  const PAGE = 1000;
  let all = [];
  let offset = 0;
  while (true) {
    let q = db.from(table).select(select).range(offset, offset + PAGE - 1);
    if (filters.notNull) {
      for (const col of filters.notNull) q = q.not(col, 'is', null);
    }
    if (filters.neq) {
      for (const [col, val] of filters.neq) q = q.neq(col, val);
    }
    const { data, error } = await q;
    if (error) throw new Error(`fetchAll ${table}: ${error.message}`);
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

/**
 * Extract domain from URL — handles http(s), www, trailing paths
 */
function extractDomain(urlOrDomain) {
  if (!urlOrDomain) return null;
  try {
    let d = urlOrDomain.trim().toLowerCase();
    if (!d.startsWith('http')) d = 'https://' + d;
    const url = new URL(d);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Stage 1: Email domain matching
 * Match contact email domains to entity website domains.
 */
async function linkByEmailDomain() {
  log('=== PHASE 1: Email Domain Matching ===');

  // Get all contacts with org emails (exclude free providers)
  const contacts = await fetchAll('ghl_contacts', 'id, email, first_name, last_name, company_name', { notNull: ['email'] });

  // Filter to org emails and extract domains
  const contactsByDomain = new Map(); // domain → [contact]
  for (const c of contacts) {
    if (!c.email || !c.email.includes('@')) continue;
    const domain = c.email.split('@')[1].toLowerCase();
    if (FREE_DOMAINS.has(domain)) continue;
    if (!contactsByDomain.has(domain)) contactsByDomain.set(domain, []);
    contactsByDomain.get(domain).push(c);
  }

  log(`Found ${contactsByDomain.size} unique org email domains from ${contacts.length} contacts`);

  // Get all entities with websites
  const entities = await fetchAll('gs_entities', 'id, canonical_name, website, abn', { notNull: ['website'] });

  // Build domain → entity map
  const entityByDomain = new Map();
  for (const e of entities) {
    const domain = extractDomain(e.website);
    if (!domain) continue;
    if (!entityByDomain.has(domain)) entityByDomain.set(domain, []);
    entityByDomain.get(domain).push(e);
  }

  log(`Built domain index: ${entityByDomain.size} unique entity domains`);

  // Match
  let linked = 0;
  const rows = [];

  for (const [domain, domainContacts] of contactsByDomain) {
    const matchedEntities = entityByDomain.get(domain);
    if (!matchedEntities) continue;

    for (const contact of domainContacts) {
      for (const entity of matchedEntities) {
        rows.push({
          contact_id: contact.id,
          entity_id: entity.id,
          confidence_score: 0.85,
          link_method: 'email_domain',
          link_evidence: {
            contact_email_domain: domain,
            entity_website: entity.website,
            entity_name: entity.canonical_name,
          },
        });
        linked++;
      }
    }
  }

  if (!DRY_RUN && rows.length > 0) {
    // Batch upsert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await db
        .from('contact_entity_links')
        .upsert(chunk, { onConflict: 'contact_id,entity_id', ignoreDuplicates: true });
      if (error) log(`Upsert error: ${error.message}`);
    }
  }

  log(`Email domain: ${linked} links ${DRY_RUN ? '(dry run)' : 'created'}`);
  return linked;
}

/**
 * Stage 2: Company name fuzzy matching (pg_trgm)
 * For contacts with company_name but no email domain match yet.
 */
async function linkByFuzzyName() {
  log('=== PHASE 2: Company Name Fuzzy Matching ===');

  // Get contacts with company_name that don't yet have a link
  const contacts = await fetchAll('ghl_contacts', 'id, company_name, first_name, last_name, email', {
    notNull: ['company_name'],
    neq: [['company_name', '']],
  });

  // Filter out contacts already linked
  const existingLinks = await fetchAll('contact_entity_links', 'contact_id');

  const linkedIds = new Set((existingLinks || []).map(l => l.contact_id));
  const unlinked = contacts.filter(c => !linkedIds.has(c.id));

  log(`${unlinked.length} contacts with company_name and no existing link`);

  let linked = 0;
  const rows = [];

  // Use pg_trgm similarity via RPC — batch in groups to avoid timeout
  for (const contact of unlinked) {
    const name = contact.company_name.trim();
    if (name.length < 3) continue;

    // Direct trigram similarity query
    const { data: matches, error } = await db.rpc('search_entities_fuzzy', {
      search_name: name,
      min_similarity: 0.4,
      max_results: 3,
    });

    if (error) {
      // Function might not exist yet — fall back to ILIKE
      if (error.message.includes('search_entities_fuzzy')) {
        log('search_entities_fuzzy RPC not found — using ILIKE fallback');
        return await linkByFuzzyNameFallback(unlinked);
      }
      continue;
    }

    if (matches && matches.length > 0) {
      const best = matches[0];
      rows.push({
        contact_id: contact.id,
        entity_id: best.id,
        confidence_score: Math.min(best.similarity, 0.99),
        link_method: 'fuzzy_name',
        link_evidence: {
          contact_company: name,
          entity_name: best.canonical_name,
          similarity: best.similarity,
        },
      });
      linked++;
    }

    if (LIMIT && linked >= LIMIT) break;
  }

  if (!DRY_RUN && rows.length > 0) {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await db
        .from('contact_entity_links')
        .upsert(chunk, { onConflict: 'contact_id,entity_id', ignoreDuplicates: true });
      if (error) log(`Upsert error: ${error.message}`);
    }
  }

  log(`Fuzzy name: ${linked} links ${DRY_RUN ? '(dry run)' : 'created'}`);
  return linked;
}

/**
 * Fallback: ILIKE matching when pg_trgm RPC doesn't exist
 */
async function linkByFuzzyNameFallback(contacts) {
  log('Using ILIKE fallback for name matching');
  let linked = 0;
  const rows = [];

  for (const contact of contacts) {
    const name = contact.company_name.trim();
    if (name.length < 4) continue;

    const { data: matches } = await db
      .from('gs_entities')
      .select('id, canonical_name, abn')
      .ilike('canonical_name', `%${name}%`)
      .limit(3);

    if (matches && matches.length > 0) {
      // Prefer exact-ish matches
      const best = matches.find(m =>
        m.canonical_name.toLowerCase() === name.toLowerCase()
      ) || matches[0];

      const isExact = best.canonical_name.toLowerCase() === name.toLowerCase();
      rows.push({
        contact_id: contact.id,
        entity_id: best.id,
        confidence_score: isExact ? 0.95 : 0.60,
        link_method: 'fuzzy_name',
        link_evidence: {
          contact_company: name,
          entity_name: best.canonical_name,
          exact_match: isExact,
        },
      });
      linked++;
    }

    if (LIMIT && linked >= LIMIT) break;
  }

  if (!DRY_RUN && rows.length > 0) {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await db
        .from('contact_entity_links')
        .upsert(chunk, { onConflict: 'contact_id,entity_id', ignoreDuplicates: true });
      if (error) log(`Upsert error: ${error.message}`);
    }
  }

  log(`Fuzzy name (ILIKE): ${linked} links ${DRY_RUN ? '(dry run)' : 'created'}`);
  return linked;
}

// ============================================================
// Main
// ============================================================

async function main() {
  log('=== Contact → Entity Linkage Engine ===');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (LIMIT) log(`Limit: ${LIMIT}`);

  const t0 = Date.now();
  let totalLinks = 0;

  // Phase 1: Email domain
  totalLinks += await linkByEmailDomain();

  // Phase 2: Fuzzy name
  totalLinks += await linkByFuzzyName();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  log(`=== DONE === ${totalLinks} total links in ${elapsed}s`);

  // Summary
  const { data: summary } = await db
    .from('contact_entity_links')
    .select('link_method')
    .then(r => {
      if (!r.data) return { data: null };
      const counts = {};
      for (const row of r.data) {
        counts[row.link_method] = (counts[row.link_method] || 0) + 1;
      }
      return { data: counts };
    });

  if (summary) {
    log('Link summary by method:');
    for (const [method, count] of Object.entries(summary)) {
      log(`  ${method}: ${count}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });

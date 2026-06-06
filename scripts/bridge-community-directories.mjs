#!/usr/bin/env node

/**
 * Community Directory → CivicGraph Entity Bridge
 *
 * Promotes scraped community-services listings (community_directory_orgs) into
 * the canonical entity graph. Three phases, conservative by default:
 *
 *   Phase 1 — ABN exact link. Listing.abn → gs_entities.abn. On match, link and
 *             backfill missing contact details (website/email/phone/postcode).
 *             ABN present but not in the graph → create an AU-ABN-{abn} entity.
 *   Phase 2 — Fuzzy name link (state-scoped). Trigram-match listing.name against
 *             gs_entities.canonical_name within the same state, so we never scan
 *             the whole 159K-row table. On match, link + enrich.
 *   Phase 3 — Create NEW entities for unmatched listings. OFF by default
 *             (--create-unmatched): mints GS-DIR-{slug}-{hash}-{state} so the
 *             "more orgs" win is opt-in and never silently pollutes the graph.
 *
 * Enrichment only fills columns that are currently NULL on the target entity —
 * directory data never overwrites better existing data.
 *
 * Usage:
 *   node --env-file=.env scripts/bridge-community-directories.mjs            # DRY RUN
 *   node --env-file=.env scripts/bridge-community-directories.mjs --apply
 *   node --env-file=.env scripts/bridge-community-directories.mjs --apply --create-unmatched
 *   node --env-file=.env scripts/bridge-community-directories.mjs --source=mycommunitydirectory --threshold=0.7
 */

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const argVal = (name, def) => {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const APPLY = process.argv.includes('--apply');
const CREATE_UNMATCHED = process.argv.includes('--create-unmatched');
const SOURCE_FILTER = argVal('source', null);
const LIMIT = parseInt(argVal('limit', '5000'), 10);
const THRESHOLD = parseFloat(argVal('threshold', '0.62'));
// Fuzzy matching only considers org-like entity types. Excludes 'person' (238K
// rows — the biggest false-match surface), 'program', 'political_party', etc.
// 'company' stays in: many NFPs are companies limited by guarantee. Override
// with --entity-types=charity,indigenous_corp to tighten further.
const ENTITY_TYPES = argVal('entity-types',
  'charity,foundation,indigenous_corp,social_enterprise,company,government_body')
  .split(',').map(s => s.trim()).filter(Boolean);

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const log = (msg) => console.log(`[bridge-community-dir] ${msg}`);

// ── Name matching ────────────────────────────────────────────────────────────
function normName(s) {
  return String(s || '').toLowerCase()
    .replace(/\b(the|inc|incorporated|ltd|limited|pty|assoc(iation)?|aboriginal|corporation|services?|ltd\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function trigrams(s) {
  const p = `  ${s} `; const r = [];
  for (let i = 0; i < p.length - 2; i++) r.push(p.slice(i, i + 3));
  return r;
}
function trigramSimilarity(a, b) {
  const A = new Set(trigrams(a)), B = new Set(trigrams(b));
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}
function dirGsId(name, state) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
  const hash = createHash('md5').update(String(name)).digest('hex').slice(0, 4);
  return `GS-DIR-${slug}-${hash}-${(state || 'au').toLowerCase()}`;
}

// Build the set of contact fields to backfill — only where target is NULL.
function enrichPatch(listing, target) {
  const patch = {};
  if (listing.website && !target.website) patch.website = listing.website;
  if (listing.email && !target.email) { patch.email = listing.email; patch.contact_source = 'community-directory'; }
  if (listing.phone && !target.phone) patch.phone = listing.phone;
  if (listing.postcode && !target.postcode) patch.postcode = listing.postcode;
  if (listing.state && !target.state) patch.state = listing.state;
  return patch;
}

// ── Data loading ─────────────────────────────────────────────────────────────
async function loadUnlinkedListings() {
  const rows = [];
  const PAGE = 1000;
  let offset = 0;
  while (rows.length < LIMIT) {
    let q = db.from('community_directory_orgs')
      .select('id, name, abn, website, email, phone, address, suburb, state, postcode, source')
      .is('gs_entity_id', null)
      .range(offset, offset + PAGE - 1);
    if (SOURCE_FILTER) q = q.eq('source', SOURCE_FILTER);
    const { data, error } = await q;
    if (error) throw new Error(`load listings: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return rows.slice(0, LIMIT);
}

// State-scoped gs_entities candidates for fuzzy matching (avoids full scans).
async function loadEntitiesForStates(states) {
  const byState = new Map();
  const PAGE = 1000;
  for (const state of states) {
    const cands = [];
    let offset = 0;
    while (true) {
      const { data, error } = await db.from('gs_entities')
        .select('id, gs_id, canonical_name, abn, website, email, phone, postcode, state')
        .eq('state', state)
        .in('entity_type', ENTITY_TYPES)
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(`load entities (${state}): ${error.message}`);
      if (!data?.length) break;
      for (const e of data) cands.push({ ...e, _norm: normName(e.canonical_name) });
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    byState.set(state, cands);
    log(`  candidates for ${state}: ${cands.length}`);
  }
  return byState;
}

async function linkAndEnrich(listingId, entity, listing, stats) {
  if (!APPLY) { stats.wouldLink++; return; }
  await db.from('community_directory_orgs').update({ gs_entity_id: entity.id }).eq('id', listingId);
  const patch = enrichPatch(listing, entity);
  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    const { error } = await db.from('gs_entities').update(patch).eq('id', entity.id);
    if (!error) stats.enriched++;
  }
  stats.linked++;
}

async function main() {
  const run = await logStart(db, 'bridge-community-directories', 'Bridge Community Directory to Entities');
  const stats = { listings: 0, linkedAbn: 0, createdAbn: 0, linked: 0, enriched: 0, createdNew: 0, wouldLink: 0, unmatched: 0 };
  try {
    log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | source=${SOURCE_FILTER || 'all'} | threshold=${THRESHOLD} | create-unmatched=${CREATE_UNMATCHED} | types=${ENTITY_TYPES.join('+')}`);

    const listings = await loadUnlinkedListings();
    stats.listings = listings.length;
    log(`${listings.length} unlinked listings`);
    if (listings.length === 0) { await logComplete(db, run.id, { items_found: 0, items_new: 0 }); return; }

    // ── Phase 1: ABN exact ────────────────────────────────────────────────
    const withAbn = listings.filter(l => l.abn && /^\d{11}$/.test(String(l.abn).replace(/\s/g, '')));
    const abnList = [...new Set(withAbn.map(l => String(l.abn).replace(/\s/g, '')))];
    const abnToEntity = new Map();
    for (let i = 0; i < abnList.length; i += 300) {
      const batch = abnList.slice(i, i + 300);
      const { data } = await db.from('gs_entities')
        .select('id, gs_id, abn, website, email, phone, postcode, state').in('abn', batch);
      for (const e of (data || [])) abnToEntity.set(e.abn, e);
    }
    const stillUnmatched = [];
    for (const l of listings) {
      const abn = l.abn ? String(l.abn).replace(/\s/g, '') : null;
      if (abn && abnToEntity.has(abn)) {
        await linkAndEnrich(l.id, abnToEntity.get(abn), l, stats);
        stats.linkedAbn++;
      } else if (abn && /^\d{11}$/.test(abn) && CREATE_UNMATCHED) {
        // ABN present but not in graph → create a clean ABN-keyed entity.
        const gs_id = `AU-ABN-${abn}`;
        if (APPLY) {
          await db.from('gs_entities').upsert([{
            gs_id, canonical_name: l.name, abn, entity_type: 'charity',
            website: l.website || null, email: l.email || null, phone: l.phone || null,
            state: l.state || null, postcode: l.postcode || null,
            source_datasets: [l.source], source_count: 1, confidence: 'reported',
            contact_source: l.email || l.phone ? 'community-directory' : null,
            tags: ['community-directory', `${l.source}-source`],
          }], { onConflict: 'gs_id', ignoreDuplicates: true });
          const { data: created } = await db.from('gs_entities').select('id').eq('gs_id', gs_id).single();
          if (created) await db.from('community_directory_orgs').update({ gs_entity_id: created.id }).eq('id', l.id);
        }
        stats.createdAbn++;
      } else {
        stillUnmatched.push(l);
      }
    }
    log(`Phase 1 (ABN): linked=${stats.linkedAbn} created=${stats.createdAbn}`);

    // ── Phase 2: fuzzy name, state-scoped ─────────────────────────────────
    const fuzzyCandidates = stillUnmatched.filter(l => l.state);
    const noState = stillUnmatched.filter(l => !l.state);
    const states = [...new Set(fuzzyCandidates.map(l => l.state))];
    const entitiesByState = states.length ? await loadEntitiesForStates(states) : new Map();

    const leftover = [...noState]; // no state ⇒ can't safely scope ⇒ leave for Phase 3
    for (const l of fuzzyCandidates) {
      const cands = entitiesByState.get(l.state) || [];
      const ln = normName(l.name);
      if (!ln) { leftover.push(l); continue; }
      let best = null, bestScore = 0;
      for (const e of cands) {
        if (!e._norm) continue;
        const score = e._norm === ln ? 1 : trigramSimilarity(ln, e._norm);
        if (score > bestScore) { bestScore = score; best = e; }
        if (score === 1) break;
      }
      if (best && bestScore >= THRESHOLD) {
        await linkAndEnrich(l.id, best, l, stats);
      } else {
        leftover.push(l);
      }
    }
    log(`Phase 2 (fuzzy): linked total=${stats.linked} enriched=${stats.enriched} (would-link dry=${stats.wouldLink})`);

    // ── Phase 3: create new entities for the genuinely-new orgs ────────────
    if (CREATE_UNMATCHED) {
      for (const l of leftover) {
        const gs_id = dirGsId(l.name, l.state);
        if (APPLY) {
          await db.from('gs_entities').upsert([{
            gs_id, canonical_name: l.name, entity_type: 'charity',
            website: l.website || null, email: l.email || null, phone: l.phone || null,
            state: l.state || null, postcode: l.postcode || null,
            source_datasets: [l.source], source_count: 1, confidence: 'reported',
            contact_source: l.email || l.phone ? 'community-directory' : null,
            tags: ['community-directory', `${l.source}-source`, 'name-only'],
          }], { onConflict: 'gs_id', ignoreDuplicates: true });
          const { data: created } = await db.from('gs_entities').select('id').eq('gs_id', gs_id).single();
          if (created) await db.from('community_directory_orgs').update({ gs_entity_id: created.id }).eq('id', l.id);
        }
        stats.createdNew++;
      }
    } else {
      stats.unmatched = leftover.length;
    }

    const newCount = stats.linkedAbn + stats.linked + stats.createdAbn + stats.createdNew + stats.wouldLink;
    log(`Done. listings=${stats.listings} linked=${stats.linkedAbn + stats.linked} created=${stats.createdAbn + stats.createdNew} enriched=${stats.enriched} unmatched-left=${stats.unmatched}`);
    await logComplete(db, run.id, {
      items_found: stats.listings,
      items_new: stats.createdAbn + stats.createdNew,
      items_updated: stats.linkedAbn + stats.linked + stats.enriched,
      status: 'success',
    });
  } catch (err) {
    log(`FATAL: ${err.message}`);
    await logFailed(db, run.id, err);
    process.exitCode = 1;
  }
}

main();

#!/usr/bin/env node

/**
 * Infoxchange Service Directory (Ask Izzy / ISS) Ingest
 *
 * The durable, cloud-friendly path for community-services org discovery. Instead
 * of scraping WAF-protected directory HTML (MyCommunityDirectory blocks datacenter
 * IPs), this hits the Infoxchange Service System (ISS) API that powers Ask Izzy —
 * structured JSON, no IP blocking, no redesign breakage.
 *
 * Writes to the SAME community_directory_orgs staging table (source='infoxchange'),
 * so the existing bridge-community-directories promotes these into gs_entities with
 * no changes.
 *
 * ── Configuration (env) ──────────────────────────────────────────────────────
 *   INFOXCHANGE_API_BASE   ISS API base, e.g. https://api.infoxchange.net.au/service/v3
 *   INFOXCHANGE_API_KEY    API key issued under an Infoxchange data agreement
 *   INFOXCHANGE_API_USER   (optional) API user header, if your agreement uses one
 *
 * Without a key the agent logs a clear message and exits 0 (safe no-op for the
 * scheduler) rather than erroring.
 *
 * ── ISS response shape (verify against your live key) ────────────────────────
 * Search returns { objects: [ service ] } where each service ≈
 *   { id, name, description, web, phones:[{number}], emails:[{email}],
 *     location:{ suburb, state, postcode, street_number, street }, abn,
 *     site:{ name, web }, type, catchment }
 * The mapping below is defensive (multiple fallbacks) but should be confirmed
 * once a real sample response is in hand — the one thing that needs a live key.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-infoxchange-services.mjs                 # DRY RUN
 *   node --env-file=.env scripts/ingest-infoxchange-services.mjs --apply
 *   node --env-file=.env scripts/ingest-infoxchange-services.mjs --area=QLD --limit=500 --apply
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const API_BASE = (process.env.INFOXCHANGE_API_BASE || '').replace(/\/$/, '');
const API_KEY = process.env.INFOXCHANGE_API_KEY || '';
const API_USER = process.env.INFOXCHANGE_API_USER || '';

const argVal = (name, def) => {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const APPLY = process.argv.includes('--apply');
const AREA = argVal('area', null);          // ISS area/location query, e.g. a state or town
const LIMIT = parseInt(argVal('limit', '500'), 10);
const PAGE_SIZE = Math.min(parseInt(argVal('page-size', '50'), 10), 100);
const DELAY_MS = parseInt(argVal('delay-ms', '500'), 10);

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const log = (m) => console.log(`[infoxchange] ${m}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function normaliseState(text) {
  if (!text) return null;
  const s = String(text).trim().toUpperCase();
  if (/\bVIC\b|VICTORIA/.test(s)) return 'VIC';
  if (/\bNSW\b|NEW SOUTH WALES/.test(s)) return 'NSW';
  if (/\bQLD\b|QUEENSLAND/.test(s)) return 'QLD';
  if (/\bWA\b|WESTERN AUSTRALIA/.test(s)) return 'WA';
  if (/\bSA\b|SOUTH AUSTRALIA/.test(s)) return 'SA';
  if (/\bTAS\b|TASMANIA/.test(s)) return 'TAS';
  if (/\bNT\b|NORTHERN TERRITORY/.test(s)) return 'NT';
  if (/\bACT\b|CANBERRA|AUSTRALIAN CAPITAL/.test(s)) return 'ACT';
  return s.length === 2 || s.length === 3 ? s : null;
}
const clean = (v, max = 2000) => {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s ? (s.length > max ? s.slice(0, max) : s) : null;
};

// ── ISS service object → staging row ─────────────────────────────────────────
function mapService(svc) {
  const loc = svc.location || svc.locations?.[0] || {};
  const phone = svc.phones?.[0]?.number || svc.phone || loc.phone || null;
  const email = svc.emails?.[0]?.email || svc.email || null;
  const street = clean([loc.street_number, loc.street].filter(Boolean).join(' '), 200);
  const address = clean([street, loc.suburb, loc.state, loc.postcode].filter(Boolean).join(', '), 500);
  const name = clean(svc.name || svc.site?.name, 300);
  if (!name) return null;
  return {
    name,
    description: clean(svc.description),
    service_type: clean(svc.type || (Array.isArray(svc.catchment) ? svc.catchment.join(', ') : svc.catchment), 200),
    website: clean(svc.web || svc.site?.web, 500),
    phone: clean(phone, 60),
    email: clean(email, 200),
    address,
    suburb: clean(loc.suburb, 120),
    state: normaliseState(loc.state),
    postcode: clean(loc.postcode, 8),
    abn: svc.abn ? String(svc.abn).replace(/\s/g, '') : null,
    source: 'infoxchange',
    source_url: svc.id ? `${API_BASE}/service/${svc.id}` : null,
    raw: svc,
  };
}

async function fetchPage(offset) {
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set('type', 'service');
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('offset', String(offset));
  if (AREA) url.searchParams.set('area', AREA);
  const headers = { 'Accept': 'application/json', 'User-Agent': 'GrantScope/1.0 (community-services research)' };
  if (API_USER) headers['X-Api-User'] = API_USER;
  if (API_KEY) headers['X-Api-Key'] = API_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`ISS HTTP ${res.status} at offset ${offset}`);
  const body = await res.json();
  return body.objects || body.results || body.data || [];
}

async function upsert(rows) {
  let written = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const slice = rows.slice(i, i + 50).map(r => ({ ...r, last_seen: new Date().toISOString() }));
    const { error, count } = await db
      .from('community_directory_orgs')
      .upsert(slice, { onConflict: 'source,source_url', ignoreDuplicates: false, count: 'estimated' });
    if (error) { log(`upsert error: ${error.message}`); continue; }
    written += count ?? slice.length;
  }
  return written;
}

async function main() {
  const run = await logStart(db, 'ingest-infoxchange-services', 'Infoxchange Service Directory Ingest');
  try {
    if (!API_BASE || !API_KEY) {
      log('INFOXCHANGE_API_BASE / INFOXCHANGE_API_KEY not set — skipping (no-op). Configure an ISS key to enable.');
      await logComplete(db, run.id, { items_found: 0, items_new: 0, status: 'success' });
      return;
    }
    log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | area=${AREA || 'all'} | limit=${LIMIT} | page=${PAGE_SIZE}`);

    const collected = [];
    for (let offset = 0; offset < LIMIT; offset += PAGE_SIZE) {
      let objects;
      try { objects = await fetchPage(offset); }
      catch (err) { log(err.message); break; }
      if (!objects.length) break;
      for (const svc of objects) {
        const row = mapService(svc);
        if (row) collected.push(row);
      }
      log(`  offset ${offset}: +${objects.length} (total mapped ${collected.length})`);
      if (objects.length < PAGE_SIZE) break;
      await sleep(DELAY_MS);
    }

    log(`${collected.length} services mapped`);
    if (!APPLY) {
      for (const r of collected.slice(0, 3)) log(`  [dry] ${r.name} — ${r.state || '?'} ${r.postcode || ''}`);
      await logComplete(db, run.id, { items_found: collected.length, items_new: 0, status: 'success' });
      return;
    }
    const written = await upsert(collected);
    log(`upserted ${written}`);
    await logComplete(db, run.id, { items_found: collected.length, items_new: written, status: 'success' });
  } catch (err) {
    log(`FATAL: ${err.message}`);
    await logFailed(db, run.id, err);
    process.exitCode = 1;
  }
}

main();

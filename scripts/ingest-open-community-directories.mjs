#!/usr/bin/env node

/**
 * Open-Data Community Directory Ingest
 *
 * Pulls government open-data community directories (CKAN-published CSV/JSON) into
 * the community_directory_orgs staging table — the same lake the HTML scraper and
 * Infoxchange ingest feed, so bridge-community-directories promotes all of them
 * identically.
 *
 * Why open data first: unlike scraped directories these come with explicit licenses
 * (CC-BY), stable schemas, and — in SA's case — native ABNs, which is exactly what
 * the promotion bridge keys on.
 *
 * Sources:
 *   - sacommunity : SA Community Directory (data.sa.gov.au, CC-BY 3.0 AU).
 *                   ~14.5K orgs, ~52% with valid 11-digit ABNs (verified 2026-06-06).
 *                   2021 snapshot is the latest published; rows carry their own
 *                   Organisation_Last_updated date in raw.
 *
 * Discovery notes (2026-06-06 CKAN sweep, data.gov.au + state portals):
 *   - QLD communitysectorreferral        → client statistics, not a directory. Skipped.
 *   - QLD dccsds-service-locations       → Cloudflare-gated direct download. Parked.
 *   - DSS emergency-relief-provider-*    → 2016 snapshot, stale. Parked.
 *   - Council directories (Lake Macquarie, Ballarat) → small; add here if wanted.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-open-community-directories.mjs            # DRY RUN
 *   node --env-file=.env scripts/ingest-open-community-directories.mjs --apply
 *   node --env-file=.env scripts/ingest-open-community-directories.mjs --source=sacommunity --limit=100 --apply
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
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
const SINGLE_SOURCE = argVal('source', null);
const LIMIT = parseInt(argVal('limit', '0'), 10); // 0 = no cap

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const log = (m) => console.log(`[open-dir] ${m}`);

const clean = (v, max = 2000) => {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s ? (s.length > max ? s.slice(0, max) : s) : null;
};

const cleanAbn = (v) => {
  const digits = String(v || '').replace(/\D/g, '');
  return digits.length === 11 ? digits : null;
};

const cleanWebsite = (v) => {
  const s = clean(v, 500);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};

// ── SA Community Directory (data.sa.gov.au) ──────────────────────────────────
// CSV has duplicate column names (street vs postal address blocks), so parse
// positionally and resolve indices from the header — first occurrence wins,
// which is the street-address block.
const SA_CSV_URL = 'https://data.sa.gov.au/data/dataset/395caf56-f28b-4c47-aac0-4ce07a1eefc4/resource/9f28e1c2-3905-4a58-8ab0-dc07e9363840/download';

async function fetchSaCommunity() {
  log('  downloading SA Community Directory CSV…');
  const res = await fetch(SA_CSV_URL, { headers: { 'User-Agent': 'GrantScope/1.0 (community-services research; ben@act.place)' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for SA Community CSV`);
  const text = await res.text();
  const recs = parse(text, { relax_quotes: true, relax_column_count: true });
  const header = recs[0];
  const idx = {};
  header.forEach((h, i) => { if (!(h in idx)) idx[h] = i; }); // first occurrence = street block
  const col = (row, name) => row[idx[name]];

  const rows = [];
  for (const row of recs.slice(1)) {
    const name = clean(col(row, 'Org_name'), 300);
    if (!name) continue;
    const tagLine = clean(col(row, 'Organisati_Tag_Line'));
    const services = clean(col(row, 'Organisati_Services'));
    const address = clean([
      col(row, 'Street_Address_Line_1'), col(row, 'Street_Address_Line_2'),
      col(row, 'Suburb'), 'SA', col(row, 'Postal_Code'),
    ].filter(Boolean).join(', '), 500);
    const id = clean(col(row, 'ID_19'), 20);
    rows.push({
      name,
      description: clean([tagLine, services].filter(Boolean).join(' — ')),
      service_type: clean([col(row, 'Primary_Category'), col(row, 'Directory_Directory_Entry_1')].filter(Boolean).join(' — '), 200),
      website: cleanWebsite(col(row, 'Website_1')),
      phone: clean(col(row, 'Phone_1'), 60),
      email: clean(col(row, 'Email_StreetAddress_1'), 200),
      address,
      suburb: clean(col(row, 'Suburb'), 120),
      state: 'SA',
      postcode: clean(col(row, 'Postal_Code'), 8),
      abn: cleanAbn(col(row, 'Organisati_ABN')),
      source: 'sacommunity',
      // sacommunity.org's stable per-org page; ID_19 is the sacommunity org id.
      source_url: id ? `https://sacommunity.org/org/${id}` : null,
      raw: Object.fromEntries(header.map((h, i) => [`${h}_${i}`, row[i]]).filter(([, v]) => v)),
    });
  }
  return rows;
}

const SOURCES = {
  sacommunity: { displayName: 'SA Community Directory (data.sa.gov.au)', fetch: fetchSaCommunity },
};

// ── Write ────────────────────────────────────────────────────────────────────
async function upsertBatch(rows) {
  let written = 0;
  const nowIso = new Date().toISOString();
  const withUrl = rows.filter(r => r.source_url);
  const withoutUrl = rows.filter(r => !r.source_url);
  for (const [batchRows, conflict] of [
    [withUrl, 'source,source_url'],
    [withoutUrl, null], // expression-based fallback index — insert, ignore dups
  ]) {
    for (let i = 0; i < batchRows.length; i += 50) {
      const slice = batchRows.slice(i, i + 50).map(r => ({ ...r, last_seen: nowIso }));
      const opts = conflict ? { onConflict: conflict, ignoreDuplicates: false } : { ignoreDuplicates: true };
      const { error, count } = await db
        .from('community_directory_orgs')
        .upsert(slice, { ...opts, count: 'estimated' });
      if (error) { log(`  upsert error: ${error.message}`); continue; }
      written += count ?? slice.length;
    }
  }
  return written;
}

async function run() {
  const runRow = await logStart(db, 'ingest-open-community-directories', 'Open-Data Community Directory Ingest');
  const stats = { found: 0, written: 0, errors: [] };
  try {
    log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | source=${SINGLE_SOURCE || 'all'} | limit=${LIMIT || '∞'}`);
    const sources = SINGLE_SOURCE ? { [SINGLE_SOURCE]: SOURCES[SINGLE_SOURCE] } : SOURCES;

    for (const [key, cfg] of Object.entries(sources)) {
      if (!cfg) { log(`Unknown source: ${key}`); continue; }
      log(`── ${cfg.displayName} ──`);
      let rows;
      try { rows = await cfg.fetch(); }
      catch (err) { stats.errors.push(`${key}: ${err.message}`); continue; }
      if (LIMIT) rows = rows.slice(0, LIMIT);
      const withAbn = rows.filter(r => r.abn).length;
      stats.found += rows.length;
      log(`  ${rows.length} orgs (${withAbn} with valid ABN)`);

      if (!APPLY) {
        for (const r of rows.slice(0, 3)) log(`    [dry] ${r.name} — ${r.suburb || '?'} ${r.postcode || ''} ${r.abn ? 'ABN✓' : ''}`);
        continue;
      }
      const written = await upsertBatch(rows);
      stats.written += written;
      log(`  upserted ${written}`);
    }

    log(`Done. found=${stats.found} written=${stats.written} errors=${stats.errors.length}`);
    await logComplete(db, runRow.id, {
      items_found: stats.found,
      items_new: stats.written,
      status: stats.errors.length > 0 ? 'partial' : 'success',
      errors: stats.errors.slice(0, 20),
    });
  } catch (err) {
    log(`FATAL: ${err.message}`);
    await logFailed(db, runRow.id, err);
    process.exitCode = 1;
  }
}

run();

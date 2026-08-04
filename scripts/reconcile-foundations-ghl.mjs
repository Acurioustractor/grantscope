#!/usr/bin/env node

/**
 * Reconcile the CivicGraph foundation discovery pipeline against GHL,
 * the system of record for relationship state.
 *
 * For each org_project_foundations row on the Goods project:
 *   1. Search GHL contacts by simplified foundation name
 *   2. If matched, cache ghl_contact_id / email / tags / synced_at on the row
 *   3. Report mismatches both ways:
 *      - warm in GHL but parked/saved in discovery (discovery understates)
 *      - high fit in discovery with no GHL contact (never pushed to the core pipeline)
 *
 * Read-only against GHL. Writes only to CivicGraph's own tables.
 *
 * Usage:
 *   node --env-file=.env scripts/reconcile-foundations-ghl.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_BASE = 'https://services.leadconnectorhq.com';
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY || !GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error('FATAL: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GHL_API_KEY, GHL_LOCATION_ID');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

/** Strip trustee/legal noise so "The Trustee For The Snow Foundation" searches as "Snow Foundation". */
function searchName(name) {
  return name
    .replace(/^the trustee for( the)?/i, '')
    .replace(/^the /i, '')
    .replace(/\b(limited|ltd|pty ltd|inc|incorporated|as trustee.*$)\b/gi, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function ghlSearchContacts(query) {
  const res = await fetch(`${GHL_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&query=${encodeURIComponent(query)}&limit=5`, {
    headers: { Authorization: `Bearer ${GHL_API_KEY}`, Version: '2021-07-28' },
  });
  if (!res.ok) throw new Error(`GHL search ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.contacts || [];
}

/** A contact counts as a match when the foundation's core name appears in its
 *  company name or email domain — GHL query search is fuzzy, so re-verify. */
function bestMatch(contacts, core) {
  const needle = core.toLowerCase().split(' ').filter((w) => w.length > 3);
  if (needle.length === 0) return null;
  for (const c of contacts) {
    const hay = `${c.companyName || ''} ${c.email || ''} ${(c.tags || []).join(' ')}`.toLowerCase();
    const hits = needle.filter((w) => hay.includes(w)).length;
    if (hits >= Math.min(2, needle.length)) return c;
  }
  return null;
}

// Temperature signals only. needs-followup / relationship:funder are markers,
// not warmth — a goods-cold contact can carry needs-followup (seen: NAACT).
const WARM_TAGS = ['goods-hot', 'goods-warm', 'engagement:personal-vip'];
const COLD_TAGS = ['goods-cold', 'goods-cooling'];
const UNWORKED_STAGES = new Set(['saved', 'parked', null, undefined]);

async function main() {
  const { data: rows, error } = await sb
    .from('org_project_foundations')
    .select('id, stage, fit_score, ghl_contact_id, foundations(name), org_projects!inner(slug)')
    .eq('org_projects.slug', 'goods');
  if (error) throw new Error(error.message);

  console.log(`${rows.length} Goods foundation rows to reconcile${DRY_RUN ? ' (dry run)' : ''}\n`);

  const warmButUnworked = [];
  const hotButUnpushed = [];
  let matched = 0;

  for (const row of rows) {
    const name = row.foundations?.name;
    if (!name) continue;
    const core = searchName(name);
    let contact = null;
    try {
      contact = bestMatch(await ghlSearchContacts(core), core);
    } catch (e) {
      console.error(`  ! ${core}: ${e.message}`);
      continue;
    }

    if (contact) {
      matched += 1;
      const tags = contact.tags || [];
      if (!DRY_RUN) {
        const { error: upErr } = await sb
          .from('org_project_foundations')
          .update({
            ghl_contact_id: contact.id,
            ghl_contact_email: contact.email || null,
            ghl_tags: tags,
            ghl_synced_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        if (upErr) console.error(`  ! update ${core}: ${upErr.message}`);
      }
      const isWarm = tags.some((t) => WARM_TAGS.includes(t)) && !tags.some((t) => COLD_TAGS.includes(t));
      if (isWarm && UNWORKED_STAGES.has(row.stage)) {
        warmButUnworked.push({ name, stage: row.stage ?? 'none', email: contact.email, tags: tags.filter((t) => WARM_TAGS.includes(t)) });
      }
      console.log(`  ✓ ${core} → ${contact.email || contact.id}${isWarm ? ' [WARM]' : ''}`);
    } else {
      if ((row.fit_score ?? 0) >= 85) {
        hotButUnpushed.push({ name, fit: row.fit_score, stage: row.stage ?? 'none' });
      }
      console.log(`  · ${core} — no GHL contact`);
    }
    await new Promise((r) => setTimeout(r, 250)); // stay polite to the GHL API
  }

  console.log(`\n${matched}/${rows.length} matched to GHL contacts.\n`);

  if (warmButUnworked.length) {
    console.log('── WARM IN GHL, UNWORKED IN DISCOVERY (discovery understates reality):');
    for (const r of warmButUnworked) console.log(`  • ${r.name} — stage=${r.stage} · ${r.email} · ${r.tags.join(', ')}`);
  }
  if (hotButUnpushed.length) {
    console.log('\n── HIGH FIT, NEVER PUSHED TO GHL (the "push next" queue):');
    for (const r of hotButUnpushed) console.log(`  • ${r.name} — fit ${r.fit} · stage=${r.stage}`);
  }
  if (!warmButUnworked.length && !hotButUnpushed.length) console.log('No mismatches — pipelines agree.');
}

main().catch((e) => { console.error(e); process.exit(1); });

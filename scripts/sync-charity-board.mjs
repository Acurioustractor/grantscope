#!/usr/bin/env node
/**
 * Sync a specific charity's board (ACNC ResponsiblePersons) directly into
 * gs_entities (GS-PERSON-*) and gs_relationships (directorship edges).
 *
 * Targeted variant of scrape-acnc-responsible-persons.mjs — for filling
 * specific gaps (e.g. ECCV ABN 65071572705) without running the full sweep.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-charity-board.mjs --abn=65071572705
 *   node --env-file=.env scripts/sync-charity-board.mjs --abn=23684792947 --abn=65071572705 --apply
 *   node --env-file=.env scripts/sync-charity-board.mjs --abn=65071572705 --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const APPLY = !process.argv.includes('--dry-run'); // default LIVE; --dry-run to preview
const ABNS = process.argv.filter(a => a.startsWith('--abn=')).map(a => a.split('=')[1]);
const BOARD_URLS = process.argv.filter(a => a.startsWith('--board-url=')).map(a => a.split('=')[1]);
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
if (!ABNS.length) {
  console.error('Usage: --abn=<abn> [--abn=<abn> ...] [--board-url=<url>] [--dry-run]');
  console.error('   --board-url maps 1:1 with --abn order, used when ACNC does not publish ResponsiblePersons');
  process.exit(1);
}

const ACNC_BASE = 'https://www.acnc.gov.au/api/dynamics';
const UA = 'CivicGraph/1.0 (research; civicgraph.au)';
const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} @ ${url}`);
  return res.json();
}

function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

async function findCharityByAbn(abn) {
  const data = await fetchJSON(`${ACNC_BASE}/search/charity?search=${abn}&size=5`);
  return (data.results || []).find(r => r.data?.Abn === abn) || null;
}

async function fetchBoardFromWebsite(boardUrl) {
  if (!FIRECRAWL_KEY) {
    console.log(`  no FIRECRAWL_API_KEY — cannot scrape ${boardUrl}`);
    return [];
  }
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: boardUrl, formats: ['markdown'], waitFor: 1500 }),
  });
  if (!res.ok) {
    console.log(`  firecrawl ${res.status}: ${await res.text()}`);
    return [];
  }
  const j = await res.json();
  const md = j?.data?.markdown || j?.markdown || '';
  if (!md) return [];

  // Capture ALL-CAPS or **ALL CAPS** name blocks under heading levels h3-h5
  // Examples that match: "#### SILVIA RENDA", "#### **TINA HOSSEINI**", "#### **DR YASMIN HASSEN**"
  const persons = new Map(); // name → { name, role }
  const lines = md.split('\n');
  let pendingName = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const headingMatch = line.match(/^#{2,5}\s+\**\s*([A-Z][A-Z'’\-\s]{2,}(?:\s+[A-Z]+)*?\s*(?:OAM|AM|PSM|MBE|OBE|PhD|JP)?)\s*\**\s*$/);
    if (headingMatch) {
      const rawName = headingMatch[1].trim().replace(/\s+/g, ' ');
      // Filter out section headings (Office Bearers, Our Board, Board Directors, etc.)
      if (/^(OUR|THE|BOARD|OFFICE|ABOUT|PURPOSE|CONTACT|NEWS|STAFF|TEAM|HOME)\b/i.test(rawName)) {
        pendingName = null;
        continue;
      }
      // Real names usually have at least 2 tokens
      const tokens = rawName.split(/\s+/);
      if (tokens.length < 2 && !/(OAM|AM|PSM|MBE)/i.test(rawName)) {
        pendingName = null;
        continue;
      }
      pendingName = rawName;
      continue;
    }
    // Role line directly after a name (h3 like "### Chairperson" / "### Treasurer")
    if (pendingName) {
      const roleMatch = line.match(/^#{2,5}\s+(Chair[a-z]*|Deputy\s+Chair[a-z]*|Treasurer|Secretary|Director|CEO|President|Vice[\s-]?President|Public Officer|Board (?:Member|Director))\b/i);
      if (roleMatch) {
        // Title-case name
        const niceName = pendingName.split(' ').map(t =>
          /^(OAM|AM|PSM|MBE|OBE|JP)$/i.test(t) ? t.toUpperCase() : t.charAt(0) + t.slice(1).toLowerCase()
        ).join(' ');
        if (!persons.has(niceName)) {
          persons.set(niceName, { name: niceName, role: roleMatch[1] });
        }
        pendingName = null;
        continue;
      }
    }
  }

  // Always also do a bare-h4 sweep to catch names without an explicit role heading
  for (const line of lines) {
    const m = line.match(/^#{3,5}\s+\**\s*((?:DR\s+|PROF\s+|MR\s+|MS\s+|MRS\s+)?[A-Z][A-Z'’\-]+(?:\s+[A-Z][A-Z'’\-]+){1,4}(?:\s+(?:OAM|AM|PSM|MBE|OBE|JP|PhD))?)\s*\**\s*$/);
    if (m) {
      const rawName = m[1].trim().replace(/\s+/g, ' ');
      if (/^(OUR|THE|BOARD|OFFICE|ABOUT|PURPOSE|MISSION|VALUES|VISION|HOME|CONTACT|NEWS|STAFF|TEAM|MEMBERS?|PUBLICATIONS|REPORTS|CHAIRPERSON|TREASURER|SECRETARY|DIRECTOR|VIEW EACH)\b/i.test(rawName)) continue;
      const tokens = rawName.split(/\s+/);
      if (tokens.length < 2) continue;
      const niceName = tokens.map(t =>
        /^(OAM|AM|PSM|MBE|OBE|JP|PhD|DR|PROF|MR|MS|MRS)$/i.test(t)
          ? (t.length <= 3 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
          : t.charAt(0) + t.slice(1).toLowerCase()
      ).join(' ');
      if (!persons.has(niceName)) {
        persons.set(niceName, { name: niceName, role: 'Director' });
      }
    }
  }

  return Array.from(persons.values());
}

async function findOrCreatePerson(name) {
  const slug = slugify(name);
  if (!slug) return null;
  let gsId = `GS-PERSON-${slug}`;

  const { data: hit } = await db.from('gs_entities').select('id, gs_id').eq('gs_id', gsId).maybeSingle();
  if (hit) return hit;
  if (!APPLY) return { id: null, gs_id: gsId, _stub: true };

  // Collision-safe variant
  for (let i = 0; i < 5; i++) {
    const tryId = i === 0 ? gsId : `${gsId}-${i + 1}`;
    const { data: ins, error } = await db.from('gs_entities').insert({
      gs_id: tryId,
      canonical_name: name,
      entity_type: 'person',
      confidence: 'reported',
      source_datasets: ['acnc_register'],
    }).select('id, gs_id').single();
    if (!error) return ins;
    if (error.code === '23505') continue;
    throw error;
  }
  return null;
}

async function processCharity(abn, boardUrl) {
  const out = { abn, charity: null, persons: 0, edges_inserted: 0, edges_existing: 0, source: null };
  console.log(`\n=== ${abn} ===`);

  // Resolve target gs_entity by ABN (regardless of source)
  const { data: targetEntity } = await db.from('gs_entities').select('id, canonical_name').eq('abn', abn).maybeSingle();
  if (!targetEntity) {
    console.log(`  no gs_entities row for ABN ${abn} — skipping`);
    return out;
  }
  console.log(`  target entity: ${targetEntity.canonical_name}`);

  let persons = [];
  let source = 'acnc_register';

  const charity = await findCharityByAbn(abn);
  if (charity) {
    out.charity = charity.data?.Name;
    console.log(`  charity (ACNC): ${charity.data?.Name} (uuid=${charity.uuid})`);
    await delay(500);
    const detail = await fetchJSON(`${ACNC_BASE}/entity/${charity.uuid}`);
    const acncPersons = detail?.data?.ResponsiblePersons || [];
    console.log(`  ACNC responsible persons: ${acncPersons.length}`);
    persons = acncPersons.map(p => ({ name: p.Name?.trim(), role: p.Role || 'Director' })).filter(p => p.name);
  } else {
    console.log(`  charity not found in ACNC search for ${abn}`);
  }

  // Website fallback when ACNC returns zero
  if (persons.length === 0 && boardUrl) {
    console.log(`  ACNC empty — falling back to ${boardUrl}`);
    const webPersons = await fetchBoardFromWebsite(boardUrl);
    if (webPersons.length > 0) {
      persons = webPersons;
      source = 'website_board_page';
      console.log(`  scraped ${persons.length} board members from website`);
    }
  }

  out.persons = persons.length;
  out.source = source;

  for (const p of persons) {
    const personName = p.name?.trim();
    if (!personName) continue;
    const role = p.role || 'Director';

    const personEntity = await findOrCreatePerson(personName);
    if (!personEntity) {
      console.log(`    ✗ ${personName}: failed to create person entity`);
      continue;
    }

    if (!APPLY) {
      console.log(`    [dry] ${personName} (${role}) → ${targetEntity.canonical_name}`);
      out.edges_inserted++;
      continue;
    }

    // Check if directorship edge already exists (any dataset)
    const { data: existing } = await db.from('gs_relationships')
      .select('id, dataset')
      .eq('source_entity_id', personEntity.id)
      .eq('target_entity_id', targetEntity.id)
      .eq('relationship_type', 'directorship')
      .maybeSingle();
    if (existing) {
      out.edges_existing++;
      continue;
    }

    const { error } = await db.from('gs_relationships').insert({
      source_entity_id: personEntity.id,
      target_entity_id: targetEntity.id,
      relationship_type: 'directorship',
      dataset: source,
      confidence: source === 'acnc_register' ? 'verified' : 'reported',
      properties: { role: role.slice(0, 200) },
    });
    if (error) {
      console.log(`    ✗ ${personName}: ${error.message}`);
    } else {
      console.log(`    ✓ ${personName} (${role})`);
      out.edges_inserted++;
    }
  }

  return out;
}

async function main() {
  const run = await logStart(db, 'sync-charity-board', 'Sync Charity Board (focused)');
  console.log('=== Sync Charity Board (focused) ===');
  console.log(`  mode: ${APPLY ? 'LIVE' : 'DRY RUN'} | abns: ${ABNS.join(', ')}`);

  let totalPersons = 0;
  let totalInserted = 0;
  const errors = [];

  for (let i = 0; i < ABNS.length; i++) {
    const abn = ABNS[i];
    const boardUrl = BOARD_URLS[i] || null;
    try {
      const r = await processCharity(abn, boardUrl);
      totalPersons += r.persons;
      totalInserted += r.edges_inserted;
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err?.message || JSON.stringify(err));
      errors.push(`${abn}: ${msg}`);
      console.error(`  fatal for ${abn}: ${msg}`);
    }
    await delay(1500);
  }

  console.log(`\n=== Summary ===`);
  console.log(`  persons seen: ${totalPersons} | edges inserted: ${totalInserted}`);
  await logComplete(db, run.id, {
    items_found: totalPersons,
    items_new: totalInserted,
    status: errors.length ? 'partial' : 'success',
    errors,
  });
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

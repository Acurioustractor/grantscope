#!/usr/bin/env node
/**
 * Fetch registered-office localities for ORIC corporations from the public register.
 *
 * Why this exists: 64,801 gs_entities have no council, because they sit in a
 * postcode spanning several and we hold no locality for them. Neither
 * abr_registry nor oric_corporations stores one (postcode and state only), and
 * the ABR bulk extract does not publish street addresses at all. That leaves
 * every ORIC corporation unplaceable, including Ceduna Aboriginal Corporation,
 * Koonibba, Yalata, Scotdesco and Oak Valley.
 *
 * The ORIC public register does publish it, per corporation, on the page we
 * already store in oric_corporations.oric_url. "39 McKenzie Street, CEDUNA, SA
 * 5690" gives us CEDUNA, which maps to exactly one council in ABS ASGS.
 *
 * Restraint is deliberate. A previous note in geo_resolution_gaps records that
 * ORIC will not release addresses in bulk and discourages custom requests, so
 * this reads the same public pages a person would, one at a time, slowly, and
 * only for corporations you ask for. It is not a crawler for the whole register.
 * Default concurrency is 1 and there is a fixed delay between requests.
 *
 * Usage:
 *   node --env-file=.env scripts/fetch-oric-addresses.mjs --abn=65255759096,33876790225
 *   node --env-file=.env scripts/fetch-oric-addresses.mjs --postcode=5690
 *   node --env-file=.env scripts/fetch-oric-addresses.mjs --postcode=5690 --apply
 *
 * Without --apply it prints what it found and writes nothing.
 */

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const arg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const APPLY = args.includes('--apply');
const ABNS = (arg('abn') || '').split(',').map((s) => s.trim()).filter(Boolean);
const POSTCODE = arg('postcode');
const LIMIT = Number(arg('limit') || 50);
const DELAY_MS = Number(arg('delay') || 2000);

if (!ABNS.length && !POSTCODE) {
  console.error('Need --abn=... or --postcode=.... Refusing to walk the whole register.');
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

let query = db
  .from('oric_corporations')
  .select('icn, name, abn, state, postcode, oric_url, status')
  .eq('status', 'Registered')
  .not('oric_url', 'is', null)
  .limit(LIMIT);
query = ABNS.length ? query.in('abn', ABNS) : query.eq('postcode', POSTCODE);

const { data: corps, error } = await query;
if (error) {
  console.error('Lookup failed:', error.message);
  process.exit(1);
}
if (!corps?.length) {
  console.log('No registered corporations matched.');
  process.exit(0);
}

// Localities genuinely belonging to each postcode in play.
const validByPostcode = new Map();
for (const pc of [...new Set(corps.map(c => c.postcode).filter(Boolean))]) {
  const { data: rows } = await db.from('postcode_geo').select('locality').eq('postcode', pc).limit(200);
  validByPostcode.set(pc, new Set((rows || []).map(r => (r.locality || '').trim().toUpperCase())));
}

console.log(`${corps.length} corporation(s) to look up, ${DELAY_MS}ms apart\n`);

// Every ABS locality in play, longest first so BOOKABIE wins over BOOK and
// "OAK VALLEY" wins over "OAK". Loaded once; the register pages are read
// against it rather than against a guess about address shape.
// Paged. PostgREST caps a response at 1,000 rows regardless of .limit(), and
// silently: the first version of this asked for 20,000 of the 16,631 rows, got
// 1,000, and quietly failed to recognise YALATA as a place.
const absLocalities = [];
for (let from = 0; ; from += 1000) {
  const { data: page } = await db
    .from('abs_locality_lga')
    .select('locality, state_name')
    .range(from, from + 999);
  if (!page?.length) break;
  absLocalities.push(...page);
  if (page.length < 1000) break;
}
const STATE_NAMES = {
  ACT: 'Australian Capital Territory', NSW: 'New South Wales', NT: 'Northern Territory',
  QLD: 'Queensland', SA: 'South Australia', TAS: 'Tasmania', VIC: 'Victoria', WA: 'Western Australia',
};
const localitiesByState = new Map();
for (const row of absLocalities || []) {
  const list = localitiesByState.get(row.state_name) || [];
  list.push(row.locality.replace(/\s*\([A-Z]{2,3}\)\s*$/, '').trim().toUpperCase());
  localitiesByState.set(row.state_name, list);
}
for (const [key, list] of localitiesByState) {
  localitiesByState.set(key, [...new Set(list)].sort((a, b) => b.length - a.length));
}

/**
 * The locality slot is not the community.
 *
 * Yalata Anangu Aboriginal Corporation's registered office reads
 * "C/-Yalata Community Eyre Highway, CEDUNA, SA 5690". CEDUNA is the postal
 * locality for the whole of 5690; Yalata is 200km west of it and ABS puts it in
 * Unincorporated SA. Reading the slot would file Yalata's money under District
 * Council of Ceduna, which is the same hub-credit distortion this work exists
 * to remove, just arriving by a new route.
 *
 * So scan the whole address for any ABS locality and prefer one that is not the
 * postal locality, because a community named in the street line is a stronger
 * signal about where an organisation sits than the sorting label at the end.
 * Return both so the caller can see when they disagree.
 */
function localitiesFromAddress(address, state, postcode, validHere) {
  if (!address) return { postal: null, specific: null };
  const cleaned = address.replace(/\s+/g, ' ').replace(/,\s*AUSTRALIA\s*$/i, '').trim().toUpperCase();

  const slotMatch = cleaned.match(new RegExp(`,\\s*([^,]+?)\\s*,\\s*${state}\\s+${postcode}\\s*$`, 'i'));
  let postal = slotMatch ? slotMatch[1].trim() : null;
  if (postal && /^(PO BOX|GPO BOX|LOCKED BAG)/i.test(postal)) postal = null;

  // Only accept a community named in the street line if it is genuinely a
  // locality of this postcode. Without that constraint "Eyre Highway" matches
  // the locality EYRE and "Laura Bay" matches LAURA BAY, and Scotdesco moves
  // from a correct BOOKABIE to a wrong EYRE. Street names collide with place
  // names constantly; the postcode is what tells them apart.
  const known = (localitiesByState.get(STATE_NAMES[state]) || []).filter(name => validHere.has(name));
  const head = postal ? cleaned.slice(0, cleaned.lastIndexOf(postal)) : cleaned;
  const specific = known.find(name =>
    name !== postal && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(head)
  ) || null;

  return { postal: postal || null, specific };
}

const results = [];
for (const corp of corps) {
  try {
    const response = await fetch(corp.oric_url, {
      headers: { 'User-Agent': 'CivicGraph/1.0 (civicgraph.app; public register lookup)' },
    });
    if (!response.ok) {
      results.push({ ...corp, locality: null, note: `HTTP ${response.status}` });
    } else {
      const html = await response.text();
      const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      // Greedy on purpose. Non-greedy captures only ", CEDUNA, SA 5690" and the
      // street line holding the community name never reaches the parser.
      const addressPattern = new RegExp(`[^.;]{0,140},\\s*${corp.state}\\s+${corp.postcode}`, 'gi');
      const candidates = text.match(addressPattern) || [];
      let postal = null;
      let specific = null;
      for (const candidate of candidates) {
        const parsed = localitiesFromAddress(candidate, corp.state, corp.postcode, validByPostcode.get(corp.postcode) || new Set());
        postal = postal || parsed.postal;
        specific = specific || parsed.specific;
        if (specific) break;
      }
      const locality = specific || postal;
      results.push({
        ...corp,
        locality,
        postal,
        specific,
        note: !locality ? 'no locality parsed'
          : specific && postal && specific !== postal ? `community line beats postal (${postal})`
          : 'postal locality only',
      });
    }
  } catch (err) {
    results.push({ ...corp, locality: null, note: err.message });
  }
  console.log(`  ${(results.at(-1).locality || '—').padEnd(14)} ${corp.name} — ${results.at(-1).note}`);
  await new Promise((r) => setTimeout(r, DELAY_MS));
}

const found = results.filter((r) => r.locality);
console.log(`\n${found.length}/${results.length} localities parsed`);

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write gs_entities.lga_name.');
  process.exit(0);
}

// Resolve locality -> council through ABS, and only where ABS is unambiguous.
let written = 0;
for (const row of found) {
  const { data: lga } = await db
    .from('abs_locality_lga')
    .select('lga_name, lga_code, lga_count')
    .ilike('locality', row.locality)
    .eq('lga_count', 1);
  if (!lga || lga.length !== 1) {
    console.log(`  skip ${row.name}: ${row.locality} is not unambiguous in ABS`);
    continue;
  }
  const { error: updateError } = await db
    .from('gs_entities')
    .update({
      lga_name: lga[0].lga_name,
      lga_code: lga[0].lga_code,
      lga_source: 'oric_register_address+abs_asgs',
    })
    .eq('abn', row.abn);
  if (updateError) console.log(`  FAILED ${row.name}: ${updateError.message}`);
  else {
    written += 1;
    console.log(`  ${row.name} -> ${lga[0].lga_name}`);
  }
}
console.log(`\n${written} entities placed.`);

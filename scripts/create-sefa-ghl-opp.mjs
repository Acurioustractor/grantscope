#!/usr/bin/env node
/**
 * create-sefa-ghl-opp.mjs
 *
 * Re-create the SEFA repayable-debt opportunity in GoHighLevel. The old bundled
 * "Snow Foundation / SEFA — Impact Investment Loan" opp vanished from live GHL
 * (the CivicGraph mirror was stale), leaving SEFA — the highest-match-value (repayable)
 * lever for the QBE match — with NO tracked opportunity. This re-creates a clean one
 * in the Goods funder pipeline.
 *
 * Pipeline : Goods Supporter Journey  (the funder pipeline; Snow/Minderoo/Centrecorp live here)
 * Stage    : Cultivating               (honest for reopening a dormant-but-real relationship)
 * Contact  : Joel Bird (joel.bird@sefa.com.au)
 * Value    : AU$300,000                (documented senior concessional-debt target)
 *
 * IDEMPOTENT: searches for an existing SEFA opp first and refuses to create a duplicate.
 *
 * Run (dry-run, read-only, default): node --env-file=.env scripts/create-sefa-ghl-opp.mjs
 * Apply:                             node --env-file=.env scripts/create-sefa-ghl-opp.mjs --apply
 */
const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const APPLY = process.argv.slice(2).includes('--apply');

const PIPELINE_ID = 'JvBFYpVpyKsw899lkFgj';            // Goods Supporter Journey
const STAGE_ID = '524aca71-287d-4eeb-a53a-66ff3a7aede5'; // Cultivating
// Other stages if you want to change it: Identified cf8d31d2-73be-4119-b56b-7b0334254197 | Ask made a23b26b4-ace3-4199-8a14-b65ed888aa52
const CONTACT_ID = 'QP8M4iLfBOfs66V81jiX';            // Joel Bird (SEFA)

const OPP = {
  locationId: GHL_LOCATION_ID,
  name: 'SEFA - Impact Investment Loan (Goods on Country)',
  pipelineId: PIPELINE_ID,
  pipelineStageId: STAGE_ID,
  status: 'open',
  monetaryValue: 300000,
  contactId: CONTACT_ID,
};

async function ghl(endpoint, options = {}) {
  if (!GHL_API_KEY) throw new Error('GHL_API_KEY not set');
  const res = await fetch(`${GHL_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`GHL ${res.status} on ${endpoint}: ${await res.text()}`);
  return res.json();
}

console.log(`\n=== create-sefa-ghl-opp.mjs  [${APPLY ? 'APPLY' : 'DRY-RUN (read-only)'}] ===\n`);

// Idempotency guard: is there already a SEFA opp anywhere in this location?
const found = await ghl(`/opportunities/search?location_id=${GHL_LOCATION_ID}&q=SEFA`);
const existing = (found.opportunities || []).filter(o => /sefa/i.test(o.name || ''));
if (existing.length) {
  console.log('A SEFA opportunity already exists — NOT creating a duplicate:');
  existing.forEach(o => console.log(`  ${o.id}  ${JSON.stringify(o.name)}  [pipeline ${o.pipelineId}]`));
  console.log('\nIf this is the wrong pipeline/stage, edit it in GHL rather than creating a new one.\n');
  process.exit(0);
}
console.log('No existing SEFA opportunity found (confirmed gap).');
console.log('WILL CREATE:');
console.log(`  name:    ${OPP.name}`);
console.log(`  pipeline:${OPP.pipelineId}  (Goods Supporter Journey)`);
console.log(`  stage:   ${OPP.pipelineStageId}  (Cultivating)`);
console.log(`  value:   AU$${OPP.monetaryValue.toLocaleString()}`);
console.log(`  contact: ${OPP.contactId}  (Joel Bird, SEFA)`);
console.log(`  status:  ${OPP.status}\n`);

if (!APPLY) {
  console.log('Dry-run — nothing created. Re-run with --apply to create it.\n');
  process.exit(0);
}

const res = await ghl('/opportunities/', { method: 'POST', body: JSON.stringify(OPP) });
console.log(`CREATED -> id ${res?.opportunity?.id || '(see response)'}  name ${JSON.stringify(res?.opportunity?.name || OPP.name)}`);
console.log('Done. Next GHL->CivicGraph sync (<=12h) will mirror it into ghl_opportunities.\n');

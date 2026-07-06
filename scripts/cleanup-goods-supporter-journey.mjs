#!/usr/bin/env node
/**
 * cleanup-goods-supporter-journey.mjs
 *
 * Aligns the "Goods Supporter Journey" GHL pipeline to the money-type model:
 * Supporter Journey = relational philanthropy cultivation ONLY. It currently mixes
 * three things that belong elsewhere. This script fixes them (dry-run by default,
 * explicit reviewable ID lists — nothing is auto-classified live):
 *
 *   1. DE-DUP GRANTS (5)   — grant opps that ALSO live in the Grants pipeline.
 *                            Grants pipeline is the grant-instrument source of truth,
 *                            so the Supporter Journey copy is set status='abandoned'
 *                            (reversible; keeps the record) with a discovery_source note.
 *   2. RETIRE CLOSED (2)   — historical/paid/acquitted funding still sitting 'open'.
 *                            Set status='won' (retires from the open board, keeps value).
 *   3. TAG CAPITAL (10)    — debt/finance instruments that are NOT "support". The
 *                            funding_type picklist has no debt option, so we first add
 *                            "Debt / repayable finance" + "Equity / impact investment",
 *                            then tag each. (Moving them to a separate Finance pipeline
 *                            is a later UI step; tagging makes them filterable now — the
 *                            "Goods tag" half of the chosen model.)
 *
 * Run (dry-run, read-only, default): node --env-file=.env scripts/cleanup-goods-supporter-journey.mjs
 * Apply:                             node --env-file=.env scripts/cleanup-goods-supporter-journey.mjs --apply
 */
const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const APPLY = process.argv.slice(2).includes('--apply');

const FUNDING_TYPE_FIELD = 'UCFe9cyjk3sVKwtInfSG';
const DISCOVERY_SOURCE_FIELD = 'eZoHX9Y7dIZBhXM3i6Kx';
const NEW_FUNDING_OPTIONS = ['Debt / repayable finance', 'Equity / impact investment'];

// ---- explicit, reviewable classification (from the 66-opp Supporter Journey audit) ----
const DUP_GRANTS = [
  ['rIYE007OMlkMXUisaTz6', 'Sisters of Charity Community Grants — partner-led bed deployment'],
  ['eJYnkLDTTVtHU34DxLsq', 'First Nations Clean Energy Advice Grants — on-country manufacturing'],
  ['IjZkVz8eOGBqhISDAfvF', 'FRRR Strengthening Rural Communities — remote bedding'],
  ['jzsCRxwr17oswxNNW8qh', 'ANZ Seeds of Renewal — remote community bed/plastic pilot'],
  ['Wx35axGV7phZbXvtKIbn', 'SEDI Capability Building Grants — Goods capability build'],
];
const CLOSED = [
  ['4DJPvPgoBxFi82lduMpN', 'Centrecorp — historical funding $123,332 (paid, acquitted)'],
  ['qqMUNJI4qHbPR2lLHqn9', 'Snow Foundation — historical funding (Xero-reconciled) $493,130'],
];
const CAPITAL = [
  ['10or6RAZK1Ai5fyOl8R6', 'Tripple — direct impact loan', 'Debt / repayable finance'],
  ['FjeSP2XmF96r0ZtMKVoH', 'CommBank Green Equipment Finance', 'Debt / repayable finance'],
  ['7fQ9ggCQZXXDgVO1NGJC', 'Metro Finance — MetroEco equipment finance', 'Debt / repayable finance'],
  ['UNgZ0ZRcYcEk4uLXNBla', 'LendForGood — crowd-lent repayable via SIH', 'Debt / repayable finance'],
  ['6qJmhAM3a01JJcI6Krg9', 'White Box SELF — social enterprise loan pathway', 'Debt / repayable finance'],
  ['QOY9I35LlsSTDnWzVvbI', 'Invest NT Business Investment Concessional Loans', 'Debt / repayable finance'],
  ['r3BROpin9pgfN6dt2BQE', 'CEFC via NAB Green Equipment Finance', 'Debt / repayable finance'],
  ['KVB5BVZcvE0fGjnmggTZ', 'First Nations Finance — working capital / equipment', 'Debt / repayable finance'],
  ['hBRVkCMhT93215aqTRRr', 'SEFA — repayable finance anchor', 'Debt / repayable finance'],
  ['2oRNt8FEpvBnbBAZzgCb', 'Eloise Hall - Impact Investor', 'Equity / impact investment'],
];

if (!GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error('FATAL: GHL_API_KEY / GHL_LOCATION_ID not set (run with `node --env-file=.env`)');
  process.exit(1);
}

async function ghl(endpoint, options = {}) {
  const res = await fetch(`${GHL_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      Accept: 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`GHL ${res.status} on ${endpoint}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

(async () => {
  console.log(`\n=== cleanup-goods-supporter-journey.mjs  [${APPLY ? 'APPLY' : 'DRY-RUN (read-only)'}] ===\n`);

  // Check current funding_type options
  const cfList = await ghl(`/locations/${GHL_LOCATION_ID}/customFields?model=opportunity`);
  const ftField = (cfList.customFields || []).find(f => f.id === FUNDING_TYPE_FIELD);
  const curOptions = ftField?.picklistOptions || ftField?.options || [];
  const missing = NEW_FUNDING_OPTIONS.filter(o => !curOptions.includes(o));

  console.log('STEP 1 — Taxonomy: add missing funding_type options');
  console.log(`  current options: ${curOptions.join(' | ')}`);
  if (missing.length) console.log(`  WILL ADD: ${missing.join(' , ')}`);
  else console.log('  (both debt/equity options already present — no change)');

  console.log(`\nSTEP 2 — De-dup grants (abandon in Supporter Journey; Grants pipeline is source of truth) [${DUP_GRANTS.length}]`);
  for (const [, name] of DUP_GRANTS) console.log(`  abandon  ${name}`);

  console.log(`\nSTEP 3 — Retire closed/historical (status -> won) [${CLOSED.length}]`);
  for (const [, name] of CLOSED) console.log(`  win      ${name}`);

  console.log(`\nSTEP 4 — Tag capital/finance instruments (funding_type) [${CAPITAL.length}]`);
  for (const [, name, type] of CAPITAL) console.log(`  tag "${type}"  ${name}`);

  console.log(`\nSummary: ${DUP_GRANTS.length} abandoned · ${CLOSED.length} won · ${CAPITAL.length} tagged · 49 untouched (real philanthropy prospects + won grants in stewardship).`);

  if (!APPLY) {
    console.log('\nDry-run — nothing written. Re-run with --apply to execute.\n');
    return;
  }

  // STEP 1 apply — add picklist options
  if (missing.length) {
    await ghl(`/locations/${GHL_LOCATION_ID}/customFields/${FUNDING_TYPE_FIELD}`, {
      method: 'PUT',
      body: JSON.stringify({ name: ftField.name, options: [...curOptions, ...missing] }),
    });
    console.log(`\n[1] Added funding_type options: ${missing.join(', ')}`);
  }

  const updOpp = (id, body) => ghl(`/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(body) });

  console.log('\n[2] Abandoning duplicate grants...');
  for (const [id, name] of DUP_GRANTS) {
    try {
      await updOpp(id, { status: 'abandoned', customFields: [{ id: DISCOVERY_SOURCE_FIELD, field_value: 'duplicate — tracked in Grants pipeline' }] });
      console.log(`  ✓ abandoned  ${name}`);
    } catch (e) { console.error(`  ✗ ${name}: ${e.message}`); }
  }

  console.log('\n[3] Retiring closed grants (won)...');
  for (const [id, name] of CLOSED) {
    try { await updOpp(id, { status: 'won' }); console.log(`  ✓ won  ${name}`); }
    catch (e) { console.error(`  ✗ ${name}: ${e.message}`); }
  }

  console.log('\n[4] Tagging capital/finance...');
  for (const [id, name, type] of CAPITAL) {
    try {
      await updOpp(id, { customFields: [{ id: FUNDING_TYPE_FIELD, field_value: type }] });
      console.log(`  ✓ ${type}  ${name}`);
    } catch (e) { console.error(`  ✗ ${name}: ${e.message}`); }
  }

  console.log('\nDone. Supporter Journey now = philanthropy cultivation + won-grant stewardship only.\n');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

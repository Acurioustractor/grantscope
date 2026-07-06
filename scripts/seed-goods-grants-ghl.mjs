#!/usr/bin/env node
/**
 * seed-goods-grants-ghl.mjs
 *
 * Wire the CivicGraph grant engine -> GoHighLevel "Grants" pipeline.
 * Reads act_grant_recommendations (the live per-project engine MV) for a project
 * (default ACT-GD = Goods on Country), takes the strong-fit, still-open opps, and
 * creates them as opportunities in the Grants pipeline at stage
 * "Grant Opportunity Identified" — populating the purpose-built opp custom fields
 * (Funder, Grant fit score, Focus areas, Geography, Eligibility, Submission link,
 * Discovery source, What it funds, Amount range, Submission date).
 *
 * DEDUP (two layers, so re-runs and the 16 hand-curated opps are safe):
 *   1. Engine idempotency  — each seeded opp stamps discovery_source with
 *      "civicgraph-engine:{opportunity_id}". On re-run, opps whose engine id is
 *      already present are SKIPPED.
 *   2. Manual-dup guard     — fuzzy-matches each rec (funder + name tokens) against
 *      every existing Grants opp. A strong match is SKIPPED and flagged
 *      "likely already tracked" rather than creating a duplicate (this is what
 *      catches FRRR / Sisters of Charity that already exist by hand).
 *
 * Everything borderline is printed in the dry-run so a human decides.
 *
 * Run (dry-run, read-only, default): node --env-file=.env scripts/seed-goods-grants-ghl.mjs
 * Apply:                             node --env-file=.env scripts/seed-goods-grants-ghl.mjs --apply
 * Other project:                     node --env-file=.env scripts/seed-goods-grants-ghl.mjs --project ACT-XX
 * Limit (test a few first):          node --env-file=.env scripts/seed-goods-grants-ghl.mjs --limit 3
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const PROJECT = (argv[argv.indexOf('--project') + 1] && argv.includes('--project')) ? argv[argv.indexOf('--project') + 1] : 'ACT-GD';
const LIMIT = argv.includes('--limit') ? parseInt(argv[argv.indexOf('--limit') + 1], 10) : Infinity;
const MIN_FIT = argv.includes('--min-fit') ? parseInt(argv[argv.indexOf('--min-fit') + 1], 10) : 65;

const GRANTS_PIPELINE_ID = 'scom3L0kNwA1W0zPIzMe';
const STAGE_IDENTIFIED = '8124c61a-1175-461e-be5d-1fa64ef6dd65'; // Grant Opportunity Identified
// GHL requires a contactId on every opportunity. Engine-discovered grants have no
// funder contact yet, so they attach to the purpose-built "GrantScope Triage" contact
// (existing convention — reassign to a real funder contact when a grant is pursued).
const TRIAGE_CONTACT_ID = 'uAsIUWBHez3DzVex8rtm';

// GHL opportunity custom-field ids (model=opportunity)
const CF = {
  funder: 'v0uQzbwOQvwsvQ1ORb0X',
  fit_score: 'xEzJNk9FpH75VRcrGFBF',
  focus_areas: 'cEUgPMeSEfcXmlvu3HcY',
  geography: 'JAIpW72Zy66hWgG0ckXs',
  eligibility: 'odfViFAgpIKB37hz1Ern',
  submission_link: 'GwPgNgVUr6MiyVOKqavt',
  submission_date: 'dRUwAKU9k70EOqsKVeWN',
  discovery_source: 'eZoHX9Y7dIZBhXM3i6Kx',
  what_it_funds: 'C1cm0kEfqxXsJhM9zUbe',
  amount_range: 'fdfztkiwIVdTU5jUTd9R',
  funding_type: 'UCFe9cyjk3sVKwtInfSG',
};

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

// ---- fuzzy matching (name/funder token overlap) ----
const STOP = new Set(['the','and','for','of','a','to','in','grant','grants','fund','funding','program','round','community','communities','trustee','foundation','inc','ltd','pty']);
const toks = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
function overlap(a, b) {
  const A = new Set(toks(a)); const B = new Set(toks(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size); // containment, not Jaccard — manual names carry extra context words
}

// ---- pull engine recs ----
async function engineRecs() {
  const sql = `SELECT opportunity_id, opportunity_name, funder_name,
    to_char(deadline,'YYYY-MM-DD') AS deadline, min_grant_amount, max_grant_amount,
    is_national, array_to_string(jurisdictions,', ') AS jurisdictions,
    array_to_string(eligible_org_types,', ') AS eligible_org_types,
    array_to_string(focus_areas,', ') AS focus_areas, opportunity_type,
    COALESCE(application_url, source_url) AS url, fit_score,
    array_to_string(flags,', ') AS flags
    FROM act_grant_recommendations
    WHERE project_code='${PROJECT}' AND is_strong_fit AND (deadline IS NULL OR deadline >= now())
    ORDER BY fit_score DESC`;
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) throw new Error(`engine query failed: ${error.message}`);
  return data || [];
}

(async () => {
  console.log(`\n=== seed-goods-grants-ghl.mjs  project=${PROJECT}  [${APPLY ? 'APPLY' : 'DRY-RUN (read-only)'}] ===\n`);

  let recs = await engineRecs();
  const rawCount = recs.length;

  // Gate on fit score (the strong-fit floor of 58 surfaces off-theme noise for Goods).
  recs = recs.filter(r => (r.fit_score ?? 0) >= MIN_FIT);

  // Collapse engine-internal duplicates (the MV carries dup rows for the same program).
  const byKey = new Map();
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const r of recs) {
    const k = `${norm(r.funder_name)}::${norm(r.opportunity_name)}`;
    const prev = byKey.get(k);
    if (!prev || (r.fit_score ?? 0) > (prev.fit_score ?? 0)) byKey.set(k, r);
  }
  recs = [...byKey.values()].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));

  if (Number.isFinite(LIMIT)) recs = recs.slice(0, LIMIT);
  console.log(`Engine: ${rawCount} strong-fit rows → ${recs.length} after fit>=${MIN_FIT} gate + internal dedup.\n`);

  // Existing Grants opps (fetch by id to hydrate custom fields for dedup)
  const search = await ghl(`/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${GRANTS_PIPELINE_ID}&limit=100`);
  const existing = [];
  for (const s of (search.opportunities || [])) {
    const full = await ghl(`/opportunities/${s.id}`);
    const o = full.opportunity || s;
    const cf = Object.fromEntries((o.customFields || []).map(f => [f.id, f.fieldValue ?? f.value ?? f.field_value]));
    existing.push({ id: o.id, name: o.name, funder: cf[CF.funder] || '', source: cf[CF.discovery_source] || '' });
  }
  const seededIds = new Set(existing.map(e => (e.source.match(/civicgraph-engine:([0-9a-f-]{36})/) || [])[1]).filter(Boolean));

  const plan = { create: [], seeded: [], dup: [] };
  for (const r of recs) {
    if (seededIds.has(r.opportunity_id)) { plan.seeded.push(r); continue; }
    // Fuzzy vs existing — NAME tokens only. Funder is shared across many grants
    // ("Australian Government", "CommBank Foundation") so funder-match = false positives.
    // Require real name-token overlap with >=2 shared significant tokens.
    let best = { score: 0, opp: null, shared: 0 };
    for (const e of existing) {
      const A = new Set(toks(r.opportunity_name)); const B = new Set(toks(e.name));
      let inter = 0; for (const t of A) if (B.has(t)) inter++;
      const s = (A.size && B.size) ? inter / Math.min(A.size, B.size) : 0;
      if (s > best.score) best = { score: s, opp: e, shared: inter };
    }
    if (best.score >= 0.5 && best.shared >= 2) { plan.dup.push({ r, match: best }); continue; }
    plan.create.push(r);
  }

  const money = (n) => n ? `$${Number(n).toLocaleString()}` : '—';
  console.log(`WILL CREATE (${plan.create.length}):`);
  for (const r of plan.create) console.log(`  + [${r.fit_score}] ${r.opportunity_name}  — ${r.funder_name}  ${money(r.max_grant_amount)}  ${r.deadline ? 'due ' + r.deadline : 'rolling'}${r.flags ? '  {' + r.flags + '}' : ''}`);

  console.log(`\nSKIP — already engine-seeded (${plan.seeded.length}):`);
  for (const r of plan.seeded) console.log(`  = ${r.opportunity_name}`);

  console.log(`\nSKIP — likely already tracked by hand (${plan.dup.length}):`);
  for (const d of plan.dup) console.log(`  ~ ${d.r.opportunity_name}  ≈  "${d.match.opp.name}"  (match ${(d.match.score * 100).toFixed(0)}% · opp ${d.match.opp.id})`);

  if (!APPLY) {
    console.log(`\nDry-run — nothing written. Re-run with --apply to create the ${plan.create.length} new opp(s).\n`);
    return;
  }

  console.log(`\nApplying — creating ${plan.create.length} opportunities...\n`);
  let ok = 0;
  for (const r of plan.create) {
    const customFields = [
      { id: CF.funder, field_value: r.funder_name || '' },
      { id: CF.fit_score, field_value: String(r.fit_score ?? '') },
      { id: CF.focus_areas, field_value: r.focus_areas || '' },
      { id: CF.geography, field_value: r.is_national ? 'National' : (r.jurisdictions || '') },
      { id: CF.eligibility, field_value: r.eligible_org_types || '' },
      { id: CF.submission_link, field_value: r.url || '' },
      { id: CF.submission_date, field_value: r.deadline || '' },
      { id: CF.funding_type, field_value: r.opportunity_type || '' },
      { id: CF.discovery_source, field_value: `civicgraph-engine:${r.opportunity_id}` },
      { id: CF.what_it_funds, field_value: r.focus_areas || '' },
      { id: CF.amount_range, field_value: [r.min_grant_amount, r.max_grant_amount].filter(Boolean).map(n => `$${Number(n).toLocaleString()}`).join(' – ') || '' },
    ].filter(f => f.field_value !== '');
    const body = {
      locationId: GHL_LOCATION_ID,
      name: r.opportunity_name.slice(0, 250),
      pipelineId: GRANTS_PIPELINE_ID,
      pipelineStageId: STAGE_IDENTIFIED,
      status: 'open',
      contactId: TRIAGE_CONTACT_ID,
      monetaryValue: Number(r.max_grant_amount) || 0,
      customFields,
    };
    try {
      const res = await ghl('/opportunities/', { method: 'POST', body: JSON.stringify(body) });
      ok++;
      console.log(`  CREATED ${res?.opportunity?.id || ''}  ${r.opportunity_name}`);
    } catch (e) {
      console.error(`  FAILED  ${r.opportunity_name}: ${e.message}`);
    }
  }
  console.log(`\nDone. Created ${ok}/${plan.create.length}. GHL->CivicGraph sync (<=12h) will mirror into ghl_opportunities.\n`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

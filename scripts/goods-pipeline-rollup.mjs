#!/usr/bin/env node
/**
 * goods-pipeline-rollup.mjs — Goods 3-pipeline operating model, Build B step 3.
 *
 * READ-ONLY cockpit for the unit ledger. Rolls the 3 Goods pipelines into one
 * number set in beds / washing machines / $:
 *
 *   NEED       ← goods_communities (curated priority slice: active + lead)
 *   ORDERED    ← GHL Buyer Pipeline  (monetaryValue + Goods:Beds/Washing-machines)
 *   FUNDED     ← GHL Supporter Journey (monetaryValue committed + units funded)
 *   FOOTPRINT  ← current Goods Asset Register canon
 *   GAP        = NEED − DELIVERED
 *
 * No writes. Emits thoughts/shared/reports/goods-pipeline-rollup-<date>.{md,json}.
 *
 * Run: node --env-file=.env --env-file=apps/web/.env.local scripts/goods-pipeline-rollup.mjs
 *
 * Plan: act-infra thoughts/shared/plans/2026-05-28-goods-three-pipeline-operating-model.md
 */
import { psql } from './lib/psql.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const GHL_API_URL = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const PIPELINES = {
  buyer:     { id: 'FjMyJM3YzWQFmKqR9fur', label: 'Buyer Pipeline (procurement)' },
  supporter: { id: 'JvBFYpVpyKsw899lkFgj', label: 'Supporter Journey (support)' },
  demand:    { id: 'UQsrmuqzxMSdCTklxEcG', label: 'Demand Register (need)' },
};
const BEDS_FIELD = 'mi9ZW3KLhmpcez14cNbx';
const WASHERS_FIELD = 'UtxtfnyEd6p1epMEJ0b2';

// Current Goods Asset Register canon, checked 2026-07-25. Beds are deployed.
// Washers are Ben's manual in-community ruling, not a register-row count.
const DELIVERED = {
  beds: 540,
  washers: 22,
  source: 'Goods Asset Register canon, 2026-07-25; washers are the manual in-community ruling',
};

async function ghlFetch(path) {
  const res = await fetch(`${GHL_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${GHL_API_KEY}`, 'Content-Type': 'application/json', Version: '2021-07-28' },
  });
  if (!res.ok) throw new Error(`GHL ${path}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`);
  return res.json();
}
async function fetchStageMap(pipelineId) {
  const data = await ghlFetch(`/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`);
  const p = (data.pipelines || []).find(x => x.id === pipelineId);
  return new Map((p?.stages || []).map(s => [s.id, s.name]));
}
async function fetchOpportunities(pipelineId) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const data = await ghlFetch(`/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${pipelineId}&limit=100&page=${page}`);
    const opps = data.opportunities || [];
    out.push(...opps);
    if (opps.length < 100) break;
  }
  return out;
}
function unitOf(opp, fieldId) {
  const cf = (opp.customFields || []).find(c => c.id === fieldId);
  // GHL opportunity search returns numeric custom fields under `fieldValueNumber`
  // (text under `fieldValueString`); the write API takes `field_value`.
  const v = cf ? (cf.fieldValueNumber ?? cf.fieldValueString ?? cf.field_value ?? cf.fieldValue ?? cf.value) : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-AU')}`;

async function rollupPipeline(pipelineId) {
  const [opps, stageMap] = await Promise.all([fetchOpportunities(pipelineId), fetchStageMap(pipelineId)]);
  const open = opps.filter(o => (o.status || 'open') === 'open');
  const byStage = {};
  let beds = 0, washers = 0, value = 0;
  for (const o of open) {
    const b = unitOf(o, BEDS_FIELD), w = unitOf(o, WASHERS_FIELD), v = Number(o.monetaryValue) || 0;
    beds += b; washers += w; value += v;
    const st = stageMap.get(o.pipelineStageId) || 'unknown';
    (byStage[st] ||= { n: 0, beds: 0, washers: 0, value: 0 });
    byStage[st].n++; byStage[st].beds += b; byStage[st].washers += w; byStage[st].value += v;
  }
  return { count: open.length, total_count: opps.length, beds, washers, value, byStage };
}

async function main() {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) throw new Error('Missing GHL_API_KEY / GHL_LOCATION_ID (run with --env-file=apps/web/.env.local)');
  console.log('=== Goods 3-pipeline roll-up (read-only) ===\n');

  // NEED — curated priority slice + full addressable.
  const [need] = psql(`SELECT SUM(demand_beds)::int beds, SUM(demand_washers)::int washers, COUNT(*) communities FROM goods_communities WHERE priority IN ('active','lead')`, { timeout: 120000 });
  const [addressable] = psql(`SELECT SUM(demand_beds)::int beds, SUM(demand_washers)::int washers, COUNT(*) communities FROM goods_communities`, { timeout: 120000 });

  // ORDERED (buyer) · FUNDED (supporter) · NEED-tracked-in-GHL (demand register).
  const buyer = await rollupPipeline(PIPELINES.buyer.id);
  const supporter = await rollupPipeline(PIPELINES.supporter.id);
  const demand = await rollupPipeline(PIPELINES.demand.id);

  const gap = { beds: Math.max(0, need.beds - DELIVERED.beds), washers: Math.max(0, need.washers - DELIVERED.washers) };

  // Console cockpit.
  const row = (l, b, w, v) => console.log(`  ${l.padEnd(34)} ${String(b).padStart(8)} beds  ${String(w).padStart(6)} wash  ${v != null ? money(v).padStart(14) : ''.padStart(14)}`);
  row('NEED (curated: active+lead)', need.beds, need.washers, null);
  row('  addressable (all communities)', addressable.beds, addressable.washers, null);
  row('ORDERED (Buyer Pipeline)', buyer.beds, buyer.washers, buyer.value);
  row('FUNDED (Supporter Journey)', supporter.beds, supporter.washers, supporter.value);
  row('DELIVERED (assets, cited)', DELIVERED.beds, DELIVERED.washers, null);
  row('GAP (need − delivered)', gap.beds, gap.washers, null);
  console.log(`\n  Demand Register: ${demand.total_count} opps (${demand.beds} beds / ${demand.washers} washers tagged in GHL)`);

  // Report.
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' });
  const stageTable = (r) => Object.entries(r.byStage).sort((a, b) => b[1].n - a[1].n)
    .map(([st, s]) => `| ${st} | ${s.n} | ${s.beds || ''} | ${s.washers || ''} | ${s.value ? money(s.value) : ''} |`).join('\n') || '| _(no open opps)_ | | | | |';

  const md = `# Goods on Country — 3-pipeline unit-ledger cockpit

**Generated:** ${date} · \`scripts/goods-pipeline-rollup.mjs\` (read-only)
**Model:** one need, two funding routes, one delivery. See \`act-infra thoughts/shared/plans/2026-05-28-goods-three-pipeline-operating-model.md\`.

## Cockpit (beds · washing machines · $)
| Line | Beds | Washers | $ |
|---|---|---|---|
| **NEED** — curated (active+lead, ${need.communities} communities) | **${need.beds.toLocaleString()}** | **${need.washers.toLocaleString()}** | — |
| _addressable (all ${addressable.communities.toLocaleString()})_ | _${addressable.beds.toLocaleString()}_ | _${addressable.washers.toLocaleString()}_ | — |
| **ORDERED** — Buyer Pipeline (${buyer.count} open) | ${buyer.beds.toLocaleString()} | ${buyer.washers.toLocaleString()} | ${money(buyer.value)} |
| **FUNDED** — Supporter Journey (${supporter.count} open) | ${supporter.beds.toLocaleString()} | ${supporter.washers.toLocaleString()} | ${money(supporter.value)} |
| **DELIVERED** — assets (cited) | ${DELIVERED.beds.toLocaleString()} | ${DELIVERED.washers.toLocaleString()} | — |
| **GAP** (need − delivered) | **${gap.beds.toLocaleString()}** | **${gap.washers.toLocaleString()}** | — |

> Units come from the new GHL opportunity fields \`Goods: Beds\` / \`Goods: Washing machines\` + native opportunity value. As the team scopes deals (fills those fields), ORDERED/FUNDED fill in and GAP closes. DELIVERED is a cited constant — ${DELIVERED.source}.

## Procurement — Buyer Pipeline by stage
| Stage | Opps | Beds ordered | Washers | $ |
|---|---|---|---|---|
${stageTable(buyer)}

## Support — Supporter Journey by stage
| Stage | Opps | Beds funded | Washers | $ committed |
|---|---|---|---|---|
${stageTable(supporter)}

## Need — Demand Register by stage (relationship tracking; quantities live in goods_communities)
| Stage | Opps | Beds | Washers | $ |
|---|---|---|---|---|
${stageTable(demand)}

## Provenance
- NEED: \`goods_communities\` priority ∈ {active, lead} (curated) and all rows (addressable), shared ACT DB \`tednluwflfhxyucgwigh\`.
- ORDERED/FUNDED: GHL pipelines (Buyer \`${PIPELINES.buyer.id}\`, Supporter \`${PIPELINES.supporter.id}\`), open opps only; units from custom fields Beds \`${BEDS_FIELD}\` / Washers \`${WASHERS_FIELD}\` + monetaryValue.
- DELIVERED: ${DELIVERED.source} (Goods v2 \`assets\`, project cwsyhpiuepvdjtxaozwf) — cited constant, not live here.
`;

  const mdPath = `thoughts/shared/reports/goods-pipeline-rollup-${date}.md`;
  const jsonPath = `thoughts/shared/reports/goods-pipeline-rollup-${date}.json`;
  mkdirSync(dirname(mdPath), { recursive: true });
  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, JSON.stringify({ generated: date, need, addressable, ordered: buyer, funded: supporter, demand, delivered: DELIVERED, gap }, null, 2));
  console.log(`\n✓ Wrote ${mdPath}`);
  console.log(`✓ Wrote ${jsonPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });

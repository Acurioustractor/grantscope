#!/usr/bin/env node
/**
 * build-funder-discernment.mjs — CivicGraph layer of ACT's energy-orbit relational system.
 *
 * The third reconciler (after build-unified-orbit + build-contributor-constellation in the
 * act-global-infrastructure repo). Same posture: READ-ONLY, paginate/batch past the 1000-cap,
 * write a worklist CSV + print a summary. No writes to any DB.
 *
 * CivicGraph is the FUNDER-DISCERNMENT / anti-foundation instrument: 100K+ entities keyed by
 * ABN, gov contracts, political donations, ATO tax transparency. Structural signals only —
 * NO editorial "ethical" label. Alignment is INFERRED, never asserted as fact.
 *
 * Two screens:
 *   A) HALO-WASH — entities that BOTH donate to political parties AND hold government
 *      contracts (matched by ABN). The "buying influence while taking public money" exposure.
 *   B) GENUINE COMMUNITY BACKERS — entities that are Supply Nation certified OR
 *      community-controlled (ORIC / ACNC-Indigenous / self-identified). The counterweight,
 *      with a `donates_to_party` DRIFT flag naming any community-controlled org that itself
 *      makes political donations.
 *
 * PERFORMANCE: exec_sql ships ≤1000 rows/call AND has an ~8s statement timeout. So we never
 * aggregate all 672K contracts in one shot — we (1) aggregate the small donor side (paginated),
 * then (2) aggregate contracts ONLY for donor ABNs in 500-ABN batches via idx_austender_supplier_abn,
 * then (3) enrich names from gs_entities via its unique ABN index. Every query stays fast + bounded.
 *
 * NOTE on energy-scoring: the "never energy-score the community lane" guardrail is about
 * individual storytellers/elders (the constellation layer), NOT funder ORGANISATIONS in the
 * funding graph. Ranking funder entities by donation / contract / revenue magnitude is fine.
 *
 * Outputs (written into the ACT repo so all three orbit layers co-locate):
 *   thoughts/shared/civicgraph-halo-wash.csv
 *   thoughts/shared/civicgraph-community-backers.csv
 *
 * Run (from the grantscope repo):  node scripts/build-funder-discernment.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OUT = '/Users/benknight/Code/act-global-infrastructure/thoughts/shared';

async function q(sql) {
  const { data, error } = await db.rpc('exec_sql', { query: sql });
  if (error) { console.error('SQL error:', error.message, '\n', sql.slice(0, 160)); process.exit(1); }
  return data || [];
}
// paginate a SELECT past the 1000-cap. baseSql must END at its ORDER BY (no trailing ;).
async function qAll(baseSql) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const page = await q(`${baseSql}\nLIMIT 1000 OFFSET ${off}`);
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}
const lit = a => `'${String(a).replace(/'/g, "''")}'`;
const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = (rows, cols) => [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
const money = n => '$' + Math.round(Number(n) || 0).toLocaleString();

// ── 1) DONOR aggregates (the small side: ~10.7k ABNs) ──────────────────────
console.log('Loading political-donation aggregates by ABN…');
const donors = new Map(); // abn -> {donated, count, parties}
for (const r of await qAll(`
  SELECT donor_abn AS abn, sum(amount) donated, count(*) dc, string_agg(DISTINCT donation_to, '; ') parties
  FROM political_donations WHERE donor_abn IS NOT NULL AND donor_abn <> ''
  GROUP BY donor_abn ORDER BY donor_abn`)) {
  donors.set(r.abn, { donated: Number(r.donated) || 0, count: Number(r.dc) || 0, parties: r.parties });
}
console.log(`  ${donors.size} distinct donor ABNs.`);

// ── 2) CONTRACT aggregates ONLY for donor ABNs (batched via index) ─────────
console.log('Aggregating government contracts for those donor ABNs (batched)…');
const donorAbns = [...donors.keys()];
const contractors = new Map(); // abn -> {value, count, name}
for (let i = 0; i < donorAbns.length; i += 500) {
  const list = donorAbns.slice(i, i + 500).map(lit).join(',');
  for (const r of await q(`
    SELECT supplier_abn AS abn, sum(contract_value) cv, count(*) cc, max(supplier_name) name
    FROM austender_contracts WHERE supplier_abn IN (${list}) GROUP BY supplier_abn`)) {
    contractors.set(r.abn, { value: Number(r.cv) || 0, count: Number(r.cc) || 0, name: r.name });
  }
}
console.log(`  ${contractors.size} of those donors also hold contracts → halo-wash set.`);

// ── 3) HALO-WASH rows = donors ∩ contractors, enriched from gs_entities ────
const haloAbns = donorAbns.filter(a => contractors.has(a));
const ent = new Map(); // abn -> {name, sector, state, is_community_controlled}
for (let i = 0; i < haloAbns.length; i += 500) {
  const list = haloAbns.slice(i, i + 500).map(lit).join(',');
  for (const r of await q(`
    SELECT abn, canonical_name AS name, sector, state, is_community_controlled
    FROM gs_entities WHERE abn IN (${list})`)) ent.set(r.abn, r);
}
const halo = haloAbns.map(abn => {
  const d = donors.get(abn), c = contractors.get(abn), e = ent.get(abn) || {};
  return {
    name: e.name || c.name, abn,
    donated: Math.round(d.donated), donation_count: d.count, parties: d.parties,
    contract_value: Math.round(c.value), contract_count: c.count,
    contract_per_donation_dollar: d.donated > 0 ? Math.round(c.value / d.donated) : null,
    sector: e.sector, state: e.state, is_community_controlled: e.is_community_controlled,
  };
}).sort((a, b) => b.donated - a.donated);
writeFileSync(`${OUT}/civicgraph-halo-wash.csv`,
  csv(halo, ['name', 'abn', 'donated', 'donation_count', 'parties', 'contract_value', 'contract_count', 'contract_per_donation_dollar', 'sector', 'state', 'is_community_controlled']));
const totalDon = halo.reduce((a, r) => a + r.donated, 0), totalCon = halo.reduce((a, r) => a + r.contract_value, 0);
console.log(`\nA) HALO-WASH — ${halo.length} entities · ${money(totalDon)} donated ↔ ${money(totalCon)} in contracts`);
console.log(`   → thoughts/shared/civicgraph-halo-wash.csv`);
console.log('   Top 10 by political donations:');
for (const r of halo.slice(0, 10)) console.log(`     ${money(r.donated).padStart(15)} → ${money(r.contract_value).padStart(16)} contracts · ${r.name}`);

// ── 4) GENUINE COMMUNITY BACKERS (gs_entities filter; drift flag from donor map) ──
console.log('\nB) Genuine community backers (Supply Nation / ORIC / community-controlled)…');
const backersRaw = await qAll(`
  SELECT abn, canonical_name AS name, entity_type,
         community_controlled_tier AS tier, is_supply_nation_certified AS supply_nation,
         sector, state, remoteness, seifa_irsd_decile AS seifa_decile, round(latest_revenue) latest_revenue
  FROM gs_entities
  WHERE (is_community_controlled OR is_supply_nation_certified) AND abn IS NOT NULL AND abn <> ''
  ORDER BY latest_revenue DESC NULLS LAST, abn`);
const backers = backersRaw.map(r => {
  const d = donors.get(r.abn);
  return { ...r, donates_to_party: !!d, party_donations: d ? Math.round(d.donated) : null };
});
writeFileSync(`${OUT}/civicgraph-community-backers.csv`,
  csv(backers, ['name', 'abn', 'tier', 'supply_nation', 'entity_type', 'sector', 'state', 'remoteness', 'seifa_decile', 'latest_revenue', 'donates_to_party', 'party_donations']));
const withCap = backers.filter(r => Number(r.latest_revenue) > 0).length;
const drift = backers.filter(r => r.donates_to_party).sort((a, b) => (b.party_donations || 0) - (a.party_donations || 0));
console.log(`   → ${backers.length} community-rooted entities (${withCap} with known revenue / funding capacity)`);
console.log(`   → thoughts/shared/civicgraph-community-backers.csv`);
const byTier = {};
for (const r of backers) { const k = r.supply_nation ? `${r.tier || 'none'}+supply_nation` : (r.tier || 'supply_nation_only'); byTier[k] = (byTier[k] || 0) + 1; }
console.log('   By tier:');
for (const [k, n] of Object.entries(byTier).sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(5)}  ${k}`);

// ── 5) DRIFT: community-controlled orgs that ALSO donate to parties (named) ──
console.log(`\nC) DRIFT FLAG — ${drift.length} community-rooted entities that ALSO donate to political parties:`);
for (const r of drift) console.log(`     ${money(r.party_donations).padStart(12)} → ${r.name} (${r.tier || 'supply_nation'}, ${r.state || '?'})`);

console.log('\nNOTE: CivicGraph has STRUCTURAL signals only — no editorial "ethical" label. Alignment is INFERRED, never asserted. Read-only; nothing written to any DB.');

#!/usr/bin/env node
/**
 * goods-repeat-buyer-intel.mjs — Goods Phase 1 (surface what exists; READ-ONLY)
 *
 * Mines `austender_contracts` (~672K rows) BY BUYER for government agencies that
 * REPEATEDLY purchase Goods-type products (beds / mattresses / whitegoods /
 * furniture / linen / laundry). Output = a ranked report of the warmest
 * procurement targets for Goods on Country.
 *
 * Inverse of hydrate-goods-procurement.mjs, which groups by SUPPLIER (who Goods
 * competes with). This groups by buyer_name — the DEMAND side, who to sell to.
 *
 * NO DB WRITES this phase. `--apply` is reserved (no-op) so a later phase can
 * promote top buyers into goods_procurement_entities / _signals.
 *
 * Run: node --env-file=.env scripts/goods-repeat-buyer-intel.mjs
 *
 * Plan: 2026-05-28-goods-phase1-discovery-surface
 */
import { psql } from './lib/psql.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const APPLY = process.argv.includes('--apply');
const TOP_N = 60;
const MIN_CONTRACTS = 2; // "repeat" buyer

// Goods product words — mirrors GOODS_KEYWORDS in hydrate-goods-procurement.mjs
// and sync-austender-open-tenders.mjs. Word-boundary matched (\m) to avoid
// 'bed' → 'seabed'/'embedded' noise.
const GOODS_KEYWORDS = [
  'furniture', 'bed', 'mattress', 'housing', 'accommodation',
  'white goods', 'whitegood', 'appliance', 'washing', 'refrigerat', 'linen',
  'fitout', 'fit-out', 'furnish', 'kitchen', 'laundry',
  'fridge', 'freezer', 'dryer',
];
// UNSPSC families that ARE Goods product (assigned by the agency = authoritative):
//   56xx furniture/furnishings · 5210 floor coverings · 5212 bedding/linen ·
//   5213 kitchenware · 5214 domestic appliances (whitegoods). Excludes 5216/5217.
const GOODS_UNSPSC_PREFIXES = ['5210', '5212', '5213', '5214'];

const KW_REGEX = `\\m(${GOODS_KEYWORDS.join('|')})`;
const GOODS_PREDICATE = `(
    title ~* '${KW_REGEX}'
    OR category ~* '${KW_REGEX}'
    OR category LIKE 'UNSPSC:56%'
    ${GOODS_UNSPSC_PREFIXES.map(p => `OR category LIKE 'UNSPSC:${p}%'`).join('\n    ')}
  )`;

// Buyer-relevance gate for the actionable shortlist: agencies whose remit is
// housing / community / First Nations / local-govt — the buyers a remote-community
// bed+washer enterprise can realistically sell to (vs Defence/ATO office furniture).
const BUYER_RELEVANCE = `buyer_name ~* '\\m(housing|communit|aborigin|indigenous|first nation|torres|land council|regional council|shire|district council|remote)'`;

// Parse a Postgres array literal like {"a","b, c",NULL} → string[]
function parsePgArray(raw) {
  if (!raw || raw === '{}' || raw === 'NULL') return [];
  const body = raw.replace(/^\{/, '').replace(/\}$/, '');
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') {
      if (inQ && body[i + 1] === '"') { cur += '"'; i++; continue; }
      inQ = !inQ; continue;
    }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out.map(s => s.trim()).filter(s => s && s !== 'NULL');
}

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-AU')}`;

function main() {
  console.log('=== Goods repeat-buyer intelligence (austender_contracts, read-only) ===\n');

  // 1. Headline diagnostics — how much goods demand is in the table at all.
  const [diag] = psql(`
    SELECT
      COUNT(*) AS goods_contracts,
      COUNT(DISTINCT buyer_name) FILTER (WHERE buyer_name IS NOT NULL AND buyer_name <> '') AS distinct_buyers,
      ROUND(SUM(COALESCE(contract_value,0))::numeric, 0) AS total_value
    FROM austender_contracts
    WHERE ${GOODS_PREDICATE};
  `, { timeout: 300000, label: 'goods-buyer-diag' });
  console.log(`Goods-matching contracts: ${diag.goods_contracts}`);
  console.log(`Distinct buyers:          ${diag.distinct_buyers}`);
  console.log(`Total contract value:     ${money(diag.total_value)}\n`);

  // 2. Ranked repeat buyers (the report core).
  const rows = psql(`
    SELECT
      buyer_name,
      COUNT(*) AS contract_count,
      ROUND(SUM(COALESCE(contract_value,0))::numeric, 0) AS total_value,
      MIN(EXTRACT(YEAR FROM contract_start))::int AS first_year,
      MAX(EXTRACT(YEAR FROM contract_start))::int AS last_year,
      COUNT(DISTINCT EXTRACT(YEAR FROM contract_start)) AS active_years,
      (array_agg(DISTINCT left(title, 90)) FILTER (WHERE title IS NOT NULL))[1:3] AS sample_titles
    FROM austender_contracts
    WHERE buyer_name IS NOT NULL AND buyer_name <> ''
      AND ${GOODS_PREDICATE}
    GROUP BY buyer_name
    HAVING COUNT(*) >= ${MIN_CONTRACTS}
    ORDER BY contract_count DESC, total_value DESC
    LIMIT ${TOP_N};
  `, { timeout: 300000, label: 'goods-buyer-rank' });

  console.log(`Top ${rows.length} repeat buyers (>= ${MIN_CONTRACTS} goods contracts):\n`);
  rows.slice(0, 15).forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${r.buyer_name}`);
    console.log(`    ${r.contract_count} contracts · ${money(r.total_value)} · ${r.first_year}–${r.last_year} (${r.active_years} active yrs)`);
  });

  // 2b. Actionable shortlist — repeat buyers whose remit fits Goods (housing /
  //     community / First Nations / local-govt). This is the warm-targets table.
  const relevantRows = psql(`
    SELECT
      buyer_name,
      COUNT(*) AS contract_count,
      ROUND(SUM(COALESCE(contract_value,0))::numeric, 0) AS total_value,
      MIN(EXTRACT(YEAR FROM contract_start))::int AS first_year,
      MAX(EXTRACT(YEAR FROM contract_start))::int AS last_year,
      COUNT(DISTINCT EXTRACT(YEAR FROM contract_start)) AS active_years,
      (array_agg(DISTINCT left(title, 90)) FILTER (WHERE title IS NOT NULL))[1:3] AS sample_titles
    FROM austender_contracts
    WHERE buyer_name IS NOT NULL AND buyer_name <> ''
      AND ${BUYER_RELEVANCE}
      AND ${GOODS_PREDICATE}
    GROUP BY buyer_name
    HAVING COUNT(*) >= ${MIN_CONTRACTS}
    ORDER BY contract_count DESC, total_value DESC
    LIMIT ${TOP_N};
  `, { timeout: 300000, label: 'goods-buyer-relevant' });

  console.log(`\nWarm targets (housing/community/First Nations remit): ${relevantRows.length}`);
  relevantRows.slice(0, 10).forEach((r, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${r.buyer_name} — ${r.contract_count} contracts · ${money(r.total_value)}`);
  });

  // 3. Write report artifacts. Date in AEST (Goods is QLD/Jinibara Country) so it
  //    lines up with the working day, not UTC.
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' });
  const mdPath = `thoughts/shared/reports/goods-repeat-buyers-${date}.md`;
  const jsonPath = `thoughts/shared/reports/goods-repeat-buyers-${date}.json`;
  mkdirSync(dirname(mdPath), { recursive: true });

  const buildTable = (list) => list.map((r, i) => {
    const titles = parsePgArray(r.sample_titles).map(t => t.replace(/\|/g, '/')).join('; ');
    return `| ${i + 1} | ${(r.buyer_name || '').replace(/\|/g, '/')} | ${r.contract_count} | ${money(r.total_value)} | ${r.first_year}–${r.last_year} | ${r.active_years} | ${titles} |`;
  }).join('\n');
  const header = `| # | Buyer (agency) | Contracts | Total value | Years | Active yrs | Sample titles |\n|---|----------------|-----------|-------------|-------|------------|---------------|`;

  const md = `# Goods on Country — repeat government buyers (procurement targets)

**Generated:** ${date} · \`scripts/goods-repeat-buyer-intel.mjs\` (read-only, no DB writes)
**Source:** \`austender_contracts\` (AusTender OCDS federal awarded contracts, ~672K rows)
**Method:** group by \`buyer_name\`, keep buyers with ≥${MIN_CONTRACTS} contracts matching Goods product (word-boundary keyword on title/category OR Goods UNSPSC family 56 / 5210 / 5212 / 5213 / 5214). Ranked by contract count, then total value.

> These are agencies that **repeatedly buy beds / whitegoods / furniture / linen** — the warmest demand-side targets for Goods. A purchase order beats a grant and repeats. Verify each before outreach: AusTender records awarded *federal* contracts only (state/NT procurement is in separate tables), and keyword matching can still admit adjacent categories — read the sample titles.

## Headline
- **${diag.goods_contracts}** goods-matching federal contracts across **${diag.distinct_buyers}** distinct buyers, **${money(diag.total_value)}** total.
- **${relevantRows.length}** of those buyers have a housing / community / First Nations / local-government remit — the actionable shortlist below. The raw top-${rows.length} list (which Defence & ATO dominate with barracks/office furniture) follows as context only.

## ⭐ Warm targets — housing / community / First Nations buyers
Filtered to buyers whose remit fits a remote-community bed+washer enterprise (\`housing|communit|aborigin|indigenous|first nation|torres|land council|regional council|shire|district council|remote\`).

${header}
${buildTable(relevantRows)}

## All repeat buyers (context — includes off-target agencies)
${header}
${buildTable(rows)}

## Caveats / provenance
- **Federal only.** \`austender_contracts\` is the AusTender OCDS feed (federal). NT/state remote-housing procurement (the $4B whale, Phase 4) is **not** here.
- **Awarded, not open.** These are past awards (demand signal), not open tenders. Open tenders are the Phase-3 \`austender-open-tenders\` feed in \`grant_opportunities\`.
- **Keyword recall vs precision.** \`bed\`/\`linen\`/\`kitchen\` are word-boundary matched but adjacent categories can still appear — the sample titles are there to sanity-check each row.
- **No DB writes.** \`--apply\` is reserved; promoting top buyers into \`goods_procurement_entities\`/\`_signals\` is a later-phase decision.
`;

  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, JSON.stringify({ generated: date, diagnostics: diag, warm_targets: relevantRows, all_repeat_buyers: rows }, null, 2));
  console.log(`\n✓ Wrote ${mdPath}`);
  console.log(`✓ Wrote ${jsonPath}`);
  if (APPLY) console.log('\n(--apply is a reserved no-op this phase; no DB writes performed.)');
}

main();

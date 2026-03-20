#!/usr/bin/env node

/**
 * Refresh all materialized views in GrantScope
 * Run after data imports/enrichments to update computed metrics
 *
 * Usage: node scripts/refresh-materialized-views.mjs
 *
 * Note: This uses the Supabase Management API (requires service role key).
 * For automated refreshes, call via cron or after enrichment scripts complete.
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const VIEWS = [
  'mv_data_quality',
  'mv_crossref_quality',
  'mv_donor_contract_crossref',
  'mv_entity_power_index',
  'mv_funding_deserts',
];

async function refreshView(viewName) {
  const query = `REFRESH MATERIALIZED VIEW ${viewName}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    // exec_sql RPC may not exist — that's OK, views are refreshed via Supabase MCP
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
}

async function main() {
  console.log(`Refreshing ${VIEWS.length} materialized views...`);

  for (const view of VIEWS) {
    const start = Date.now();
    try {
      await refreshView(view);
      console.log(`  ✓ ${view} (${Date.now() - start}ms)`);
    } catch (err) {
      console.log(`  ✗ ${view}: ${err.message}`);
      console.log(`    → Refresh manually: REFRESH MATERIALIZED VIEW ${view};`);
    }
  }

  console.log('\nDone. If any failed, refresh via Supabase SQL editor or MCP.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

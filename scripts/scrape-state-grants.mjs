#!/usr/bin/env node

/**
 * Scrape State Grant Portals
 *
 * Runs state/territory grant scrapers and upserts to grant_opportunities.
 *
 * Usage:
 *   node scripts/scrape-state-grants.mjs                    # All states
 *   node scripts/scrape-state-grants.mjs --state=nsw        # Specific state
 *   node scripts/scrape-state-grants.mjs --dry-run          # Preview only
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { createACTGrantsPlugin } from '../packages/grant-engine/src/sources/act-grants.ts';
import { createQLDGrantsPlugin } from '../packages/grant-engine/src/sources/qld-grants.ts';
import { createNSWGrantsPlugin } from '../packages/grant-engine/src/sources/nsw-grants.ts';
import { createVICGrantsPlugin } from '../packages/grant-engine/src/sources/vic-grants.ts';
import { createTASGrantsPlugin } from '../packages/grant-engine/src/sources/tas-grants.ts';
import { createSAGrantsPlugin } from '../packages/grant-engine/src/sources/sa-grants.ts';
import { createWAGrantsPlugin } from '../packages/grant-engine/src/sources/wa-grants.ts';
import { createNTGrantsPlugin } from '../packages/grant-engine/src/sources/nt-grants.ts';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const stateArg = process.argv.find(a => a.startsWith('--state='));
const SINGLE_STATE = stateArg ? stateArg.split('=')[1].toLowerCase() : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let currentRunId = null;

const statePlugins = [
  createACTGrantsPlugin(),
  createQLDGrantsPlugin(),
  createNSWGrantsPlugin(),
  createVICGrantsPlugin(),
  createTASGrantsPlugin(),
  createSAGrantsPlugin(),
  createWAGrantsPlugin(),
  createNTGrantsPlugin(),
];

function buildGrantKey(grant) {
  return `${grant.sourceId}::${String(grant.title || '').trim().toLowerCase()}`;
}

function buildRowKey(row) {
  return `${row.source_id}::${String(row.name || '').trim().toLowerCase()}`;
}

function normalizeUrl(url) {
  if (!url) return null;
  const text = String(url).trim();
  return text || null;
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function fetchPaginated(queryFactory, pageSize = 1000) {
  const rows = [];
  let page = 0;

  while (true) {
    const { data, error } = await queryFactory(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    page += 1;
  }

  return rows;
}

function scoreGrant(grant) {
  return (normalizeUrl(grant.sourceUrl) ? 4 : 0)
    + (grant.deadline ? 3 : 0)
    + ((grant.amount?.max || grant.amount_max) ? 2 : 0)
    + Math.min((grant.description || '').length, 1000) / 1000;
}

function preferGrant(current, candidate) {
  return scoreGrant(candidate) > scoreGrant(current) ? candidate : current;
}

function dedupeGrants(grants) {
  const byKey = new Map();
  for (const grant of grants) {
    const key = buildGrantKey(grant);
    const existing = byKey.get(key);
    byKey.set(key, existing ? preferGrant(existing, grant) : grant);
  }

  return [...byKey.values()];
}

function buildGrantRow(grant) {
  return {
    name: grant.title,
    provider: grant.provider,
    url: normalizeUrl(grant.sourceUrl),
    description: grant.description,
    amount_min: grant.amount?.min || null,
    amount_max: grant.amount?.max || null,
    deadline: grant.deadline || null,
    categories: grant.categories,
    source_id: grant.sourceId,
    geography: grant.geography?.[0] || 'AU',
    status: 'open',
    grant_type: 'open_opportunity',
    source: grant.provider || 'state-grants',
    last_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function prepareGrantRows(grants, pluginId) {
  const grantRows = grants.map(buildGrantRow);
  const existingSourceRows = await fetchPaginated((from, to) => (
    supabase
      .from('grant_opportunities')
      .select('id, name, source_id, url, status')
      .eq('source_id', pluginId)
      .range(from, to)
  ));

  const existingByKey = new Map(
    (existingSourceRows || []).map((row) => [buildRowKey(row), { ...row, url: normalizeUrl(row.url) }]),
  );

  const candidateUrls = [...new Set(grantRows.map(row => normalizeUrl(row.url)).filter(Boolean))];
  const existingUrlOwnerByUrl = new Map();

  if (candidateUrls.length > 0) {
    for (const urlChunk of chunkArray(candidateUrls, 100)) {
      const { data: existingUrlRows, error: existingUrlError } = await supabase
        .from('grant_opportunities')
        .select('name, source_id, url')
        .in('url', urlChunk);

      if (existingUrlError) throw existingUrlError;

      for (const row of existingUrlRows || []) {
        existingUrlOwnerByUrl.set(normalizeUrl(row.url), buildRowKey(row));
      }
    }
  }

  const rowsByUrl = new Map();
  for (const row of grantRows) {
    const url = normalizeUrl(row.url);
    if (!url) continue;
    const bucket = rowsByUrl.get(url) || [];
    bucket.push(row);
    rowsByUrl.set(url, bucket);
  }

  for (const [url, rows] of rowsByUrl) {
    const reservedOwnerKey = existingUrlOwnerByUrl.get(url);
    const currentKeys = rows.map(buildRowKey);
    let ownerKey = null;

    if (reservedOwnerKey && currentKeys.includes(reservedOwnerKey)) {
      ownerKey = reservedOwnerKey;
    } else if (!reservedOwnerKey) {
      const preferredRow = rows
        .slice()
        .sort((left, right) => scoreGrant(right) - scoreGrant(left) || buildRowKey(left).localeCompare(buildRowKey(right)))[0];
      ownerKey = preferredRow ? buildRowKey(preferredRow) : null;
    }

    for (const row of rows) {
      const key = buildRowKey(row);
      if (ownerKey === key) continue;

      const existingUrl = normalizeUrl(existingByKey.get(key)?.url);
      row.url = existingUrl && existingUrl !== url ? existingUrl : null;
    }
  }

  return { grantRows, existingByKey };
}

async function closeMissingGrantRows(pluginId, existingByKey, grantRows) {
  const liveKeys = new Set(grantRows.map(buildRowKey));
  const staleRows = [...existingByKey.entries()]
    .filter(([key, row]) => !liveKeys.has(key) && row.status !== 'closed')
    .map(([, row]) => row);

  if (staleRows.length === 0) return { closed: 0, skipped: false };

  const safetyThreshold = Math.max(25, Math.ceil(grantRows.length * 0.5));
  if (staleRows.length > safetyThreshold) {
    console.warn(`  Skipping stale cleanup for ${pluginId}: ${staleRows.length} missing rows exceeds safety threshold ${safetyThreshold}`);
    return { closed: 0, skipped: true };
  }

  const staleIds = staleRows.map(row => row.id).filter(Boolean);
  if (staleIds.length === 0) return { closed: 0, skipped: false };

  const { error: closeError } = await supabase
    .from('grant_opportunities')
    .update({
      status: 'closed',
      updated_at: new Date().toISOString(),
    })
    .in('id', staleIds);

  if (closeError) throw closeError;

  console.log(`  Closed ${staleIds.length} stale grants missing from current ${pluginId} feed`);
  return { closed: staleIds.length, skipped: false };
}

function isDuplicateUrlError(error) {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ].filter(Boolean).join(' ');

  return /grant_opportunities_url_idx|idx_grants_unique_url/i.test(text)
    || (error?.code === '23505' && /duplicate key value/i.test(text) && /\burl\b/i.test(text));
}

async function upsertGrantRow(grantRow) {
  const { error } = await supabase
    .from('grant_opportunities')
    .upsert(grantRow, { onConflict: 'name,source_id', ignoreDuplicates: false });

  if (!error) return null;
  if (!isDuplicateUrlError(error)) return error;

  const { data: existingGrant, error: existingError } = await supabase
    .from('grant_opportunities')
    .select('url')
    .eq('name', grantRow.name)
    .eq('source_id', grantRow.source_id)
    .maybeSingle();

  if (existingError) return existingError;

  const fallbackRow = {
    ...grantRow,
    url: existingGrant?.url || null,
  };

  const { error: fallbackError } = await supabase
    .from('grant_opportunities')
    .upsert(fallbackRow, { onConflict: 'name,source_id', ignoreDuplicates: false });

  return fallbackError || null;
}

async function main() {
  const run = await logStart(supabase, 'scrape-state-grants', 'Scrape State Grants');
  currentRunId = run.id;

  console.log('=== State Grant Scraper ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`State: ${SINGLE_STATE || 'all'}\n`);

  const plugins = SINGLE_STATE
    ? statePlugins.filter(p => p.id.startsWith(SINGLE_STATE))
    : statePlugins;

  if (plugins.length === 0) {
    console.error(`No plugin found for state: ${SINGLE_STATE}`);
    console.error(`Available: ${statePlugins.map(p => p.id).join(', ')}`);
    process.exit(1);
  }

  let totalDiscovered = 0;
  let totalNew = 0;
  let totalUpdated = 0;
  const errors = [];

  for (const plugin of plugins) {
    console.log(`\n--- ${plugin.name} ---`);
    let grants = [];

    try {
      for await (const grant of plugin.discover({ geography: ['AU'], status: 'open' })) {
        grants.push(grant);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${plugin.id}: ${message}`);
      console.error(`Error running ${plugin.id}: ${message}`);
      continue;
    }

    const rawCount = grants.length;
    grants = dedupeGrants(grants);

    console.log(`Found ${rawCount} grants from ${plugin.id} (${grants.length} unique after source-key dedup)`);
    totalDiscovered += grants.length;

    if (DRY_RUN) {
      for (const g of grants.slice(0, 10)) {
        console.log(`  ${g.title} | ${g.provider} | ${g.sourceUrl || 'no url'}`);
      }
      if (grants.length > 10) console.log(`  ... and ${grants.length - 10} more`);
      continue;
    }

    const { grantRows, existingByKey } = await prepareGrantRows(grants, plugin.id);

    // Upsert to grant_opportunities on the concrete unique key the table exposes.
    const BATCH_SIZE = 50;
    for (let i = 0; i < grantRows.length; i += BATCH_SIZE) {
      const batch = grantRows.slice(i, i + BATCH_SIZE);

      const { error } = await supabase
        .from('grant_opportunities')
        .upsert(batch, { onConflict: 'name,source_id', ignoreDuplicates: false });

      if (error) {
        console.error(`  Batch upsert error (${plugin.id}, offset ${i}): ${error.message}`);
        for (const grantRow of batch) {
          const singleError = await upsertGrantRow(grantRow);
          if (singleError) {
            errors.push(`${plugin.id} upsert: ${singleError.message}`);
            console.error(`  Single upsert error: ${singleError.message}`);
            continue;
          }

          if (existingByKey.has(buildRowKey(grantRow))) totalUpdated += 1;
          else totalNew += 1;
        }
      } else {
        for (const grantRow of batch) {
          if (existingByKey.has(buildRowKey(grantRow))) totalUpdated += 1;
          else totalNew += 1;
        }
      }
    }

    if (grantRows.length > 0) {
      const staleCleanup = await closeMissingGrantRows(plugin.id, existingByKey, grantRows);
      totalUpdated += staleCleanup.closed;
    }

    console.log(`  Upserted ${grantRows.length} grants from ${plugin.id}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total new: ${totalNew}`);
  console.log(`Total updated: ${totalUpdated}`);
  console.log('Done.');

  await logComplete(supabase, run.id, {
    items_found: totalDiscovered,
    items_new: totalNew,
    items_updated: totalUpdated,
    status: errors.length > 0 ? 'partial' : 'success',
    errors,
  });
}

main().catch(async err => {
  console.error('Fatal error:', err);
  const message = err instanceof Error ? err.message : String(err);
  await logFailed(supabase, currentRunId, message);
  process.exit(1);
});

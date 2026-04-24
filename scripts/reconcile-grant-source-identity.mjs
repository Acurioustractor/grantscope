#!/usr/bin/env node

/**
 * Reconcile Grant Source Identity
 *
 * Canonicalizes legacy grant_engine rows that predate source_id backfill.
 * For each (discovery_method, name) conflict group:
 * - prefer an existing canonical row with source_id = discovery_method
 * - otherwise promote the best blank row to the canonical source_id
 * - mark the remaining blank rows as duplicates with stable synthetic source_ids
 *
 * Usage:
 *   node --env-file=.env scripts/reconcile-grant-source-identity.mjs [--apply] [--limit=100] [--sources=a,b]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APPLY = process.argv.includes('--apply');
const LIMIT = Math.max(1, Number.parseInt(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '100', 10));
const SOURCES = (process.argv.find((arg) => arg.startsWith('--sources='))?.split('=')[1] || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUS_PRIORITY = new Map([
  ['open', 5],
  ['ongoing', 4],
  ['unknown', 3],
  ['closed', 2],
  ['duplicate', 1],
]);

const APPLICATION_STATUS_PRIORITY = new Map([
  ['open', 6],
  ['ongoing', 5],
  ['upcoming', 4],
  ['unknown', 3],
  ['closed', 2],
  ['awarded', 1],
  ['submitted', 1],
  ['not_applied', 1],
  ['unsuccessful', 1],
  ['in_progress', 1],
]);

function log(message) {
  console.log(`[reconcile-grant-source-identity] ${message}`);
}

function escapeSqlLiteral(value) {
  return value.replace(/'/g, "''");
}

function syntheticDuplicateSourceId(discoveryMethod, id) {
  return `${discoveryMethod}::duplicate::${id}`;
}

function canonicalSourceIdFromDuplicate(sourceId) {
  return String(sourceId || '').split('::duplicate::')[0] || null;
}

function parseTime(value) {
  return value ? Date.parse(value) || 0 : 0;
}

function numericPriority(map, value) {
  return map.get(value || '') || 0;
}

function confidenceScore(confidence) {
  if (confidence === 'verified') return 3;
  if (confidence === 'scraped') return 2;
  return 1;
}

function normalizeSources(sources) {
  let parsed = sources;

  if (typeof sources === 'string') {
    try {
      parsed = JSON.parse(sources);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.filter((source) => {
    return source
      && typeof source === 'object'
      && typeof source.pluginId === 'string'
      && typeof source.foundAt === 'string'
      && (source.confidence === 'verified' || source.confidence === 'scraped' || source.confidence === 'llm_knowledge');
  });
}

function mergeSources(...sourceSets) {
  const merged = new Map();

  for (const sourceSet of sourceSets) {
    for (const source of normalizeSources(sourceSet)) {
      const existing = merged.get(source.pluginId);
      if (!existing) {
        merged.set(source.pluginId, source);
        continue;
      }

      merged.set(source.pluginId, {
        pluginId: source.pluginId,
        foundAt: new Date(source.foundAt) > new Date(existing.foundAt)
          ? source.foundAt
          : existing.foundAt,
        rawUrl: existing.rawUrl || source.rawUrl,
        confidence: confidenceScore(source.confidence) >= confidenceScore(existing.confidence)
          ? source.confidence
          : existing.confidence,
      });
    }
  }

  return [...merged.values()];
}

function compareRows(a, b) {
  const comparisons = [
    numericPriority(STATUS_PRIORITY, b.status) - numericPriority(STATUS_PRIORITY, a.status),
    numericPriority(APPLICATION_STATUS_PRIORITY, b.application_status) - numericPriority(APPLICATION_STATUS_PRIORITY, a.application_status),
    (parseTime(b.last_verified_at) - parseTime(a.last_verified_at)),
    (parseTime(b.updated_at) - parseTime(a.updated_at)),
    (parseTime(b.created_at) - parseTime(a.created_at)),
    Number(Boolean(b.url)) - Number(Boolean(a.url)),
    String(a.id).localeCompare(String(b.id)),
  ];

  return comparisons.find((value) => value !== 0) || 0;
}

async function execSql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) {
    throw new Error(`SQL execution failed: ${error.message}`);
  }
  return data || [];
}

async function fetchConflictGroups() {
  const sourceFilter = SOURCES.length > 0
    ? ` AND discovery_method IN (${SOURCES.map((value) => `'${escapeSqlLiteral(value)}'`).join(', ')})`
    : '';

  const query = `
    SELECT
      discovery_method,
      name,
      COUNT(*) AS blank_rows,
      MAX(updated_at) AS last_updated_at
    FROM grant_opportunities
    WHERE discovered_by = 'grant_engine'
      AND COALESCE(discovery_method, '') <> ''
      AND COALESCE(source_id, '') = ''
      AND COALESCE(status, '') <> 'duplicate'
      ${sourceFilter}
    GROUP BY discovery_method, name
    ORDER BY MAX(updated_at) DESC NULLS LAST, discovery_method, name
    LIMIT ${LIMIT}
  `;

  return execSql(query);
}

async function fetchMismatchRows() {
  const sourceFilter = SOURCES.length > 0
    ? ` AND source_id IN (${SOURCES.map((value) => `'${escapeSqlLiteral(value)}'`).join(', ')})`
    : '';

  const query = `
    SELECT
      id,
      name,
      source,
      source_id,
      discovery_method,
      status,
      application_status,
      updated_at
    FROM grant_opportunities
    WHERE discovered_by = 'grant_engine'
      AND COALESCE(discovery_method, '') <> ''
      AND COALESCE(source_id, '') <> ''
      AND source_id NOT LIKE '%::duplicate::%'
      AND source_id <> discovery_method
      ${sourceFilter}
    ORDER BY updated_at DESC NULLS LAST, id
    LIMIT ${LIMIT}
  `;

  return execSql(query);
}

async function fetchDuplicateShadowRows() {
  const sourceFilter = SOURCES.length > 0
    ? ` AND split_part(source_id, '::duplicate::', 1) IN (${SOURCES.map((value) => `'${escapeSqlLiteral(value)}'`).join(', ')})`
    : '';

  const query = `
    SELECT
      id,
      name,
      source_id,
      sources,
      updated_at
    FROM grant_opportunities
    WHERE discovered_by = 'grant_engine'
      AND source_id LIKE '%::duplicate::%'
      ${sourceFilter}
    ORDER BY updated_at DESC NULLS LAST, id
    LIMIT ${LIMIT}
  `;

  return execSql(query);
}

async function fetchGroupRows(discoveryMethod, name) {
  const query = `
    SELECT
      id,
      name,
      source,
      source_id,
      discovery_method,
      discovered_by,
      url,
      sources,
      status,
      application_status,
      created_at,
      updated_at,
      last_verified_at
    FROM grant_opportunities
    WHERE name = '${escapeSqlLiteral(name)}'
      AND (
        source_id = '${escapeSqlLiteral(discoveryMethod)}'
        OR (
          discovered_by = 'grant_engine'
          AND COALESCE(source_id, '') = ''
          AND discovery_method = '${escapeSqlLiteral(discoveryMethod)}'
        )
      )
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
  `;

  return execSql(query);
}

async function fetchCanonicalRow(name, sourceId) {
  const query = `
    SELECT
      id,
      name,
      source,
      source_id,
      discovery_method,
      discovered_by,
      url,
      sources,
      status,
      application_status,
      created_at,
      updated_at,
      last_verified_at
    FROM grant_opportunities
    WHERE name = '${escapeSqlLiteral(name)}'
      AND source_id = '${escapeSqlLiteral(sourceId)}'
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    LIMIT 1
  `;

  const rows = await execSql(query);
  return rows[0] || null;
}

async function promoteSurvivor(row, discoveryMethod) {
  const { error } = await supabase
    .from('grant_opportunities')
    .update({ source_id: discoveryMethod })
    .eq('id', row.id);

  if (error) {
    throw new Error(`Failed to promote survivor ${row.id}: ${error.message}`);
  }
}

async function mergeSurvivorSources(survivor, duplicates) {
  const mergedSources = mergeSources(
    survivor.sources,
    ...duplicates.map((row) => row.sources),
  );
  const currentSources = normalizeSources(survivor.sources);

  if (mergedSources.length === currentSources.length) {
    const currentKeys = currentSources
      .map((source) => `${source.pluginId}:${source.foundAt}:${source.confidence}:${source.rawUrl || ''}`)
      .sort()
      .join('|');
    const mergedKeys = mergedSources
      .map((source) => `${source.pluginId}:${source.foundAt}:${source.confidence}:${source.rawUrl || ''}`)
      .sort()
      .join('|');
    if (currentKeys === mergedKeys) {
      return false;
    }
  }

  const { error } = await supabase
    .from('grant_opportunities')
    .update({ sources: mergedSources })
    .eq('id', survivor.id);

  if (error) {
    throw new Error(`Failed to merge provenance into survivor ${survivor.id}: ${error.message}`);
  }

  survivor.sources = mergedSources;
  return true;
}

async function markDuplicate(row, discoveryMethod) {
  const { error } = await supabase
    .from('grant_opportunities')
    .update({
      status: 'duplicate',
      source_id: syntheticDuplicateSourceId(discoveryMethod, row.id),
    })
    .eq('id', row.id);

  if (error) {
    throw new Error(`Failed to mark duplicate ${row.id}: ${error.message}`);
  }
}

async function alignMismatch(row) {
  const { error } = await supabase
    .from('grant_opportunities')
    .update({ discovery_method: row.source_id })
    .eq('id', row.id);

  if (error) {
    throw new Error(`Failed to align mismatch ${row.id}: ${error.message}`);
  }
}

async function main() {
  const run = APPLY
    ? await logStart(supabase, 'reconcile-grant-source-identity', 'Reconcile Grant Source Identity')
    : { id: null };

  try {
    log(`Starting source-identity reconciler (limit=${LIMIT}, apply=${APPLY}, sources=${SOURCES.join(',') || 'all'})`);

    const groups = await fetchConflictGroups();
    const mismatches = await fetchMismatchRows();
    const duplicateShadows = await fetchDuplicateShadowRows();

    if (groups.length === 0 && mismatches.length === 0 && duplicateShadows.length === 0) {
      log('No source-identity conflict groups found.');
      if (run.id) {
        await logComplete(supabase, run.id, { items_found: 0, items_updated: 0 });
      }
      return;
    }

    let promoted = 0;
    let markedDuplicate = 0;
    let alignedMismatch = 0;
    let mergedProvenance = 0;
    let duplicateShadowMerged = 0;
    const errors = [];

    log(`Found ${groups.length} blank-source conflict groups, ${mismatches.length} canonical mismatches, and ${duplicateShadows.length} duplicate shadows`);

    for (const group of groups) {
      try {
        const rows = await fetchGroupRows(group.discovery_method, group.name);
        const canonicalRows = rows
          .filter((row) => row.source_id === group.discovery_method)
          .sort(compareRows);
        const blankRows = rows
          .filter((row) => row.discovered_by === 'grant_engine' && !row.source_id && row.discovery_method === group.discovery_method)
          .sort(compareRows);

        if (blankRows.length === 0) {
          continue;
        }

        const survivor = canonicalRows[0] || blankRows[0];
        const duplicateRows = canonicalRows.length > 0
          ? blankRows
          : blankRows.filter((row) => row.id !== survivor.id);

        log(`${group.discovery_method} :: ${group.name} — survivor=${survivor.id}${canonicalRows.length > 0 ? ' (existing canonical)' : ' (promote blank)'} duplicates=${duplicateRows.length}`);

        if (!APPLY) {
          continue;
        }

        if (canonicalRows.length === 0) {
          await promoteSurvivor(survivor, group.discovery_method);
          promoted += 1;
        }

        if (duplicateRows.length > 0 && await mergeSurvivorSources(survivor, duplicateRows)) {
          mergedProvenance += 1;
        }

        for (const duplicateRow of duplicateRows) {
          await markDuplicate(duplicateRow, group.discovery_method);
          markedDuplicate += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        log(`Failed group ${group.discovery_method} :: ${group.name}: ${message}`);
      }
    }

    for (const row of mismatches) {
      try {
        log(`align mismatch ${row.id} :: ${row.name} — ${row.discovery_method} -> ${row.source_id}`);
        if (!APPLY) {
          continue;
        }
        await alignMismatch(row);
        alignedMismatch += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        log(`Failed mismatch ${row.id}: ${message}`);
      }
    }

    for (const duplicateRow of duplicateShadows) {
      try {
        const canonicalSourceId = canonicalSourceIdFromDuplicate(duplicateRow.source_id);
        if (!canonicalSourceId) {
          continue;
        }

        const canonicalRow = await fetchCanonicalRow(duplicateRow.name, canonicalSourceId);
        if (!canonicalRow) {
          log(`skip orphan duplicate ${duplicateRow.id} :: ${duplicateRow.name} — missing canonical ${canonicalSourceId}`);
          continue;
        }

        log(`merge duplicate shadow ${duplicateRow.id} -> ${canonicalRow.id} :: ${duplicateRow.name}`);
        if (!APPLY) {
          continue;
        }

        if (await mergeSurvivorSources(canonicalRow, [duplicateRow])) {
          duplicateShadowMerged += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        log(`Failed duplicate shadow ${duplicateRow.id}: ${message}`);
      }
    }

    const outstandingRows = await execSql(`
      SELECT COUNT(*) AS rows
      FROM grant_opportunities
      WHERE discovered_by = 'grant_engine'
        AND COALESCE(discovery_method, '') <> ''
        AND COALESCE(source_id, '') = ''
        AND COALESCE(status, '') <> 'duplicate'
    `);

    const outstandingMismatchRows = await execSql(`
      SELECT COUNT(*) AS rows
      FROM grant_opportunities
      WHERE discovered_by = 'grant_engine'
        AND COALESCE(discovery_method, '') <> ''
        AND COALESCE(source_id, '') <> ''
        AND source_id NOT LIKE '%::duplicate::%'
        AND source_id <> discovery_method
    `);

    const outstanding = Number(outstandingRows[0]?.rows || 0);
    const mismatchOutstanding = Number(outstandingMismatchRows[0]?.rows || 0);
    log(`Done. promoted=${promoted} provenance_merged=${mergedProvenance} duplicate_shadow_merged=${duplicateShadowMerged} duplicate_marked=${markedDuplicate} mismatch_aligned=${alignedMismatch} outstanding_non_duplicate_blank=${outstanding} outstanding_mismatch=${mismatchOutstanding}`);

    if (run.id) {
      await logComplete(supabase, run.id, {
        status: errors.length > 0 ? 'partial' : 'success',
        items_found: groups.length + mismatches.length + duplicateShadows.length,
        items_new: promoted,
        items_updated: mergedProvenance + duplicateShadowMerged + markedDuplicate + alignedMismatch,
        errors,
      });
    }

    if (errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    if (run.id) {
      await logFailed(supabase, run.id, error);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * dedup-entities.mjs — Entity Deduplication Script
 *
 * Finds duplicate entity clusters (same canonical_name), picks a survivor
 * (most relationships, then most non-null fields), merges all references,
 * and deletes the duplicates.
 *
 * Dry-run by default. Use --live to execute mutations.
 *
 * Usage:
 *   node --env-file=.env scripts/dedup-entities.mjs
 *   node --env-file=.env scripts/dedup-entities.mjs --live
 *   node --env-file=.env scripts/dedup-entities.mjs --min-size=3
 *   node --env-file=.env scripts/dedup-entities.mjs --limit=100
 *
 * Flags:
 *   --live           Execute mutations (default: dry-run)
 *   --min-size=N     Minimum cluster size to process (default: 2)
 *   --limit=N        Max clusters to process (default: all)
 *   --name="X"       Process only clusters matching this name (for testing)
 *
 * FK references handled:
 *   - gs_relationships.source_entity_id (CASCADE but we redirect first)
 *   - gs_relationships.target_entity_id (CASCADE but we redirect first)
 *   - justice_funding.gs_entity_id (no FK constraint, soft ref)
 *   - alma_interventions.gs_entity_id (FK, no CASCADE)
 *   - entity_identifiers.entity_id (refs canonical_entities, skip)
 *   - person_roles.entity_id (FK, ON DELETE SET NULL — redirect)
 *   - person_roles.person_entity_id (FK, ON DELETE SET NULL — redirect)
 *   - person_entity_links.entity_id (FK, ON DELETE CASCADE)
 *   - gs_entity_aliases.entity_id (FK, ON DELETE CASCADE)
 *   - contact_entity_links.entity_id (FK, ON DELETE CASCADE)
 *   - entity_watches.entity_id (FK, ON DELETE CASCADE)
 *   - funder_portfolio_entities.entity_id (FK, ON DELETE CASCADE)
 *   - org_contacts.linked_entity_id (FK, no CASCADE)
 *   - org_pipeline.funder_entity_id (FK, no CASCADE)
 *   - justice_reinvestment_sites.gs_entity_id (FK, no CASCADE)
 *   - nz_charities.gs_entity_id (FK, no CASCADE)
 *   - nz_gets_contracts.gs_entity_id (FK, no CASCADE)
 *   - research_grants.gs_entity_id (FK, no CASCADE)
 *
 * Also logs merges to entity_merge_log for audit trail / undo.
 *
 * Dedup index on gs_relationships:
 *   UNIQUE(source_entity_id, target_entity_id, relationship_type, dataset, COALESCE(source_record_id, ''))
 *   Relationship redirects that would violate this are deleted (duplicate relationship).
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────
// CLI flags
// ─────────────────────────────────────────────────────────
const LIVE = process.argv.includes('--live');
const MIN_SIZE = parseInt(
  process.argv.find(a => a.startsWith('--min-size='))?.split('=')[1] || '2'
);
const LIMIT = parseInt(
  process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0'
);
const NAME_FILTER = process.argv.find(a => a.startsWith('--name='))?.split('=').slice(1).join('=') || '';

const BATCH_SIZE = 100; // clusters per batch
const LOG_INTERVAL = 50; // log progress every N clusters

// ─────────────────────────────────────────────────────────
// psql helper — no statement timeout, CSV output
// ─────────────────────────────────────────────────────────
function psql(query, { timeout = 300000, parse = true } = {}) {
  const connStr = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
  const tmpFile = `/tmp/dedup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.sql`;
  writeFileSync(tmpFile, query);
  try {
    const result = execSync(
      `psql "${connStr}" --csv -f ${tmpFile} 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 200 * 1024 * 1024, timeout }
    );
    unlinkSync(tmpFile);
    if (!parse) return result;
    // Multiline-aware CSV parser (handles quoted fields with newlines)
    const rows = [];
    let cur = '', inQ = false, vals = [];
    const chars = result.trim();
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === '"') {
        if (inQ && chars[i + 1] === '"') { cur += '"'; i++; continue; } // escaped quote
        inQ = !inQ; continue;
      }
      if (ch === ',' && !inQ) { vals.push(cur); cur = ''; continue; }
      if (ch === '\n' && !inQ) { vals.push(cur); rows.push(vals); vals = []; cur = ''; continue; }
      if (ch === '\r' && !inQ) continue; // skip \r
      cur += ch;
    }
    if (cur || vals.length > 0) { vals.push(cur); rows.push(vals); }
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(vals => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i] || '');
      return obj;
    });
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    console.error('psql error:', err.message?.slice(0, 300));
    return parse ? [] : '';
  }
}

/**
 * Execute a mutation via psql. Returns raw output string.
 */
function psqlExec(query, { timeout = 120000 } = {}) {
  const connStr = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
  const tmpFile = `/tmp/dedup-exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.sql`;
  writeFileSync(tmpFile, query);
  try {
    const result = execSync(
      `psql "${connStr}" -f ${tmpFile} 2>&1`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout }
    );
    unlinkSync(tmpFile);
    return result;
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    throw new Error(`psql exec error: ${err.message?.slice(0, 300)}`);
  }
}

// ─────────────────────────────────────────────────────────
// Escape a string for SQL literals
// ─────────────────────────────────────────────────────────
function esc(str) {
  if (str == null) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// ─────────────────────────────────────────────────────────
// Count non-null enrichment fields on an entity
// ─────────────────────────────────────────────────────────
const ENRICHMENT_FIELDS = [
  'abn', 'acn', 'description', 'website', 'state', 'postcode',
  'sector', 'sub_sector', 'latest_revenue', 'latest_assets',
  'latest_tax_payable', 'financial_year', 'seifa_irsd_decile',
  'remoteness', 'sa2_code', 'is_community_controlled', 'lga_name', 'lga_code',
];

function countNonNull(entity) {
  let n = 0;
  for (const f of ENRICHMENT_FIELDS) {
    if (entity[f] != null && entity[f] !== '') n++;
  }
  // Also count tags and source_datasets arrays
  if (entity.tags && entity.tags !== '{}') n++;
  if (entity.source_datasets && entity.source_datasets !== '{}') n++;
  return n;
}

// ─────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  console.log(`Entity Dedup${LIVE ? ' — LIVE MODE' : ' — dry run'}`);
  console.log('='.repeat(60));
  console.log(`  Min cluster size: ${MIN_SIZE}`);
  if (LIMIT > 0) console.log(`  Cluster limit: ${LIMIT}`);
  if (NAME_FILTER) console.log(`  Name filter: "${NAME_FILTER}"`);

  const runId = LIVE
    ? (await logStart(supabase, 'dedup-entities', 'Entity Deduplication'))?.id
    : null;

  try {
    // ── Step 1: Find duplicate clusters ──
    console.log('\n  Finding duplicate clusters...');

    let clusterQuery = `
      SELECT canonical_name, COUNT(*) AS cnt
      FROM gs_entities
      WHERE canonical_name IS NOT NULL
        AND LENGTH(TRIM(canonical_name)) > 0
    `;
    if (NAME_FILTER) {
      clusterQuery += `    AND canonical_name = ${esc(NAME_FILTER)}\n`;
    }
    clusterQuery += `
      GROUP BY canonical_name
      HAVING COUNT(*) >= ${MIN_SIZE}
      ORDER BY COUNT(*) DESC
    `;
    if (LIMIT > 0) {
      clusterQuery += `  LIMIT ${LIMIT}`;
    }

    const clusters = psql(clusterQuery);
    const totalEntities = clusters.reduce((sum, c) => sum + parseInt(c.cnt), 0);
    console.log(`  Found ${clusters.length} duplicate clusters (${totalEntities.toLocaleString()} entities)`);

    if (clusters.length === 0) {
      console.log('  Nothing to deduplicate.');
      if (runId) await logComplete(supabase, runId, { items_found: 0, items_new: 0 });
      process.exit(0);
    }

    // Show top 10 largest clusters
    console.log('\n  Largest clusters:');
    for (const c of clusters.slice(0, 10)) {
      console.log(`    ${c.canonical_name} — ${c.cnt} copies`);
    }

    // ── Step 2: Process clusters in batches ──
    const stats = {
      clustersProcessed: 0,
      entitiesMerged: 0,
      relationshipsRedirected: 0,
      relationshipsDeduped: 0,
      fieldsMerged: 0,
      errors: [],
    };

    for (let batchStart = 0; batchStart < clusters.length; batchStart += BATCH_SIZE) {
      const batch = clusters.slice(batchStart, batchStart + BATCH_SIZE);

      // Fetch all entities for this batch of cluster names
      const names = batch.map(c => esc(c.canonical_name)).join(',');
      const entities = psql(`
        SELECT id, gs_id, canonical_name, entity_type, abn, acn,
               description, website, state, postcode, sector, sub_sector,
               tags::text, source_datasets::text, source_count, confidence,
               latest_revenue, latest_assets, latest_tax_payable, financial_year,
               first_seen, last_seen, created_at,
               seifa_irsd_decile, remoteness, sa2_code,
               is_community_controlled, lga_name, lga_code
        FROM gs_entities
        WHERE canonical_name IN (${names})
        ORDER BY canonical_name, created_at
      `);

      // Get relationship counts for all entities in this batch
      const entityIds = entities.map(e => `'${e.id}'`).join(',');
      let relCounts = new Map();
      if (entityIds.length > 0) {
        const counts = psql(`
          SELECT entity_id, SUM(cnt) AS total FROM (
            SELECT source_entity_id AS entity_id, COUNT(*) AS cnt
            FROM gs_relationships
            WHERE source_entity_id IN (${entityIds})
            GROUP BY source_entity_id
            UNION ALL
            SELECT target_entity_id AS entity_id, COUNT(*) AS cnt
            FROM gs_relationships
            WHERE target_entity_id IN (${entityIds})
            GROUP BY target_entity_id
          ) sub
          GROUP BY entity_id
        `);
        for (const row of counts) {
          relCounts.set(row.entity_id, parseInt(row.total) || 0);
        }
      }

      // Group entities by canonical_name
      const byName = new Map();
      for (const e of entities) {
        if (!byName.has(e.canonical_name)) byName.set(e.canonical_name, []);
        byName.get(e.canonical_name).push(e);
      }

      // Process each cluster
      for (const [name, clusterEntities] of byName) {
        if (clusterEntities.length < 2) continue;

        // Pick survivor: most relationships, then most non-null fields, then earliest created_at
        clusterEntities.sort((a, b) => {
          const relA = relCounts.get(a.id) || 0;
          const relB = relCounts.get(b.id) || 0;
          if (relB !== relA) return relB - relA; // most relationships first
          const nnA = countNonNull(a);
          const nnB = countNonNull(b);
          if (nnB !== nnA) return nnB - nnA; // most non-null fields first
          // Prefer earliest created entity (original)
          return (a.created_at || '').localeCompare(b.created_at || '');
        });

        const survivor = clusterEntities[0];
        const victims = clusterEntities.slice(1);
        const survivorRels = relCounts.get(survivor.id) || 0;

        stats.clustersProcessed++;

        if (stats.clustersProcessed % LOG_INTERVAL === 0 || stats.clustersProcessed <= 5) {
          console.log(`\n  [${stats.clustersProcessed}/${clusters.length}] "${name}" (${clusterEntities.length} copies)`);
          console.log(`    Survivor: ${survivor.id} (${survivorRels} rels, gs_id=${survivor.gs_id})`);
          console.log(`    Merging ${victims.length} duplicates`);
        }

        if (!LIVE) {
          stats.entitiesMerged += victims.length;
          // In dry-run, estimate relationship redirects
          for (const v of victims) {
            stats.relationshipsRedirected += relCounts.get(v.id) || 0;
          }
          continue;
        }

        // ── LIVE: Build a single transaction for this cluster ──
        const sqls = [];
        sqls.push('BEGIN;');

        const victimIds = victims.map(v => `'${v.id}'`).join(',');

        // 2a. Merge enrichment fields from victims to survivor (fill blanks)
        const updates = [];
        for (const field of ENRICHMENT_FIELDS) {
          if (survivor[field] == null || survivor[field] === '') {
            // Find first victim with this field populated
            const donor = victims.find(v => v[field] != null && v[field] !== '');
            if (donor) {
              updates.push(`${field} = ${esc(donor[field])}`);
              stats.fieldsMerged++;
            }
          }
        }
        // Merge source_datasets arrays
        const allDatasets = new Set();
        for (const e of clusterEntities) {
          if (e.source_datasets) {
            // Parse postgres array text format: {a,b,c}
            const cleaned = e.source_datasets.replace(/^\{|\}$/g, '');
            if (cleaned) cleaned.split(',').forEach(d => allDatasets.add(d.trim()));
          }
        }
        if (allDatasets.size > 0) {
          updates.push(`source_datasets = ARRAY[${[...allDatasets].map(d => esc(d)).join(',')}]`);
          updates.push(`source_count = ${allDatasets.size}`);
        }
        // Merge tags arrays
        const allTags = new Set();
        for (const e of clusterEntities) {
          if (e.tags && e.tags !== '{}') {
            const cleaned = e.tags.replace(/^\{|\}$/g, '');
            if (cleaned) cleaned.split(',').forEach(t => allTags.add(t.trim()));
          }
        }
        if (allTags.size > 0) {
          updates.push(`tags = ARRAY[${[...allTags].map(t => esc(t)).join(',')}]`);
        }
        // Use earliest first_seen
        const firstSeens = clusterEntities
          .map(e => e.first_seen)
          .filter(Boolean)
          .sort();
        if (firstSeens.length > 0) {
          updates.push(`first_seen = ${esc(firstSeens[0])}`);
        }
        // Use latest last_seen
        const lastSeens = clusterEntities
          .map(e => e.last_seen)
          .filter(Boolean)
          .sort()
          .reverse();
        if (lastSeens.length > 0) {
          updates.push(`last_seen = ${esc(lastSeens[0])}`);
        }

        if (updates.length > 0) {
          sqls.push(`UPDATE gs_entities SET ${updates.join(', ')}, updated_at = NOW() WHERE id = '${survivor.id}';`);
        }

        // 2b. Redirect relationships from victims to survivor
        // Handle the unique index: (source_entity_id, target_entity_id, relationship_type, dataset, COALESCE(source_record_id, ''))
        // Strategy: try UPDATE, delete rows that would violate uniqueness

        // For source_entity_id redirects:
        // First, delete relationships that would become duplicates
        sqls.push(`
          DELETE FROM gs_relationships
          WHERE id IN (
            SELECT victim_rel.id
            FROM gs_relationships victim_rel
            WHERE victim_rel.source_entity_id IN (${victimIds})
              AND EXISTS (
                SELECT 1 FROM gs_relationships survivor_rel
                WHERE survivor_rel.source_entity_id = '${survivor.id}'
                  AND survivor_rel.target_entity_id = victim_rel.target_entity_id
                  AND survivor_rel.relationship_type = victim_rel.relationship_type
                  AND survivor_rel.dataset = victim_rel.dataset
                  AND COALESCE(survivor_rel.source_record_id, '') = COALESCE(victim_rel.source_record_id, '')
              )
          );
        `);

        // Also delete relationships that would become self-loops (source=target=survivor)
        sqls.push(`
          DELETE FROM gs_relationships
          WHERE source_entity_id IN (${victimIds})
            AND target_entity_id = '${survivor.id}';
        `);

        // Now redirect remaining source_entity_id references
        sqls.push(`
          UPDATE gs_relationships
          SET source_entity_id = '${survivor.id}'
          WHERE source_entity_id IN (${victimIds});
        `);

        // For target_entity_id redirects:
        // Delete would-be duplicates
        sqls.push(`
          DELETE FROM gs_relationships
          WHERE id IN (
            SELECT victim_rel.id
            FROM gs_relationships victim_rel
            WHERE victim_rel.target_entity_id IN (${victimIds})
              AND EXISTS (
                SELECT 1 FROM gs_relationships survivor_rel
                WHERE survivor_rel.target_entity_id = '${survivor.id}'
                  AND survivor_rel.source_entity_id = victim_rel.source_entity_id
                  AND survivor_rel.relationship_type = victim_rel.relationship_type
                  AND survivor_rel.dataset = victim_rel.dataset
                  AND COALESCE(survivor_rel.source_record_id, '') = COALESCE(victim_rel.source_record_id, '')
              )
          );
        `);

        // Delete self-loops (target=victim, source=survivor)
        sqls.push(`
          DELETE FROM gs_relationships
          WHERE target_entity_id IN (${victimIds})
            AND source_entity_id = '${survivor.id}';
        `);

        // Redirect remaining
        sqls.push(`
          UPDATE gs_relationships
          SET target_entity_id = '${survivor.id}'
          WHERE target_entity_id IN (${victimIds});
        `);

        // Also delete any intra-cluster relationships (victim-to-victim that became survivor-to-survivor)
        sqls.push(`
          DELETE FROM gs_relationships
          WHERE source_entity_id = '${survivor.id}'
            AND target_entity_id = '${survivor.id}';
        `);

        // 2c. Redirect soft FK references (no CASCADE, no unique constraints)
        sqls.push(`UPDATE justice_funding SET gs_entity_id = '${survivor.id}' WHERE gs_entity_id IN (${victimIds});`);
        sqls.push(`UPDATE alma_interventions SET gs_entity_id = '${survivor.id}' WHERE gs_entity_id IN (${victimIds});`);
        sqls.push(`UPDATE justice_reinvestment_sites SET gs_entity_id = '${survivor.id}' WHERE gs_entity_id IN (${victimIds});`);
        sqls.push(`UPDATE nz_charities SET gs_entity_id = '${survivor.id}' WHERE gs_entity_id IN (${victimIds});`);
        sqls.push(`UPDATE nz_gets_contracts SET gs_entity_id = '${survivor.id}' WHERE gs_entity_id IN (${victimIds});`);
        sqls.push(`UPDATE research_grants SET gs_entity_id = '${survivor.id}' WHERE gs_entity_id IN (${victimIds});`);
        sqls.push(`UPDATE org_contacts SET linked_entity_id = '${survivor.id}' WHERE linked_entity_id IN (${victimIds});`);
        sqls.push(`UPDATE org_pipeline SET funder_entity_id = '${survivor.id}' WHERE funder_entity_id IN (${victimIds});`);

        // person_roles: redirect both entity_id and person_entity_id
        sqls.push(`UPDATE person_roles SET entity_id = '${survivor.id}' WHERE entity_id IN (${victimIds});`);
        sqls.push(`UPDATE person_roles SET person_entity_id = '${survivor.id}' WHERE person_entity_id IN (${victimIds});`);

        // person_entity_links: redirect before cascade delete would remove them
        sqls.push(`UPDATE person_entity_links SET entity_id = '${survivor.id}' WHERE entity_id IN (${victimIds});`);

        // gs_entity_aliases: redirect before cascade delete
        sqls.push(`
          UPDATE gs_entity_aliases SET entity_id = '${survivor.id}'
          WHERE entity_id IN (${victimIds})
            AND NOT EXISTS (
              SELECT 1 FROM gs_entity_aliases existing
              WHERE existing.entity_id = '${survivor.id}'
                AND existing.alias = gs_entity_aliases.alias
            );
        `);
        // Delete remaining aliases that would be duplicates
        sqls.push(`DELETE FROM gs_entity_aliases WHERE entity_id IN (${victimIds});`);

        // contact_entity_links, entity_watches, funder_portfolio_entities: ON DELETE CASCADE
        // but redirect first to preserve data
        sqls.push(`UPDATE contact_entity_links SET entity_id = '${survivor.id}' WHERE entity_id IN (${victimIds});`);
        sqls.push(`UPDATE entity_watches SET entity_id = '${survivor.id}' WHERE entity_id IN (${victimIds});`);
        sqls.push(`UPDATE funder_portfolio_entities SET entity_id = '${survivor.id}' WHERE entity_id IN (${victimIds});`);

        // 2d. Log merges to entity_merge_log for audit trail
        for (const victim of victims) {
          const snapshot = {};
          for (const [key, val] of Object.entries(victim)) {
            if (val != null && val !== '') snapshot[key] = val;
          }
          sqls.push(`
            INSERT INTO entity_merge_log (
              surviving_entity_id, merged_entity_id, merged_entity_snapshot,
              merge_reason, match_confidence, match_details, merged_by, can_unmerge, merged_at
            ) VALUES (
              '${survivor.id}',
              '${victim.id}',
              ${esc(JSON.stringify(snapshot))}::jsonb,
              'dedup-entities: same canonical_name',
              1.0,
              ${esc(JSON.stringify({
                cluster_size: clusterEntities.length,
                survivor_rels: survivorRels,
                victim_rels: relCounts.get(victim.id) || 0,
              }))}::jsonb,
              'dedup-entities.mjs',
              true,
              NOW()
            );
          `);
        }

        // 2e. Delete victim entities
        sqls.push(`DELETE FROM gs_entities WHERE id IN (${victimIds});`);

        sqls.push('COMMIT;');

        // Execute the transaction
        try {
          psqlExec(sqls.join('\n'), { timeout: 120000 });
          stats.entitiesMerged += victims.length;
          for (const v of victims) {
            stats.relationshipsRedirected += relCounts.get(v.id) || 0;
          }
        } catch (err) {
          console.error(`  ERROR processing "${name}": ${err.message.slice(0, 200)}`);
          stats.errors.push({ name, error: err.message.slice(0, 200) });
          // Try to rollback if not already rolled back
          try { psqlExec('ROLLBACK;'); } catch {}
        }
      }

      // Batch progress
      const processed = Math.min(batchStart + batch.length, clusters.length);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const rate = (stats.clustersProcessed / ((Date.now() - t0) / 1000)).toFixed(1);
      console.log(`\n  Progress: ${processed}/${clusters.length} clusters | ${stats.entitiesMerged.toLocaleString()} merged | ${elapsed}s | ${rate} clusters/s`);
    }

    // ── Summary ──
    const duration = ((Date.now() - t0) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('  Summary:');
    console.log(`    Clusters processed:        ${stats.clustersProcessed.toLocaleString()}`);
    console.log(`    Entities merged:            ${stats.entitiesMerged.toLocaleString()}`);
    console.log(`    Relationships redirected:   ${stats.relationshipsRedirected.toLocaleString()}`);
    if (stats.fieldsMerged > 0) {
      console.log(`    Fields backfilled:          ${stats.fieldsMerged.toLocaleString()}`);
    }
    if (stats.errors.length > 0) {
      console.log(`    Errors:                     ${stats.errors.length}`);
      for (const e of stats.errors.slice(0, 10)) {
        console.log(`      - ${e.name}: ${e.error}`);
      }
    }
    console.log(`    Duration:                   ${duration}s`);

    if (!LIVE) {
      console.log('\n  Run with --live to execute.');
    } else {
      console.log('\n  Deduplication complete. Consider refreshing materialized views:');
      console.log('    node --env-file=.env scripts/refresh-views.mjs');
    }

    if (runId) {
      await logComplete(supabase, runId, {
        items_found: totalEntities,
        items_new: stats.entitiesMerged,
        items_updated: stats.relationshipsRedirected,
      });
    }
  } catch (err) {
    console.error('\nFatal:', err);
    if (runId) await logFailed(supabase, runId, err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

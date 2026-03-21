#!/usr/bin/env node
/**
 * watch-data-quality.mjs — Autoresearch Agent #3
 *
 * Detects data quality issues across the graph:
 *   1. Entities with missing ABNs that should have one (charities, companies)
 *   2. Duplicate entity names (potential merge candidates)
 *   3. Unlinked records (justice_funding, donations without entity links)
 *   4. Stale materialized views
 *
 * Writes findings to the `discoveries` table for Mission Control.
 *
 * Usage:
 *   node --env-file=.env scripts/watch-data-quality.mjs
 *   node --env-file=.env scripts/watch-data-quality.mjs --lookback=48
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LOOKBACK_HOURS = parseInt(
  process.argv.find(a => a.startsWith('--lookback='))?.split('=')[1] || '0'
);

function psql(query) {
  const connStr = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
  const tmpFile = `/tmp/watch-dq-${Date.now()}.sql`;
  writeFileSync(tmpFile, query);
  try {
    const result = execSync(
      `psql "${connStr}" --csv -f ${tmpFile} 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 120000 }
    );
    unlinkSync(tmpFile);
    const lines = result.trim().split('\n').filter(l => l.length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === ',' && !inQ) { vals.push(cur); cur = ''; continue; }
        cur += ch;
      }
      vals.push(cur);
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i] || '');
      return obj;
    });
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    console.error('psql error:', err.message?.slice(0, 200));
    return [];
  }
}

async function main() {
  const t0 = Date.now();
  console.log('Data Quality Watcher — Autoresearch Agent');
  console.log('═'.repeat(50));

  const runId = (await logStart(supabase, 'watch-data-quality', 'Data Quality Watcher'))?.id;

  try {
    const discoveries = [];

    // ── 1. Entity type breakdown — missing ABNs ──
    console.log('\n  Checking entities missing ABNs...');
    const missingAbns = psql(`
      SELECT entity_type, COUNT(*) as cnt
      FROM gs_entities
      WHERE abn IS NULL
        AND entity_type NOT IN ('person', 'individual', 'government_body', 'program')
      GROUP BY entity_type
      HAVING COUNT(*) > 100
      ORDER BY cnt DESC
      LIMIT 20
    `);

    for (const row of missingAbns) {
      const cnt = parseInt(row.cnt);
      discoveries.push({
        agent_id: 'watch-data-quality',
        discovery_type: 'data_quality',
        severity: cnt > 5000 ? 'significant' : cnt > 1000 ? 'notable' : 'info',
        title: `${cnt.toLocaleString()} ${row.entity_type} entities missing ABN`,
        description: `${row.entity_type} entities without ABN — potential for deduplication or ABR linkage.`,
        entity_ids: [],
        person_names: [],
        metadata: { entity_type: row.entity_type, count: cnt, issue: 'missing_abn' },
      });
    }
    console.log(`  ${missingAbns.length} entity types with missing ABNs`);

    // ── 2. Duplicate entity names (top merge candidates) ──
    console.log('  Checking duplicate entity names...');
    const dupes = psql(`
      SELECT canonical_name, COUNT(*) as cnt,
        array_agg(DISTINCT entity_type) as types,
        array_agg(DISTINCT abn) FILTER (WHERE abn IS NOT NULL) as abns
      FROM gs_entities
      WHERE entity_type != 'person'
        AND canonical_name IS NOT NULL
        AND length(canonical_name) > 5
      GROUP BY canonical_name
      HAVING COUNT(*) >= 3
      ORDER BY cnt DESC
      LIMIT 50
    `);

    for (const row of dupes) {
      const cnt = parseInt(row.cnt);
      discoveries.push({
        agent_id: 'watch-data-quality',
        discovery_type: 'data_quality',
        severity: cnt >= 10 ? 'significant' : cnt >= 5 ? 'notable' : 'info',
        title: `"${(row.canonical_name || '').slice(0, 50)}" appears ${cnt} times`,
        description: `Potential duplicate: ${cnt} entities named "${row.canonical_name}". Types: ${row.types}. ABNs: ${row.abns || 'none'}.`,
        entity_ids: [],
        person_names: [],
        metadata: { canonical_name: row.canonical_name, count: cnt, types: row.types, abns: row.abns, issue: 'duplicate_name' },
      });
    }
    console.log(`  ${dupes.length} duplicate name clusters found`);

    // ── 3. Unlinked funding records ──
    console.log('  Checking unlinked funding records...');
    const unlinkStats = psql(`
      SELECT
        'justice_funding' AS source,
        COUNT(*) FILTER (WHERE gs_entity_id IS NULL) AS unlinked,
        COUNT(*) AS total
      FROM justice_funding
      UNION ALL
      SELECT
        'political_donations',
        COUNT(*) FILTER (WHERE NOT EXISTS (
          SELECT 1 FROM gs_entities e WHERE e.abn = d.donor_abn
        )),
        COUNT(*)
      FROM political_donations d
      WHERE d.donor_abn IS NOT NULL
    `);

    for (const row of unlinkStats) {
      const unlinked = parseInt(row.unlinked || '0');
      const total = parseInt(row.total || '0');
      const pct = total > 0 ? ((unlinked / total) * 100).toFixed(1) : '0';
      if (unlinked > 100) {
        discoveries.push({
          agent_id: 'watch-data-quality',
          discovery_type: 'data_quality',
          severity: parseFloat(pct) > 20 ? 'significant' : parseFloat(pct) > 10 ? 'notable' : 'info',
          title: `${row.source}: ${unlinked.toLocaleString()} unlinked records (${pct}%)`,
          description: `${unlinked.toLocaleString()} of ${total.toLocaleString()} ${row.source} records not linked to gs_entities.`,
          entity_ids: [],
          person_names: [],
          metadata: { source: row.source, unlinked, total, pct: parseFloat(pct), issue: 'unlinked_records' },
        });
      }
    }
    console.log(`  ${unlinkStats.length} funding sources checked`);

    // ── 4. Stale materialized views ──
    console.log('  Checking MV freshness...');
    const staleMvs = psql(`
      SELECT
        ar.agent_id,
        MAX(ar.completed_at) AS last_refresh,
        EXTRACT(EPOCH FROM (NOW() - MAX(ar.completed_at))) / 3600 AS hours_ago
      FROM agent_runs ar
      WHERE ar.agent_id = 'refresh-views'
        AND ar.status = 'success'
      GROUP BY ar.agent_id
    `);

    for (const row of staleMvs) {
      const hoursAgo = parseFloat(row.hours_ago || '0');
      if (hoursAgo > 72) {
        discoveries.push({
          agent_id: 'watch-data-quality',
          discovery_type: 'data_quality',
          severity: hoursAgo > 168 ? 'significant' : 'notable',
          title: `Materialized views last refreshed ${Math.round(hoursAgo / 24)}d ago`,
          description: `Views were last refreshed ${Math.round(hoursAgo)}h ago. Run refresh-views to update.`,
          entity_ids: [],
          person_names: [],
          metadata: { hours_ago: hoursAgo, issue: 'stale_views' },
        });
      }
    }

    // ── 5. Orphaned relationships ──
    console.log('  Checking orphaned relationships...');
    const orphaned = psql(`
      SELECT COUNT(*) AS cnt
      FROM gs_relationships r
      WHERE NOT EXISTS (SELECT 1 FROM gs_entities e WHERE e.id = r.source_entity_id)
         OR NOT EXISTS (SELECT 1 FROM gs_entities e WHERE e.id = r.target_entity_id)
    `);

    const orphanCount = parseInt(orphaned[0]?.cnt || '0');
    if (orphanCount > 0) {
      discoveries.push({
        agent_id: 'watch-data-quality',
        discovery_type: 'data_quality',
        severity: orphanCount > 1000 ? 'significant' : orphanCount > 100 ? 'notable' : 'info',
        title: `${orphanCount.toLocaleString()} orphaned relationships`,
        description: `Relationships pointing to non-existent entities. These should be cleaned up.`,
        entity_ids: [],
        person_names: [],
        metadata: { count: orphanCount, issue: 'orphaned_relationships' },
      });
    }
    console.log(`  ${orphanCount} orphaned relationships`);

    // ── Deduplicate and insert ──
    const seen = new Set();
    const unique = discoveries.filter(d => {
      const key = `${d.discovery_type}_${d.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`\n  ${unique.length} discoveries to record`);

    const significant = unique.filter(d => d.severity !== 'info');
    if (significant.length > 0) {
      console.log('\n  Notable findings:');
      for (const d of significant.slice(0, 10)) {
        const icon = d.severity === 'significant' ? '!' : '*';
        console.log(`    [${icon}] ${d.title}`);
      }
    }

    if (unique.length > 0) {
      for (let i = 0; i < unique.length; i += 500) {
        const chunk = unique.slice(i, i + 500);
        const { error } = await supabase.from('discoveries').insert(chunk);
        if (error) console.error(`  Insert error: ${error.message.slice(0, 100)}`);
      }
      console.log(`  ${unique.length} discoveries saved`);
    }

    const duration = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Missing ABN types: ${missingAbns.length}`);
    console.log(`  Duplicate names: ${dupes.length}`);
    console.log(`  Orphaned rels: ${orphanCount}`);
    console.log(`  Duration: ${duration}s`);

    await logComplete(supabase, runId, {
      items_found: missingAbns.length + dupes.length + unlinkStats.length + orphanCount,
      items_new: unique.length,
    });
  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(supabase, runId, err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

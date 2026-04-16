#!/usr/bin/env node
/**
 * watch-entity-changes.mjs — Autoresearch Agent #4
 *
 * Detects significant entity lifecycle events:
 *   1. New entities from pipeline ingestion (charity registrations, company filings)
 *   2. Entities with sudden relationship growth (new connections)
 *   3. Community-controlled org changes (new Indigenous orgs, ORIC registrations)
 *
 * Writes findings to the `discoveries` table for Mission Control.
 *
 * Usage:
 *   node --env-file=.env scripts/watch-entity-changes.mjs
 *   node --env-file=.env scripts/watch-entity-changes.mjs --lookback=48
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { psql } from './lib/psql.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LOOKBACK_HOURS = parseInt(
  process.argv.find(a => a.startsWith('--lookback='))?.split('=')[1] || '0'
);


async function getLastRunTime() {
  if (LOOKBACK_HOURS > 0) {
    return new Date(Date.now() - LOOKBACK_HOURS * 3600000).toISOString();
  }
  const { data } = await supabase
    .from('agent_runs')
    .select('completed_at')
    .eq('agent_id', 'watch-entity-changes')
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1);

  if (data && data.length > 0) return data[0].completed_at;
  return new Date(Date.now() - 24 * 3600000).toISOString();
}

async function main() {
  const t0 = Date.now();
  console.log('Entity Change Watcher — Autoresearch Agent');
  console.log('═'.repeat(50));

  const runId = (await logStart(supabase, 'watch-entity-changes', 'Entity Change Watcher'))?.id;

  try {
    const since = await getLastRunTime();
    console.log(`  Looking for changes since: ${since}`);
    const discoveries = [];

    // ── 1. New entities by type ──
    console.log('\n  Scanning new entities...');
    const newEntities = psql(`
      SELECT entity_type, COUNT(*) as cnt,
        COUNT(*) FILTER (WHERE is_community_controlled = true) as cc_count
      FROM gs_entities
      WHERE created_at > '${since}'
        AND entity_type != 'person'
      GROUP BY entity_type
      HAVING COUNT(*) >= 5
      ORDER BY cnt DESC
    `);

    for (const row of newEntities) {
      const cnt = parseInt(row.cnt);
      const cc = parseInt(row.cc_count || '0');
      discoveries.push({
        agent_id: 'watch-entity-changes',
        discovery_type: 'entity_change',
        severity: cnt > 1000 ? 'significant' : cnt > 100 ? 'notable' : 'info',
        title: `${cnt.toLocaleString()} new ${row.entity_type} entities`,
        description: `${cnt} new ${row.entity_type} entities ingested${cc > 0 ? ` (${cc} community-controlled)` : ''}.`,
        entity_ids: [],
        person_names: [],
        metadata: { entity_type: row.entity_type, count: cnt, community_controlled: cc },
      });
    }
    console.log(`  ${newEntities.length} entity types with new entries`);

    // ── 2. New community-controlled organisations ──
    console.log('  Checking new community-controlled orgs...');
    const newCC = psql(`
      SELECT id, canonical_name, entity_type, state, abn
      FROM gs_entities
      WHERE created_at > '${since}'
        AND is_community_controlled = true
        AND entity_type != 'person'
      ORDER BY created_at DESC
      LIMIT 100
    `);

    if (newCC.length > 20) {
      // Aggregate into a single discovery to avoid flooding Mission Control
      const exampleNames = newCC.slice(0, 5).map(e => e.canonical_name).filter(Boolean);
      discoveries.push({
        agent_id: 'watch-entity-changes',
        discovery_type: 'entity_change',
        severity: 'notable',
        title: `${newCC.length} new community-controlled organisations registered`,
        description: `${newCC.length} new community-controlled orgs ingested. Examples: ${exampleNames.join(', ')}.`,
        entity_ids: newCC.slice(0, 20).map(e => e.id),
        person_names: [],
        metadata: {
          count: newCC.length,
          examples: newCC.slice(0, 10).map(e => ({
            name: e.canonical_name,
            entity_type: e.entity_type,
            state: e.state,
            abn: e.abn,
          })),
        },
      });
    } else {
      for (const e of newCC) {
        discoveries.push({
          agent_id: 'watch-entity-changes',
          discovery_type: 'entity_change',
          severity: 'notable',
          title: `New community-controlled org: ${(e.canonical_name || '').slice(0, 50)}`,
          description: `${e.canonical_name} (${e.entity_type}) registered in ${e.state || 'unknown state'}. ABN: ${e.abn || 'pending'}.`,
          entity_ids: [e.id],
          person_names: [],
          metadata: { entity_type: e.entity_type, state: e.state, abn: e.abn },
        });
      }
    }
    console.log(`  ${newCC.length} new community-controlled orgs`);

    // ── 3. Relationship growth spikes ──
    console.log('  Checking relationship growth...');
    const relGrowth = psql(`
      SELECT
        e.id, e.canonical_name, e.entity_type,
        COUNT(*) AS new_rels,
        SUM(COALESCE(r.amount, 0)) AS new_amount
      FROM gs_relationships r
      JOIN gs_entities e ON e.id = r.target_entity_id
      WHERE r.created_at > '${since}'
        AND r.relationship_type IN ('contract', 'donation', 'grant')
      GROUP BY e.id, e.canonical_name, e.entity_type
      HAVING COUNT(*) >= 10
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `);

    for (const row of relGrowth) {
      const rels = parseInt(row.new_rels);
      const amount = parseFloat(row.new_amount || '0');
      discoveries.push({
        agent_id: 'watch-entity-changes',
        discovery_type: 'entity_change',
        severity: rels >= 50 ? 'significant' : 'notable',
        title: `${row.canonical_name?.slice(0, 40)}: ${rels} new relationships`,
        description: `${row.canonical_name} (${row.entity_type}) gained ${rels} new funding relationships${amount > 0 ? ` worth $${(amount / 1_000_000).toFixed(1)}M` : ''}.`,
        entity_ids: [row.id],
        person_names: [],
        metadata: { new_relationships: rels, new_amount: amount, entity_type: row.entity_type },
      });
    }
    console.log(`  ${relGrowth.length} entities with relationship growth spikes`);

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
    console.log(`  New entity types: ${newEntities.length}`);
    console.log(`  New CC orgs: ${newCC.length}`);
    console.log(`  Growth spikes: ${relGrowth.length}`);
    console.log(`  Duration: ${duration}s`);

    await logComplete(supabase, runId, {
      items_found: newEntities.reduce((s, r) => s + parseInt(r.cnt), 0) + newCC.length + relGrowth.length,
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

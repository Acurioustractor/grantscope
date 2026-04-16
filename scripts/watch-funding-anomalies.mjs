#!/usr/bin/env node
/**
 * watch-funding-anomalies.mjs — Autoresearch Agent #2
 *
 * Detects unusual funding patterns since last run:
 *   1. Large new contracts (>$1M awarded since last run)
 *   2. Contracts to entities with board interlocks (shared_director edges)
 *   3. Entities appearing in 3+ systems for the first time (cross-system emergence)
 *
 * Writes findings to the `discoveries` table for Mission Control.
 *
 * Usage:
 *   node --env-file=.env scripts/watch-funding-anomalies.mjs
 *   node --env-file=.env scripts/watch-funding-anomalies.mjs --lookback=48
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
    .eq('agent_id', 'watch-funding-anomalies')
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1);

  if (data && data.length > 0) return data[0].completed_at;
  return new Date(Date.now() - 24 * 3600000).toISOString();
}

async function main() {
  const t0 = Date.now();
  console.log('Funding Anomaly Watcher — Autoresearch Agent');
  console.log('═'.repeat(50));

  const runId = (await logStart(supabase, 'watch-funding-anomalies', 'Funding Anomaly Watcher'))?.id;

  try {
    const since = await getLastRunTime();
    console.log(`  Looking for changes since: ${since}`);
    const discoveries = [];

    // ── 1. Large new contracts (>$1M) ──
    console.log('\n  Scanning large new contracts...');
    const largeContracts = psql(`
      SELECT
        ac.cn_id, ac.title, ac.contract_value,
        ac.supplier_name, ac.supplier_abn,
        ac.buyer_name, ac.contract_start,
        e.id AS entity_id, e.canonical_name
      FROM austender_contracts ac
      LEFT JOIN gs_entities e ON e.abn = ac.supplier_abn
      WHERE ac.created_at > '${since}'
        AND ac.contract_value > 1000000
      ORDER BY ac.contract_value DESC
      LIMIT 200
    `);
    console.log(`  ${largeContracts.length} large contracts (>$1M) found`);

    for (const c of largeContracts) {
      const value = parseFloat(c.contract_value);
      const severity = value > 50_000_000 ? 'critical'
        : value > 10_000_000 ? 'significant'
        : value > 5_000_000 ? 'notable' : 'info';

      discoveries.push({
        agent_id: 'watch-funding-anomalies',
        discovery_type: 'new_contract',
        severity,
        title: `$${(value / 1_000_000).toFixed(1)}M contract: ${(c.supplier_name || '').slice(0, 50)}`,
        description: `${c.buyer_name} awarded $${(value / 1_000_000).toFixed(1)}M to ${c.supplier_name}. Contract: "${(c.title || '').slice(0, 100)}".`,
        entity_ids: c.entity_id ? [c.entity_id] : [],
        person_names: [],
        metadata: {
          contract_value: value,
          supplier_name: c.supplier_name,
          supplier_abn: c.supplier_abn,
          buyer_name: c.buyer_name,
          contract_start: c.contract_start,
          cn_id: c.cn_id,
        },
      });
    }

    // ── 2. Contracts to interlock entities ──
    console.log('  Checking contracts to entities with board interlocks...');
    const interlockContracts = psql(`
      SELECT
        ac.supplier_name, ac.supplier_abn, ac.contract_value,
        ac.buyer_name, ac.title,
        bi.person_name, bi.shared_board_count,
        e.id AS entity_id
      FROM austender_contracts ac
      JOIN gs_entities e ON e.abn = ac.supplier_abn
      JOIN mv_board_interlocks bi ON bi.person_name = ANY(
        SELECT pr.person_name FROM person_roles pr WHERE pr.entity_id = e.id AND pr.cessation_date IS NULL LIMIT 5
      )
      WHERE ac.created_at > '${since}'
        AND bi.shared_board_count >= 3
      ORDER BY ac.contract_value DESC
      LIMIT 100
    `);
    console.log(`  ${interlockContracts.length} contracts to interlock entities`);

    for (const c of interlockContracts) {
      const value = parseFloat(c.contract_value || '0');
      discoveries.push({
        agent_id: 'watch-funding-anomalies',
        discovery_type: 'funding_anomaly',
        severity: 'significant',
        title: `Interlock contract: ${(c.supplier_name || '').slice(0, 40)} ($${(value / 1_000_000).toFixed(1)}M)`,
        description: `${c.buyer_name} → ${c.supplier_name}. Board member ${c.person_name} sits on ${c.shared_board_count} boards. Contract: "${(c.title || '').slice(0, 80)}".`,
        entity_ids: c.entity_id ? [c.entity_id] : [],
        person_names: [c.person_name],
        metadata: {
          contract_value: value,
          shared_board_count: parseInt(c.shared_board_count),
          person_name: c.person_name,
        },
      });
    }

    // ── 3. Cross-system emergence (entities with 3+ systems that gained a new relationship recently) ──
    // Instead of checking entity creation time (which almost never catches cross-system entities),
    // find entities that have 3+ systems AND gained a new relationship since last run.
    // A new relationship could push them over the 3-system threshold.
    console.log('  Checking cross-system emergence...');
    const crossSystem = psql(`
      SELECT DISTINCT
        pi.id, pi.canonical_name, pi.power_score,
        pi.system_count, pi.total_dollar_flow,
        pi.systems
      FROM mv_entity_power_index pi
      JOIN gs_relationships r ON (r.source_entity_id = pi.id OR r.target_entity_id = pi.id)
      WHERE r.created_at > '${since}'
        AND pi.system_count >= 3
      ORDER BY pi.power_score DESC
      LIMIT 100
    `);
    console.log(`  ${crossSystem.length} cross-system entities with recent activity`);

    for (const e of crossSystem) {
      const score = parseFloat(e.power_score || '0');
      discoveries.push({
        agent_id: 'watch-funding-anomalies',
        discovery_type: 'pattern',
        severity: score > 100 ? 'significant' : 'notable',
        title: `Cross-system entity: ${(e.canonical_name || '').slice(0, 50)} (${e.system_count} systems)`,
        description: `${e.canonical_name} spans ${e.system_count} systems (${e.systems}). Power score: ${score.toFixed(1)}, dollar flow: $${Number(e.total_dollar_flow || 0).toLocaleString()}.`,
        entity_ids: [e.id],
        person_names: [],
        metadata: {
          power_score: score,
          system_count: parseInt(e.system_count),
          total_dollar_flow: parseFloat(e.total_dollar_flow || '0'),
          systems: e.systems,
        },
      });
    }

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
        const icon = d.severity === 'critical' ? '!!' : d.severity === 'significant' ? '!' : '*';
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
    console.log(`  Large contracts: ${largeContracts.length}`);
    console.log(`  Interlock contracts: ${interlockContracts.length}`);
    console.log(`  Cross-system entities: ${crossSystem.length}`);
    console.log(`  Duration: ${duration}s`);

    await logComplete(supabase, runId, {
      items_found: largeContracts.length + interlockContracts.length + crossSystem.length,
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

#!/usr/bin/env node
/**
 * watch-board-changes.mjs — Autoresearch Agent #1
 *
 * Detects changes in board composition since last run:
 *   1. New board appointments (person_roles created since last run)
 *   2. New interlocks (person now on 2+ boards)
 *   3. High-power entity connections (new director at entity with high power_score)
 *
 * Writes findings to the `discoveries` table for Mission Control.
 *
 * Usage:
 *   node --env-file=.env scripts/watch-board-changes.mjs
 *   node --env-file=.env scripts/watch-board-changes.mjs --lookback=48
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// How far back to look (hours). Default: check agent_runs for last successful run, else 24h.
const LOOKBACK_HOURS = parseInt(
  process.argv.find(a => a.startsWith('--lookback='))?.split('=')[1] || '0'
);

function psql(query) {
  const connStr = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
  const tmpFile = `/tmp/watch-board-${Date.now()}.sql`;
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

async function getLastRunTime() {
  if (LOOKBACK_HOURS > 0) {
    return new Date(Date.now() - LOOKBACK_HOURS * 3600000).toISOString();
  }
  // Check last successful run of this agent
  const { data } = await supabase
    .from('agent_runs')
    .select('completed_at')
    .eq('agent_id', 'watch-board-changes')
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    return data[0].completed_at;
  }
  // First run — look back 24 hours
  return new Date(Date.now() - 24 * 3600000).toISOString();
}

async function main() {
  const t0 = Date.now();
  console.log('Board Change Watcher — Autoresearch Agent');
  console.log('═'.repeat(50));

  const runId = (await logStart(supabase, 'watch-board-changes', 'Board Change Watcher'))?.id;

  try {
    const since = await getLastRunTime();
    console.log(`  Looking for changes since: ${since}`);

    // ── 1. New board appointments ──
    console.log('\n  Scanning new appointments...');
    const newRoles = psql(`
      SELECT
        pr.person_name, pr.person_name_normalised,
        pr.entity_id, pr.role_type, pr.source,
        pr.company_name, pr.company_abn,
        e.canonical_name AS entity_name,
        e.entity_type
      FROM person_roles pr
      LEFT JOIN gs_entities e ON e.id = pr.entity_id
      WHERE pr.created_at > '${since}'
        AND pr.cessation_date IS NULL
      ORDER BY pr.created_at DESC
      LIMIT 5000
    `);
    console.log(`  ${newRoles.length} new appointments found`);

    // ── 2. Check for new interlocks ──
    console.log('  Checking for new interlocks...');
    const discoveries = [];

    // Get board counts for people with new appointments
    const newPeople = [...new Set(newRoles.map(r => r.person_name_normalised).filter(Boolean))];

    if (newPeople.length > 0) {
      // Batch check: how many boards does each person now sit on?
      const batchSize = 500;
      const interlockPeople = [];

      for (let i = 0; i < newPeople.length; i += batchSize) {
        const batch = newPeople.slice(i, i + batchSize);
        const inClause = batch.map(n => `'${n.replace(/'/g, "''")}'`).join(',');
        const counts = psql(`
          SELECT person_name_normalised, COUNT(DISTINCT entity_id) AS board_count
          FROM person_roles
          WHERE person_name_normalised IN (${inClause})
            AND entity_id IS NOT NULL
            AND cessation_date IS NULL
          GROUP BY person_name_normalised
          HAVING COUNT(DISTINCT entity_id) >= 2
        `);
        interlockPeople.push(...counts);
      }

      console.log(`  ${interlockPeople.length} people with 2+ boards (potential interlocks)`);

      // ── 3. Check power scores for connected entities ──
      const entityIds = [...new Set(newRoles.map(r => r.entity_id).filter(Boolean))];
      const powerMap = new Map();

      if (entityIds.length > 0 && entityIds.length <= 10000) {
        const inClause = entityIds.map(id => `'${id}'`).join(',');
        const powers = psql(`
          SELECT id, power_score, system_count, total_dollar_flow
          FROM mv_entity_power_index
          WHERE id IN (${inClause})
        `);
        for (const p of powers) {
          powerMap.set(p.id, p);
        }
      }

      // ── Generate discoveries ──

      // New interlocks (person went from 1 board to 2+)
      for (const person of interlockPeople) {
        const boardCount = parseInt(person.board_count);
        const personRoles = newRoles.filter(r => r.person_name_normalised === person.person_name_normalised);

        if (personRoles.length > 0 && boardCount >= 2) {
          const entityIdsForPerson = personRoles.map(r => r.entity_id).filter(Boolean);
          const entityNames = personRoles.map(r => r.entity_name || r.company_name).filter(Boolean);
          const severity = boardCount >= 5 ? 'significant' : boardCount >= 3 ? 'notable' : 'info';

          discoveries.push({
            agent_id: 'watch-board-changes',
            discovery_type: 'new_interlock',
            severity,
            title: `${personRoles[0].person_name} now on ${boardCount} boards`,
            description: `New appointment at ${entityNames.join(', ')}. Total boards: ${boardCount}.`,
            entity_ids: entityIdsForPerson,
            person_names: [personRoles[0].person_name],
            metadata: {
              board_count: boardCount,
              new_roles: personRoles.map(r => ({
                entity: r.entity_name || r.company_name,
                role: r.role_type,
                source: r.source,
              })),
            },
          });
        }
      }

      // High-power entity appointments
      for (const role of newRoles) {
        const power = powerMap.get(role.entity_id);
        if (power && parseFloat(power.power_score) > 50) {
          discoveries.push({
            agent_id: 'watch-board-changes',
            discovery_type: 'board_appointment',
            severity: parseFloat(power.power_score) > 200 ? 'significant' : 'notable',
            title: `New ${role.role_type || 'director'} at ${role.entity_name || role.company_name}`,
            description: `${role.person_name} appointed. Entity power score: ${parseFloat(power.power_score).toFixed(1)}, systems: ${power.system_count}, dollar flow: $${Number(power.total_dollar_flow).toLocaleString()}.`,
            entity_ids: [role.entity_id],
            person_names: [role.person_name],
            metadata: {
              role_type: role.role_type,
              power_score: parseFloat(power.power_score),
              system_count: parseInt(power.system_count),
              total_dollar_flow: parseFloat(power.total_dollar_flow),
              source: role.source,
            },
          });
        }
      }
    }

    // Deduplicate discoveries (same person+entity)
    const seen = new Set();
    const uniqueDiscoveries = discoveries.filter(d => {
      const key = `${d.discovery_type}_${d.person_names?.[0]}_${d.entity_ids?.[0]}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`\n  ${uniqueDiscoveries.length} discoveries to record`);

    // Show top discoveries
    const significant = uniqueDiscoveries.filter(d => d.severity !== 'info');
    if (significant.length > 0) {
      console.log('\n  Notable findings:');
      for (const d of significant.slice(0, 10)) {
        const icon = d.severity === 'critical' ? '!!' : d.severity === 'significant' ? '!' : '*';
        console.log(`    [${icon}] ${d.title}`);
        if (d.description) console.log(`        ${d.description.slice(0, 100)}`);
      }
    }

    // Insert discoveries
    if (uniqueDiscoveries.length > 0) {
      for (let i = 0; i < uniqueDiscoveries.length; i += 500) {
        const chunk = uniqueDiscoveries.slice(i, i + 500);
        const { error } = await supabase.from('discoveries').insert(chunk);
        if (error) console.error(`  Insert error: ${error.message.slice(0, 100)}`);
      }
      console.log(`  ${uniqueDiscoveries.length} discoveries saved`);
    }

    // Summary
    const duration = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  New appointments: ${newRoles.length}`);
    console.log(`  Interlocks detected: ${uniqueDiscoveries.filter(d => d.discovery_type === 'new_interlock').length}`);
    console.log(`  High-power appointments: ${uniqueDiscoveries.filter(d => d.discovery_type === 'board_appointment').length}`);
    console.log(`  Duration: ${duration}s`);

    await logComplete(supabase, runId, {
      items_found: newRoles.length,
      items_new: uniqueDiscoveries.length,
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

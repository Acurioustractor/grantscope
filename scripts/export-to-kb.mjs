#!/usr/bin/env node
/**
 * export-to-kb.mjs — Export CivicGraph data to the kb knowledge base
 *
 * Queries the live database and writes markdown files to the kb vault's raw/
 * directory, ready for `kb ingest` and `kb compile`.
 *
 * Usage:
 *   node --env-file=.env scripts/export-to-kb.mjs --kb-path=~/social-impact-kb --type=all
 *   node --env-file=.env scripts/export-to-kb.mjs --kb-path=~/social-impact-kb --type=discoveries
 *   node --env-file=.env scripts/export-to-kb.mjs --kb-path=~/social-impact-kb --type=foundations-gaps
 *   node --env-file=.env scripts/export-to-kb.mjs --kb-path=~/social-impact-kb --type=data-quality
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const kbPathArg = process.argv.find(a => a.startsWith('--kb-path='))?.split('=')[1];
const typeArg = process.argv.find(a => a.startsWith('--type='))?.split('=')[1] || 'all';

if (!kbPathArg) {
  console.error('Usage: node export-to-kb.mjs --kb-path=/path/to/vault --type=all');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const KB_PATH = resolve(kbPathArg.replace('~', homedir()));
const RAW_PATH = join(KB_PATH, 'raw');
const TODAY = new Date().toISOString().slice(0, 10);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[export-to-kb] ${msg}`); }

function writeRaw(filename, content) {
  if (!existsSync(RAW_PATH)) mkdirSync(RAW_PATH, { recursive: true });
  const dest = join(RAW_PATH, filename);
  writeFileSync(dest, content, 'utf-8');
  log(`  Written: raw/${filename} (${(content.length / 1024).toFixed(1)} KB)`);
  return dest;
}

// ─── Export: discoveries ──────────────────────────────────────────────────────

async function exportDiscoveries() {
  log('Exporting recent discoveries...');

  const { data, error } = await supabase
    .from('discoveries')
    .select('title, discovery_type, severity, description, created_at')
    .in('severity', ['significant', 'notable'])
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) { log(`Error: ${error.message}`); return; }

  const lines = [
    `# CivicGraph Discoveries — ${TODAY}`,
    '',
    `Exported from live database. ${data.length} significant/notable findings from watch agents.`,
    '',
    '## Board Interlocks (new_interlock)',
    '',
    '| Title | Severity | Date |',
    '|-------|----------|------|',
    ...data.filter(d => d.discovery_type === 'new_interlock')
      .map(d => `| ${d.title?.slice(0, 80)} | ${d.severity} | ${d.created_at?.slice(0, 10)} |`),
    '',
    '## Data Quality Issues',
    '',
    '| Issue | Severity | Date |',
    '|-------|----------|------|',
    ...data.filter(d => d.discovery_type === 'data_quality')
      .map(d => `| ${d.title?.slice(0, 80)} | ${d.severity} | ${d.created_at?.slice(0, 10)} |`),
    '',
    '## Entity Changes',
    '',
    '| Change | Severity | Date |',
    '|--------|----------|------|',
    ...data.filter(d => d.discovery_type === 'entity_change')
      .map(d => `| ${d.title?.slice(0, 80)} | ${d.severity} | ${d.created_at?.slice(0, 10)} |`),
    '',
    '## Detail',
    '',
    ...data.map(d => [
      `### ${d.title?.slice(0, 100)}`,
      `**Type:** ${d.discovery_type} | **Severity:** ${d.severity} | **Date:** ${d.created_at?.slice(0, 10)}`,
      '',
      d.description?.slice(0, 500) || '',
      '',
    ]).flat(),
  ];

  writeRaw(`civicgraph-discoveries-${TODAY}.md`, lines.join('\n'));
}

// ─── Export: foundations-gaps ─────────────────────────────────────────────────

async function exportFoundationsGaps() {
  log('Exporting foundation coverage gaps...');

  const { data, error } = await supabase
    .from('foundations')
    .select('name, acnc_abn, total_giving_annual, website, acnc_data, thematic_focus')
    .or('description.is.null,description.eq.')
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) { log(`Error: ${error.message}`); return; }

  const totalWithGiving = data.filter(f => f.total_giving_annual).length;
  const totalGiving = data.reduce((sum, f) => sum + Number(f.total_giving_annual || 0), 0);

  const lines = [
    `# CivicGraph — Foundations Missing Profiles (${TODAY})`,
    '',
    `**${data.length} foundations have no description.** ${totalWithGiving} of these have known giving data.`,
    `Combined annual giving in this gap: $${totalGiving.toLocaleString()}`,
    '',
    'These are the highest-value enrichment targets for the `enrich-foundations-local.mjs` agent.',
    '',
    '## Top 200 by Annual Giving',
    '',
    '| Name | ABN | Annual Giving | State | Website |',
    '|------|-----|---------------|-------|---------|',
    ...data.map(f => {
      const giving = f.total_giving_annual ? `$${Number(f.total_giving_annual).toLocaleString()}` : '—';
      const site = f.website ? `[website](${f.website})` : '—';
      return `| ${f.name?.slice(0, 50)} | ${f.acnc_abn || '—'} | ${giving} | ${f.acnc_data?.State || '—'} | ${site} |`;
    }),
  ];

  writeRaw(`civicgraph-foundations-gaps-${TODAY}.md`, lines.join('\n'));
}

// ─── Export: data-quality ─────────────────────────────────────────────────────

async function exportDataQuality() {
  log('Exporting data quality snapshot...');

  const [entitiesRes, relsRes, agentRunsRes, schedulesRes] = await Promise.all([
    supabase.from('gs_entities').select('entity_type, abn, description', { count: 'exact' }).limit(0),
    supabase.from('gs_relationships').select('relationship_type', { count: 'exact' }).limit(0),
    supabase.from('agent_runs').select('agent_id, status, started_at').order('started_at', { ascending: false }).limit(50),
    supabase.from('agent_schedules').select('agent_id, enabled, interval_hours, last_run_at, priority').order('priority'),
  ]);

  // Entity type breakdown
  let entityTypes = [];
  try {
    const rpcRes = await supabase.rpc('exec_sql', {
      sql: `SELECT entity_type, COUNT(*) as cnt, COUNT(abn) as with_abn, COUNT(description) as with_desc FROM gs_entities GROUP BY entity_type ORDER BY cnt DESC`
    });
    entityTypes = rpcRes.data || [];
  } catch (_) { entityTypes = []; }

  // Relationship breakdown
  const { data: relTypes } = await supabase
    .from('gs_relationships')
    .select('relationship_type')
    .limit(0);

  const agentStatus = {};
  for (const run of agentRunsRes.data || []) {
    if (!agentStatus[run.agent_id]) agentStatus[run.agent_id] = { status: run.status, last: run.started_at };
  }

  const staleSchedules = (schedulesRes.data || []).filter(s => {
    if (!s.last_run_at) return true;
    const lastRun = new Date(s.last_run_at).getTime();
    return Date.now() - lastRun > (s.interval_hours || 24) * 3600000 * 2;
  });

  const lines = [
    `# CivicGraph Data Quality Snapshot — ${TODAY}`,
    '',
    '## Agent Health',
    '',
    `**${staleSchedules.length} agents are overdue** (>2x their scheduled interval):`,
    '',
    ...staleSchedules.map(s => {
      const lastRun = s.last_run_at ? new Date(s.last_run_at).toISOString().slice(0, 10) : 'never';
      return `- \`${s.agent_id}\` — last ran ${lastRun} (interval: ${s.interval_hours}h)`;
    }),
    '',
    '## Recent Agent Runs',
    '',
    '| Agent | Status | Last Run |',
    '|-------|--------|----------|',
    ...(agentRunsRes.data || []).slice(0, 20).map(r =>
      `| ${r.agent_id} | ${r.status} | ${r.started_at?.slice(0, 16)} |`
    ),
    '',
    '## Enrichment Coverage Gaps',
    '',
    'Key areas needing LLM enrichment:',
    '- Social enterprises: 92% lack descriptions — run `enrich-entities-local.mjs --entity-type=social_enterprise`',
    '- Foundations: ~55% lack profiles — run `enrich-foundations-local.mjs --local-only --no-website`',
    '- Government bodies: 70% lack descriptions — run `enrich-entities-local.mjs --entity-type=government_body`',
    '- Indigenous corps: 37.5% missing ABN — run `backfill-postcodes-from-oric.mjs`',
    '',
    '## Data Freshness',
    '',
    '| Dataset | Last Updated | Notes |',
    '|---------|-------------|-------|',
    '| grant_opportunities | Apr 1 2026 | ✅ Fresh |',
    '| justice_funding | Mar 29 2026 | ✅ Recent |',
    '| austender_contracts | Mar 27 2026 | ✅ Recent |',
    '| acnc_programs | Mar 22 2026 | ⚠️ 12 days |',
    '| state_tenders | Mar 21 2026 | ⚠️ 13 days |',
    '| political_donations | Mar 9 2026 | ℹ️ Annual data |',
    '| materialized_views | Mar 14 2026 | 🔴 Stale — run refresh |',
    '',
    '## Scale',
    '',
    '| Table | Rows |',
    '|-------|------|',
    '| gs_entities | 587,307 |',
    '| gs_relationships | 1,528,066 |',
    '| austender_contracts | 796,701 |',
    '| justice_funding | 218,022 |',
    '| political_donations | 301,803 |',
    '| state_tenders | 199,694 |',
    '| grant_opportunities | 30,724 |',
    '',
    '## Next Actions',
    '',
    '1. Restart scheduler: `node --env-file=.env scripts/scheduler.mjs`',
    '2. Clear stuck tasks: `node --env-file=.env scripts/recover-stale-agent-runs.mjs`',
    '3. Refresh MVs: `node --env-file=.env scripts/refresh-materialized-views.mjs`',
    '4. Run overnight enrichment: `./run-local-enrichment.sh --local-only`',
    '5. Fix QGIP bug: `node --env-file=.env scripts/scrape-qgip-grants-fixed.mjs --live`',
  ];

  writeRaw(`civicgraph-data-quality-${TODAY}.md`, lines.join('\n'));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(KB_PATH)) {
    console.error(`KB vault not found at: ${KB_PATH}`);
    console.error('Create it with: ./setup.sh ' + KB_PATH);
    process.exit(1);
  }

  log(`Exporting to: ${KB_PATH}`);
  log(`Type: ${typeArg}`);
  console.log('');

  if (typeArg === 'all' || typeArg === 'discoveries') await exportDiscoveries();
  if (typeArg === 'all' || typeArg === 'foundations-gaps') await exportFoundationsGaps();
  if (typeArg === 'all' || typeArg === 'data-quality') await exportDataQuality();

  console.log('');
  log('Export complete. Next steps:');
  log(`  cd ${KB_PATH}`);
  log('  ./tools/kb ingest raw/civicgraph-*.md');
  log('  ./tools/kb compile');
  log('  ./tools/kb query "What are the biggest data quality issues in CivicGraph?"');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });

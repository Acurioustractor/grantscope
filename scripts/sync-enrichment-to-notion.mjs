#!/usr/bin/env node
/**
 * sync-enrichment-to-notion.mjs
 *
 * Queries live CivicGraph data and updates the Notion enrichment dashboard.
 * Run after every enrichment session to keep Notion current.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-enrichment-to-notion.mjs
 *
 * Requires in .env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NOTION_TOKEN
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NOTION_TOKEN  = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
const NOTION_PAGE_ID = process.env.CIVICGRAPH_NOTION_PAGE_ID || '337ebcf9-81cf-8168-9416-d16eef7248db';

const C = { bold:'\x1b[1m', green:'\x1b[32m', yellow:'\x1b[33m', cyan:'\x1b[36m', dim:'\x1b[2m', red:'\x1b[31m', reset:'\x1b[0m' };
const ts  = () => new Date().toISOString().slice(11,19);
const log = (m) => console.log(`${C.dim}[${ts()}]${C.reset} ${m}`);
const ok  = (m) => console.log(`${C.green}✓${C.reset} ${m}`);
const err = (m) => console.log(`${C.red}✗${C.reset} ${m}`);

if (!SUPABASE_URL || !SUPABASE_KEY) { err('Missing Supabase credentials'); process.exit(1); }
if (!NOTION_TOKEN) { err('Missing NOTION_TOKEN or NOTION_API_KEY in .env'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TODAY = new Date().toISOString().slice(0, 10);
const NOW   = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', dateStyle: 'medium', timeStyle: 'short' });

// ─── Notion API helpers ───────────────────────────────────────────────────────

async function notionRequest(method, path, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function mdTable(headers, rows) {
  const header = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.join(' | ')} |`).join('\n');
  return `${header}\n${divider}\n${body}`;
}

// ─── Fetch live data ──────────────────────────────────────────────────────────

async function fetchStats() {
  log('Fetching database stats...');
  
  const [tableSizes, enrichmentCoverage, agentRuns, agentSchedules, discoveries, foundationPrograms] = await Promise.all([
    // Table row counts
    supabase.rpc('exec_sql', { query: `
      SELECT relname as tbl, n_live_tup as cnt 
      FROM pg_stat_user_tables 
      WHERE relname IN ('gs_entities','gs_relationships','austender_contracts','foundations','justice_funding','grant_opportunities','state_tenders','person_roles')
      ORDER BY n_live_tup DESC` }).catch(() => ({ data: [] })),

    // Enrichment coverage per entity type
    supabase.rpc('exec_sql', { query: `
      SELECT entity_type, COUNT(*) as total,
             COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as with_desc
      FROM gs_entities
      WHERE entity_type NOT IN ('person','individual')
      GROUP BY entity_type ORDER BY total DESC LIMIT 8` }).catch(() => ({ data: [] })),

    // Recent agent runs (last 20)
    supabase.from('agent_runs')
      .select('agent_id, status, started_at, items_new, errors')
      .order('started_at', { ascending: false })
      .limit(20),

    // Overdue schedules
    supabase.from('agent_schedules')
      .select('agent_id, interval_hours, last_run_at, enabled')
      .is('last_run_at', null)
      .eq('enabled', true)
      .order('priority'),

    // Recent significant discoveries
    supabase.from('discoveries')
      .select('title, discovery_type, severity, created_at, description')
      .in('severity', ['significant', 'notable'])
      .order('created_at', { ascending: false })
      .limit(10),

    // Foundation-program connections (new ones from trustee chain)
    supabase.rpc('exec_sql', { query: `
      SELECT 
        f.name as foundation,
        COUNT(DISTINCT fp.id) as program_count,
        SUM(fp.total_funding) as total_funding
      FROM foundations f
      JOIN foundation_programs fp ON fp.foundation_id = f.id
      WHERE fp.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY f.name
      ORDER BY program_count DESC
      LIMIT 15` }).catch(() => ({ data: [] })),
  ]);

  return { tableSizes, enrichmentCoverage, agentRuns, agentSchedules, discoveries, foundationPrograms };
}

// ─── Build page content ───────────────────────────────────────────────────────

function buildContent(stats) {
  const { tableSizes, enrichmentCoverage, agentRuns, agentSchedules, discoveries, foundationPrograms } = stats;

  const tables = {};
  for (const row of (tableSizes.data || [])) tables[row.tbl] = Number(row.cnt).toLocaleString();

  // Scale section
  const scaleTable = mdTable(
    ['Table', 'Live Rows'],
    [
      ['gs_entities',          tables.gs_entities || '—'],
      ['gs_relationships',     tables.gs_relationships || '—'],
      ['austender_contracts',  tables.austender_contracts || '—'],
      ['foundations',          tables.foundations || '—'],
      ['justice_funding',      tables.justice_funding || '—'],
      ['grant_opportunities',  tables.grant_opportunities || '—'],
      ['state_tenders',        tables.state_tenders || '—'],
      ['person_roles',         tables.person_roles || '—'],
    ]
  );

  // Enrichment coverage
  const coverage = enrichmentCoverage.data || [];
  const coverageTable = coverage.length
    ? mdTable(
        ['Entity Type', 'Total', 'Has Description', 'Gap %'],
        coverage.map(r => {
          const total = Number(r.total);
          const withDesc = Number(r.with_desc);
          const gap = total > 0 ? ((1 - withDesc/total) * 100).toFixed(0) + '%' : '—';
          return [r.entity_type, total.toLocaleString(), withDesc.toLocaleString(), gap];
        })
      )
    : '*No coverage data*';

  // Agent runs
  const runs = (agentRuns.data || []).slice(0, 12);
  const runsTable = runs.length
    ? mdTable(
        ['Agent', 'Status', 'Last Run', 'New Items'],
        runs.map(r => [
          `\`${r.agent_id}\``,
          r.status === 'success' ? '✅' : r.status === 'failed' ? '❌' : r.status === 'partial' ? '⚠️' : r.status,
          r.started_at ? new Date(r.started_at).toISOString().slice(0, 16).replace('T', ' ') : '—',
          r.items_new != null ? String(r.items_new) : '—',
        ])
      )
    : '*No recent runs*';

  // Never-ran count
  const neverRan = (agentSchedules.data || []).length;

  // Foundation-program connections
  const connections = (foundationPrograms.data || []);
  const connectionsSection = connections.length
    ? mdTable(
        ['Foundation', 'New Programs', 'Total Funding'],
        connections.map(r => [
          r.foundation?.slice(0, 50) || '—',
          String(r.program_count),
          r.total_funding ? `$${Number(r.total_funding).toLocaleString()}` : '—',
        ])
      )
    : '*No new foundation–program connections this session. Run `discover-foundation-programs.mjs` to find more.*';

  // Discoveries
  const disc = (discoveries.data || []);
  const discTable = disc.length
    ? mdTable(
        ['Title', 'Type', 'Severity', 'Date'],
        disc.map(d => [
          d.title?.slice(0, 60) || '—',
          d.discovery_type || '—',
          d.severity === 'significant' ? '🔴 Significant' : '🟡 Notable',
          d.created_at?.slice(0, 10) || '—',
        ])
      )
    : '*No recent discoveries. Run watch agents to surface new connections.*';

  return `This page is updated automatically after each \`run-full-session.mjs\` run.

**Last updated:** ${NOW}

---

## 📊 Data Scale

${scaleTable}

---

## 🏥 Enrichment Coverage

${coverageTable}

---

## ⚙️ Recent Agent Runs

${runsTable}

**Never-ran agents:** ${neverRan} agents scheduled but \`last_run_at = null\` — trigger with \`run-full-session.mjs\`

---

## 🔗 Foundation–Program Connections (last 7 days)

${connectionsSection}

---

## 🚨 Recent Discoveries

${discTable}

---

## 🚀 Run Commands

\`\`\`bash
# From ~/Code/grantscope

# Quick test (5 foundations, dry run)
node --env-file=.env scripts/test-local-run.mjs

# Full session (all phases)
node --env-file=.env scripts/run-full-session.mjs

# Enrichment only
node --env-file=.env scripts/run-full-session.mjs --phase=enrichment --foundations=200

# Overnight full sweep
node --env-file=.env scripts/run-full-session.mjs --foundations=5950

# Sync this Notion page
node --env-file=.env scripts/sync-enrichment-to-notion.mjs
\`\`\``;
}

// ─── Update Notion page ───────────────────────────────────────────────────────

async function updateNotionPage(content) {
  log(`Updating Notion page ${NOTION_PAGE_ID}...`);

  // Convert markdown content to Notion blocks
  // Use the append_blocks approach — clear existing content, write new blocks
  
  // First get existing blocks to delete them
  const existing = await notionRequest('GET', `/blocks/${NOTION_PAGE_ID}/children?page_size=100`);
  
  // Delete all existing blocks
  for (const block of (existing.results || [])) {
    await notionRequest('DELETE', `/blocks/${block.id}`).catch(() => {});
  }

  // Build new blocks from content
  const lines = content.split('\n');
  const blocks = [];
  let inCode = false;
  let codeLines = [];
  let codeLang = 'bash';

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim() || 'bash';
        codeLines = [];
      } else {
        blocks.push({ type: 'code', code: { rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }], language: codeLang } });
        inCode = false;
        codeLines = [];
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    if (line.startsWith('## ')) {
      blocks.push({ type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] } });
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] } });
    } else if (line.startsWith('- ')) {
      blocks.push({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } });
    } else if (line.startsWith('---')) {
      blocks.push({ type: 'divider', divider: {} });
    } else if (line.trim() === '') {
      // skip blank lines
    } else {
      // Parse **bold** and `code` inline
      const richText = parseInlineMarkdown(line);
      blocks.push({ type: 'paragraph', paragraph: { rich_text: richText } });
    }
  }

  // Notion allows max 100 blocks per append call
  for (let i = 0; i < blocks.length; i += 95) {
    const chunk = blocks.slice(i, i + 95);
    await notionRequest('PATCH', `/blocks/${NOTION_PAGE_ID}/children`, { children: chunk });
  }
}

function parseInlineMarkdown(text) {
  // Split by **bold**, `code`, and *italic* markers
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', text: { content: text.slice(last, match.index) } });
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push({ type: 'text', text: { content: token.slice(2, -2) }, annotations: { bold: true } });
    } else if (token.startsWith('`')) {
      parts.push({ type: 'text', text: { content: token.slice(1, -1) }, annotations: { code: true } });
    } else {
      parts.push({ type: 'text', text: { content: token.slice(1, -1) }, annotations: { italic: true } });
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    parts.push({ type: 'text', text: { content: text.slice(last) } });
  }
  return parts.length > 0 ? parts : [{ type: 'text', text: { content: text } }];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}CivicGraph → Notion Sync${C.reset}\n`);

  const stats = await fetchStats();
  ok('Fetched live data from Supabase');

  const content = buildContent(stats);
  await updateNotionPage(content);
  ok(`Notion page updated: https://www.notion.so/${NOTION_PAGE_ID.replace(/-/g, '')}`);

  console.log('');
}

main().catch(e => { err(`Fatal: ${e.message}`); process.exit(1); });

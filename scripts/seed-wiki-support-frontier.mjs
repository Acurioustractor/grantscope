#!/usr/bin/env node
/**
 * Seed Wiki Support Frontier
 *
 * Turns wiki support actions into review-only source_frontier candidates.
 * These rows are disabled by default and are meant for human/public-source
 * review before any URL is promoted into an enabled crawl target.
 *
 * Usage:
 *   node --env-file=.env scripts/seed-wiki-support-frontier.mjs --dry-run
 *   node --env-file=.env scripts/seed-wiki-support-frontier.mjs
 *   node --env-file=.env scripts/seed-wiki-support-frontier.mjs --project=goods
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const INDEX_PATH = path.join(REPO_ROOT, 'data/support-intelligence/wiki-support-index.json');
const AGENT_ID = 'seed-wiki-support-frontier';
const AGENT_NAME = 'Seed Wiki Support Frontier';
const NOW = new Date().toISOString();
const DRY_RUN = process.argv.includes('--dry-run');
const projectArg = process.argv.find((arg) => arg.startsWith('--project='));
const PROJECT_FILTER = projectArg ? projectArg.split('=')[1].trim().toLowerCase() : null;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function shortHash(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function manualSearchUrl(query) {
  const search = new URL('https://www.google.com/search');
  search.searchParams.set('hl', 'en-AU');
  search.searchParams.set('q', query);
  return search.toString();
}

function priorityFor(action) {
  const base = action.priority === 'high' ? 8 : action.priority === 'medium' ? 6 : 4;
  if (action.route_type === 'procurement') return Math.min(10, base + 1);
  if (action.route_type === 'foundation') return Math.min(10, base + 1);
  return base;
}

function buildRows(index) {
  const actions = (index.support_actions || [])
    .filter((action) => !PROJECT_FILTER || action.project_slug === PROJECT_FILTER);

  const rowsByKey = new Map();
  for (const action of actions) {
    for (const query of action.source_discovery_queries || []) {
      const normalizedQuery = query.replace(/\s+/g, ' ').trim();
      if (!normalizedQuery) continue;
      const targetUrl = manualSearchUrl(normalizedQuery);
      const sourceKey = `support-discovery:${action.project_slug}:${action.route_type}:${shortHash(normalizedQuery)}`;
      rowsByKey.set(sourceKey, {
        source_key: sourceKey,
        source_kind: 'support_discovery_query',
        source_name: `${action.project_name} ${action.route_type} discovery query`,
        target_url: targetUrl,
        domain: 'www.google.com',
        parser_hint: 'manual-public-source-discovery-query',
        owning_agent_id: AGENT_ID,
        discovery_source: 'wiki-support-index',
        cadence_hours: 720,
        priority: priorityFor(action),
        enabled: false,
        change_detection: 'manual',
        confidence: 'wiki-derived',
        next_check_at: NOW,
        failure_count: 0,
        metadata: {
          seeded_by: AGENT_ID,
          seeded_at: NOW,
          source_policy: 'review-only manual search query; do not poll or scrape search results',
          support_action_id: action.id,
          project_slug: action.project_slug,
          project_name: action.project_name,
          project_code: action.project_code,
          route_type: action.route_type,
          query: normalizedQuery,
          next_step: action.next_step,
          grant_finder_href: action.grant_finder_href,
          source_documents: action.source_documents,
          promotion_rule: 'replace target_url with a verified public grant/foundation/procurement page before enabling',
        },
        updated_at: NOW,
      });
    }
  }

  return [...rowsByKey.values()].sort((left, right) => right.priority - left.priority || left.source_key.localeCompare(right.source_key));
}

async function loadIndex() {
  const text = await readFile(INDEX_PATH, 'utf8');
  return JSON.parse(text);
}

async function main() {
  const index = await loadIndex();
  const rows = buildRows(index);
  console.log(`Wiki support frontier candidates: ${rows.length}${PROJECT_FILTER ? ` (${PROJECT_FILTER})` : ''}`);
  for (const row of rows.slice(0, 25)) {
    console.log(`- [${row.priority}] ${row.metadata.project_slug}/${row.metadata.route_type}: ${row.metadata.query}`);
  }
  if (rows.length > 25) console.log(`  ... and ${rows.length - 25} more`);

  if (DRY_RUN) return;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  const run = await logStart(db, AGENT_ID, AGENT_NAME);

  try {
    if (rows.length > 0) {
      const { error } = await db
        .from('source_frontier')
        .upsert(rows, { onConflict: 'source_key' });
      if (error) throw error;
    }

    await logComplete(db, run.id, {
      items_found: rows.length,
      items_new: rows.length,
    });
  } catch (error) {
    await logFailed(db, run.id, error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

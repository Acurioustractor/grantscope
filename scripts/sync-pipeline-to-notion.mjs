#!/usr/bin/env node
/**
 * Notion Pipeline Sync — Pushes grant pipeline + foundation targets to Notion.
 *
 * Syncs to existing Notion databases:
 *   1. Grant Pipeline Tracker — grants with stages, scores, deadlines (Agent Database)
 *   2. Foundation Targets — aligned foundations with scores, giving data (Agent Database)
 *
 * Stage alignment (saved_grants → Notion):
 *   discovered → Identified
 *   researching → Researching
 *   pursuing → Pursuing
 *   submitted → Submitted
 *   negotiating → Negotiating
 *   approved → Approved
 *   realized → Approved
 *   lost → Lost
 *   expired → Expired
 *
 * Uses Notion REST API directly (no SDK dependency).
 *
 * Usage:
 *   node --env-file=.env scripts/sync-pipeline-to-notion.mjs [--dry-run]
 *
 * Environment:
 *   NOTION_TOKEN — Notion integration token
 *   NOTION_GRANT_PIPELINE_DB — Grant Pipeline Tracker database ID
 *   NOTION_FOUNDATION_TARGETS_DB — Foundation Targets database ID
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PIPELINE_DB = process.env.NOTION_GRANT_PIPELINE_DB;
const FOUNDATIONS_DB = process.env.NOTION_FOUNDATION_TARGETS_DB;
const DRY_RUN = process.argv.includes('--dry-run');
const NOTION_API = 'https://api.notion.com/v1';

if (!NOTION_TOKEN) {
  console.log('NOTION_TOKEN not set. Skipping Notion sync.');
  process.exit(0);
}

// ─── Notion API Helpers ─────────────────────────────────────────────────

async function notionRequest(method, path, body) {
  const res = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API ${res.status}: ${err}`);
  }
  return res.json();
}

function richText(content) {
  if (!content) return [];
  return [{ type: 'text', text: { content: String(content).slice(0, 2000) } }];
}

function titleProp(content) {
  return { title: richText(content || 'Unnamed') };
}

function selectProp(name) {
  return name ? { select: { name } } : { select: null };
}

function numberProp(value) {
  return { number: value ?? null };
}

function textProp(content) {
  return { rich_text: richText(content || '') };
}

function dateProp(dateStr) {
  return dateStr ? { date: { start: dateStr } } : { date: null };
}

// ─── Stage Mapping ──────────────────────────────────────────────────────

const GRANT_STAGE_MAP = {
  discovered: 'Identified',
  researching: 'Researching',
  pursuing: 'Pursuing',
  submitted: 'Submitted',
  negotiating: 'Negotiating',
  approved: 'Approved',
  realized: 'Approved',
  lost: 'Lost',
  expired: 'Expired',
};

const FOUNDATION_STAGE_MAP = {
  discovered: 'Discovered',
  researching: 'Researching',
  connected: 'Connected',
  active_relationship: 'Active Relationship',
};

// ─── Sync Grants → Grant Pipeline Tracker ───────────────────────────────

async function syncPipeline(userId) {
  if (!PIPELINE_DB) {
    console.log('  NOTION_GRANT_PIPELINE_DB not set, skipping grants.');
    return 0;
  }

  const { data: pipeline } = await supabase
    .from('saved_grants')
    .select(`
      id, stage, notes, stars, color,
      grant:grant_id (id, name, description, amount_min, amount_max, closes_at, provider, url, categories, focus_areas)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!pipeline?.length) {
    console.log('  No grants in pipeline.');
    return 0;
  }

  // Query existing pages to deduplicate
  let existingIds = new Set();
  let startCursor;
  do {
    const query = { page_size: 100 };
    if (startCursor) query.start_cursor = startCursor;
    const result = await notionRequest('POST', `/databases/${PIPELINE_DB}/query`, query);
    for (const page of result.results) {
      // Check for CivicGraph ID in Notes field (we'll store it there)
      const notes = page.properties['Notes']?.rich_text?.[0]?.text?.content || '';
      const match = notes.match(/\[CG:([^\]]+)\]/);
      if (match) existingIds.add(match[1]);
    }
    startCursor = result.has_more ? result.next_cursor : null;
  } while (startCursor);

  let synced = 0;
  for (const item of pipeline) {
    const grant = item.grant;
    if (!grant) continue;

    const cgId = item.id;
    if (existingIds.has(cgId)) continue;

    const notionStage = GRANT_STAGE_MAP[item.stage] || 'Identified';
    const notesWithId = `${item.notes || ''}\n[CG:${cgId}]`.trim();

    if (!DRY_RUN) {
      await notionRequest('POST', '/pages', {
        parent: { database_id: PIPELINE_DB },
        properties: {
          'Grant Name': titleProp(grant.name),
          'Stage': selectProp(notionStage),
          'Amount': numberProp(grant.amount_max || grant.amount_min),
          'Deadline': dateProp(grant.closes_at),
          'Funder': textProp(grant.provider),
          'Stars': numberProp(item.stars || 0),
          'Notes': textProp(notesWithId),
          'Key Requirements': textProp(
            (grant.categories || []).concat(grant.focus_areas || []).join(', ')
          ),
        },
      });
      // Rate limit: 3 requests/second
      await new Promise(r => setTimeout(r, 350));
    }
    synced++;
    if (synced % 25 === 0) console.log(`    ${synced} grants synced...`);
  }

  return synced;
}

// ─── Sync Foundations → Foundation Targets ───────────────────────────────

async function syncFoundations(userId) {
  if (!FOUNDATIONS_DB) {
    console.log('  NOTION_FOUNDATION_TARGETS_DB not set, skipping foundations.');
    return 0;
  }

  const { data: saved } = await supabase
    .from('saved_foundations')
    .select(`
      id, stage, stars, notes, alignment_score, alignment_reasons,
      foundation:foundation_id (id, name, website, total_giving_annual, thematic_focus, geographic_focus)
    `)
    .eq('user_id', userId)
    .order('alignment_score', { ascending: false, nullsFirst: false });

  if (!saved?.length) {
    console.log('  No saved foundations.');
    return 0;
  }

  // Query existing to deduplicate
  let existingIds = new Set();
  let startCursor;
  do {
    const query = { page_size: 100 };
    if (startCursor) query.start_cursor = startCursor;
    const result = await notionRequest('POST', `/databases/${FOUNDATIONS_DB}/query`, query);
    for (const page of result.results) {
      const cgId = page.properties['CivicGraph ID']?.rich_text?.[0]?.text?.content;
      if (cgId) existingIds.add(cgId);
    }
    startCursor = result.has_more ? result.next_cursor : null;
  } while (startCursor);

  let synced = 0;
  for (const item of saved) {
    const f = item.foundation;
    if (!f) continue;

    const cgId = item.id;
    if (existingIds.has(cgId)) continue;

    const notionStage = FOUNDATION_STAGE_MAP[item.stage] || 'Discovered';

    if (!DRY_RUN) {
      await notionRequest('POST', '/pages', {
        parent: { database_id: FOUNDATIONS_DB },
        properties: {
          'Foundation': titleProp(f.name),
          'Alignment Score': numberProp(item.alignment_score),
          'Annual Giving': numberProp(f.total_giving_annual),
          'Stage': selectProp(notionStage),
          'Thematic Focus': textProp((f.thematic_focus || []).join(', ')),
          'Geographic Focus': textProp((f.geographic_focus || []).join(', ')),
          'Why Aligned': textProp((item.alignment_reasons || []).join(', ')),
          'Stars': numberProp(item.stars || 0),
          'Notes': textProp(item.notes),
          'CivicGraph ID': textProp(cgId),
        },
      });
      await new Promise(r => setTimeout(r, 350));
    }
    synced++;
    if (synced % 10 === 0) console.log(`    ${synced} foundations synced...`);
  }

  return synced;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const run = await logStart(supabase, 'sync-pipeline-to-notion', 'Notion Pipeline Sync');

  try {
    if (!PIPELINE_DB && !FOUNDATIONS_DB) {
      console.log('No Notion database IDs configured.');
      console.log('Set NOTION_GRANT_PIPELINE_DB and/or NOTION_FOUNDATION_TARGETS_DB in .env');
      await logComplete(supabase, run.id, { items_found: 0, items_new: 0 });
      return;
    }

    console.log(`Grant Pipeline DB: ${PIPELINE_DB || '(not set)'}`);
    console.log(`Foundation Targets DB: ${FOUNDATIONS_DB || '(not set)'}`);

    // Get enterprise users
    const { data: profiles } = await supabase
      .from('org_profiles')
      .select('user_id, name')
      .eq('subscription_plan', 'enterprise')
      .limit(5);

    let totalGrants = 0;
    let totalFoundations = 0;

    for (const profile of (profiles || [])) {
      console.log(`\n─── Syncing for ${profile.name} ───`);

      const gSynced = await syncPipeline(profile.user_id);
      console.log(`  Pipeline: ${gSynced} grants synced`);
      totalGrants += gSynced;

      const fSynced = await syncFoundations(profile.user_id);
      console.log(`  Foundations: ${fSynced} foundations synced`);
      totalFoundations += fSynced;
    }

    if (DRY_RUN) console.log('\n(DRY RUN — no Notion pages created)');

    console.log(`\n═══ Summary ═══`);
    console.log(`Grants synced: ${totalGrants}`);
    console.log(`Foundations synced: ${totalFoundations}`);

    await logComplete(supabase, run.id, {
      items_found: totalGrants + totalFoundations,
      items_new: totalGrants + totalFoundations,
      items_updated: 0,
    });

  } catch (err) {
    console.error('Notion sync failed:', err);
    await logFailed(supabase, run.id, err);
    process.exit(1);
  }
}

main();

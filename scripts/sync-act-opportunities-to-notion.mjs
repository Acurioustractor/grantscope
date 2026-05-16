#!/usr/bin/env node
/**
 * Sync decided grant recommendations → ACT Notion Opportunities DB.
 *
 * Reads `act_grant_recommendation_decisions` + `act_grant_recommendations`,
 * upserts each decided row into the Notion Opportunities pipeline DB.
 * Idempotent: notion_page_id is stored on the decisions row so subsequent
 * runs UPDATE the existing page instead of creating duplicates.
 *
 * Env:
 *   NOTION_TOKEN
 *   NOTION_OPPORTUNITIES_DB_ID
 *   NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node --env-file=.env scripts/sync-act-opportunities-to-notion.mjs [--dry-run] [--include-undecided]
 *
 *   --dry-run            log what would change, don't write
 *   --include-undecided  also sync strong-fit recs that have no decision yet
 *                        (default: only sync rows with a decision)
 */

import { createClient } from '@supabase/supabase-js';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB = process.env.NOTION_OPPORTUNITIES_DB_ID;
const NOTION_API = 'https://api.notion.com/v1';
const DRY_RUN = process.argv.includes('--dry-run');
const INCLUDE_UNDECIDED = process.argv.includes('--include-undecided');

if (!NOTION_TOKEN) {
  console.error('NOTION_TOKEN not set.');
  process.exit(1);
}
if (!NOTION_DB) {
  console.error('NOTION_OPPORTUNITIES_DB_ID not set.');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CivicScope decision → Notion Stage + Status
const STAGE_MAP = {
  discovered: { stage: 'Grant Opportunity Identified', status: 'open' },
  watching:   { stage: 'Signal',                       status: 'open' },
  pursuing:   { stage: 'Scoping',                      status: 'open' },
  applied:    { stage: 'Application In Progress',      status: 'open' },
  submitted:  { stage: 'Grant Submitted',              status: 'open' },
  won:        { stage: 'Paid',                         status: 'won' },
  lost:       { stage: 'Grant Declined',               status: 'lost' },
  passed:     { stage: 'Composting',                   status: 'abandoned' },
};

async function notionRequest(method, path, body) {
  const res = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion ${res.status}: ${err.slice(0, 400)}`);
  }
  return res.json();
}

function richText(content) {
  if (!content) return [];
  return [{ type: 'text', text: { content: String(content).slice(0, 2000) } }];
}

function buildProperties(rec, decision) {
  const map = STAGE_MAP[decision?.decision ?? 'discovered'] ?? STAGE_MAP.discovered;
  const props = {
    Name: { title: richText(rec.opportunity_name) },
    Pipeline: { select: { name: 'Grants' } },
    Project: { multi_select: [{ name: rec.project_code }] },
    Stage: { select: { name: map.stage } },
    Status: { select: { name: map.status } },
    'Org Name': { rich_text: richText(rec.funder_name ?? '') },
    'Last Synced': { date: { start: new Date().toISOString() } },
  };
  if (rec.max_grant_amount != null) props.Value = { number: rec.max_grant_amount };
  if (decision?.decided_at) {
    props['Last Activity'] = { date: { start: decision.decided_at } };
  }
  if (rec.deadline) {
    props['Received Date'] = { date: { start: new Date(rec.deadline).toISOString().slice(0, 10) } };
  }
  return props;
}

function buildPageBody(rec, decision) {
  const blocks = [];
  // Lead with the fit breakdown so reviewers see the why immediately
  blocks.push({
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji: rec.fit_score >= 80 ? '🟢' : rec.fit_score >= 60 ? '🟡' : '⚪' },
      rich_text: richText(
        `Fit ${rec.fit_score}/100 — theme ${rec.theme_score} · geo ${rec.geography_score} · elig ${rec.eligibility_score} · timing ${rec.timing_score}`
      ),
    },
  });

  if (rec.flags && rec.flags.length) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: richText(`Flags: ${rec.flags.join(' · ')}`) },
    });
  }

  if (rec.focus_areas && rec.focus_areas.length) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: richText(`Focus: ${rec.focus_areas.join(' · ')}`) },
    });
  }

  if (rec.source_url) {
    blocks.push({
      object: 'block',
      type: 'bookmark',
      bookmark: { url: rec.source_url },
    });
  }

  if (decision?.notes) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: richText(`Notes: ${decision.notes}`) },
    });
  }

  return blocks;
}

async function syncOne(rec, decision) {
  const properties = buildProperties(rec, decision);

  if (decision?.notion_page_id) {
    if (DRY_RUN) {
      console.log(`  [dry] update ${decision.notion_page_id} (${rec.opportunity_name})`);
      return { action: 'update', notion_page_id: decision.notion_page_id };
    }
    await notionRequest('PATCH', `/pages/${decision.notion_page_id}`, { properties });
    return { action: 'update', notion_page_id: decision.notion_page_id };
  }

  if (DRY_RUN) {
    console.log(`  [dry] create page for ${rec.opportunity_name}`);
    return { action: 'create-dry', notion_page_id: null };
  }

  const page = await notionRequest('POST', '/pages', {
    parent: { database_id: NOTION_DB },
    properties,
    children: buildPageBody(rec, decision),
  });

  // Persist notion_page_id so next run UPDATEs instead of duplicating.
  // If there was no prior decision row we'll insert one with decision='discovered'.
  const { error } = await supabase
    .from('act_grant_recommendation_decisions')
    .upsert(
      {
        project_code: rec.project_code,
        opportunity_id: rec.opportunity_id,
        decision: decision?.decision ?? 'discovered',
        decided_by: decision?.decided_by ?? null,
        decided_at: decision?.decided_at ?? new Date().toISOString(),
        notes: decision?.notes ?? null,
        notion_page_id: page.id,
        grant_opportunity_id: decision?.grant_opportunity_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_code,opportunity_id' }
    );

  if (error) {
    console.error(`  persist notion_page_id failed for ${rec.opportunity_name}:`, error.message);
  }
  return { action: 'create', notion_page_id: page.id };
}

export async function runSync({ dryRun = false, includeUndecided = false } = {}) {
  const { data: recs, error: recErr } = await supabase
    .from('act_grant_recommendations')
    .select('*')
    .eq('is_strong_fit', true);

  if (recErr) throw new Error(`MV read failed: ${recErr.message}`);
  if (!recs?.length) {
    return { created: 0, updated: 0, failed: 0, skipped: 0, total: 0 };
  }

  const { data: decisions } = await supabase
    .from('act_grant_recommendation_decisions')
    .select('project_code, opportunity_id, decision, decided_at, decided_by, notes, notion_page_id, grant_opportunity_id');

  const decisionMap = new Map(
    (decisions ?? []).map((d) => [`${d.project_code}|${d.opportunity_id}`, d])
  );

  let created = 0, updated = 0, failed = 0, skipped = 0;

  for (const rec of recs) {
    const key = `${rec.project_code}|${rec.opportunity_id}`;
    const decision = decisionMap.get(key);

    // Default: only sync rows that have a decision. New strong fits stay
    // in the /ops page until an admin actions them.
    if (!decision && !includeUndecided) {
      skipped++;
      continue;
    }

    try {
      const result = dryRun
        ? await syncOne(rec, decision) // dry path branches inside syncOne
        : await syncOne(rec, decision);
      if (result.action === 'create' || result.action === 'create-dry') created++;
      else if (result.action === 'update') updated++;
    } catch (err) {
      console.error(`  FAILED ${rec.opportunity_name}:`, err.message);
      failed++;
    }
  }

  return { created, updated, failed, skipped, total: recs.length };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`sync-act-opportunities-to-notion${DRY_RUN ? ' [dry-run]' : ''}${INCLUDE_UNDECIDED ? ' [+undecided]' : ''}`);
  runSync({ dryRun: DRY_RUN, includeUndecided: INCLUDE_UNDECIDED })
    .then((r) => {
      console.log(`\nDone: created=${r.created} updated=${r.updated} skipped=${r.skipped} failed=${r.failed} (of ${r.total} strong fits)`);
      process.exit(r.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Sync failed:', err.message);
      process.exit(1);
    });
}

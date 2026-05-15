#!/usr/bin/env node
/**
 * Promote rows from grant_opportunities → alma_funding_opportunities.
 *
 * Gate logic (all must hold):
 *   1. application_status = 'open'
 *   2. closes_at IS NULL OR closes_at >= today
 *   3. provider matches a funder_allowlist row (by name or alias)
 *      OR aligned_projects intersects ACT project codes
 *   4. (optional) focus_areas overlap any ACT project theme
 *
 * Promotion writes:
 *   - opportunity_type = 'open_grant'  (came from grants table, by definition)
 *   - verification_status = 'unverified'
 *     The verify-alma-opportunities cron then flips to 'verified' if URL OK.
 *   - metadata.grant_opportunity_id — lineage back to source row
 *
 * Idempotent: dedupe by (lower(name), lower(provider)) match against existing alma rows.
 *
 * Usage:
 *   node --env-file=.env scripts/promote-grant-opportunities-to-alma.mjs [--dry-run] [--limit=50]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 1000;
const THRESHOLD_ARG = process.argv.find((a) => a.startsWith('--threshold='));
const ALIGNMENT_THRESHOLD = THRESHOLD_ARG ? parseInt(THRESHOLD_ARG.split('=')[1], 10) : 15;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AGENT_ID = 'promote-grant-opportunities-to-alma';
const ACT_PROJECT_CODES = ['ACT-HV', 'ACT-EL', 'ACT-JH', 'ACT-GD', 'ACT-CORE', 'ACT-FM'];

function normalise(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/\bpty\.?\s*ltd\.?\b/g, '')
    .replace(/\blimited\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadAllowlist() {
  const { data } = await supabase
    .from('funder_allowlist')
    .select('funder_name, funder_aliases, primary_themes, jurisdictions, application_channel')
    .eq('active', true);
  return (data ?? []).map((f) => ({
    ...f,
    norm_names: [f.funder_name, ...(f.funder_aliases ?? [])].map(normalise),
  }));
}

function matchAllowlist(allowlist, provider) {
  if (!provider) return null;
  const np = normalise(provider);
  for (const f of allowlist) {
    if (f.norm_names.some((n) => n && (np === n || np.includes(n) || n.includes(np)))) {
      return f;
    }
  }
  return null;
}

async function loadProjectThemes() {
  const { data } = await supabase
    .from('act_grant_recommendation_projects')
    .select('project_code, theme_keywords')
    .eq('in_scope', true);
  const flat = new Set();
  for (const p of data ?? []) {
    for (const kw of p.theme_keywords ?? []) {
      if (kw && kw.length >= 4) flat.add(kw.toLowerCase());
    }
  }
  return Array.from(flat);
}

function actAlignmentScore(grant, themes) {
  let score = 0;
  const reasons = [];

  if (grant.aligned_projects?.some((p) => ACT_PROJECT_CODES.includes(p))) {
    score += 50;
    reasons.push('aligned_to_act_code');
  }

  const haystack = [
    ...(grant.focus_areas ?? []),
    ...(grant.categories ?? []),
    grant.name ?? '',
    grant.description ?? '',
  ].join(' ').toLowerCase();

  const hits = themes.filter((t) => haystack.includes(t));
  if (hits.length) {
    score += Math.min(50, hits.length * 10);
    reasons.push(`themes:${hits.slice(0, 5).join(',')}`);
  }
  return { score, reasons };
}

async function loadAlmaIndex() {
  const { data } = await supabase
    .from('alma_funding_opportunities')
    .select('id, name, funder_name');
  const idx = new Map();
  for (const row of data ?? []) {
    const k = `${normalise(row.name)}|${normalise(row.funder_name)}`;
    idx.set(k, row.id);
  }
  return idx;
}

async function run() {
  const runRow = await logStart(supabase, AGENT_ID, 'Promote grant_opportunities → alma');
  const runId = runRow?.id ?? null;
  const startedAt = Date.now();

  try {
    const [allowlist, themes, almaIndex] = await Promise.all([
      loadAllowlist(),
      loadProjectThemes(),
      loadAlmaIndex(),
    ]);
    console.log(`Loaded: ${allowlist.length} allowlisted funders, ${themes.length} theme keywords, ${almaIndex.size} existing alma rows`);

    // Pull open grants from the wider pipeline — paginate (PostgREST caps each page at 1000)
    const today = new Date().toISOString().slice(0, 10);
    const PAGE_SIZE = 1000;
    const grants = [];
    for (let offset = 0; offset < 10000; offset += PAGE_SIZE) {
      const { data: page, error } = await supabase
        .from('grant_opportunities')
        .select('id, name, description, amount_min, amount_max, deadline, closes_at, provider, program, aligned_projects, categories, focus_areas, application_status, url, eligibility_criteria')
        .eq('application_status', 'open')
        .or(`closes_at.is.null,closes_at.gte.${today}`)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      if (!page?.length) break;
      grants.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    console.log(`Candidates: ${grants.length} open grants in grant_opportunities`);

    let promoted = 0, skippedExisting = 0, skippedNotMatched = 0, skippedNoAlign = 0;
    const toInsert = [];

    for (const g of grants ?? []) {
      const allowMatch = matchAllowlist(allowlist, g.provider);
      const align = actAlignmentScore(g, themes);

      // Gate: must pass allowlist OR have ACT alignment via theme (configurable, default 15)
      if (!allowMatch && align.score < ALIGNMENT_THRESHOLD) {
        skippedNotMatched++;
        continue;
      }
      if (!allowMatch && !align.reasons.length) {
        skippedNoAlign++;
        continue;
      }

      const dedupeKey = `${normalise(g.name)}|${normalise(g.provider)}`;
      if (almaIndex.has(dedupeKey)) {
        skippedExisting++;
        continue;
      }

      const deadline = g.closes_at ? new Date(g.closes_at).toISOString() : null;
      const focus = g.focus_areas ?? g.categories ?? [];

      toInsert.push({
        name: g.name,
        description: g.description,
        funder_name: g.provider,
        source_type: 'philanthropy',
        status: 'open',
        deadline,
        min_grant_amount: g.amount_min ?? null,
        max_grant_amount: g.amount_max ?? null,
        is_national: g.aligned_projects?.includes('National') ?? null,
        focus_areas: focus,
        keywords: g.categories ?? [],
        source_url: g.url,
        application_url: g.url,
        scrape_source: 'promotion-from-grant_opportunities',
        // Promoted rows enter as 'unverified' on both axes. They DO NOT appear in
        // act_grant_recommendations until a human/agent classifies opportunity_type
        // (e.g., to 'open_grant') AND the verifier confirms URL is live.
        // This puts a human in the loop on "is this really a grant for us?"
        opportunity_type: 'unverified',
        verification_status: 'unverified',
        verification_notes: JSON.stringify({
          promoted_from: g.id,
          allowlist_match: allowMatch?.funder_name ?? null,
          alignment_score: align.score,
          reasons: align.reasons,
        }),
        raw_data: {
          grant_opportunity_id: g.id,
          original_provider: g.provider,
          original_program: g.program,
          eligibility_criteria: g.eligibility_criteria,
        },
      });

      if (toInsert.length >= LIMIT) break;
    }

    console.log(`To promote: ${toInsert.length} new opps (skipped ${skippedExisting} existing, ${skippedNotMatched + skippedNoAlign} non-ACT)`);

    if (!DRY_RUN && toInsert.length) {
      // Insert in batches of 50 to avoid payload limits
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error: insErr } = await supabase
          .from('alma_funding_opportunities')
          .insert(batch);
        if (insErr) {
          console.error(`Insert batch ${i / 50} failed:`, insErr.message);
        } else {
          promoted += batch.length;
        }
      }
    } else if (DRY_RUN) {
      // Preview first 10
      console.log('\nFirst 10 candidates:');
      for (const t of toInsert.slice(0, 10)) {
        console.log(`  ${t.funder_name?.slice(0,30).padEnd(30)} ${t.name.slice(0,70)}`);
      }
    }

    const summary = { promoted: DRY_RUN ? toInsert.length : promoted, skippedExisting, skippedNotMatched, skippedNoAlign, candidates: grants?.length ?? 0 };
    console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}Done in ${(Date.now() - startedAt) / 1000}s:`, summary);

    if (runId) {
      await logComplete(supabase, runId, {
        items_found: grants?.length ?? 0,
        items_new: summary.promoted,
        items_updated: 0,
        metadata: summary,
      });
    }
  } catch (err) {
    console.error('promote failed:', err);
    if (runId) await logFailed(supabase, runId, err);
    process.exit(1);
  }
}

run();

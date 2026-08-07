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

/** Single words that appear in a quarter to a third of the grant corpus on their
 *  own, so any two of them cleared the old 15-point threshold and let academic
 *  research rounds through (audit 2026-08-07: support 2,971 rows, research 2,747,
 *  community 2,525 of 9,536 candidates). The multi-word phrases that contain them
 *  — "community-led", "social procurement", "lived experience" — still score, and
 *  score higher, because those are the ones that actually discriminate. */
const GENERIC_THEME_WORDS = new Set([
  'support', 'research', 'public', 'foundation', 'strategy', 'community',
  'operations', 'sustainability', 'events', 'rights', 'seed', 'partner',
  'engagement', 'infrastructure', 'cultural', 'environment', 'intervention',
  'voice', 'arts', 'tour', 'teens', 'remote', 'rural', 'regional', 'civic',
]);

/** Academic research and individual scholarship rounds are 43% of the candidate
 *  pool (4,132 university/college providers) and ACT applies for none of them.
 *  They are excluded unless a specific multi-word ACT phrase matches. */
const SCHOLARLY_NAME = /\b(scholarship|fellowship|phd|postdoctoral|postdoc|honours|dissertation|thesis)\b/i;
const ACADEMIC_PROVIDER = /\b(universit|college|institute of technolog|school of medicine)/i;

function wordBoundaryHit(haystack, term) {
  // Substring matching turned "arts" into a hit on "parts"/"quarters" and made
  // every keyword far wider than intended. Match on word boundaries instead.
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
}

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

  const hits = themes.filter((t) => wordBoundaryHit(haystack, t));
  // A multi-word phrase ("palm island", "market garden", "narrative sovereignty")
  // names something specific; a bare generic word does not. Weight accordingly so
  // one real phrase clears the bar and a pile of generic words never does.
  const phraseHits = hits.filter((t) => /[ -]/.test(t));
  const wordHits = hits.filter((t) => !/[ -]/.test(t) && !GENERIC_THEME_WORDS.has(t));
  score += Math.min(50, phraseHits.length * 25 + wordHits.length * 10);
  if (phraseHits.length || wordHits.length) {
    reasons.push(`themes:${[...phraseHits, ...wordHits].slice(0, 5).join(',')}`);
  }

  // ACT does not apply for university research rounds or individual scholarships,
  // so a theme match on one is a false positive however specific it looks — an
  // RMIT zinc-ion battery grant matches "clean energy" and is still not ours.
  // Allowlisted funders bypass this upstream; partnership-shaped research reaches
  // ACT through a relationship, not the grant feed.
  const academic = ACADEMIC_PROVIDER.test(grant.provider ?? '') || SCHOLARLY_NAME.test(grant.name ?? '');
  if (academic) {
    return { score: 0, reasons: [], excluded: 'academic_or_scholarship' };
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
        // `application_status` tracks ACT's own application state, not whether the
        // round is live: 'not_applied' holds 4,087 of the 4,463 future-deadline
        // grants (92%), while 'open' holds only 372. Filtering on 'open' alone
        // starved the ACT feed to 18 opportunities (audit 2026-08-07).
        .in('application_status', ['open', 'not_applied', 'upcoming'])
        .or(`closes_at.is.null,closes_at.gte.${today}`)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      if (!page?.length) break;
      grants.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    console.log(`Candidates: ${grants.length} open grants in grant_opportunities`);

    let promoted = 0, skippedExisting = 0, skippedNotMatched = 0, skippedNoAlign = 0, skippedAcademic = 0, skippedNoFunder = 0;
    const toInsert = [];

    for (const g of grants ?? []) {
      // `alma_funding_opportunities.funder_name` is NOT NULL, and an opportunity
      // with no named funder cannot be verified or applied for anyway.
      if (!g.provider?.trim()) {
        skippedNoFunder++;
        continue;
      }
      const allowMatch = matchAllowlist(allowlist, g.provider);
      const align = actAlignmentScore(g, themes);

      if (!allowMatch && align.excluded === 'academic_or_scholarship') {
        skippedAcademic++;
        continue;
      }

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

      // Fall back to `deadline` when `closes_at` is absent — the feed quarantines
      // any row without timing, so a dropped date silently costs the opportunity.
      const rawDeadline = g.closes_at ?? g.deadline;
      const deadline = rawDeadline ? new Date(rawDeadline).toISOString() : null;
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
          // A batch insert is all-or-nothing, so one malformed row used to cost
          // the other 49. Retry the batch row-by-row and report only the losses.
          console.error(`Insert batch ${i / 50} failed (${insErr.message}) — retrying row-by-row`);
          for (const row of batch) {
            const { error: rowErr } = await supabase.from('alma_funding_opportunities').insert(row);
            if (rowErr) console.error(`  skipped "${row.name?.slice(0, 60)}": ${rowErr.message}`);
            else promoted += 1;
          }
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

    // The feed quarantines any row without timing, so report how many promoted
    // rows can actually reach `apply_now` rather than just how many were written.
    const withDeadline = toInsert.filter((t) => t.deadline).length;
    const summary = { promoted: DRY_RUN ? toInsert.length : promoted, withDeadline, skippedExisting, skippedNotMatched, skippedNoAlign, skippedAcademic, skippedNoFunder, candidates: grants?.length ?? 0 };
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

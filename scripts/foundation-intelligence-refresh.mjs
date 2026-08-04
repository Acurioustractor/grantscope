#!/usr/bin/env node

/**
 * Foundation Intelligence Refresh
 *
 * Finds high-value foundation evidence gaps and optionally seeds source_frontier
 * crawl targets for the next discovery pass.
 *
 * Usage:
 *   node --env-file=.env scripts/foundation-intelligence-refresh.mjs
 *   node --env-file=.env scripts/foundation-intelligence-refresh.mjs --apply --limit=80
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const LIMIT = Math.max(1, Number.parseInt(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '80', 10));
const MIN_GIVING = Math.max(0, Number.parseInt(process.argv.find((arg) => arg.startsWith('--min-giving='))?.split('=')[1] || '1000000', 10));

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(message) {
  console.log(`[foundation-intel] ${message}`);
}

function normalizeUrl(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function evidenceGaps(row) {
  const gaps = [];
  if (!row.website) gaps.push('website');
  if (Number(row.current_program_count) <= 0) gaps.push('current_programs');
  if (Number(row.application_pathway_count) <= 0) gaps.push('application_pathway');
  if (Number(row.board_roles) <= 0) gaps.push('governance');
  if (Number(row.verified_grants) <= 0) gaps.push('verified_grants');
  if (Number(row.year_memory_count) <= 0) gaps.push('year_memory');
  if (Number(row.verified_source_backed_count) <= 0) gaps.push('source_backed_memory');
  return gaps;
}

function reviewScore(row) {
  let score = 0;
  if (row.acnc_abn) score += 5;
  if (row.website) score += 5;
  if (Number(row.total_giving_annual) > 0) score += 5;
  if (row.enriched_at) score += 8;
  if (row.description) score += 5;
  if (Array.isArray(row.thematic_focus) && row.thematic_focus.length) score += 4;
  if (Array.isArray(row.geographic_focus) && row.geographic_focus.length) score += 3;
  if (Number(row.current_program_count) > 0) score += 8;
  if (Number(row.open_program_count) > 0) score += 3;
  if (Number(row.application_pathway_count) > 0) score += 4;
  if (Number(row.board_roles) > 0) score += 10;
  if (Number(row.verified_grants) > 0) score += 10;
  if (Number(row.year_memory_count) > 0) score += 8;
  if (Number(row.verified_source_backed_count) > 0) score += 8;
  if (Number(row.scraped_url_count) > 0) score += 4;
  return Math.max(0, Math.min(100, score));
}

async function loadCandidates() {
  const { data, error } = await db.rpc('exec_sql', {
    query: `WITH fg AS (
              SELECT foundation_id, COUNT(*)::int AS verified_grants, MAX(grant_year)::int AS latest_grant_year
              FROM foundation_grantees
              GROUP BY foundation_id
            ),
            board AS (
              SELECT COALESCE(NULLIF(company_abn, ''), company_name) AS foundation_key, COUNT(*)::int AS board_roles
              FROM person_roles
              WHERE cessation_date IS NULL
              GROUP BY COALESCE(NULLIF(company_abn, ''), company_name)
            ),
            programs AS (
              SELECT
                foundation_id,
                COUNT(*)::int AS current_program_count,
                COUNT(*) FILTER (WHERE status = 'open')::int AS open_program_count,
                COUNT(*) FILTER (
                  WHERE COALESCE(application_process, '') <> ''
                     OR COALESCE(application_mode, '') <> ''
                     OR url IS NOT NULL
                     OR COALESCE(cardinality(source_urls), 0) > 0
                )::int AS application_pathway_count,
                MAX(scraped_at) AS latest_program_scraped_at
              FROM foundation_programs
              WHERE status IN ('open', 'ongoing', 'closed')
              GROUP BY foundation_id
            ),
            yrs AS (
              SELECT
                foundation_id,
                COUNT(*)::int AS year_memory_count,
                COUNT(*) FILTER (
                  WHERE source_report_url IS NOT NULL
                     OR (
                       COALESCE(metadata->>'source', '') <> ''
                       AND COALESCE(metadata->>'source', '') NOT ILIKE '%inferred%'
                     )
                )::int AS verified_source_backed_count
              FROM foundation_program_years
              GROUP BY foundation_id
            )
            SELECT
              f.id::text,
              f.acnc_abn,
              f.name,
              f.type,
              f.website,
              f.description,
              f.total_giving_annual,
              f.thematic_focus,
              f.geographic_focus,
              f.enriched_at,
              COALESCE(cardinality(f.scraped_urls), 0)::int AS scraped_url_count,
              COALESCE(board.board_roles, 0)::int AS board_roles,
              COALESCE(fg.verified_grants, 0)::int AS verified_grants,
              fg.latest_grant_year,
              COALESCE(programs.current_program_count, 0)::int AS current_program_count,
              COALESCE(programs.open_program_count, 0)::int AS open_program_count,
              COALESCE(programs.application_pathway_count, 0)::int AS application_pathway_count,
              programs.latest_program_scraped_at,
              COALESCE(yrs.year_memory_count, 0)::int AS year_memory_count,
              COALESCE(yrs.verified_source_backed_count, 0)::int AS verified_source_backed_count
            FROM foundations f
            LEFT JOIN fg ON fg.foundation_id = f.id
            LEFT JOIN board ON board.foundation_key = COALESCE(NULLIF(f.acnc_abn, ''), f.name)
            LEFT JOIN programs ON programs.foundation_id = f.id
            LEFT JOIN yrs ON yrs.foundation_id = f.id
            WHERE COALESCE(f.total_giving_annual, 0) >= ${MIN_GIVING}
            ORDER BY
              ((COALESCE(board.board_roles, 0) > 0)::int
                + (COALESCE(fg.verified_grants, 0) > 0)::int
                + (COALESCE(programs.current_program_count, 0) > 0)::int
                + (COALESCE(programs.application_pathway_count, 0) > 0)::int
                + (COALESCE(yrs.verified_source_backed_count, 0) > 0)::int) ASC,
              f.total_giving_annual DESC NULLS LAST
            LIMIT ${LIMIT}`,
  });

  if (error) throw error;
  return data || [];
}

async function seedFrontier(row, gaps) {
  const targetUrl = normalizeUrl(row.website);
  if (!targetUrl) return { inserted: 0, skipped: 1 };

  const payload = {
    source_key: `foundation-intel:${row.id}:homepage`,
    source_kind: 'foundation_homepage',
    source_name: row.name,
    target_url: targetUrl,
    domain: domainFromUrl(targetUrl),
    parser_hint: 'foundation_intelligence_refresh',
    owning_agent_id: 'foundation-intelligence-refresh',
    discovery_source: 'foundation-intelligence-refresh',
    foundation_id: row.id,
    cadence_hours: 168,
    priority: Number(row.total_giving_annual) >= 10_000_000 ? 7 : 5,
    enabled: true,
    confidence: 'review_gap',
    metadata: {
      gaps,
      review_score: reviewScore(row),
      total_giving_annual: row.total_giving_annual,
      latest_grant_year: row.latest_grant_year,
      current_program_count: row.current_program_count,
      application_pathway_count: row.application_pathway_count,
    },
    next_check_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from('source_frontier')
    .upsert(payload, { onConflict: 'source_key' });

  if (error) throw error;
  return { inserted: 1, skipped: 0 };
}

async function main() {
  const run = await logStart(db, 'foundation-intelligence-refresh', 'Foundation Intelligence Refresh');
  try {
    const rows = await loadCandidates();
    const reviewed = rows.map((row) => ({
      ...row,
      review_score: reviewScore(row),
      gaps: evidenceGaps(row),
    }));

    const actionable = reviewed.filter((row) => row.website && row.gaps.length > 0);
    log(`${reviewed.length} candidates reviewed; ${actionable.length} have website-backed crawl targets`);
    for (const row of reviewed.slice(0, 12)) {
      log(`${row.review_score}/100 ${row.name} — ${row.gaps.slice(0, 4).join(', ') || 'no core gaps'}`);
    }

    let inserted = 0;
    let skipped = 0;
    if (APPLY) {
      for (const row of actionable) {
        const result = await seedFrontier(row, row.gaps);
        inserted += result.inserted;
        skipped += result.skipped;
      }
      log(`Seeded/updated ${inserted} source_frontier rows; skipped ${skipped}`);
    } else {
      log('Dry run only. Re-run with --apply to seed source_frontier.');
    }

    await logComplete(db, run.id, {
      items_found: reviewed.length,
      items_new: inserted,
      items_updated: APPLY ? inserted : 0,
    });
  } catch (error) {
    await logFailed(db, run.id, error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

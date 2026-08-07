#!/usr/bin/env node
/**
 * match-foundations-for-projects — the "find" agent for the philanthropy half
 * of the ACT Opportunity Engine.
 *
 * The grant side already self-populates: `act_grant_recommendations` (MV) is
 * refreshed nightly and renders in the /org pipeline kanban. The foundation
 * side had a matching pipeline table (`org_project_foundations`) + full CRUD
 * UI, but nothing FED it — every foundation match was added by hand. This
 * closes that asymmetry: it scores every foundation against each active ACT
 * project and lands the top fits into the existing pipeline as candidates
 * (`stage='saved'`, `engagement_status='researching'`) — awaiting human review.
 *
 * BOUNDARY (non-negotiable, per workflow.md): this agent FINDS and DRAFTS only.
 * It never approaches, emails, or sends. New rows land as "saved / researching"
 * so a human decides whether to approach. Night-shift, Tier 1-2.
 *
 * Usage:
 *   node --env-file=.env scripts/match-foundations-for-projects.mjs            # dry-run (default, Tier 1, no writes)
 *   node --env-file=.env scripts/match-foundations-for-projects.mjs --apply    # insert candidates (Tier 2/3 — explicit authorization)
 *   node --env-file=.env scripts/match-foundations-for-projects.mjs --limit=10 --min-score=65
 *
 * Scorer (0..100): theme overlap (55) + target-recipient overlap (15)
 *                + geography (20) + giving-scale signal (10). Must share >=1
 *                theme; faith-purpose funders excluded as noise.
 */
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'match-foundations-for-projects';
const ACT_ORG_PROFILE_ID = '8b6160a1-7eea-4bd2-8404-71c196381de0';

// ── CLI ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const PER_PROJECT_LIMIT = Number((argv.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || 8;
const MIN_SCORE = Number((argv.find(a => a.startsWith('--min-score=')) || '').split('=')[1]) || 60;

/**
 * Per-project match config. `themes` are the coarse `foundations.thematic_focus`
 * vocab (community/indigenous/youth/environment/arts/legal/social-enterprise/…)
 * that each project's fine-grained `theme_keywords` map to — the crosswalk that
 * bridges the two vocabularies. States are mapped to the `AU-<STATE>` tokens the
 * foundations table uses. Curated here for transparency; a later hardening pass
 * can move this into an `act_grant_recommendation_projects.foundation_themes`
 * column so it is DB-editable alongside `theme_keywords`.
 */
const CROSSWALK = [
  { code: 'ACT-JH', themes: ['youth', 'community', 'legal', 'human_rights', 'education'],   home: ['AU-QLD', 'AU-NT'], sec: ['AU-NSW', 'AU-VIC', 'AU-WA', 'AU-National'] },
  { code: 'ACT-PI', themes: ['indigenous', 'community', 'youth', 'arts'],                    home: ['AU-QLD'],          sec: ['AU-NT', 'AU-National'] },
  { code: 'ACT-GD', themes: ['indigenous', 'community', 'social-enterprise', 'employment'], home: ['AU-QLD', 'AU-NT'], sec: ['AU-NSW', 'AU-WA', 'AU-SA', 'AU-VIC'] },
  { code: 'ACT-HV', themes: ['environment', 'rural_remote', 'community', 'employment'],      home: ['AU-QLD'],          sec: ['AU-NSW', 'AU-National'] },
  { code: 'ACT-FM', themes: ['environment', 'rural_remote', 'community', 'employment', 'indigenous'], home: ['AU-QLD'], sec: ['AU-NSW', 'AU-National'] },
  { code: 'ACT-EL', themes: ['indigenous', 'arts', 'community', 'human_rights'],             home: ['AU-QLD', 'AU-NSW'], sec: ['AU-VIC', 'AU-National', 'AU-NT'] },
];

const sqlArr = (a) => `ARRAY[${a.map(s => `'${s.replace(/'/g, "''")}'`).join(',')}]`;
const ilikeArr = (a) => `ARRAY[${a.map(s => `'%${s.replace(/'/g, "''")}%'`).join(',')}]`;

/**
 * Values / off-mission exclusion (Ben's call, encoded so no future run re-litigates
 * it): funders filtered out even when they score high mechanically. Name-pattern
 * match (case-insensitive substring) because these are specific funders, not a
 * `thematic_focus` tag. Kept tight and named — add a peer here rather than rejecting
 * the same funder in the UI every nightly run.
 *
 * Two groups:
 *  - EXTRACTIVE: mining / fossil-fuel corporate foundations.
 *  - FAITH: faith-mission orgs that dodge the `religion` theme filter (they're tagged
 *    community/youth, not religion) but are off-mission noise for these projects.
 *    Specific observed names only — a broad faith-term regex would false-positive on
 *    legit secular community funders (e.g. some Uniting/Catholic community trusts).
 *
 * NOTE 1: Minderoo (Forrest/Fortescue-derived) is deliberately NOT here — borderline,
 *   left to human review in the /org pipeline, not auto-filtered.
 * NOTE 2: Aboriginal community benefit-trusts funded by mining royalties (WCCT,
 *   Groote Eylandt Aboriginal Trust, McArthur River Mine Community Benefits Trust)
 *   are NOT here — excluding indigenous community money is a distinct values call;
 *   they're also wrong-geography, so per-project parking handles them.
 */
const EXCLUDE_FUNDERS = [
  // extractive
  'BHP', 'Rio Tinto', 'Glencore', 'Adani', 'Woodside', 'Santos',
  'Fortescue', 'Whitehaven', 'Peabody', 'Yancoal',
  // faith-mission
  'WIZO', 'Human Appeal', 'Tzedek', 'Bodhicitta', 'Salvation Army', 'Art Of Living',
];

/**
 * The scorer, as a single reusable CTE chain. Both the dry-run SELECT and the
 * --apply INSERT read from the final `ranked` CTE, so the ranking logic has one
 * home. Ends after the `ranked` CTE (no trailing SELECT) so callers append theirs.
 */
function scorerCTE() {
  const rows = CROSSWALK.map(p =>
    `('${p.code}', ${sqlArr(p.themes)}, ${sqlArr(p.home)}, ${sqlArr(p.sec)})`
  ).join(',\n    ');
  return `
WITH proj AS (
  SELECT * FROM (VALUES
    ${rows}
  ) AS v(code, themes, home_geo, sec_geo)
),
scored AS (
  SELECT
    p.code, op.id AS org_project_id, f.id AS foundation_id, f.name AS foundation,
    ARRAY(SELECT unnest(f.thematic_focus) INTERSECT SELECT unnest(p.themes))      AS matched_themes,
    cardinality(ARRAY(SELECT unnest(f.thematic_focus) INTERSECT SELECT unnest(p.themes)))    AS theme_overlap,
    cardinality(ARRAY(SELECT unnest(f.target_recipients) INTERSECT SELECT unnest(p.themes))) AS target_overlap,
    (f.geographic_focus && p.home_geo)        AS home_match,
    ('AU-National' = ANY(f.geographic_focus)) AS national,
    (f.geographic_focus && p.sec_geo)         AS sec_match,
    -- total_giving_annual is a placeholder on 85% of the table (25,000 on 6,940
    -- rows, 100,000 on 1,474, 500,000 on 816 — only 958 real figures in 11,159).
    -- Carry the verified figure separately so nothing scores or asserts on a
    -- default. See docs/strategy/act-money-surface-audit-2026-08-07.md.
    CASE WHEN f.total_giving_annual NOT IN (25000, 100000, 500000)
         THEN f.total_giving_annual END AS verified_giving,
    ac.is_foundation AS confirmed_grantmaker,
    COALESCE(array_length(f.notable_grants, 1), 0) AS notable_grant_count,
    f.has_dgr,
    -- Evidence grade, not a confidence score. Only 6 of 5,190 themed grantmakers
    -- carry a verified giving figure, so gating on money would empty the queue.
    -- Grade instead on what is actually provable:
    --   A — notable_grants: named recipients, amounts, years. Proof they give.
    --   B — DGR endorsement or a verified giving figure. Proof they can give.
    --   C — theme and geography overlap only. A suggestion, never a desk record.
    CASE
      WHEN COALESCE(array_length(f.notable_grants, 1), 0) > 0 THEN 'A'
      WHEN f.has_dgr OR f.total_giving_annual NOT IN (25000, 100000, 500000) THEN 'B'
      ELSE 'C'
    END AS evidence_grade
  FROM proj p
  JOIN org_projects op ON op.code = p.code
  JOIN foundations f
    ON f.thematic_focus IS NOT NULL
   AND f.thematic_focus && p.themes
   AND NOT ('religion' = ANY(f.thematic_focus))   -- faith-purpose funders are noise for these projects
   AND NOT (f.name ILIKE ANY (${ilikeArr(EXCLUDE_FUNDERS)}))   -- extractive-industry funders (values exclusion)
  LEFT JOIN acnc_charities ac ON ac.abn = f.acnc_abn
  -- A program-delivering charity is not a grantmaker. Bravehearts scored 100
  -- against Empathy Ledger on theme overlap alone before this gate existed.
  WHERE ac.is_foundation IS TRUE
),
fit AS (
  SELECT s.*,
    ROUND(
      LEAST(theme_overlap,3)/3.0 * 55
      + LEAST(target_overlap,2)/2.0 * 15
      + CASE WHEN home_match THEN 20 WHEN national THEN 15 WHEN sec_match THEN 10 ELSE 0 END
      -- Only a real figure earns capacity points. A default earns nothing.
      + CASE WHEN verified_giving >= 50000 THEN 10 WHEN verified_giving > 0 THEN 5 ELSE 0 END
    )::int AS fit_score
  FROM scored s
),
deduped AS (
  -- One funder split across sub-regional trusts used to occupy several slots at
  -- identical scores (WCCT Southern/Northern/Central + Western Cape Communities
  -- Trust, all 100). Keep the best-scoring row per funder stem per project.
  SELECT fit.*,
    ROW_NUMBER() OVER (
      PARTITION BY fit.org_project_id,
        regexp_replace(
          regexp_replace(lower(fit.foundation),
            '\\m(the trustee for|the |ltd|limited|pty|inc|incorporated|foundation|trust|fund)\\M', '', 'g'),
          '\\m(northern|southern|central|eastern|western|sub-regional|regional)\\M', '', 'g')
      ORDER BY fit.evidence_grade, fit.fit_score DESC, fit.notable_grant_count DESC
    ) AS dupe_rn
  FROM fit
),
ranked AS (
  SELECT deduped.*,
    -- Evidence outranks fit. A grade-B funder that demonstrably gives beats a
    -- grade-C one that merely shares a theme tag, whatever the theme score says.
    ROW_NUMBER() OVER (
      PARTITION BY deduped.code
      ORDER BY deduped.evidence_grade, deduped.notable_grant_count DESC, deduped.fit_score DESC
    ) AS rn
  FROM deduped
  LEFT JOIN org_project_foundations existing
    ON existing.org_project_id = deduped.org_project_id AND existing.foundation_id = deduped.foundation_id
  WHERE existing.id IS NULL            -- never touch a foundation already in the pipeline (human-curated)
    AND deduped.dupe_rn = 1
    AND deduped.fit_score >= ${MIN_SCORE}
    -- Grade C stays out of the pipeline entirely. It is a suggestion, not a
    -- record, and writing suggestions as records is what left 1,005 rows at
    -- "saved" that nobody could trust enough to work.
    AND deduped.evidence_grade <> 'C'
)`;
}

function runSelect(supabase, sql) {
  return supabase.rpc('exec_sql', { query: sql });
}

async function dryRun(supabase) {
  const sql = `${scorerCTE()}
SELECT code, rn, fit_score, LEFT(foundation, 48) AS foundation,
       array_to_string(matched_themes, ',') AS themes,
       verified_giving::bigint AS giving, evidence_grade, notable_grant_count
FROM ranked WHERE rn <= ${PER_PROJECT_LIMIT}
ORDER BY code, rn`;                       // no trailing ';' — exec_sql wraps the query and rejects one
  const { data, error } = await runSelect(supabase, sql);
  if (error) throw new Error(`scorer failed: ${error.message}`);
  const rows = data || [];
  let lastCode = null;
  for (const r of rows) {
    if (r.code !== lastCode) { console.log(`\n${r.code}`); lastCode = r.code; }
    console.log(`  ${String(r.fit_score).padStart(3)}  ${String(r.foundation).padEnd(50)} [${r.evidence_grade}] [${r.themes}] ${r.giving == null ? "giving n/p" : "$" + Number(r.giving).toLocaleString()}`);
  }
  console.log(`\n${rows.length} candidate matches across ${new Set(rows.map(r => r.code)).size} projects (min-score ${MIN_SCORE}, top ${PER_PROJECT_LIMIT}/project).`);
  console.log('Dry-run only — no rows written. Re-run with --apply to land these as "saved / researching" in the pipeline.');
  return { candidates: rows.length };
}

async function apply(supabase) {
  const selectSql = `${scorerCTE()}
SELECT org_project_id::text, foundation_id::text, fit_score, matched_themes,
       home_match, national, sec_match, verified_giving, foundation,
       evidence_grade, notable_grant_count, has_dgr
FROM ranked WHERE rn <= ${PER_PROJECT_LIMIT}
ORDER BY code, rn`;
  const { data, error } = await runSelect(supabase, selectSql);
  if (error) throw new Error(`candidate selection failed: ${error.message}`);

  const candidates = data ?? [];
  if (candidates.length === 0) {
    console.log('No new foundation candidates met the threshold.');
    return { inserted: 0, candidates: 0 };
  }

  const payload = candidates.map((row) => {
    const geography = row.home_match
      ? 'home-state funder'
      : row.national
        ? 'national funder'
        : row.sec_match
          ? 'secondary-state funder'
          : null;
    // Only a verified figure is stated. Where the source carries a placeholder
    // the summary says so, rather than asserting an invented number as fact —
    // 276 of the 286 high-fit rows used to read "gives ~$500,000/yr" off a
    // default, which is why the queue was never trusted or worked.
    const giving = row.verified_giving == null ? null : Number(row.verified_giving);
    return {
      org_profile_id: ACT_ORG_PROFILE_ID,
      org_project_id: row.org_project_id,
      foundation_id: row.foundation_id,
      stage: 'saved',
      engagement_status: 'researching',
      fit_score: Number(row.fit_score ?? 0),
      fit_summary: [
        `[evidence ${row.evidence_grade}] themes: ${(row.matched_themes ?? []).join(', ')}`,
        geography,
        'ACNC-confirmed grantmaker',
        Number(row.notable_grant_count) > 0
          ? `${row.notable_grant_count} recorded grant${Number(row.notable_grant_count) === 1 ? '' : 's'} on file`
          : null,
        row.has_dgr ? 'DGR endorsed' : null,
        giving != null
          ? `gives $${Math.round(giving).toLocaleString('en-AU')}/yr`
          : 'annual giving not published',
      ].filter(Boolean).join(' · '),
      // Every promoted row arrives with the next move already on it. 19 of 1,063
      // rows carried one before this, which is most of why 1,005 sat at "saved".
      next_step: Number(row.notable_grant_count) > 0
        ? 'Read the recorded grants for pattern and size, then decide pursue or pass'
        : 'Confirm open rounds and giving size from the funder site before deciding',
    };
  });

  const { data: insertedRows, error: insertError } = await supabase
    .from('org_project_foundations')
    .upsert(payload, {
      onConflict: 'org_project_id,foundation_id',
      ignoreDuplicates: true,
    })
    .select('id');
  if (insertError) throw new Error(`candidate insert failed: ${insertError.message}`);
  const inserted = insertedRows?.length ?? 0;
  console.log(`Inserted ${inserted} new foundation candidates (stage=saved, status=researching) into org_project_foundations.`);
  console.log('These are now visible in the /org pipeline UI, awaiting human review. Nothing was sent.');
  return { inserted, candidates: candidates.length };
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const runRow = await logStart(supabase, AGENT_ID, 'Match foundations to ACT projects (philanthropy find agent)');
  console.log(`=== match-foundations-for-projects · ${new Date().toISOString()} · mode=${APPLY ? 'APPLY' : 'dry-run'} ===`);
  try {
    const stats = APPLY ? await apply(supabase) : await dryRun(supabase);
    if (runRow?.id) await logComplete(supabase, runRow.id, {
      items_found: stats.candidates ?? stats.inserted ?? 0,
      items_new: stats.inserted ?? 0,
    });
  } catch (err) {
    console.error('FAILED:', err.message);
    if (runRow?.id) await logFailed(supabase, runRow.id, err);
    process.exit(1);
  }
}

main();

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
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
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
 * Values-based exclusion (Ben's call, encoded so no future run re-litigates it):
 * extractive-industry corporate foundations are filtered out even when they score
 * high mechanically. Name-pattern match (case-insensitive substring) because these
 * are specific funders, not a `thematic_focus` tag. Kept tight and named — add a
 * peer here rather than rejecting the same funder in the UI every nightly run.
 * NOTE: Minderoo (Forrest/Fortescue-derived) is deliberately NOT here — it's a
 * borderline call left to human review in the /org pipeline, not auto-filtered.
 */
const EXCLUDE_FUNDERS = [
  'BHP', 'Rio Tinto', 'Glencore', 'Adani', 'Woodside', 'Santos',
  'Fortescue', 'Whitehaven', 'Peabody', 'Yancoal',
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
    f.total_giving_annual
  FROM proj p
  JOIN org_projects op ON op.code = p.code
  JOIN foundations f
    ON f.thematic_focus IS NOT NULL
   AND f.thematic_focus && p.themes
   AND NOT ('religion' = ANY(f.thematic_focus))   -- faith-purpose funders are noise for these projects
   AND NOT (f.name ILIKE ANY (${ilikeArr(EXCLUDE_FUNDERS)}))   -- extractive-industry funders (values exclusion)
),
fit AS (
  SELECT s.*,
    ROUND(
      LEAST(theme_overlap,3)/3.0 * 55
      + LEAST(target_overlap,2)/2.0 * 15
      + CASE WHEN home_match THEN 20 WHEN national THEN 15 WHEN sec_match THEN 10 ELSE 0 END
      + CASE WHEN total_giving_annual >= 50000 THEN 10 WHEN total_giving_annual > 0 THEN 5 ELSE 0 END
    )::int AS fit_score
  FROM scored s
),
ranked AS (
  SELECT fit.*,
    ROW_NUMBER() OVER (PARTITION BY fit.code ORDER BY fit.fit_score DESC, fit.total_giving_annual DESC NULLS LAST) AS rn
  FROM fit
  LEFT JOIN org_project_foundations existing
    ON existing.org_project_id = fit.org_project_id AND existing.foundation_id = fit.foundation_id
  WHERE existing.id IS NULL            -- never touch a foundation already in the pipeline (human-curated)
    AND fit.fit_score >= ${MIN_SCORE}
)`;
}

/** Human-readable "why" that doubles as agent provenance in fit_summary. */
const FIT_SUMMARY_SQL = `
  '[auto-matched] themes: ' || array_to_string(matched_themes, ', ')
  || CASE WHEN home_match THEN ' · home-state funder'
          WHEN national THEN ' · national funder'
          WHEN sec_match THEN ' · secondary-state funder' ELSE '' END
  || CASE WHEN total_giving_annual >= 50000
          THEN ' · gives ~$' || to_char(total_giving_annual, 'FM999,999,999') || '/yr' ELSE '' END`;

function runSelect(supabase, sql) {
  return supabase.rpc('exec_sql', { query: sql });
}

async function dryRun(supabase) {
  const sql = `${scorerCTE()}
SELECT code, rn, fit_score, LEFT(foundation, 48) AS foundation,
       array_to_string(matched_themes, ',') AS themes,
       COALESCE(total_giving_annual,0)::bigint AS giving
FROM ranked WHERE rn <= ${PER_PROJECT_LIMIT}
ORDER BY code, rn`;                       // no trailing ';' — exec_sql wraps the query and rejects one
  const { data, error } = await runSelect(supabase, sql);
  if (error) throw new Error(`scorer failed: ${error.message}`);
  const rows = data || [];
  let lastCode = null;
  for (const r of rows) {
    if (r.code !== lastCode) { console.log(`\n${r.code}`); lastCode = r.code; }
    console.log(`  ${String(r.fit_score).padStart(3)}  ${String(r.foundation).padEnd(50)} [${r.themes}] $${Number(r.giving).toLocaleString()}`);
  }
  console.log(`\n${rows.length} candidate matches across ${new Set(rows.map(r => r.code)).size} projects (min-score ${MIN_SCORE}, top ${PER_PROJECT_LIMIT}/project).`);
  console.log('Dry-run only — no rows written. Re-run with --apply to land these as "saved / researching" in the pipeline.');
  return { candidates: rows.length };
}

async function apply(supabase) {
  const dbPassword = process.env.DATABASE_PASSWORD;
  if (!dbPassword) throw new Error('DATABASE_PASSWORD not set — required for --apply (INSERT via psql).');
  const insertSql = `${scorerCTE()}
INSERT INTO org_project_foundations
  (org_profile_id, org_project_id, foundation_id, stage, engagement_status, fit_score, fit_summary)
SELECT '${ACT_ORG_PROFILE_ID}'::uuid, org_project_id, foundation_id,
       'saved', 'researching', fit_score, ${FIT_SUMMARY_SQL}
FROM ranked WHERE rn <= ${PER_PROJECT_LIMIT}
ON CONFLICT (org_project_id, foundation_id) DO NOTHING;`;
  const tmp = `/tmp/match-foundations-${AGENT_ID}.sql`;
  writeFileSync(tmp, insertSql);
  const out = execSync(
    `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -v ON_ERROR_STOP=1 -f ${tmp}`,
    { env: { ...process.env, PGPASSWORD: dbPassword }, encoding: 'utf8', timeout: 120000 }
  );
  const m = out.match(/INSERT 0 (\d+)/);
  const inserted = m ? Number(m[1]) : 0;
  console.log(`Inserted ${inserted} new foundation candidates (stage=saved, status=researching) into org_project_foundations.`);
  console.log('These are now visible in the /org pipeline UI, awaiting human review. Nothing was sent.');
  return { inserted };
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

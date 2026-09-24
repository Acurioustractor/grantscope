#!/usr/bin/env node
/**
 * Score every grant_opportunities row for the five non-Goods ACT projects
 * (justicehub, empathy-ledger, harvest, farm, contained). Goods has its own
 * scorer/script (scripts/score-goods-relevance.mjs) — untouched by this file.
 *
 * Writes:
 *   - project_relevance (jsonb, keyed by project — see the migration comment)
 *   - project_relevance_scored_at
 *   - aligned_projects: adds/removes ACT-JH/ACT-EL/ACT-HV/ACT-FM/ACT-CN per project threshold
 *
 * Usage:
 *   node --env-file=.env scripts/score-project-relevance.mjs              # incremental: only unscored
 *   node --env-file=.env scripts/score-project-relevance.mjs --rescore-all
 *   node --env-file=.env scripts/score-project-relevance.mjs --limit=500 --dry-run
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { scoreGrantForProject, applyProjectTags, PROJECT_CONFIGS, PROJECT_TAG_THRESHOLD } from './lib/project-relevance.mjs';
import { loadWrongProjectVerdicts, humanNoFor, enforceHumanVerdicts } from './lib/human-verdicts.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const args = process.argv.slice(2);
const RESCORE_ALL = args.includes('--rescore-all');
const DRY_RUN = args.includes('--dry-run');
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || 50_000;
const BATCH = 500;
const PROJECTS = Object.keys(PROJECT_CONFIGS);

function pickColumns(row) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    description: row.description,
    geography: row.geography,
    closes_at: row.closes_at,
    source: row.source,
    aligned_projects: row.aligned_projects || [],
    project_relevance: row.project_relevance || {},
  };
}

async function fetchBatch(offset) {
  let q = supabase
    .from('grant_opportunities')
    .select('id,name,provider,description,geography,closes_at,source,aligned_projects,project_relevance,project_relevance_scored_at')
    .order('id', { ascending: true })
    .range(offset, offset + BATCH - 1);
  if (!RESCORE_ALL) q = q.is('project_relevance_scored_at', null);
  const { data, error } = await q;
  if (error) throw new Error(`fetch: ${error.message}`);
  return data || [];
}

// Bulk update via psql: one round-trip per batch instead of one per row (CLAUDE.md:
// "Bulk SQL, not API loops" for 50+ rows). Same pattern as score-goods-relevance.mjs.
function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (Array.isArray(v)) {
    const parts = v.map((s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',');
    return `'{${parts.replace(/'/g, "''")}}'`;
  }
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function applyScoresPsql(scored) {
  const rows = scored.map((s) => [
    sqlLiteral(s.row.id),
    sqlLiteral(s.relevance),
    sqlLiteral(s.scoredAt),
    sqlLiteral(s.tagged),
  ]);
  const valuesClause = rows.map((r) => `(${r[0]}::uuid, ${r[1]}, ${r[2]}::timestamptz, ${r[3]}::text[])`).join(',\n');
  const sql = `
UPDATE grant_opportunities g SET
  project_relevance = v.relevance,
  project_relevance_scored_at = v.scored_at,
  aligned_projects = v.aligned_projects
FROM (VALUES
${valuesClause}
) AS v(id, relevance, scored_at, aligned_projects)
WHERE g.id = v.id;
`;
  const tmpFile = join(tmpdir(), `project-relevance-${process.pid}-${Date.now()}.sql`);
  writeFileSync(tmpFile, sql);
  try {
    execSync(
      `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f "${tmpFile}" --quiet`,
      { env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD }, stdio: ['ignore', 'ignore', 'pipe'] },
    );
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

async function applyScoresRest(scored) {
  const CONCURRENCY = 10;
  let i = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < scored.length) {
      const s = scored[i++];
      const { error } = await supabase
        .from('grant_opportunities')
        .update({ project_relevance: s.relevance, project_relevance_scored_at: s.scoredAt, aligned_projects: s.tagged })
        .eq('id', s.row.id);
      if (error) console.error(`  update ${s.row.id}: ${error.message.slice(0, 80)}`);
    }
  });
  await Promise.all(workers);
}

async function applyScores(scored) {
  if (scored.length === 0 || DRY_RUN) return;
  try {
    return await applyScoresPsql(scored);
  } catch (err) {
    console.log('  psql failed — falling back to REST for this batch:', String(err.message || err).slice(0, 120));
    return applyScoresRest(scored);
  }
}

async function main() {
  console.log('=== Score Project Relevance (non-Goods) ===');
  console.log(`  projects: ${PROJECTS.join(', ')}`);
  console.log(`  mode: ${RESCORE_ALL ? 'rescore-all' : 'incremental'}`);
  console.log(`  limit: ${LIMIT}`);
  console.log(`  dry-run: ${DRY_RUN}\n`);

  const run = !DRY_RUN ? await logStart(supabase, 'score-project-relevance', 'Score Project Relevance') : { id: null };
  // Ben's "not a fit" passes on the desk: those project tags stay off (lib/human-verdicts.mjs).
  const verdicts = await loadWrongProjectVerdicts(supabase);

  let totalScored = 0;
  const tagged = Object.fromEntries(PROJECTS.map((p) => [p, 0]));
  const tagsAdded = [];
  const tagsRemoved = [];
  let offset = 0;

  while (totalScored < LIMIT) {
    const batch = await fetchBatch(offset);
    if (batch.length === 0) break;

    const scoredAt = new Date().toISOString();
    const scored = batch.map((raw) => {
      const row = { ...pickColumns(raw), human_no: humanNoFor(verdicts, raw.id) };
      const results = {};
      for (const project of PROJECTS) {
        results[project] = scoreGrantForProject(project, row);
        if (results[project].score >= PROJECT_TAG_THRESHOLD) tagged[project]++;
      }
      const { tagged: newTags, changes, relevance } = applyProjectTags(row, results, scoredAt);
      for (const [project, change] of Object.entries(changes)) {
        if (change.change === 'added') tagsAdded.push(`${project}:${row.name}`);
        else tagsRemoved.push(`${project}:${row.name}`);
      }
      return { row, tagged: newTags, relevance, scoredAt };
    });

    await applyScores(scored);

    totalScored += batch.length;
    if (RESCORE_ALL || DRY_RUN) offset += BATCH;
    if (totalScored % 2000 === 0 || batch.length < BATCH) console.log(`  scored ${totalScored}`);
    if (batch.length < BATCH) break;
  }

  const enforced = await enforceHumanVerdicts(supabase, verdicts, { apply: !DRY_RUN });

  console.log('\n=== SUMMARY ===');
  console.log(`Rows processed: ${totalScored}`);
  console.log(`Human verdicts: ${verdicts.size} grants carry a "not a fit" pass; tags removed now: ${enforced.length}${enforced.length ? '  ' + enforced.slice(0, 10).join(' · ') : ''}`);
  for (const project of PROJECTS) console.log(`  ${project}: ${tagged[project]} tagged (score >= ${PROJECT_TAG_THRESHOLD})`);
  console.log(`Tags added:   ${tagsAdded.length}${tagsAdded.length ? '  ' + tagsAdded.slice(0, 10).join(' · ') : ''}`);
  console.log(`Tags removed: ${tagsRemoved.length}${tagsRemoved.length ? '  ' + tagsRemoved.slice(0, 10).join(' · ') : ''}`);

  if (!DRY_RUN && run.id) {
    await logComplete(supabase, run.id, { items_found: totalScored, items_new: tagsAdded.length, items_updated: totalScored });
  }
}

main().catch(async (err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

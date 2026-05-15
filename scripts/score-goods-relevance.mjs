#!/usr/bin/env node
/**
 * Score every grant_opportunities row for Goods/ACT-GD relevance.
 *
 * Writes:
 *   - goods_relevance_score (0-100)
 *   - goods_relevance_signals (jsonb explaining the math)
 *   - goods_relevance_scored_at
 *   - aligned_projects: adds 'ACT-GD' when score >= GOODS_TAG_THRESHOLD
 *
 * Usage:
 *   node --env-file=.env scripts/score-goods-relevance.mjs              # incremental: only unscored / stale
 *   node --env-file=.env scripts/score-goods-relevance.mjs --rescore-all
 *   node --env-file=.env scripts/score-goods-relevance.mjs --limit=500 --dry-run
 *   node --env-file=.env scripts/score-goods-relevance.mjs --source=grantconnect
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { scoreGrantForGoods, GOODS_TAG_THRESHOLD, GOODS_HIGH_FIT_THRESHOLD } from './lib/goods-relevance.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const args = process.argv.slice(2);
const RESCORE_ALL = args.includes('--rescore-all');
const DRY_RUN = args.includes('--dry-run');
const LIMIT = Number((args.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || 50_000;
const SOURCE = (args.find(a => a.startsWith('--source=')) || '').split('=')[1] || null;
const BATCH = 500;

function pickColumns(row) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    description: row.description,
    geography: row.geography,
    amount_max: row.amount_max,
    categories: row.categories,
    focus_areas: row.focus_areas,
    closes_at: row.closes_at,
    aligned_projects: row.aligned_projects || [],
    goods_relevance_score: row.goods_relevance_score,
  };
}

async function fetchBatch(offset) {
  let q = supabase
    .from('grant_opportunities')
    .select('id,name,provider,description,geography,amount_max,categories,focus_areas,closes_at,aligned_projects,goods_relevance_score,goods_relevance_scored_at,updated_at')
    .order('id', { ascending: true })
    .range(offset, offset + BATCH - 1);

  if (SOURCE) q = q.eq('source', SOURCE);
  if (!RESCORE_ALL) q = q.is('goods_relevance_scored_at', null);

  const { data, error } = await q;
  if (error) throw new Error(`fetch: ${error.message}`);
  return data || [];
}

// Bulk update via psql: one round-trip per batch instead of one per row.
// Builds an UPDATE ... FROM (VALUES ...) statement and pipes via stdin so the
// payload size is bounded by Postgres limits, not shell ARG_MAX.
function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    const parts = v.map(s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',');
    return `'{${parts.replace(/'/g, "''")}}'`;
  }
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function applyScoresPsql(scored) {
  const nowIso = new Date().toISOString();
  const rows = scored.map(s => {
    const tagged = new Set(s.row.aligned_projects || []);
    if (s.score >= GOODS_TAG_THRESHOLD) {
      tagged.add('ACT-GD');  // canonical finance/ledger tag
      tagged.add('goods');   // UI pile tag (matches /grants?pile=goods)
    } else {
      tagged.delete('ACT-GD');
      tagged.delete('goods');
    }
    return [
      sqlLiteral(s.row.id),
      sqlLiteral(s.score),
      sqlLiteral(s.signals),
      sqlLiteral(nowIso),
      sqlLiteral(Array.from(tagged)),
    ];
  });

  const valuesClause = rows.map(r => `(${r[0]}::uuid, ${r[1]}::int, ${r[2]}, ${r[3]}::timestamptz, ${r[4]}::text[])`).join(',\n');

  const sql = `
UPDATE grant_opportunities g SET
  goods_relevance_score = v.score,
  goods_relevance_signals = v.signals,
  goods_relevance_scored_at = v.scored_at,
  aligned_projects = v.aligned_projects
FROM (VALUES
${valuesClause}
) AS v(id, score, signals, scored_at, aligned_projects)
WHERE g.id = v.id;
`;

  const tmpFile = join(tmpdir(), `goods-score-${process.pid}-${Date.now()}.sql`);
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
  const nowIso = new Date().toISOString();
  const CONCURRENCY = 10;
  const queue = scored.map(s => {
    const tagged = new Set(s.row.aligned_projects || []);
    if (s.score >= GOODS_TAG_THRESHOLD) {
      tagged.add('ACT-GD');  // canonical finance/ledger tag
      tagged.add('goods');   // UI pile tag (matches /grants?pile=goods)
    } else {
      tagged.delete('ACT-GD');
      tagged.delete('goods');
    }
    return { id: s.row.id, score: s.score, signals: s.signals, tagged: Array.from(tagged) };
  });

  let i = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < queue.length) {
      const u = queue[i++];
      const { error } = await supabase.from('grant_opportunities').update({
        goods_relevance_score: u.score,
        goods_relevance_signals: u.signals,
        goods_relevance_scored_at: nowIso,
        aligned_projects: u.tagged,
      }).eq('id', u.id);
      if (error) console.error(`  update ${u.id}: ${error.message.slice(0, 80)}`);
    }
  });
  await Promise.all(workers);
}

const USE_REST = args.includes('--rest');

async function applyScores(scored) {
  if (scored.length === 0) return;
  if (USE_REST) return applyScoresRest(scored);
  try {
    return await applyScoresPsql(scored);
  } catch (err) {
    if (String(err.message || err).includes('CIRCUITBREAKER') || String(err.message || err).includes('authentication')) {
      console.log('  psql blocked (circuit breaker / auth) — falling back to REST for this batch');
      return applyScoresRest(scored);
    }
    throw err;
  }
}

async function main() {
  console.log('=== Score Goods Relevance ===');
  console.log(`  mode: ${RESCORE_ALL ? 'rescore-all' : 'incremental'}`);
  console.log(`  source filter: ${SOURCE || 'all'}`);
  console.log(`  limit: ${LIMIT}`);
  console.log(`  dry-run: ${DRY_RUN}\n`);

  const run = !DRY_RUN ? await logStart(supabase, 'score-goods-relevance', 'Score Goods Relevance') : { id: null };

  let totalScored = 0;
  let totalTagged = 0;
  let totalHighFit = 0;
  // When incremental (filter on IS NULL), the pool shrinks each batch so we keep
  // offset=0. For rescore-all the offset must advance to walk the whole table.
  let offset = 0;
  const histogram = { '0-19': 0, '20-39': 0, '40-49': 0, '50-69': 0, '70-100': 0 };

  while (totalScored < LIMIT) {
    const batch = await fetchBatch(offset);
    if (batch.length === 0) break;

    const scored = batch.map(row => {
      const result = scoreGrantForGoods(pickColumns(row));
      if (result.score >= GOODS_TAG_THRESHOLD) totalTagged++;
      if (result.score >= GOODS_HIGH_FIT_THRESHOLD) totalHighFit++;
      if (result.score < 20) histogram['0-19']++;
      else if (result.score < 40) histogram['20-39']++;
      else if (result.score < 50) histogram['40-49']++;
      else if (result.score < 70) histogram['50-69']++;
      else histogram['70-100']++;
      return { row, ...result };
    });

    if (!DRY_RUN) await applyScores(scored);

    totalScored += batch.length;
    if (RESCORE_ALL || DRY_RUN) offset += BATCH;
    // else: keep offset=0 — rows just scored fall out of the IS NULL filter

    if (totalScored % 2000 === 0 || batch.length < BATCH) {
      console.log(`  scored ${totalScored} | ACT-GD-tagged ${totalTagged} | high-fit ${totalHighFit}`);
    }
    if (batch.length < BATCH) break;
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total scored:    ${totalScored}`);
  console.log(`ACT-GD tagged:   ${totalTagged} (score >= ${GOODS_TAG_THRESHOLD})`);
  console.log(`High-fit:        ${totalHighFit} (score >= ${GOODS_HIGH_FIT_THRESHOLD})`);
  console.log('Distribution:');
  for (const [band, count] of Object.entries(histogram)) {
    const pct = totalScored ? ((count / totalScored) * 100).toFixed(1) : '0';
    console.log(`  ${band}: ${count.toString().padStart(6)} (${pct}%)`);
  }

  if (!DRY_RUN && run.id) {
    await logComplete(supabase, run.id, {
      items_found: totalScored,
      items_new: totalTagged,
      items_updated: totalScored,
    });
  }
}

main().catch(async err => {
  console.error('FATAL:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Read-only measurement: score every live grant_opportunities row against the
 * five non-Goods project scorers and report the hit distribution + top matches
 * per project, so a human can sanity-check before anything writes to the DB.
 *
 * Usage: node --env-file=.env scripts/measure-project-relevance.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { scoreGrantForProject, PROJECT_CONFIGS, PROJECT_TAG_THRESHOLD } from './lib/project-relevance.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function fetchAll() {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('grant_opportunities')
      .select("id,name,provider,description,geography,closes_at,status,source")
      .in('status', ['open', 'ongoing', 'upcoming'])
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function main() {
  const rows = await fetchAll();
  console.log(`Scored ${rows.length} live grants against ${Object.keys(PROJECT_CONFIGS).length} project scorers (threshold ${PROJECT_TAG_THRESHOLD})\n`);

  for (const project of Object.keys(PROJECT_CONFIGS)) {
    const scored = rows.map((r) => ({ row: r, ...scoreGrantForProject(project, r) })).sort((a, b) => b.score - a.score);
    const tagged = scored.filter((s) => s.score >= PROJECT_TAG_THRESHOLD);
    console.log(`=== ${project} === ${tagged.length} tagged / ${rows.length}`);
    for (const s of tagged.slice(0, 8)) {
      console.log(`  ${s.score.toString().padStart(3)}  ${s.row.name.slice(0, 70)}  [${s.signals.tier1_hits.join(', ')}]`);
    }
    console.log('');
  }
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

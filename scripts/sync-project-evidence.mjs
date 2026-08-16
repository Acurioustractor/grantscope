#!/usr/bin/env node
/**
 * Slice 9: mirror the wiki-side project-evidence declarations into CivicGraph.
 *
 * Reads (source of truth, both in act-global-infrastructure):
 *   config/project-codes.json     — the 74 canonical codes
 *   config/project-evidence.json  — code -> [clarity_object object_keys]
 * Writes:
 *   clarity_project_code          — all 74 codes + metadata + evidence arrays, PLUS enrichment:
 *     summary          — public one-liner from the studio's generated wiki content
 *                        (act-regenerative-studio/src/data/wiki-projects.generated.json)
 *     repo             — the code's declared primary codebase (wiki-side 'repos' map)
 *     repo_last_commit — MEASURED from git at sync time, never declared
 *   clarity_object.project_codes  — the same edge from the object end, for fast filtering
 *
 * VALIDATES AND REFUSES rather than skipping silently: an unknown code or an unknown object_key
 * in a declaration aborts the whole sync. A declaration that names a vanished table is a claim
 * that needs fixing at the source, not data to be quietly dropped — the zero-evidence report is
 * only worth reading if this mirror is exact.
 *
 * Usage: node --env-file=.env scripts/sync-project-evidence.mjs [--dry-run]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

const WIKI = process.env.ACT_INFRA_DIR ?? join(homedir(), 'Code', 'act-global-infrastructure');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function sqlLit(s) {
  return `'${s.replace(/'/g, "''")}'`;
}
function sqlArr(a) {
  return `ARRAY[${a.map(sqlLit).join(', ')}]::text[]`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const codes = JSON.parse(readFileSync(join(WIKI, 'config', 'project-codes.json'), 'utf8'));
  const evidence = JSON.parse(readFileSync(join(WIKI, 'config', 'project-evidence.json'), 'utf8'));
  const projects = codes.projects;
  const declarations = evidence.declarations;

  // Validate declarations against both ends.
  const badCodes = Object.keys(declarations).filter((c) => !projects[c]);
  if (badCodes.length) throw new Error(`declarations for unknown project codes: ${badCodes.join(', ')}`);

  const declaredKeys = [...new Set(Object.values(declarations).flat())];
  const known = new Set();
  for (let from = 0; from < declaredKeys.length; from += 200) {
    const chunk = declaredKeys.slice(from, from + 200);
    const { data, error } = await supabase
      .from('clarity_object')
      .select('object_key')
      .in('object_key', chunk);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) known.add(r.object_key);
  }
  const badKeys = declaredKeys.filter((k) => !known.has(k));
  if (badKeys.length) throw new Error(`declared objects not in the catalogue: ${badKeys.join(', ')}`);

  // Enrichment 1: public summaries from the studio's generated wiki content. Optional input —
  // a missing studio checkout degrades to no summaries, loudly, rather than failing the sync.
  const summaries = new Map();
  const studioPath = join(
    process.env.ACT_STUDIO_DIR ?? join(homedir(), 'Code', 'act-regenerative-studio'),
    'src', 'data', 'wiki-projects.generated.json',
  );
  try {
    const wikiProjects = JSON.parse(readFileSync(studioPath, 'utf8'));
    const entries = Array.isArray(wikiProjects) ? wikiProjects : Object.values(wikiProjects.projects ?? wikiProjects);
    for (const p of entries) {
      const code = p.canonicalCode ?? p.code;
      if (code && p.summary && !summaries.has(code)) summaries.set(code, String(p.summary));
    }
    console.log(`summaries: ${summaries.size} from studio wiki content`);
  } catch {
    console.log('WARNING: studio wiki-projects.generated.json unreadable — no summaries this sync.');
  }

  // Enrichment 2: declared repo + measured freshness. The declaration is wiki-side; the date is
  // measured here and now. A declared repo that is not on disk is an error (same refuse-not-skip
  // rule as object keys — a silent miss would render a living project dormant).
  const repoInfo = new Map();
  for (const [code, repoName] of Object.entries(evidence.repos ?? {})) {
    if (!projects[code]) throw new Error(`repos map names unknown project code: ${code}`);
    const repoDir = join(homedir(), 'Code', repoName);
    let date;
    try {
      date = execFileSync('git', ['-C', repoDir, 'log', '-1', '--format=%cs'], { encoding: 'utf8' }).trim();
    } catch {
      throw new Error(`declared repo for ${code} not found or not a git repo: ${repoDir}`);
    }
    repoInfo.set(code, { repo: repoName, lastCommit: date });
  }

  // object_key -> codes (the mirrored edge, from the object end)
  const byObject = new Map();
  for (const [code, keys] of Object.entries(declarations)) {
    for (const k of keys) {
      if (!byObject.has(k)) byObject.set(k, []);
      byObject.get(k).push(code);
    }
  }

  const stmts = [
    'BEGIN;',
    'DELETE FROM clarity_project_code;',
    ...Object.entries(projects).map(([code, p]) => {
      const ev = declarations[code] ?? [];
      const s = summaries.get(code);
      const r = repoInfo.get(code);
      return `INSERT INTO clarity_project_code (code, name, category, tier, status, evidence_object_keys, summary, repo, repo_last_commit) VALUES (${sqlLit(code)}, ${sqlLit(p.name)}, ${p.category ? sqlLit(p.category) : 'NULL'}, ${p.tier ? sqlLit(p.tier) : 'NULL'}, ${p.status ? sqlLit(p.status) : 'NULL'}, ${ev.length ? sqlArr(ev.sort()) : "'{}'::text[]"}, ${s ? sqlLit(s) : 'NULL'}, ${r ? sqlLit(r.repo) : 'NULL'}, ${r ? sqlLit(r.lastCommit) : 'NULL'});`;
    }),
    'UPDATE clarity_object SET project_codes = NULL WHERE project_codes IS NOT NULL;',
    ...[...byObject.entries()].map(
      ([k, cs]) => `UPDATE clarity_object SET project_codes = ${sqlArr(cs.sort())} WHERE object_key = ${sqlLit(k)};`,
    ),
    'COMMIT;',
  ];

  const sqlPath = join(mkdtempSync(join(tmpdir(), 'project-evidence-')), 'apply.sql');
  writeFileSync(sqlPath, stmts.join('\n'));
  const total = Object.keys(projects).length;
  const declared = Object.keys(declarations).length;
  console.log(`codes: ${total}, declared: ${declared}, ZERO EVIDENCE: ${total - declared}`);
  console.log(`objects carrying codes: ${byObject.size}`);
  console.log(`SQL: ${sqlPath}`);
  if (dryRun) return;

  const pw = process.env.DATABASE_PASSWORD;
  if (!pw) throw new Error('DATABASE_PASSWORD not set');
  execFileSync(
    'psql',
    ['-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432', '-U', 'postgres.tednluwflfhxyucgwigh', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', sqlPath],
    { env: { ...process.env, PGPASSWORD: pw }, stdio: 'inherit' },
  );
  console.log('synced.');
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

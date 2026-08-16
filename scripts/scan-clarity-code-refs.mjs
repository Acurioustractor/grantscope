#!/usr/bin/env node
/**
 * Clarity slice 6b: the code scanner.
 *
 * Populates clarity_code_ref (ref_class app/script/migration) and the refs_app / refs_script /
 * refs_migration counters on clarity_object — 0 on all 1,479 objects until this first ran, which
 * is why the object page renders them UNMEASURED and why the orphan detector (slice 7) is blocked:
 * without this, "nothing references it" would be claimed about 1,151 objects on the strength of an
 * unrun scanner.
 *
 * Method: whole-word ripgrep of every catalogued object name over three source sets in THIS repo —
 *   app        apps/web/src
 *   script     scripts
 *   migration  supabase/migrations + migrations
 * Functions are scanned by their bare name (the catalogue keys them by full signature).
 * Matching is deliberately GENEROUS (a name in a comment counts): the expensive failure is a
 * false orphan, so the scanner errs toward "used". refs_* = number of referencing files;
 * per-file hit counts live on clarity_code_ref.hits.
 *
 * Writes are bulk SQL applied via psql in one transaction: delete the three scanned classes,
 * insert fresh, recompute the three counters for ALL objects (so 0 now means measured-unused,
 * not unmeasured). db_function / trigger / view_lineage rows are never touched.
 *
 * Usage:
 *   node --env-file=.env scripts/scan-clarity-code-refs.mjs           # scan + apply
 *   node --env-file=.env scripts/scan-clarity-code-refs.mjs --dry-run # scan, write SQL, don't apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execFileSync, execSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
// Repo-aware since slice 8: the same database serves CivicGraph and JusticeHub, so ownership is
// measurable only if both codebases are scanned. clarity_code_ref.repo's CHECK constraint
// ('civicgraph'|'justicehub'|'database') anticipated exactly this. A missing JusticeHub checkout
// is skipped with a loud line, not an error — but then refs and owner proposals are
// CivicGraph-only and owner_app proposals must not be trusted from that run.
const REPOS = [
  {
    repo: 'civicgraph',
    root: REPO,
    sets: [
      { refClass: 'app', dirs: ['apps/web/src'] },
      { refClass: 'script', dirs: ['scripts'] },
      { refClass: 'migration', dirs: ['supabase/migrations', 'migrations'] },
    ],
  },
  {
    repo: 'justicehub',
    root: `${process.env.HOME}/Code/JusticeHub`,
    sets: [
      { refClass: 'app', dirs: ['src'] },
      { refClass: 'script', dirs: ['scripts'] },
      { refClass: 'migration', dirs: ['supabase/migrations'] },
    ],
  },
];
// Names this short are English words or SQL noise; a whole-word grep for them measures prose,
// not usage. They stay UNSCANNED (no row, counters recomputed to whatever real rows exist).
const MIN_NAME_LEN = 4;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function loadObjects() {
  const keys = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('clarity_object')
      .select('object_key')
      .order('object_key')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    keys.push(...data.map((r) => r.object_key));
    if (data.length < 1000) break;
  }
  return keys;
}

function bareName(objectKey) {
  return objectKey.includes('(') ? objectKey.slice(0, objectKey.indexOf('(')).trim() : objectKey;
}

function scan(names, root, dirs) {
  // One rg pass per source set: fixed-string whole-word alternation over every name.
  const patternFile = join(mkdtempSync(join(tmpdir(), 'clarity-scan-')), 'patterns.txt');
  writeFileSync(patternFile, [...names].join('\n'));
  const existing = dirs.filter((d) => {
    try {
      execSync(`test -d ${JSON.stringify(join(root, d))}`);
      return true;
    } catch {
      return false;
    }
  });
  if (!existing.length) return new Map();

  let out = '';
  try {
    out = execFileSync(
      'rg',
      // Generated Supabase type mirrors name EVERY table in the shared DB (JusticeHub's
      // database.types.ts alone matched 1,234 catalogued names) — that is the schema reflected
      // back at us, not usage. Excluded, or every object looks used by every repo.
      ['-oFw', '--no-heading', '--with-filename', '-g', '!**/database.types.ts', '-g', '!**/*.generated.*', '-f', patternFile, ...existing],
      { cwd: root, maxBuffer: 512 * 1024 * 1024, encoding: 'utf8' },
    );
  } catch (e) {
    if (e.status === 1) return new Map(); // rg exit 1 = no matches
    throw e;
  }

  // name -> file -> hits
  const tally = new Map();
  for (const line of out.split('\n')) {
    if (!line) continue;
    const sep = line.lastIndexOf(':');
    if (sep < 1) continue;
    const file = line.slice(0, sep);
    const name = line.slice(sep + 1);
    if (!tally.has(name)) tally.set(name, new Map());
    const files = tally.get(name);
    files.set(file, (files.get(file) ?? 0) + 1);
  }
  return tally;
}

function sqlLiteral(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const objectKeys = await loadObjects();
  const nameToKeys = new Map(); // bare name -> [object_key] (function overloads share a name)
  for (const key of objectKeys) {
    const name = bareName(key);
    if (name.length < MIN_NAME_LEN) continue;
    if (!nameToKeys.has(name)) nameToKeys.set(name, []);
    nameToKeys.get(name).push(key);
  }
  console.log(`objects: ${objectKeys.length}, scannable names: ${nameToKeys.size}`);

  const inserts = [];
  for (const { repo, root, sets } of REPOS) {
    let repoSeen = false;
    for (const { refClass, dirs } of sets) {
      const tally = scan(nameToKeys.keys(), root, dirs);
      let files = 0;
      for (const [name, fileHits] of tally) {
        for (const key of nameToKeys.get(name) ?? []) {
          for (const [file, hits] of fileHits) {
            inserts.push(
              `(${sqlLiteral(key)}, ${sqlLiteral(refClass)}, ${sqlLiteral(repo)}, ${sqlLiteral(file)}, ${hits}, now())`,
            );
            files += 1;
          }
        }
      }
      if (files > 0) repoSeen = true;
      console.log(`${repo}/${refClass}: ${tally.size} names referenced across ${files} file entries`);
    }
    if (!repoSeen && repo === 'justicehub') {
      console.log('WARNING: no JusticeHub matches — checkout missing? owner_app proposals from this run are one-eyed.');
    }
  }

  const batches = [];
  for (let i = 0; i < inserts.length; i += 500) {
    batches.push(
      `INSERT INTO clarity_code_ref (object_key, ref_class, repo, file_path, hits, scanned_at)\nVALUES\n${inserts.slice(i, i + 500).join(',\n')};`,
    );
  }
  const sql = `-- generated by scripts/scan-clarity-code-refs.mjs ${new Date().toISOString()}
BEGIN;
DELETE FROM clarity_code_ref WHERE ref_class IN ('app', 'script', 'migration');
${batches.join('\n')}
-- Recompute the three counters for ALL objects: after a scan, 0 is a measurement.
UPDATE clarity_object o SET
  refs_app = coalesce(r.app, 0),
  refs_script = coalesce(r.script, 0),
  refs_migration = coalesce(r.migration, 0)
FROM (
  SELECT ok.object_key,
    count(cr.id) FILTER (WHERE cr.ref_class = 'app') AS app,
    count(cr.id) FILTER (WHERE cr.ref_class = 'script') AS script,
    count(cr.id) FILTER (WHERE cr.ref_class = 'migration') AS migration
  FROM clarity_object ok
  LEFT JOIN clarity_code_ref cr ON cr.object_key = ok.object_key
    AND cr.ref_class IN ('app', 'script', 'migration')
  GROUP BY ok.object_key
) r
WHERE r.object_key = o.object_key;
COMMIT;
`;

  const sqlPath = join(mkdtempSync(join(tmpdir(), 'clarity-scan-')), 'apply.sql');
  writeFileSync(sqlPath, sql);
  console.log(`SQL written: ${sqlPath} (${inserts.length} ref rows)`);
  if (dryRun) return;

  const pw = process.env.DATABASE_PASSWORD;
  if (!pw) throw new Error('DATABASE_PASSWORD not set');
  execFileSync(
    'psql',
    ['-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432', '-U', 'postgres.tednluwflfhxyucgwigh', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', sqlPath],
    { env: { ...process.env, PGPASSWORD: pw }, stdio: 'inherit' },
  );
  console.log('applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

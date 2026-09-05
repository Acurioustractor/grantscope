#!/usr/bin/env node
/**
 * Does supabase/migrations/ agree with supabase_migrations.schema_migrations?
 *
 *   node --env-file=.env scripts/check-migration-parity.mjs
 *
 * Exit 1 and name the offenders when the tracker has a post-baseline version with no file here (applied via MCP
 * apply_migration or psql from another repo and never committed; the exact failure that left 313 orphans by
 * 2026-09-05). A file here that the tracker lacks is a PENDING draft awaiting Ben's verb: reported, exit 0, unless
 * --strict is passed (use --strict in CI on main, where nothing should sit unapplied for long).
 *
 * Pre-baseline tracker versions (< 20260905130000) are history and reported as a count only.
 * Uses the same exec_sql read path as scripts/gsql.mjs (service role).
 */
import { readdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BASELINE = '20260905130000';
const STRICT = process.argv.includes('--strict');
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env)'); process.exit(2); }

const files = readdirSync(new URL('../supabase/migrations/', import.meta.url))
  .filter((f) => /^\d{14}_.+\.sql$/.test(f));
const local = new Map(files.map((f) => [f.slice(0, 14), f]));

const sb = createClient(url, key);
const { data, error } = await sb.rpc('exec_sql', { query: 'SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version' });
if (error) { console.error('tracker read failed:', error.message); process.exit(2); }
const remote = new Map((data || []).map((r) => [r.version, r.name]));

const preBaseline = [...remote.keys()].filter((v) => v < BASELINE);
const remoteOnly = [...remote.keys()].filter((v) => v >= BASELINE && !local.has(v));
const localOnly = [...local.keys()].filter((v) => v >= BASELINE && !remote.has(v));

console.log(`tracker: ${remote.size} versions (${preBaseline.length} pre-baseline history) · folder: ${local.size} files`);
if (remoteOnly.length) {
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Migrations applied without a committed file::${remoteOnly.map((v) => `${v} ${remote.get(v)}`).join(', ')}`);
  console.log(`\n✗ ${remoteOnly.length} version(s) applied to the database with NO file in supabase/migrations/:`);
  for (const v of remoteOnly) console.log(`   ${v}  ${remote.get(v)}   ← commit the SQL here with this version, or it is lost`);
}
if (localOnly.length) {
  console.log(`\n${STRICT ? '✗' : '·'} ${localOnly.length} file(s) in supabase/migrations/ not yet applied (pending Ben's verb, or applied without db-apply.sh):`);
  for (const v of localOnly) console.log(`   ${local.get(v)}`);
  // In GitHub Actions, surface pending drafts as annotations so they are visible on the run without failing it.
  if (process.env.GITHUB_ACTIONS && !STRICT) console.log(`::warning title=Migration drafts pending::${localOnly.map((v) => local.get(v)).join(', ')} committed but not applied; apply with /db-apply`);
}
if (!remoteOnly.length && (!localOnly.length || !STRICT)) { console.log(localOnly.length ? '✓ parity: nothing applied is uncommitted (drafts pending)' : '✓ parity: folder and tracker agree on every post-baseline version'); process.exit(0); }
process.exit(1);

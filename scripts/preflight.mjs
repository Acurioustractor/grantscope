#!/usr/bin/env node
/**
 * preflight.mjs — Session health check for GrantScope
 *
 * Checks database connectivity, env vars, git status, and TypeScript health.
 * Run at the start of each session: node --env-file=.env scripts/preflight.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const args = process.argv.slice(2);
const shouldRefreshSchema = args.includes('--refresh');

function check(label, fn) {
  try {
    const result = fn();
    if (result instanceof Promise) return result.then(r => ({ label, ...r })).catch(e => ({ label, ok: false, detail: e.message }));
    return { label, ...result };
  } catch (e) {
    return { label, ok: false, detail: e.message };
  }
}

async function checkDb() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, detail: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' };

  const supabase = createClient(url, key);

  // Table count
  const { data: tables, error: tErr } = await supabase.rpc('exec_sql', {
    query: "SELECT COUNT(*) as cnt FROM pg_stat_user_tables WHERE schemaname = 'public'"
  });
  if (tErr) return { ok: false, detail: `DB query failed: ${tErr.message}` };
  const tableCount = tables?.[0]?.cnt || '?';

  // Entity count
  const { data: entities, error: eErr } = await supabase.rpc('exec_sql', {
    query: "SELECT COUNT(*) as cnt FROM gs_entities"
  });
  const entityCount = eErr ? '?' : (entities?.[0]?.cnt || '?');

  return { ok: true, detail: `${tableCount} tables, ${entityCount} entities` };
}

function checkEnv() {
  const required = ['DATABASE_PASSWORD', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const optional = ['ABN_LOOKUP_GUID', 'OPENAI_API_KEY', 'STRIPE_SECRET_KEY'];
  const missing = required.filter(k => !process.env[k]);
  const missingOpt = optional.filter(k => !process.env[k]);

  if (missing.length > 0) return { ok: false, detail: `Missing: ${missing.join(', ')}` };

  let detail = `${required.length} required present`;
  if (missingOpt.length > 0) detail += ` | optional missing: ${missingOpt.join(', ')}`;
  return { ok: true, detail };
}

function checkGit() {
  try {
    const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim();
    const lines = status ? status.split('\n') : [];
    const uncommitted = lines.length;

    const unpushed = execSync('git log @{u}..HEAD --oneline 2>/dev/null || echo ""', { cwd: ROOT, encoding: 'utf8' }).trim();
    const unpushedCount = unpushed ? unpushed.split('\n').length : 0;

    const branch = execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf8' }).trim();

    let detail = `branch: ${branch}`;
    if (uncommitted > 0) detail += ` | ${uncommitted} uncommitted`;
    if (unpushedCount > 0) detail += ` | ${unpushedCount} unpushed`;
    if (uncommitted === 0 && unpushedCount === 0) detail += ' | clean';

    return { ok: true, warn: uncommitted > 0 || unpushedCount > 0, detail };
  } catch (e) {
    return { ok: false, detail: e.message };
  }
}

function checkTsc() {
  try {
    execSync('npx tsc --noEmit', { cwd: `${ROOT}/apps/web`, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, detail: 'clean' };
  } catch (e) {
    const output = (e.stdout || '') + (e.stderr || '');
    const errorLines = output.split('\n').filter(l => l.includes('error TS'));
    return { ok: false, detail: `${errorLines.length} type error(s)` };
  }
}

function checkPort() {
  try {
    const result = execSync('lsof -i :3003 -t 2>/dev/null', { encoding: 'utf8' }).trim();
    return { ok: true, warn: true, detail: `port 3003 in use (PID ${result.split('\n')[0]})` };
  } catch {
    return { ok: true, detail: 'port 3003 available' };
  }
}

// Run all checks
console.log('\n  GrantScope Preflight Check\n');

const results = await Promise.all([
  check('Database', checkDb),
  Promise.resolve(check('Environment', checkEnv)),
  Promise.resolve(check('Git', checkGit)),
  Promise.resolve(check('Port 3003', checkPort)),
  check('TypeScript', checkTsc),
]);

let hasErrors = false;
for (const r of results) {
  const resolved = r instanceof Promise ? await r : r;
  const icon = resolved.ok ? (resolved.warn ? '⚠️' : '✅') : '❌';
  console.log(`  ${icon} ${resolved.label}: ${resolved.detail}`);
  if (!resolved.ok) hasErrors = true;
}

// Schema cache refresh
if (shouldRefreshSchema) {
  console.log('  Refreshing schema cache...');
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(url, key);

    const TABLES = [
      'gs_entities', 'gs_relationships', 'austender_contracts', 'justice_funding',
      'foundations', 'grant_opportunities', 'postcode_geo', 'org_profiles',
    ];

    const { data: schema } = await supabase.rpc('exec_sql', {
      query: `SELECT c.relname, a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod) as type,
              CASE WHEN a.attnotnull THEN 'NOT NULL' ELSE '' END as nullable
              FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              JOIN pg_attribute a ON a.attrelid = c.oid
              WHERE n.nspname = 'public' AND c.relname IN (${TABLES.map(t => `'${t}'`).join(',')})
              AND a.attnum > 0 AND NOT a.attisdropped
              ORDER BY c.relname, a.attnum`
    });

    const { data: counts } = await supabase.rpc('exec_sql', {
      query: `SELECT relname, n_live_tup FROM pg_stat_user_tables
              WHERE schemaname = 'public' AND relname IN (${TABLES.map(t => `'${t}'`).join(',')})
              ORDER BY n_live_tup DESC`
    });

    const countMap = Object.fromEntries((counts || []).map(r => [r.relname, r.n_live_tup]));
    const byTable = {};
    for (const row of (schema || [])) {
      if (!byTable[row.relname]) byTable[row.relname] = [];
      byTable[row.relname].push(row);
    }

    let md = `# GrantScope Schema Cache\n\nGenerated: ${new Date().toISOString().split('T')[0]}. Refresh with:\n\`\`\`bash\nnode --env-file=.env scripts/preflight.mjs --refresh\n\`\`\`\n`;

    for (const table of TABLES) {
      const rows = byTable[table] || [];
      const count = countMap[table] ? `${Math.round(countMap[table] / 1000)}K` : '—';
      md += `\n## ${table} (${count} rows)\n| Column | Type | Nullable |\n|--------|------|----------|\n`;
      for (const r of rows) {
        md += `| ${r.attname} | ${r.type} | ${r.nullable} |\n`;
      }
    }

    writeFileSync(`${ROOT}/data/schema-cache.md`, md);
    console.log(`  ✅ Schema cache: ${TABLES.length} tables written to data/schema-cache.md\n`);
  } catch (e) {
    console.log(`  ❌ Schema cache refresh failed: ${e.message}\n`);
  }
} else {
  console.log('');
}

process.exit(hasErrors ? 1 : 0);

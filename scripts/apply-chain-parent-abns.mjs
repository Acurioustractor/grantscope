#!/usr/bin/env node
/**
 * apply-chain-parent-abns.mjs
 *
 * Attaches parent-org ABNs to no-ABN social_enterprises rows that are
 * site-level shops of a known chain (Salvos, Vinnies, Red Cross, ...).
 *
 * The mapping lives in data/chain-parent-abns.json — every entry's ABN is
 * verified (ACNC register / ABR API / org website on the directory record)
 * before it goes in the file. This script just applies it.
 *
 * Matching rules (conservative):
 *   - row.abn IS NULL/empty
 *   - entry.pattern matches row.name (case-insensitive regex)
 *   - entry.state is null (national) or equals row.state
 *   - entry.postcodes, if present, must include row.postcode
 *   - if MORE than one entry matches a row -> conflict, skipped with warning
 *
 * Usage:
 *   node --env-file=.env scripts/apply-chain-parent-abns.mjs              # dry run
 *   node --env-file=.env scripts/apply-chain-parent-abns.mjs --state=SA   # dry run, one state
 *   node --env-file=.env scripts/apply-chain-parent-abns.mjs --apply      # write
 *
 * Writes abn + provenance into sources jsonb (abn_source='chain-parent-mapping',
 * abn_parent_name, abn_verified_via). Audit CSV always written to data/backups/.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const stateArg = (process.argv.find((a) => a.startsWith('--state=')) || '').split('=')[1] || null;
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
const AUDIT_FILE = `data/backups/${new Date().toISOString().slice(0, 10)}-chain-parent-abn-${APPLY ? 'applied' : 'dryrun'}.csv`;

if (!process.env.DATABASE_PASSWORD) {
  console.error('DATABASE_PASSWORD not set — run with --env-file=.env');
  process.exit(1);
}

// ---------- SQL runners (surface errors, unlike lib/psql.mjs) ----------

function runSql(query, { label = 'chain-abn' } = {}) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const sqlFile = `/tmp/${label}-${stamp}.sql`;
  const outFile = `/tmp/${label}-${stamp}.out`;
  writeFileSync(sqlFile, `SET statement_timeout = '120s';\n\\t on\n\\a\n\\o ${outFile}\nSELECT COALESCE(json_agg(t), '[]'::json) FROM (\n${query}\n) t;\n\\o\n`);
  try {
    execSync(`psql "${CONN}" -v ON_ERROR_STOP=1 -q -f ${sqlFile}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    const raw = readFileSync(outFile, 'utf-8').trim();
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    throw new Error(`psql failed: ${err.stderr || err.message}`);
  } finally {
    try { unlinkSync(sqlFile); } catch {}
    try { unlinkSync(outFile); } catch {}
  }
}

function runDml(statement, { label = 'chain-abn-dml' } = {}) {
  const sqlFile = `/tmp/${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.sql`;
  writeFileSync(sqlFile, `SET statement_timeout = '120s';\n${statement}`);
  try {
    const out = execSync(`psql "${CONN}" -v ON_ERROR_STOP=1 -f ${sqlFile}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    const m = out.match(/UPDATE (\d+)/g) || [];
    return m.reduce((sum, tag) => sum + Number(tag.slice(7)), 0);
  } catch (err) {
    throw new Error(`psql DML failed: ${err.stderr || err.message}`);
  } finally {
    try { unlinkSync(sqlFile); } catch {}
  }
}

const esc = (v) => String(v).replace(/'/g, "''");

// ---------- main ----------

const { entries } = JSON.parse(readFileSync('data/chain-parent-abns.json', 'utf-8'));
const compiled = entries.map((e) => ({ ...e, re: new RegExp(e.pattern, 'i') }));
console.log(`Loaded ${entries.length} chain entries. Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}${stateArg ? `, state=${stateArg}` : ''}\n`);

const rows = runSql(`
  SELECT id, name, state, postcode, source_primary
  FROM social_enterprises
  WHERE (abn IS NULL OR abn = '')
  ${stateArg ? `AND state = '${esc(stateArg)}'` : ''}
`);
console.log(`${rows.length} no-ABN rows in scope`);

const proposals = [];
const conflicts = [];
for (const row of rows) {
  const hits = compiled.filter(
    (e) =>
      e.re.test(row.name) &&
      (e.state === null || e.state === row.state) &&
      (!e.postcodes || e.postcodes.includes(row.postcode))
  );
  if (hits.length === 1) {
    proposals.push({ ...row, entry: hits[0] });
  } else if (hits.length > 1) {
    conflicts.push({ row, chains: hits.map((h) => h.chain) });
  }
}

if (conflicts.length) {
  console.log(`\n⚠ ${conflicts.length} rows matched MULTIPLE entries — skipped:`);
  conflicts.forEach((c) => console.log(`  ${c.row.name} (${c.row.state}) -> ${c.chains.join(' + ')}`));
}

console.log(`\n${proposals.length} proposals:\n`);
for (const p of proposals) {
  console.log(`  ${p.name} (${p.state} ${p.postcode || '—'}) -> ${p.entry.abn} ${p.entry.parent_name} [${p.entry.chain}]`);
}

// audit trail
const csv = [
  'id,name,state,postcode,source_primary,chain,abn,parent_name',
  ...proposals.map((p) =>
    [p.id, `"${p.name.replace(/"/g, '""')}"`, p.state, p.postcode || '', p.source_primary, p.entry.chain, p.entry.abn, `"${p.entry.parent_name}"`].join(',')
  ),
].join('\n');
writeFileSync(AUDIT_FILE, csv);
console.log(`\nAudit CSV: ${AUDIT_FILE}`);

if (!APPLY) {
  console.log('\nDry run — re-run with --apply to write.');
  process.exit(0);
}

let applied = 0;
for (let i = 0; i < proposals.length; i += 50) {
  const batch = proposals.slice(i, i + 50);
  const values = batch
    .map((p) => {
      const prov = {
        abn_source: 'chain-parent-mapping',
        abn_parent_name: p.entry.parent_name,
        abn_chain: p.entry.chain,
        abn_verified_via: p.entry.verified_via,
        abn_applied_at: new Date().toISOString(),
      };
      return `('${p.id}'::uuid, '${esc(p.entry.abn)}', '${esc(JSON.stringify(prov))}'::jsonb)`;
    })
    .join(',\n      ');
  applied += runDml(`
    UPDATE social_enterprises se
    SET abn = v.abn,
        sources = COALESCE(se.sources, '{}'::jsonb) || v.prov,
        updated_at = now()
    FROM (VALUES
      ${values}
    ) AS v(id, abn, prov)
    WHERE se.id = v.id AND (se.abn IS NULL OR se.abn = '');
  `);
}
console.log(`\nApplied ${applied} ABN updates.`);

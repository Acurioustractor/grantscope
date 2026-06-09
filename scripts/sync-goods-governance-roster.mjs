#!/usr/bin/env node
/**
 * sync-goods-governance-roster.mjs — Sync the Goods on Country governance roster
 * (The Butterfly Movement Ltd board) FROM the wiki INTO grantscope `org_contacts`.
 *
 * Source of truth: act-global-infrastructure/wiki/decisions/goods-governance-roster.md
 * Edit the wiki, run this; never retype the roster downstream.
 *
 * Run:    node --env-file=.env scripts/sync-goods-governance-roster.mjs
 * Apply:  node --env-file=.env scripts/sync-goods-governance-roster.mjs --apply
 *
 * These people are CO-OWNERS, not supporters. They are written as
 * contact_type='governance' (the structural separator from the supporter ladder)
 * and are NEVER laddered, scored, or funnelled. The sync NEVER fabricates: any
 * `confirm` placeholder in the wiki is treated as unknown (NULL / omitted).
 *
 * Idempotent: INSERT-WHERE-NOT-EXISTS + UPDATE, matched on
 * (org_profile_id, project_id, lower(name), contact_type='governance').
 * Additive only — it never deletes, so a person removed from the wiki stays until
 * pruned by hand (safest default for a tiny, high-stakes roster).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Verified IDs (CLAUDE.md / queried 2026-06-09).
const ORG_ID = '8b6160a1-7eea-4bd2-8404-71c196381de0'; // A Curious Tractor org_profile
const PROJECT_ID = '01359765-a88c-4ac2-8e4d-c40beb01c299'; // ACT-GD (Goods) — org_projects.id (FK target of org_contacts.project_id)
const ORGANISATION = 'The Butterfly Movement Ltd';

const ROSTER_PATH =
  process.env.GOODS_GOVERNANCE_ROSTER_PATH ||
  resolve(__dirname, '../../act-global-infrastructure/wiki/decisions/goods-governance-roster.md');

const OUT_SQL = resolve(__dirname, 'seed-goods-governance-roster.generated.sql');
const APPLY = process.argv.includes('--apply');
const PG_CONN =
  'host=aws-0-ap-southeast-2.pooler.supabase.com port=6543 user=postgres.tednluwflfhxyucgwigh dbname=postgres connect_timeout=10';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Double single quotes for safe SQL literal embedding (handles "O'Brien").
function sqlStr(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

// A `confirm` placeholder in the wiki means "not yet known" — never seed it as fact.
function clean(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^confirm\b/i.test(s)) return null; // "confirm", "confirm (surname to confirm)"
  return s;
}

/**
 * Parse the `## Roster` markdown table. Columns (fixed order):
 *   Name | Role | Status | Cultural authority and context | Person page | LinkedIn
 * Returns one object per data row. Tolerant of surrounding prose; only reads the
 * first pipe-table that follows the `## Roster` heading.
 */
function parseRoster(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^##\s+Roster\b/i.test(l));
  if (start === -1) throw new Error('No "## Roster" heading found in roster file.');

  const rows = [];
  let inTable = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const isTableRow = line.startsWith('|') && line.endsWith('|');
    if (!isTableRow) {
      if (inTable) break; // table ended
      continue; // still in the prose before the table
    }
    inTable = true;
    const cells = line.slice(1, -1).split('|').map((c) => c.trim());
    const first = cells[0]?.toLowerCase() ?? '';
    if (first === 'name') continue; // header row
    if (/^-+$/.test((cells[0] ?? '').replace(/\s/g, ''))) continue; // separator row
    const [name, role, status, cultural, , linkedin] = cells; // person-page col unused in DB
    if (!clean(name)) continue;
    rows.push({
      name: name.trim(),
      role: clean(role),
      status: clean(status),
      cultural: clean(cultural),
      linkedin: clean(linkedin),
    });
  }
  if (rows.length === 0) throw new Error('Roster table parsed to zero rows — refusing to emit.');
  return rows;
}

/**
 * Build the org_contacts.notes payload. Readable AND parseable by
 * goods-governance-shared.ts (parseGovernanceNotes). No em-dashes (ACT voice).
 */
function buildNotes(r) {
  const parts = [];
  parts.push(`Status: ${r.status || 'continuing'}`);
  if (r.cultural) parts.push(`Context: ${r.cultural}`);
  parts.push(
    'Co-owner of Goods governance (The Butterfly Movement Ltd board). Never laddered per OCAP. Synced from wiki/decisions/goods-governance-roster.md.',
  );
  return parts.join('\n');
}

async function main() {
  let md;
  try {
    md = readFileSync(ROSTER_PATH, 'utf8');
  } catch (e) {
    console.error(`FATAL: could not read roster at ${ROSTER_PATH}\n${e.message}`);
    process.exit(1);
  }

  const roster = parseRoster(md);

  const lines = [];
  lines.push('-- GENERATED by scripts/sync-goods-governance-roster.mjs — do not edit by hand.');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- Source: act-global-infrastructure/wiki/decisions/goods-governance-roster.md');
  lines.push('-- Idempotent + additive: INSERT-WHERE-NOT-EXISTS + UPDATE, matched on');
  lines.push("--   (org_profile_id, project_id, lower(name), contact_type='governance').");
  lines.push('-- These rows are CO-OWNERS (governance), never laddered. See the wiki roster.');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  for (const r of roster) {
    const name = sqlStr(r.name);
    const role = sqlStr(r.role);
    const org = sqlStr(ORGANISATION);
    const linkedin = sqlStr(r.linkedin);
    const notes = sqlStr(buildNotes(r));
    const match =
      `org_profile_id = '${ORG_ID}'::uuid AND project_id = '${PROJECT_ID}'::uuid ` +
      `AND lower(name) = lower(${name}) AND contact_type = 'governance'`;

    lines.push(`-- ${r.name}`);
    lines.push(
      `INSERT INTO org_contacts (id, org_profile_id, project_id, name, role, organisation, contact_type, linkedin_url, notes, created_at, updated_at)`,
    );
    lines.push(
      `SELECT gen_random_uuid(), '${ORG_ID}'::uuid, '${PROJECT_ID}'::uuid, ${name}, ${role}, ${org}, 'governance', ${linkedin}, ${notes}, now(), now()`,
    );
    lines.push(`WHERE NOT EXISTS (SELECT 1 FROM org_contacts WHERE ${match});`);
    lines.push(`UPDATE org_contacts SET`);
    lines.push(`  role = ${role}, organisation = ${org}, contact_type = 'governance',`);
    lines.push(`  linkedin_url = COALESCE(${linkedin}, linkedin_url), notes = ${notes}, updated_at = now()`);
    lines.push(`WHERE ${match};`);
    lines.push('');
  }

  lines.push('COMMIT;');
  lines.push('');
  writeFileSync(OUT_SQL, lines.join('\n'));

  console.log('Goods governance roster → org_contacts (SQL generated)');
  for (const r of roster) {
    console.log(`  ${r.name} [${r.role || 'role: confirm'}] — ${r.status || 'continuing'}`);
  }
  console.log(`Rows: ${roster.length}`);
  console.log(`SQL written: ${OUT_SQL}`);

  if (!APPLY) {
    console.log('\nDry-run (SQL only). Re-run with --apply to upsert into org_contacts.');
    return;
  }
  if (!process.env.DATABASE_PASSWORD) {
    console.error('FATAL: --apply needs DATABASE_PASSWORD to run psql.');
    process.exit(2);
  }

  // agent_runs logging is best-effort (no registry FK dependency): a logging
  // failure must not stop the seed from applying.
  let supabase = null;
  let run = null;
  if (SUPABASE_URL && SERVICE_KEY) {
    try {
      supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      run = await logStart(supabase, 'sync-goods-governance-roster', 'Sync Goods Governance Roster');
    } catch (e) {
      console.error(`WARN: agent_runs logStart failed (non-fatal): ${e.message}`);
    }
  }

  try {
    execFileSync('psql', [PG_CONN, '-v', 'ON_ERROR_STOP=1', '-q', '-f', OUT_SQL], {
      env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    if (supabase && run) {
      try {
        await logComplete(supabase, run.id, { items_found: roster.length, items_updated: roster.length });
      } catch (e) {
        console.error(`WARN: agent_runs logComplete failed (non-fatal): ${e.message}`);
      }
    }
    console.log(`\nApplied: ${roster.length} governance rows upserted into org_contacts.`);
  } catch (e) {
    if (supabase && run) {
      try { await logFailed(supabase, run.id, e); } catch { /* ignore */ }
    }
    console.error('FATAL (apply): psql failed:', e.message);
    process.exit(4);
  }
}

main().catch((e) => {
  console.error('FATAL (unexpected):', e.message);
  process.exit(3);
});

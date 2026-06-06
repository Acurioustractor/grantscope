#!/usr/bin/env node

/**
 * Entity Contact Enrichment v2 — set-based backfill of gs_entities contact
 * details from already-linked, already-held sources. Zero new ingestion.
 *
 * v1 (enrich-entity-contacts.mjs) loops supabase-js row-updates over ACNC /
 * contact_intelligence / ghl_contacts for email+phone. v2 is complementary
 * and set-based: it bulk-fills primarily WEBSITES (plus org-profile email and
 * phone) through psql in single UPDATE-from-join statements, because the
 * candidate volume (~100K fields) makes per-row API updates impractical
 * (supabase-js bulk UPDATE also silently fails >500 rows).
 *
 * The canonical graph is contact-poor (website ~10%, email ~1%, phone ~1%
 * as of 2026-06-06) while linked side-tables hold tens of thousands of
 * verified contact fields. This agent pushes them across, FILL-ONLY:
 * a field is written only where gs_entities currently has NULL — directory
 * data never overwrites better existing data (same rule as the community
 * bridge).
 *
 * Sources, in trust order (first writer wins via fill-only):
 *   1. organizations             — self-managed org profiles (gs_entity_id, 97% linked)
 *   2. ndis_registered_providers — NDIS regulator register (gs_entity_id, 100% linked)
 *   3. acnc_ais                  — ACNC annual statements, latest year ≥ 2022 (ABN join)
 *   4. acnc_programs             — ACNC program weblinks, 2023 (gs_entity_id, 100% linked)
 *
 * Quality gates (probed 2026-06-06): junk URL rate ≤1.5% per source; a
 * domain-shape regex filters the rest. URLs are normalised to https://.
 *
 * Safety: before any UPDATE, the pre-state of every row that will be touched
 * is snapshotted into _backup_entity_contacts_YYYYMMDD (id, website, email,
 * phone, contact_source, updated_at) — restore is a single UPDATE-from-join.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-entity-contacts-v2.mjs            # DRY RUN (counts only)
 *   node --env-file=.env scripts/enrich-entity-contacts-v2.mjs --apply
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PASSWORD = process.env.DATABASE_PASSWORD;
if (!SUPABASE_URL || !SUPABASE_KEY || !DB_PASSWORD) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_PASSWORD');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const db = createClient(SUPABASE_URL, SUPABASE_KEY); // agent_runs logging only
const log = (m) => console.log(`[enrich-contacts-v2] ${m}`);

const STAMP = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const BACKUP = `_backup_entity_contacts_${STAMP}`;

// Domain-shape gate + https normalisation, shared by every website source.
const URL_OK = `~* '^(https?://)?[a-z0-9.-]+\\.[a-z]{2,}'`;
const norm = (col) => `CASE WHEN ${col} ~* '^https?://' THEN TRIM(${col}) ELSE 'https://' || TRIM(${col}) END`;

// Each candidate set: one row per entity (eid), the value to fill (val), and
// which gs_entities column it fills. Trust order matters — fill-only means
// the first source to run claims the NULL.
const CANDIDATES = [
  {
    key: 'organizations.website', field: 'website', source: 'org-profile',
    sql: `SELECT DISTINCT ON (gs_entity_id) gs_entity_id AS eid, ${norm('website')} AS val
          FROM organizations
          WHERE gs_entity_id IS NOT NULL AND NULLIF(TRIM(website), '') IS NOT NULL
            AND website ${URL_OK} AND LENGTH(website) < 500 AND archived IS NOT TRUE
          ORDER BY gs_entity_id, updated_at DESC NULLS LAST`,
  },
  {
    key: 'organizations.email', field: 'email', source: 'org-profile',
    sql: `SELECT DISTINCT ON (gs_entity_id) gs_entity_id AS eid, LOWER(TRIM(COALESCE(NULLIF(TRIM(email), ''), NULLIF(TRIM(contact_email), '')))) AS val
          FROM organizations
          WHERE gs_entity_id IS NOT NULL AND archived IS NOT TRUE
            AND COALESCE(NULLIF(TRIM(email), ''), NULLIF(TRIM(contact_email), '')) ~* '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$'
          ORDER BY gs_entity_id, updated_at DESC NULLS LAST`,
  },
  {
    key: 'organizations.phone', field: 'phone', source: 'org-profile',
    sql: `SELECT DISTINCT ON (gs_entity_id) gs_entity_id AS eid, TRIM(phone) AS val
          FROM organizations
          WHERE gs_entity_id IS NOT NULL AND archived IS NOT TRUE
            AND NULLIF(TRIM(phone), '') IS NOT NULL AND LENGTH(TRIM(phone)) BETWEEN 8 AND 25
          ORDER BY gs_entity_id, updated_at DESC NULLS LAST`,
  },
  {
    key: 'ndis_registered_providers.website', field: 'website', source: 'ndis-register',
    sql: `SELECT DISTINCT ON (gs_entity_id) gs_entity_id AS eid, ${norm('website')} AS val
          FROM ndis_registered_providers
          WHERE gs_entity_id IS NOT NULL AND NULLIF(TRIM(website), '') IS NOT NULL
            AND website ${URL_OK} AND LENGTH(website) < 500
          ORDER BY gs_entity_id, report_date DESC`,
  },
  {
    key: 'acnc_ais.charity_website', field: 'website', source: 'acnc-ais',
    sql: `SELECT DISTINCT ON (e.id) e.id AS eid, ${norm('a.charity_website')} AS val
          FROM acnc_ais a JOIN gs_entities e ON e.abn = a.abn
          WHERE a.ais_year >= 2022 AND NULLIF(TRIM(a.charity_website), '') IS NOT NULL
            AND a.charity_website ${URL_OK} AND LENGTH(a.charity_website) < 500
          ORDER BY e.id, a.ais_year DESC`,
  },
  {
    key: 'acnc_programs.charity_weblink', field: 'website', source: 'acnc-programs',
    sql: `SELECT DISTINCT ON (gs_entity_id) gs_entity_id AS eid, ${norm('charity_weblink')} AS val
          FROM acnc_programs
          WHERE gs_entity_id IS NOT NULL AND NULLIF(TRIM(charity_weblink), '') IS NOT NULL
            AND charity_weblink ${URL_OK} AND LENGTH(charity_weblink) < 500
          ORDER BY gs_entity_id, report_year DESC`,
  },
];

function runPsql(sql) {
  const file = join(mkdtempSync(join(tmpdir(), 'enrich-')), 'batch.sql');
  writeFileSync(file, sql);
  const res = spawnSync('psql', [
    '-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432',
    '-U', 'postgres.tednluwflfhxyucgwigh', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '--no-psqlrc', '-qAt', '-f', file,
  ], { env: { ...process.env, PGPASSWORD: DB_PASSWORD }, encoding: 'utf8', timeout: 900_000 });
  if (res.status !== 0) throw new Error(`psql failed: ${(res.stderr || '').slice(0, 500)}`);
  return res.stdout.trim();
}

const SESSION = `SET statement_timeout = '600s';`;

function dryRunSql() {
  const counts = CANDIDATES.map(c => `
    SELECT '${c.key}' AS source, COUNT(*) AS would_fill
    FROM (${c.sql}) src JOIN gs_entities e ON e.id = src.eid
    WHERE e.${c.field} IS NULL AND src.val IS NOT NULL`);
  return `${SESSION}\n${counts.join('\nUNION ALL')};`;
}

function applySql() {
  const steps = CANDIDATES.map(c => `
    -- ${c.key}: snapshot pre-state of rows this step will touch (once per row)
    INSERT INTO ${BACKUP} (id, website, email, phone, contact_source, updated_at)
    SELECT e.id, e.website, e.email, e.phone, e.contact_source, e.updated_at
    FROM (${c.sql}) src JOIN gs_entities e ON e.id = src.eid
    WHERE e.${c.field} IS NULL AND src.val IS NOT NULL
    ON CONFLICT (id) DO NOTHING;

    WITH src AS (${c.sql})
    UPDATE gs_entities e
    SET ${c.field} = src.val,
        contact_source = COALESCE(e.contact_source, '${c.source}'),
        updated_at = now()
    FROM src
    WHERE e.id = src.eid AND e.${c.field} IS NULL AND src.val IS NOT NULL;`);
  return `${SESSION}
    DROP TABLE IF EXISTS ${BACKUP};
    CREATE TABLE ${BACKUP} (id uuid PRIMARY KEY, website text, email text, phone text, contact_source text, updated_at timestamptz);
    ${steps.join('\n')}`;
}

async function main() {
  const run = await logStart(db, 'enrich-entity-contacts-v2', 'Entity Contact Enrichment v2');
  try {
    log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

    log('Counting fill candidates per source (fill-only semantics)…');
    const dry = runPsql(dryRunSql());
    let totalWouldFill = 0;
    for (const line of dry.split('\n').filter(Boolean)) {
      const [key, n] = line.split('|');
      totalWouldFill += parseInt(n, 10);
      log(`  ${key.padEnd(36)} would fill ${n}`);
    }
    log(`  TOTAL fields that would be filled: ${totalWouldFill}`);

    if (!APPLY) {
      log(`Dry run only — re-run with --apply to write (snapshots pre-state into ${BACKUP})`);
      await logComplete(db, run.id, { items_found: totalWouldFill, items_new: 0, status: 'success' });
      return;
    }

    log(`Applying… (pre-state snapshot → ${BACKUP})`);
    runPsql(applySql());

    const after = runPsql(`${SESSION}
      SELECT COUNT(website) || '|' || COUNT(email) || '|' || COUNT(phone) FROM gs_entities;`);
    const [web, email, phone] = after.split('|');
    log(`gs_entities coverage now: website=${web} email=${email} phone=${phone}`);
    const backed = runPsql(`SELECT COUNT(*) FROM ${BACKUP};`);
    log(`rows snapshotted in ${BACKUP}: ${backed}`);

    await logComplete(db, run.id, { items_found: totalWouldFill, items_new: parseInt(backed, 10), status: 'success' });
  } catch (err) {
    log(`FATAL: ${err.message}`);
    await logFailed(db, run.id, err);
    process.exitCode = 1;
  }
}

main();

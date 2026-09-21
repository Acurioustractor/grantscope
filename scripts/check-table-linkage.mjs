#!/usr/bin/env node

/**
 * Guard against new tables that name organisations but cannot join to one.
 *
 * A table with a `funder_name` or `organization` column and no `abn`, `acn`,
 * `gs_id`, `gs_entity_id`, `entity_id` or `icn` holds organisations the graph
 * cannot see. Nothing stopped them being created: on 2026-09-22 there were 30.
 *
 *   node --env-file=.env scripts/check-table-linkage.mjs
 *   node --env-file=.env scripts/check-table-linkage.mjs --update-baseline
 *
 * Exits non-zero when a table appears that is not in the baseline. The baseline
 * itself does not fail, for the same reason as check-data-contradictions.mjs: a
 * check that is red the day it ships gets muted. What it stops is the list
 * growing.
 *
 * The baseline is a list of NAMES, not a count. With a count, dropping one old
 * table would let a new one in unnoticed.
 *
 * To clear a failure, either add a join key to the new table, or add it to
 * data/linkage-baseline.json under `exempt` with the reason it is not about
 * organisations the graph should know (a mailing list, a sync log).
 * Base tables only; views inherit their keys from what they read.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'

const BASELINE = 'data/linkage-baseline.json'

// Columns that name an organisation. Bare `name` is deliberately excluded: it
// is on tags, topics and agents, and matching it would make every new table fail.
const ORG = `'^(organisation|organization|operating_organi[sz]ation|canonical_name|((recipient|supplier|buyer|donor|entity|org|organisation|organization|company|charity|funder|grantee|provider|grantor|agency|employer|contractor|applicant)_name))$'`
// Anything the graph can join on. recipient_abn and supplier_abn count.
const KEY = `'(^|_)(abn|acn|gs_id|gs_entity_id|entity_id|icn)$'`

// A table counts as linked if it has a key column itself, or a foreign key to a
// table that does (fellows -> organizations is linked; organizations has abn).
// Key columns must not be boolean: requires_abn is a flag, not an identifier,
// and until 2026-09-22 it hid alma_funding_opportunities from this check.
const SQL = `
WITH cols AS (
  SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
   WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
),
keyed AS (
  SELECT DISTINCT table_name FROM cols
   WHERE column_name ~ ${KEY} AND data_type <> 'boolean'
),
via_fk AS (
  SELECT DISTINCT src.relname AS table_name
    FROM pg_constraint k
    JOIN pg_class src ON src.oid = k.conrelid
    JOIN pg_class dst ON dst.oid = k.confrelid
    JOIN pg_namespace n ON n.oid = src.relnamespace
   WHERE k.contype = 'f' AND n.nspname = 'public'
     AND dst.relname IN (SELECT table_name FROM keyed)
)
SELECT table_name FROM cols
 GROUP BY table_name
HAVING bool_or(column_name ~ ${ORG})
   AND table_name NOT IN (SELECT table_name FROM keyed)
   AND table_name NOT IN (SELECT table_name FROM via_fk)
 ORDER BY table_name`

const UPDATE = process.argv.includes('--update-baseline')

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'))
  } catch {
    return { accepted: [], exempt: {} }
  }
}

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required; nothing was checked')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data, error } = await sb.rpc('exec_sql', { query: SQL.trim() })
  if (error) {
    console.error(`✗ query failed — ${error.message}`)
    process.exit(2)
  }
  const found = (data ?? []).map((r) => r.table_name)
  // An empty answer from a database with hundreds of tables is a broken query,
  // not a clean schema. Refuse rather than pass.
  if (found.length === 0) {
    console.error('✗ query returned no tables; refusing to report a clean schema from an empty answer')
    process.exit(2)
  }

  const base = loadBaseline()
  const known = new Set([...(base.accepted ?? []), ...Object.keys(base.exempt ?? {})])
  const added = found.filter((t) => !known.has(t))
  const gone = [...known].filter((t) => !found.includes(t))

  if (UPDATE) {
    const exempt = base.exempt ?? {}
    const accepted = found.filter((t) => !(t in exempt))
    writeFileSync(BASELINE, JSON.stringify({ accepted, exempt }, null, 2) + '\n')
    console.log(`baseline written: ${accepted.length} accepted, ${Object.keys(exempt).length} exempt`)
    return
  }

  for (const t of gone) console.log(`✓ ${t}: now linked (a key column, a foreign key to a keyed table, or dropped)`)
  if (added.length) {
    for (const t of added) console.error(`✗ ${t}: names organisations, has no join key, not in the baseline`)
    console.error(`\n${added.length} new unlinked table(s). Add an abn/gs_entity_id column, or exempt it in ${BASELINE} with a reason.`)
    process.exit(1)
  }
  console.log(`· ${found.length} unlinked tables, all known (${known.size} in baseline)`)
}

run()

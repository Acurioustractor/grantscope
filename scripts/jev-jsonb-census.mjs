#!/usr/bin/env node

/**
 * Census what is actually INSIDE the database's jsonb columns.
 *
 * The column-level catalogue (scripts/jev-catalogue.mjs) measured jsonb as the
 * largest pool of free text in the database, ~215M tokens across 252 columns,
 * more than every plain text column combined, and then treated it only as
 * something to READ. That is the gap this closes.
 *
 * A jsonb column is not one field. It is a schema nobody declared. Until you
 * know its keys you cannot say whether it holds three enums worth promoting to
 * real columns or a megabyte of API exhaust worth nothing.
 *
 *   node --env-file=.env scripts/jev-jsonb-census.mjs
 *   node --env-file=.env scripts/jev-jsonb-census.mjs --sample 400 --min-rows 50
 *
 * Output: thoughts/shared/data-map/jsonb-census.md + .json
 *
 * ── Method and its limits ───────────────────────────────────────────────────
 *
 * Samples up to N non-null rows per column with an unordered LIMIT, which stops
 * the scan early rather than reading the table. So the key frequencies are from
 * whatever Postgres returns first, NOT a random sample. That is fine for "which
 * keys exist and what shape are they" and NOT fine for "what fraction of rows
 * have key X" on a table written in phases. The doc says so where it matters.
 *
 * Top-level keys only. Nested objects are reported as a type, not descended
 * into: one level answers the question that decides the next move.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const OUT_MD = 'thoughts/shared/data-map/jsonb-census.md'
const OUT_JSON = 'thoughts/shared/data-map/jsonb-census.json'

const argv = process.argv.slice(2)
const num = (flag, dflt) => Number(argv[argv.indexOf(flag) + 1]) || dflt
const SAMPLE = num('--sample', 200)
const MIN_ROWS = num('--min-rows', 100)
const KEYS_PER_COL = 30

/** Keys that are plumbing wherever they appear. */
const NEVER_KEY = /^(id|_id|uuid|url|href|link|created|updated|timestamp|ts|hash|etag|token|secret|signature|raw|html)$|_(id|at|url|hash)$/i

/**
 * Columns whose name says their contents are identifiers. Every key inside one
 * is a number or a code, whatever the value distribution suggests.
 *
 * From a false positive worth keeping: acnc_ais.association_numbers has keys
 * nsw, vic, qld... which looked like a 6-value enum and are state REGISTRATION
 * NUMBERS. Nothing about the values said so. The column name did.
 */
const ID_COLUMN = /(number|numbers|code|codes|ids|identifiers|reference|abn|acn)$/i

/**
 * A key worth a typed judgement: a string value long enough to carry meaning.
 * Short strings with few distinct values are already enums and want promoting
 * to a column, not classifying.
 *
 * Distinctness is a RATIO, not a count. The first version tested `distinct <=
 * 25` against a 50-row sample, where distinct can never exceed 50 — so the test
 * was always true and every key looked like an enum. A threshold has to be
 * relative to the sample that produced it.
 */
function classifyKey(k, colName) {
  if (NEVER_KEY.test(k.key)) return 'plumbing'
  if (ID_COLUMN.test(colName)) return 'plumbing'
  if (k.string_frac < 0.5) return 'not-text'
  if (k.avg_len >= 80) return 'prose'
  // Needs enough sample to say anything, and the values must actually repeat.
  if (k.n >= 30 && k.distinct / k.n <= 0.2 && k.distinct <= 25) return 'enum-in-hiding'
  if (k.n < 30) return 'too-few-rows'
  return 'short-text'
}

const listSql = (offset) => `
SELECT c.relname AS tbl, a.attname AS col, c.reltuples::bigint AS reltuples
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
JOIN pg_type t ON t.oid = a.atttypid
WHERE n.nspname = 'public' AND c.relkind = 'r' AND t.typname = 'jsonb'
  AND c.reltuples >= ${MIN_ROWS}
  AND c.relname NOT LIKE '%backup%'
ORDER BY c.reltuples DESC, c.relname, a.attname
LIMIT 500 OFFSET ${offset}
`

/**
 * jsonb_each fails on a non-object, so the sample is filtered to objects. A
 * column that is entirely arrays or scalars therefore returns no keys, which is
 * itself the answer and is recorded as such.
 *
 * TABLESAMPLE on anything big enough for it to matter. An unordered LIMIT
 * returns the first pages of the heap, which on a table written in ingest
 * phases means one batch: the first run reported
 * gs_relationships.properties.receipt_type as having ONE distinct value across
 * 200 rows. It has several. The sample was 200 rows of a single dataset, and a
 * cardinality read off it is fiction. Random pages, then take the sample from
 * those.
 */
const keysSql = (tbl, col, reltuples) => {
  // Aim at ~6x the sample so the LIMIT still has room after the null/object filter.
  const pct = reltuples > 20000 ? Math.min(100, Math.max(0.05, (SAMPLE * 6 * 100) / reltuples)) : null
  const from = pct ? `"${tbl}" TABLESAMPLE SYSTEM (${pct.toFixed(3)})` : `"${tbl}"`
  return `
WITH s AS (
  SELECT "${col}" AS j FROM ${from}
  WHERE "${col}" IS NOT NULL AND jsonb_typeof("${col}") = 'object'
  LIMIT ${SAMPLE}
)
SELECT e.key,
       count(*)::int AS n,
       count(DISTINCT left(e.value::text, 120))::int AS distinct,
       avg(length(e.value::text))::numeric(10,1) AS avg_len,
       (count(*) FILTER (WHERE jsonb_typeof(e.value) = 'string'))::numeric / count(*) AS string_frac
FROM s, LATERAL jsonb_each(s.j) AS e(key, value)
GROUP BY e.key
ORDER BY count(*) DESC
LIMIT ${KEYS_PER_COL}
`
}

async function q(sb, sql) {
  const { data, error } = await sb.rpc('exec_sql', { query: sql.trim() })
  if (error) throw new Error(error.message)
  return data || []
}

function render(cols) {
  const withKeys = cols.filter((c) => c.keys.length)
  const noKeys = cols.filter((c) => !c.keys.length && !c.error)
  const failed = cols.filter((c) => c.error)

  const prose = []
  const hidden = []
  for (const c of withKeys) {
    for (const k of c.keys) {
      if (k.kind === 'prose') prose.push({ ...k, tbl: c.tbl, col: c.col, reltuples: c.reltuples })
      if (k.kind === 'enum-in-hiding') hidden.push({ ...k, tbl: c.tbl, col: c.col, reltuples: c.reltuples })
    }
  }
  prose.sort((a, b) => b.reltuples * b.avg_len - a.reltuples * a.avg_len)
  hidden.sort((a, b) => b.reltuples - a.reltuples)

  const L = []
  L.push('# What is inside the jsonb')
  L.push('')
  L.push(`Generated by \`scripts/jev-jsonb-census.mjs\` on ${new Date().toISOString().slice(0, 10)}. Re-run it; do not hand-edit.`)
  L.push('')
  L.push('The column-level catalogue found jsonb to be the largest pool of free text in the database,')
  L.push('~215M tokens across 252 columns, more than every plain text column combined, and then only')
  L.push('ever treated it as something to read. A jsonb column is not one field, it is a schema nobody')
  L.push('declared. This says what is in them.')
  L.push('')
  L.push('## Summary')
  L.push('')
  L.push(`- **${cols.length} jsonb columns** sampled (tables with >= ${MIN_ROWS} rows).`)
  L.push(`- **${withKeys.length}** hold objects with readable top-level keys.`)
  L.push(`- **${noKeys.length}** hold no object at the top level (arrays or scalars), so there are no keys to promote.`)
  if (failed.length) L.push(`- **${failed.length}** could not be sampled; listed at the end with the reason.`)
  L.push(`- **${hidden.length} keys are enums in hiding**: short strings, few distinct values. These want promoting to real columns, not classifying. A model is the wrong tool.`)
  L.push(`- **${prose.length} keys hold prose**: a typed judgement could read them.`)
  L.push('')
  L.push('**A threshold has to be relative to its sample.** The first version of this script called a')
  L.push('key an enum when it had 25 or fewer distinct values, tested against a 50-row sample where')
  L.push('distinct can never exceed 50. Everything looked like an enum. Distinctness is now a ratio and')
  L.push('needs at least 30 sampled rows before it says anything.')
  L.push('')
  L.push('**Sampling.** Up to ' + SAMPLE + ' rows per column, drawn with `TABLESAMPLE SYSTEM` on any table')
  L.push('over 20,000 rows. The first run used an unordered `LIMIT`, which returns the first pages of')
  L.push('the heap: on a table written in ingest phases that is ONE batch. It reported')
  L.push('`gs_relationships.properties.receipt_type` as having a single distinct value across 200 rows.')
  L.push('It has several. A cardinality read off the first page of a phase-written table is fiction.')
  L.push('')
  L.push('Rows marked `fallback-unordered` in the JSON are small or sparse tables where TABLESAMPLE')
  L.push('returned nothing and the unordered form was used instead; treat their cardinalities with the')
  L.push('same suspicion.')
  L.push('')

  L.push('## Enums in hiding')
  L.push('')
  L.push('Short strings with few distinct values, buried in json where nothing can index or filter them.')
  L.push('**These are a migration, not a model.** Promote the key to a column and backfill it with SQL.')
  L.push('')
  L.push('| table | column | key | distinct | avg len | rows |')
  L.push('|---|---|---|---|---|---|')
  for (const k of hidden.slice(0, 45)) {
    L.push(`| \`${k.tbl}\` | \`${k.col}\` | \`${k.key}\` | ${k.distinct} | ${k.avg_len} | ${k.reltuples.toLocaleString()} |`)
  }
  L.push('')

  L.push('## Prose buried in json')
  L.push('')
  L.push('Long string values a typed judgement could read. Ranked by rows x length, i.e. by how much')
  L.push('text is actually there.')
  L.push('')
  L.push('| table | column | key | avg len | rows |')
  L.push('|---|---|---|---|---|')
  for (const k of prose.slice(0, 45)) {
    L.push(`| \`${k.tbl}\` | \`${k.col}\` | \`${k.key}\` | ${k.avg_len} | ${k.reltuples.toLocaleString()} |`)
  }
  L.push('')

  if (noKeys.length) {
    L.push('## No top-level object')
    L.push('')
    L.push('Arrays or scalars. Nothing to promote without descending, which this census does not do.')
    L.push('')
    L.push(noKeys.map((c) => `\`${c.tbl}.${c.col}\``).join(' · '))
    L.push('')
  }
  if (failed.length) {
    L.push('## Could not sample')
    L.push('')
    for (const c of failed) L.push(`- \`${c.tbl}.${c.col}\` — ${c.error}`)
    L.push('')
  }
  return L.join('\n')
}

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  const sb = createClient(url, key)

  const targets = []
  for (let offset = 0; ; offset += 500) {
    const page = await q(sb, listSql(offset))
    targets.push(...page)
    if (page.length < 500) break
  }
  console.log(`jsonb columns to sample: ${targets.length}`)

  const cols = []
  let done = 0
  for (const t of targets) {
    const entry = { tbl: t.tbl, col: t.col, reltuples: Number(t.reltuples), keys: [], error: null }
    try {
      let rows = await q(sb, keysSql(t.tbl, t.col, Number(t.reltuples)))
      // TABLESAMPLE can return nothing on a small or sparsely-populated table.
      // Fall back rather than silently reporting "no keys", which would read as
      // a finding.
      if (!rows.length && Number(t.reltuples) > 20000) {
        entry.sampling = 'fallback-unordered'
        rows = await q(sb, keysSql(t.tbl, t.col, 0))
      }
      entry.keys = rows
        .map((r) => ({
          key: r.key,
          n: Number(r.n),
          distinct: Number(r.distinct),
          avg_len: Number(r.avg_len),
          string_frac: Number(r.string_frac),
        }))
        .map((k) => ({ ...k, kind: classifyKey(k, t.col) }))
        .filter((k) => k.kind !== 'plumbing')
    } catch (e) {
      entry.error = e.message.slice(0, 160)
    }
    cols.push(entry)
    if (++done % 25 === 0) console.log(`  ${done}/${targets.length}`)
  }

  mkdirSync(dirname(OUT_MD), { recursive: true })
  writeFileSync(OUT_MD, render(cols))
  writeFileSync(OUT_JSON, JSON.stringify({ generated_at: new Date().toISOString(), sample: SAMPLE, min_rows: MIN_ROWS, cols }, null, 2))

  const hidden = cols.flatMap((c) => c.keys.filter((k) => k.kind === 'enum-in-hiding'))
  const prose = cols.flatMap((c) => c.keys.filter((k) => k.kind === 'prose'))
  console.log(`\nsampled:          ${cols.length}`)
  console.log(`with keys:        ${cols.filter((c) => c.keys.length).length}`)
  console.log(`failed:           ${cols.filter((c) => c.error).length}`)
  console.log(`enums in hiding:  ${hidden.length}`)
  console.log(`prose keys:       ${prose.length}`)
  console.log(`\nwrote ${OUT_MD}`)
}

run().catch((e) => {
  console.error(e.message)
  process.exit(1)
})

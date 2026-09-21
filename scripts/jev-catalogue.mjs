#!/usr/bin/env node

/**
 * Catalogue every place in the database where a typed semantic judgement could
 * turn unstructured text into a queryable field.
 *
 * The method (Ben, 2026-09-21): use a typed classifier as the cheap,
 * high-volume layer over free text; act automatically only above a high
 * confidence; escalate the middle band; keep arithmetic and exact matching in
 * normal code.
 *
 * This script finds the WORK. It runs no model and writes nothing to any table.
 *
 * It reads pg_stats, which ANALYZE already maintains, so the whole 724-table
 * census costs one query and scans nothing. That matters: the naive version of
 * this — count(*) with a NULL filter per column — would be thousands of full
 * scans over 52M rows.
 *
 *   node --env-file=.env scripts/jev-catalogue.mjs            # write the catalogue
 *   node --env-file=.env scripts/jev-catalogue.mjs --min-rows 1000
 *
 * Output: thoughts/shared/data-map/jev-catalogue.md + .json
 *
 * ── The trap this script cannot see, and you must ───────────────────────────
 *
 * A null is not automatically a gap. gs_entities.sector is null on 428,449
 * rows, which reads as the biggest opportunity in the database until you split
 * it by entity_type: 240,584 of those are PEOPLE, and a person has no sector.
 * The real gap is 185,504 organisations. The script reports a
 * `needs_scoping` flag on every candidate for exactly this reason. Do the split
 * before quoting a number to anyone.
 *
 * Structurally-null columns look identical to unfilled ones in pg_stats.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const OUT_MD = 'thoughts/shared/data-map/jev-catalogue.md'
const OUT_JSON = 'thoughts/shared/data-map/jev-catalogue.json'

/** $ per million input tokens. Output is free on this model. */
const COST_PER_M_INPUT = 0.042
/** Rough chars-per-token for English prose. */
const CHARS_PER_TOKEN = 4

const argv = process.argv.slice(2)
const MIN_ROWS = Number(argv[argv.indexOf('--min-rows') + 1]) || 500

/**
 * A column is a TARGET (something a judgement could fill) when it holds a small
 * closed set of values and is mostly empty. n_distinct > 0 is an absolute
 * count of distinct values; a small one means an enum in all but name.
 */
function isTarget(col) {
  const closedSet = col.n_distinct > 1 && col.n_distinct <= 60
  const mostlyEmpty = col.null_frac >= 0.25
  return closedSet && mostlyEmpty
}

/**
 * A taxonomy too large to be one Choice, but still a closed set.
 *
 * gs_entities.sector is the case that forced this: 182 distinct values and 70%
 * null, which is the single largest gap in the database and was being dropped
 * silently by the 60-option cap above. 182 options in one call is not a
 * question anyone can answer well; it needs a two-stage design (a coarse
 * top-level choice, then a second call inside the chosen branch).
 *
 * Listed separately so the size difference is a design decision, not an
 * accident of a threshold.
 */
function isLargeTaxonomy(col) {
  return col.n_distinct > 60 && col.n_distinct <= 600 && col.null_frac >= 0.25
}

/**
 * A column is a SOURCE (text worth reading) when it is wide enough to carry
 * meaning and mostly unique. n_distinct < 0 is a NEGATIVE RATIO of distinct
 * values to row count, so -1 means every value is unique: free text.
 */
function isSource(col) {
  const isProse = col.avg_width >= 40
  const mostlyUnique = col.n_distinct < 0 || col.n_distinct > 1000
  const mostlyPresent = col.null_frac < 0.75
  return isProse && mostlyUnique && mostlyPresent
}

/** Columns that are never a semantic judgement, whatever the stats say. */
const NEVER = new RegExp([
  // identity, provenance, plumbing
  '^id$', '_id$', '_at$', '_by$', 'url', 'uuid', 'hash', 'token', 'key$', 'email', 'phone',
  'slug', 'path', 'version', '_source$', '_model$', 'confidence',
  // arithmetic and dates: out of scope by the classifier's own limits
  'count$', 'amount', 'total', 'score$', '^year$', '_year$', 'date', '_band$', 'avg_',
  // exact identifiers
  'abn', 'acn', 'postcode', 'asx_code', 'lat$', 'lng$', 'longitude', 'latitude',
  // operational state, not judgement
  '_status$', 'error', 'utm_', 'referrer',
  // DERIVED BY JOIN, not by reading text. remoteness, seifa and lga come from
  // postcode_geo; asking a model for them would fabricate what a join already
  // knows, and the 2026-08 place work exists precisely because getting these
  // confidently wrong is worse than leaving them null.
  'remoteness', 'seifa', '^state$', 'lga_', '_tier$',
].join('|'), 'i')

/**
 * Names that read as a genuine semantic judgement: something a knowledgeable
 * person could answer by reading the row's text. Everything else that survives
 * NEVER is listed as "review" rather than proposed outright, because a column
 * name is a weak signal and this script cannot see intent.
 */
const SEMANTIC = /(_type$|_category$|^category$|topic|sector|sentiment|accepts_|eligib|requires|_relevance|dgr|purpose|theme|audience|is_[a-z]+$)/i

function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  return { url, key }
}

/**
 * Paginated on purpose. The census is ~3,700 rows across ~198 tables, and the
 * unpaginated form came back with exactly the first page and no error — 43
 * tables, which reads as a finished answer. A truncation that looks like a
 * result is the failure mode this whole catalogue exists to find, so it would
 * have been a poor one to ship inside it.
 */
const PAGE = 800

const sqlPage = (offset) => `
SELECT s.tablename, s.attname, s.null_frac::float8, s.n_distinct::float8,
       s.avg_width, c.reltuples::bigint AS reltuples, t.typname
FROM pg_stats s
JOIN pg_class c ON c.relname = s.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = s.attname
JOIN pg_type t ON t.oid = a.atttypid
WHERE s.schemaname = 'public'
  AND n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.reltuples >= ${MIN_ROWS}
  AND s.tablename NOT LIKE '%backup%'
  AND s.tablename NOT LIKE '\\_%'
ORDER BY s.tablename, s.attname
LIMIT ${PAGE} OFFSET ${offset}
`

function render(tables) {
  const lines = []
  lines.push('# JEV catalogue: where typed judgement could fill the database')
  lines.push('')
  lines.push(`Generated by \`scripts/jev-catalogue.mjs\` on ${new Date().toISOString().slice(0, 10)}. Re-run it; do not hand-edit.`)
  lines.push('')
  lines.push('Read from `pg_stats`, so this is a census of the whole database that scans nothing.')
  lines.push('')
  lines.push('**A null is not automatically a gap.** `gs_entities.sector` looks like 428,449 missing values')
  lines.push('until you split by `entity_type` and find 240,584 of them are people, who have no sector.')
  lines.push('The real gap is 185,504 organisations. Every candidate below is marked `needs scoping` for')
  lines.push('that reason: split it before quoting the number to anyone.')
  lines.push('')
  lines.push('**What a typed classifier cannot do:** count, join, rank, or order dates. It fills in fields.')
  lines.push('Better fields make better joins, but the joins themselves stay SQL.')
  lines.push('')
  lines.push('Columns whose value is DERIVED BY JOIN are excluded, not listed as opportunities:')
  lines.push('`remoteness`, `seifa_*`, `state` and `lga_*` come from `postcode_geo`. Asking a model for')
  lines.push('them would fabricate what a join already knows, and the 2026-08 place work exists because')
  lines.push('getting those confidently wrong is worse than leaving them null.')
  lines.push('')

  for (const t of tables) t.strong = t.targets.filter((c) => c.strength === 'strong')
  const withWork = tables.filter((t) => t.strong.length && t.sources.length)
    .sort((a, b) => b.reltuples - a.reltuples)
  const targetsOnly = tables.filter((t) => t.strong.length && !t.sources.length)

  const totalRows = withWork.reduce((a, t) => a + t.estUnknownRows, 0)
  const totalCost = withWork.reduce((a, t) => a + t.estCostUsd, 0)

  lines.push('## Summary')
  lines.push('')
  lines.push(`- **${withWork.length} tables** have both an unfilled typed field and text in the same row to read.`)
  lines.push(`- **${targetsOnly.length} tables** have an unfilled field but no readable text beside it. A classifier cannot help; these need a source, not a model.`)
  lines.push(`- **~${totalRows.toLocaleString()} rows** carry at least one unknown that text in the same row might answer.`)
  lines.push(`- **~$${totalCost.toFixed(2)}** to ask every one of them once, at $${COST_PER_M_INPUT}/M input tokens.`)
  lines.push('')
  lines.push('That total is an upper bound on the ask, not a promise of the answer. Expect a large share of')
  lines.push('honest "not enough information" on rows whose only text is a name.')
  lines.push('')

  lines.push('## Tables with work to do')
  lines.push('')
  lines.push('| table | rows | unfilled field (unknown %) | text to read | est. rows | est. $ |')
  lines.push('|---|---|---|---|---|---|')
  for (const t of withWork.slice(0, 40)) {
    const tg = t.strong.map((c) => `\`${c.attname}\` (${Math.round(c.null_frac * 100)}%)`).join('<br>')
    const src = t.sources.map((c) => `\`${c.attname}\``).join(', ')
    lines.push(`| \`${t.tablename}\` | ${t.reltuples.toLocaleString()} | ${tg} | ${src} | ${t.estUnknownRows.toLocaleString()} | $${t.estCostUsd.toFixed(2)} |`)
  }
  lines.push('')

  const largeTables = tables.filter((t) => t.large.length)
  if (largeTables.length) {
    lines.push('## Large taxonomies: a closed set, but too big for one question')
    lines.push('')
    lines.push('These need a two-stage design: a coarse choice, then a second call inside the chosen')
    lines.push('branch. `gs_entities.sector` is the reason this section exists. It is the single largest')
    lines.push('gap in the database and a 60-option cap was dropping it silently.')
    lines.push('')
    lines.push('| table | rows | field | distinct values | unknown | text to read |')
    lines.push('|---|---|---|---|---|---|')
    for (const t of largeTables.sort((a, b) => b.reltuples - a.reltuples).slice(0, 20)) {
      for (const c of t.large) {
        const src = t.sources.map((x) => `\`${x.attname}\``).join(', ') || '_none in this row_'
        lines.push(`| \`${t.tablename}\` | ${t.reltuples.toLocaleString()} | \`${c.attname}\` | ${c.n_distinct} | ${Math.round(c.null_frac * 100)}% | ${src} |`)
      }
    }
    lines.push('')
  }

  lines.push('## Unfilled, but nothing to read')
  lines.push('')
  lines.push('A model has no input here. Either the column is dead, or the answer lives in another table.')
  lines.push('')
  lines.push('| table | rows | unfilled field (unknown %) |')
  lines.push('|---|---|---|')
  for (const t of targetsOnly.slice(0, 30)) {
    const tg = t.targets.map((c) => `\`${c.attname}\` (${Math.round(c.null_frac * 100)}%)`).join('<br>')
    lines.push(`| \`${t.tablename}\` | ${t.reltuples.toLocaleString()} | ${tg} |`)
  }
  lines.push('')
  return lines.join('\n')
}

async function run() {
  const { url, key } = main()
  const sb = createClient(url, key)
  const rows = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.rpc('exec_sql', { query: sqlPage(offset).trim() })
    if (error) throw new Error(`census query failed at offset ${offset}: ${error.message}`)
    const page = data || []
    rows.push(...page)
    if (page.length < PAGE) break
    if (offset > 50_000) throw new Error('pagination did not terminate — refusing to loop')
  }
  if (!rows.length) throw new Error('census returned no rows — pg_stats empty or the query was filtered to nothing')
  console.log(`census rows: ${rows.length} across ${new Set(rows.map((r) => r.tablename)).size} tables`)

  const byTable = new Map()
  for (const r of rows) {
    if (NEVER.test(r.attname)) continue
    if (!byTable.has(r.tablename)) {
      byTable.set(r.tablename, { tablename: r.tablename, reltuples: Number(r.reltuples), targets: [], sources: [], large: [] })
    }
    const t = byTable.get(r.tablename)
    const col = {
      attname: r.attname,
      null_frac: Number(r.null_frac),
      n_distinct: Number(r.n_distinct),
      avg_width: Number(r.avg_width),
      typname: r.typname,
    }
    if (isTarget(col)) {
      col.strength = SEMANTIC.test(col.attname) ? 'strong' : 'review'
      t.targets.push(col)
    } else if (isLargeTaxonomy(col) && SEMANTIC.test(col.attname)) {
      t.large.push(col)
    } else if (isSource(col)) t.sources.push(col)
  }

  const tables = [...byTable.values()].map((t) => {
    // Rows carrying at least one unknown: the worst-filled target column.
    const worst = t.targets.reduce((m, c) => Math.max(m, c.null_frac), 0)
    const estUnknownRows = Math.round(t.reltuples * worst)
    const charsPerRow = t.sources.reduce((a, c) => a + c.avg_width, 0)
    const tokens = (estUnknownRows * charsPerRow) / CHARS_PER_TOKEN
    return {
      ...t,
      needsScoping: true,
      estUnknownRows,
      estCostUsd: (tokens / 1_000_000) * COST_PER_M_INPUT,
    }
  })
  tables.sort((a, b) => b.estUnknownRows - a.estUnknownRows)

  mkdirSync(dirname(OUT_MD), { recursive: true })
  writeFileSync(OUT_MD, render(tables))
  writeFileSync(OUT_JSON, JSON.stringify({ generated_at: new Date().toISOString(), min_rows: MIN_ROWS, tables }, null, 2))

  const withWork = tables.filter((t) => t.strong?.length && t.sources.length)
  console.log(`tables scanned:        ${byTable.size}`)
  console.log(`with work to do:       ${withWork.length}`)
  console.log(`unfilled, no source:   ${tables.filter((t) => t.targets.length && !t.sources.length).length}`)
  console.log(`rows with an unknown:  ~${withWork.reduce((a, t) => a + t.estUnknownRows, 0).toLocaleString()}`)
  console.log(`cost to ask once:      ~$${withWork.reduce((a, t) => a + t.estCostUsd, 0).toFixed(2)}`)
  console.log(`\nwrote ${OUT_MD}`)
}

run().catch((e) => {
  console.error(e.message)
  process.exit(1)
})

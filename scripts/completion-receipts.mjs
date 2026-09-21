#!/usr/bin/env node

/**
 * Prove that a change did what it claimed, by reading the world again.
 *
 * A migration that applied is not a change that worked. On 2026-09-21 an index
 * migration applied cleanly, tracked cleanly, passed a green EXPLAIN, and was
 * useless: the EXPLAIN was written with the index's own predicate in it, so it
 * confirmed the index existed and proved nothing about the path consumers take.
 * Through the view they actually query it was a Parallel Seq Scan over 3.0M
 * rows. The decision was verified. The outcome was not.
 *
 * So each receipt states a CLAIM in words, names the CONSUMER that has to see
 * it, and carries a query that reads fresh state through that consumer's path.
 *
 *   node --env-file=.env scripts/completion-receipts.mjs
 *   node --env-file=.env scripts/completion-receipts.mjs --id index_usable_through_view
 *
 * Exits non-zero if any claim is unproven. Writes data/completion-receipts.json.
 *
 * ── The one rule that is mechanically enforced ──────────────────────────────
 *
 * A receipt's query may not name any object its own migration created. That is
 * the failure above, expressed as something a script can check: if the proof
 * mentions the thing you built, you are restating the implementation rather
 * than observing the result. Name the consumer's object instead. The view, the
 * table the app reads, the endpoint's own query.
 *
 * It cannot catch every restatement. It catches the one that shipped.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const OUT = 'data/completion-receipts.json'

const RECEIPTS = [
  {
    id: 'index_usable_through_view',
    migrations: ['20260921210000', '20260921220000'],
    claim:
      'Filtering role_type through v_gs_relationships_typed uses an index instead of scanning 3.0M rows.',
    consumer: 'anything selecting from v_gs_relationships_typed, which is the readable face of the jsonb keys',
    /** Names the VIEW, not the index. See the rule above. */
    creates: [
      'gs_relationships_props_role_type_idx',
      'gs_relationships_props_procurement_method_idx',
      'gs_relationships_props_buyer_name_idx',
      'person_roles_props_charity_size_idx',
    ],
    // exec_sql is SELECT-only, so an EXPLAIN has to go through psql. gsql.mjs
    // hides this by routing anything not starting with select/with/values/table
    // to psql, which is why the same statement appeared to work there.
    runner: 'psql',
    query: `EXPLAIN SELECT count(*) FROM v_gs_relationships_typed WHERE role_type = 'director'`,
    expect: (rows) => {
      const plan = rows.map((r) => Object.values(r)[0]).join('\n')
      if (/Seq Scan/i.test(plan)) return { ok: false, saw: 'Seq Scan — the index is not being used through the view' }
      if (!/Index Scan|Bitmap Index Scan/i.test(plan)) return { ok: false, saw: plan.split('\n')[1]?.trim() ?? 'no index node' }
      return { ok: true, saw: plan.split('\n').find((l) => /Index/i.test(l))?.trim() }
    },
  },
  {
    id: 'philanthropic_label_folded',
    migrations: ['20260921230000'],
    claim: 'One concept has one label: philanthropic-grant no longer exists, and its 20 rows are counted as philanthropic.',
    consumer: 'the model behind /api/ask and /api/query, which is given funding_type in its column list and writes SQL against it',
    creates: [],
    query: `SELECT funding_type, count(*)::int AS n FROM justice_funding
             WHERE funding_type LIKE 'philanthropic%' GROUP BY 1 ORDER BY 1`,
    expect: (rows) => {
      const stray = rows.find((r) => r.funding_type === 'philanthropic-grant')
      if (stray) return { ok: false, saw: `philanthropic-grant still has ${stray.n} rows` }
      const p = rows.find((r) => r.funding_type === 'philanthropic')
      if (!p || p.n !== 190) return { ok: false, saw: `philanthropic has ${p?.n ?? 0} rows, expected 190` }
      return { ok: true, saw: 'philanthropic 190, no philanthropic-grant' }
    },
  },
  {
    id: 'wrong_youth_justice_tags_gone',
    migrations: ['20260921234500'],
    claim:
      'A church Sunday service is no longer reachable as a youth justice intervention: the 64 wrong tags are gone and 30 unresolved cases remain.',
    consumer:
      'report-service.ts, which filters on topics @> ARRAY[...] and never reads serves_youth_justice',
    creates: [],
    query: `SELECT count(*)::int AS n FROM alma_interventions
             WHERE serves_youth_justice = false AND topics @> ARRAY['youth-justice']::text[]`,
    expect: (rows) => {
      const n = rows[0]?.n
      if (n !== 30) return { ok: false, saw: `${n} contradicting rows, expected 30` }
      return { ok: true, saw: '30 contradicting rows, down from 94' }
    },
  },
]

async function viaExecSql(sb, query) {
  const { data, error } = await sb.rpc('exec_sql', { query: query.trim() })
  if (error) throw new Error(error.message)
  return data || []
}

/**
 * For statements exec_sql will not take. It is SELECT-only, so EXPLAIN needs a
 * real connection. Returns rows shaped like exec_sql's so `expect` does not
 * have to care which runner ran.
 */
function viaPsql(query) {
  const pw = process.env.DATABASE_PASSWORD
  if (!pw) throw new Error('DATABASE_PASSWORD required for a psql receipt')
  const out = execFileSync(
    'psql',
    ['-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432',
     '-U', 'postgres.tednluwflfhxyucgwigh', '-d', 'postgres',
     '-A', '-t', '-c', query.trim()],
    { env: { ...process.env, PGPASSWORD: pw }, encoding: 'utf8', timeout: 60000 },
  )
  return out.split('\n').filter((l) => l.trim()).map((line) => ({ line }))
}

/** The proof may not name what the migration built. */
function restatesImplementation(receipt) {
  const q = receipt.query.toLowerCase()
  return (receipt.creates ?? []).filter((name) => q.includes(name.toLowerCase()))
}

const argv = process.argv.slice(2)
const ONLY = argv[argv.indexOf('--id') + 1]

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required; nothing was proven')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const todo = ONLY ? RECEIPTS.filter((r) => r.id === ONLY) : RECEIPTS
  if (!todo.length) throw new Error(`no receipt with id "${ONLY}"`)

  const results = []
  let failed = 0

  for (const receipt of todo) {
    const restated = restatesImplementation(receipt)
    if (restated.length) {
      // Refuse before running. A proof that names its own subject cannot fail
      // in the way that matters, so a pass from it means nothing.
      console.error(`✗ ${receipt.id}: the proof names ${restated.join(', ')}, which this change created.`)
      console.error('   That restates the implementation. Query the consumer\'s path instead.')
      failed++
      results.push({ id: receipt.id, ok: false, reason: 'restates the implementation', restated })
      continue
    }

    let data
    try {
      data = receipt.runner === 'psql' ? viaPsql(receipt.query) : await viaExecSql(sb, receipt.query)
    } catch (e) {
      console.error(`✗ ${receipt.id}: query failed — ${e.message}`)
      failed++
      results.push({ id: receipt.id, ok: false, reason: `query failed: ${e.message}` })
      continue
    }

    const verdict = receipt.expect(data)
    results.push({
      id: receipt.id,
      migrations: receipt.migrations,
      claim: receipt.claim,
      consumer: receipt.consumer,
      ok: verdict.ok,
      saw: verdict.saw,
      checked_at: new Date().toISOString(),
    })
    if (verdict.ok) {
      console.log(`✓ ${receipt.id}`)
      console.log(`   claim: ${receipt.claim}`)
      console.log(`   saw:   ${verdict.saw}`)
    } else {
      console.error(`✗ ${receipt.id}`)
      console.error(`   claim: ${receipt.claim}`)
      console.error(`   saw:   ${verdict.saw}`)
      failed++
    }
  }

  writeFileSync(OUT, JSON.stringify({ checked_at: new Date().toISOString(), results }, null, 2) + '\n')
  console.log(`\nwrote ${OUT}`)

  if (failed) {
    console.error(`\n${failed} claim(s) unproven. A migration that applied is not a change that worked.`)
    process.exit(1)
  }
  console.log(`${results.length} claim(s) proven against fresh state`)
}

run().catch((e) => {
  console.error(e.message)
  process.exit(2)
})

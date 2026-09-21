#!/usr/bin/env node

/**
 * Measure JEV against a label we did not write.
 *
 * grantconnect_awards holds 291,264 rows that have BOTH a free-text `purpose`
 * and a `category` assigned by the granting agency. That is a gold set nobody
 * in this repo had to grade: the labels come from the Commonwealth, not from
 * us, and they predate the question.
 *
 * So this run measures accuracy, not agreement. Every earlier JEV number here
 * compared two systems that could both be wrong.
 *
 *   node --env-file=.env scripts/jev-purpose-sample.mjs --per-category 25
 *   node --env-file=.env scripts/jev-purpose-sample.mjs --dry-run
 *
 * Output: data/jev-purpose/results.jsonl (append-only, resumable) and a summary
 * on stdout.
 *
 * ── Design notes ────────────────────────────────────────────────────────────
 *
 * Eight categories, not 119. The full taxonomy is far too large for one Choice,
 * and asking a 119-option question would measure the question, not the model.
 * These eight are the highest-volume categories that a reader could tell apart
 * from a purpose statement without knowing the scheme.
 *
 * `not_stated` is an explicit option. The pilot's central finding was that
 * folding "cannot tell" into a wrong answer destroys the measurement, and a
 * purpose statement genuinely may not say which of these a grant belongs to.
 * A not_stated answer is counted separately and is NOT scored as an error:
 * abstention is the behaviour we want, and mixing it into accuracy hides it.
 *
 * Confidence is bucketed and accuracy reported per bucket. That is the only
 * thing that answers whether a JEV confidence of 0.9 means roughly 90% right on
 * OUR data, which every threshold in the workspace audit depends on.
 */

import { createClient } from '@supabase/supabase-js'
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const MODEL = 'jev-latest'
const OUT = 'data/jev-purpose/results.jsonl'
const CONCURRENCY = 4
const PURPOSE_CHARS = 1200

const argv = process.argv.slice(2)
const num = (f, d) => Number(argv[argv.indexOf(f) + 1]) || d
const PER_CATEGORY = num('--per-category', 25)
const DRY = argv.includes('--dry-run')

/**
 * The eight buckets. Each maps to exactly one official category, so the
 * comparison needs no judgement of mine: JEV's answer either matches the
 * agency's label or it does not.
 */
const BUCKETS = [
  { key: 'aged_care', category: 'Aged Care', label: 'aged care services or facilities for older people' },
  { key: 'child_care', category: 'Child Care', label: 'child care, early learning or out-of-school care' },
  { key: 'disaster_relief', category: 'Disaster Relief', label: 'disaster relief, recovery or resilience' },
  { key: 'trade_tourism', category: 'Trade and Tourism', label: 'trade, export or tourism' },
  { key: 'industry_innovation', category: 'Industry Innovation', label: 'industry innovation, commercialisation or business R&D' },
  { key: 'indigenous_arts', category: 'Indigenous Arts and Culture', label: 'Aboriginal and Torres Strait Islander arts, culture or language' },
  { key: 'medical_research', category: 'Medical Research', label: 'medical or health research' },
  { key: 'legal_services', category: 'Legal Services', label: 'legal services, legal assistance or access to justice' },
]

/**
 * The API takes `questions` as an OBJECT keyed by question id, with `criteria`
 * mapping each allowed answer to a description. Sending an array of option
 * objects returns 422 "Input should be a valid dictionary" — which is at least
 * an honest failure: 116 calls failed, nothing was written, and no result was
 * invented from a malformed request.
 */
const QUESTIONS = {
  funding_domain: {
    type: 'choice',
    instructions:
      'Read the grant purpose. Decide which kind of work this grant funds. ' +
      'Judge only from the purpose text. Do not infer from the funder or the writing style.',
    criteria: {
      ...Object.fromEntries(BUCKETS.map((b) => [b.key, `The purpose describes ${b.label}.`])),
      not_stated: 'The purpose does not say clearly enough to place it, or the work belongs to none of these.',
    },
  },
}

function readDone() {
  if (!existsSync(OUT)) return new Set()
  return new Set(
    readFileSync(OUT, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l).ga_id),
  )
}

async function askJev(row, attempt = 0) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.JEV_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      state: { grant_purpose: (row.purpose || '').slice(0, PURPOSE_CHARS) },
      questions: QUESTIONS,
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (res.status === 429 || res.status === 529) {
    if (attempt >= 4) throw new Error(`${res.status} after retries`)
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000))
    return askJev(row, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

function summarise(rows) {
  const scored = rows.filter((r) => r.answer && r.answer !== 'not_stated')
  const abstained = rows.filter((r) => r.answer === 'not_stated')
  const correct = scored.filter((r) => r.answer === r.expected)

  console.log(`\nrows asked:        ${rows.length}`)
  console.log(`abstained:         ${abstained.length} (${pct(abstained.length, rows.length)})  <- not scored as error`)
  console.log(`scored:            ${scored.length}`)
  console.log(`correct:           ${correct.length} (${pct(correct.length, scored.length)} of scored)`)

  console.log('\nby category (agency label -> how often JEV agreed):')
  for (const b of BUCKETS) {
    const mine = rows.filter((r) => r.expected === b.key)
    if (!mine.length) continue
    const s = mine.filter((r) => r.answer !== 'not_stated')
    const c = s.filter((r) => r.answer === r.expected)
    const a = mine.filter((r) => r.answer === 'not_stated')
    console.log(`  ${b.key.padEnd(20)} n=${String(mine.length).padStart(3)}  correct ${pct(c.length, s.length).padStart(6)}  abstained ${pct(a.length, mine.length).padStart(6)}`)
  }

  // The question everything else depends on.
  console.log('\nconfidence calibration (scored answers only):')
  const bands = [[0.9, 1.01], [0.8, 0.9], [0.7, 0.8], [0.5, 0.7], [0, 0.5]]
  for (const [lo, hi] of bands) {
    const inBand = scored.filter((r) => r.confidence >= lo && r.confidence < hi)
    if (!inBand.length) continue
    const c = inBand.filter((r) => r.answer === r.expected)
    console.log(`  ${lo.toFixed(2)}-${hi === 1.01 ? '1.00' : hi.toFixed(2)}   n=${String(inBand.length).padStart(3)}  actually correct ${pct(c.length, inBand.length)}`)
  }
  console.log('\nIf a band\'s stated confidence and its actual accuracy diverge, the thresholds in')
  console.log('thoughts/shared/findings/jev-workspace-audit-2026-09-21.md are not defensible.')
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(0)}%` : 'n/a')

async function run() {
  if (!process.env.JEV_API_KEY) throw new Error('JEV_API_KEY missing from env')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const todo = []
  for (const b of BUCKETS) {
    const { data, error } = await sb
      .from('grantconnect_awards')
      .select('ga_id, purpose, category')
      .eq('category', b.category)
      .not('purpose', 'is', null)
      .limit(PER_CATEGORY * 20)
    if (error) throw new Error(`fetch ${b.category}: ${error.message}`)
    // Deduplicate by purpose TEXT. The same wording repeats across many awards
    // of one programme, and scoring 25 copies of one sentence would report a
    // precise-looking number about a single example.
    const seen = new Set()
    const usable = (data || [])
      .filter((r) => (r.purpose || '').trim().length >= 60)
      .filter((r) => {
        const k = r.purpose.trim().slice(0, 200)
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .slice(0, PER_CATEGORY)
    for (const r of usable) todo.push({ ...r, expected: b.key })
  }
  console.log(`sampled ${todo.length} rows across ${BUCKETS.length} categories`)
  if (DRY) {
    console.log(todo.slice(0, 3).map((r) => `[${r.expected}] ${r.purpose.slice(0, 110)}`).join('\n'))
    return
  }

  mkdirSync('data/jev-purpose', { recursive: true })
  const done = readDone()
  const queue = todo.filter((r) => !done.has(r.ga_id))
  console.log(`${done.size} already asked; ${queue.length} to do`)

  let cursor = 0
  let failed = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < queue.length) {
      const row = queue[cursor++]
      try {
        const out = await askJev(row)
        const a = out?.answers?.funding_domain ?? {}
        appendFileSync(
          OUT,
          JSON.stringify({
            ga_id: row.ga_id,
            expected: row.expected,
            answer: a.choice ?? null,
            confidence: a.confidence ?? null,
            purpose: row.purpose.slice(0, 300),
          }) + '\n',
        )
      } catch (e) {
        failed++
        console.error(`  ${row.ga_id}: ${e.message}`)
      }
    }
  })
  await Promise.all(workers)
  if (failed) console.log(`\n${failed} calls failed`)

  const rows = readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  summarise(rows)
}

run().catch((e) => {
  console.error(e.message)
  process.exit(1)
})

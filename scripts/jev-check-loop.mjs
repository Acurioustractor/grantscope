#!/usr/bin/env node

/**
 * Audit a column that is ALREADY filled, by asking a typed classifier the same
 * question the label claims to answer and reporting where it confidently
 * disagrees.
 *
 * This is the mode that improves data. Filling blanks adds rows; checking
 * existing labels finds the ones that lie. The database holds 724 populated
 * tables whose labels nobody has audited since ingest.
 *
 *   node --env-file=.env scripts/jev-check-loop.mjs --audit grantconnect_category --limit 400
 *   node --env-file=.env scripts/jev-check-loop.mjs --list
 *
 * Output: data/jev-check/<audit>.jsonl (append-only, resumable) and a report.
 * It writes NOTHING to the database and never corrects a label. A disagreement
 * is a suspect row for a human, not a correction.
 *
 * ── Why the report is grouped by PATTERN, not by row ────────────────────────
 *
 * In the calibration run (thoughts/shared/findings/jev-calibration-2026-09-21.md)
 * 8 of 12 disagreements were the same pair: disaster_relief -> trade_tourism.
 * They were not twelve bad rows. They were one wrong idea about what the column
 * means, repeated: `category` records which programme PAID, not what the work
 * IS, so a COVID airfreight grant is filed as Disaster Relief.
 *
 * A row-level queue would have buried that under twelve individually plausible
 * items. A pattern with a count is a defect you can act on. So the report leads
 * with pairs and their frequency, and offers rows only underneath.
 *
 * ── The threshold, and the noise it implies ─────────────────────────────────
 *
 * Only disagreements at or above MIN_CONFIDENCE count. Measured on our data,
 * that band is 95% correct, which cuts both ways: roughly 1 in 20 flagged rows
 * will be the classifier being wrong, not the label. A pattern of 3 is noise.
 * The report says so rather than letting a reader assume every flag is a find.
 *
 * Below the threshold nothing is reported at all. An uncertain disagreement is
 * not evidence of anything and putting it in a queue wastes the reviewer.
 */

import { createClient } from '@supabase/supabase-js'
import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const MODEL = 'jev-latest'
const CONCURRENCY = 4
const TEXT_CHARS = 1200

/**
 * Measured, not chosen: 0.90 is the band where the classifier was 95% correct
 * on this data. Do not lower it without re-running the calibration in
 * thoughts/shared/findings/jev-calibration-2026-09-21.md.
 */
const MIN_CONFIDENCE = 0.9

/**
 * An audit names a filled column, the text that should justify it, and the
 * vocabulary both sides share.
 *
 * `buckets` maps the stored label to the answer id. Only rows whose stored
 * label is in the map are audited: a label the question cannot express would
 * produce a guaranteed disagreement that means nothing.
 */
const AUDITS = {
  /**
   * justice_funding.funding_type decides which LANE a row belongs to, and
   * CLAUDE.md records that mixing the lanes publishes figures wrong by an order
   * of magnitude. So a defect here is a money defect, not a tagging one.
   *
   * Only the four real values are audited. The tail is vocabulary drift from
   * separate ingests rather than a classification problem: philanthropic (170)
   * beside philanthropic-grant (20), and total_budget / grants_program /
   * budget_program_net_cost with one or two rows each. A model cannot fix a
   * vocabulary that disagrees with itself; that is a migration.
   *
   * Expect capital to disagree. "Gambling Community Benefit Fund | Upgrade
   * Facility" is a grant that pays for capital works, so grant and capital are
   * not mutually exclusive in this vocabulary. If that shows up as a large
   * pattern it is evidence about the taxonomy, not about the rows.
   */
  justice_funding_type: {
    table: 'justice_funding',
    id: 'id',
    textCols: ['program_name', 'project_description'],
    label: 'funding_type',
    // contract rows average 42 characters of combined text. The default floor
    // of 60 would drop most of them and quietly bias the sample toward the
    // verbose types, which would then look like the whole column.
    minChars: 25,
    question: {
      instructions:
        'Read the description of a payment made by an Australian government or funder. ' +
        'Decide what KIND of payment it is. Judge only from the text.',
      notStated: 'The text does not say clearly enough what kind of payment this is.',
    },
    buckets: {
      grant: ['grant', 'a grant or funding awarded to an organisation to deliver a programme or project'],
      contract: ['contract', 'a procurement contract to buy goods, services, supplies or labour'],
      capital: ['capital', 'funding for buildings, facilities, construction or physical infrastructure'],
      appropriation: ['appropriation', 'a government budget appropriation or departmental allocation, not money paid to an external recipient'],
    },
  },

  grantconnect_category: {
    table: 'grantconnect_awards',
    id: 'ga_id',
    text: 'purpose',
    label: 'category',
    question: {
      instructions:
        'Read the grant purpose. Decide which kind of work this grant funds. ' +
        'Judge only from the purpose text. Do not infer from the funder or the writing style.',
      notStated:
        'The purpose does not say clearly enough to place it, or the work belongs to none of these.',
    },
    buckets: {
      'Aged Care': ['aged_care', 'aged care services or facilities for older people'],
      'Child Care': ['child_care', 'child care, early learning or out-of-school care'],
      'Disaster Relief': ['disaster_relief', 'disaster relief, recovery or resilience'],
      'Trade and Tourism': ['trade_tourism', 'trade, export or tourism'],
      'Industry Innovation': ['industry_innovation', 'industry innovation, commercialisation or business R&D'],
      'Indigenous Arts and Culture': ['indigenous_arts', 'Aboriginal and Torres Strait Islander arts, culture or language'],
      'Medical Research': ['medical_research', 'medical or health research'],
      'Legal Services': ['legal_services', 'legal services, legal assistance or access to justice'],
    },
    /**
     * Known and already explained. The calibration run established that this
     * pair is the column's semantics, not a row defect: `category` is a
     * programme label. Reported separately so a re-run does not present it as a
     * new discovery every time.
     */
    known: [['disaster_relief', 'trade_tourism', 'category records which programme paid, not what the work is']],
  },
}

const argv = process.argv.slice(2)
const arg = (f, d) => {
  const i = argv.indexOf(f)
  return i >= 0 ? argv[i + 1] : d
}
const LIMIT = Number(arg('--limit', 300))
const AUDIT = arg('--audit', null)

function buildQuestion(audit) {
  const criteria = {}
  for (const [, [key, desc]] of Object.entries(audit.buckets)) {
    criteria[key] = `The text describes ${desc}.`
  }
  criteria.not_stated = audit.question.notStated
  return { verdict: { type: 'choice', instructions: audit.question.instructions, criteria } }
}

async function ask(text, questions, attempt = 0) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.JEV_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, state: { text: text.slice(0, TEXT_CHARS) }, questions }),
    signal: AbortSignal.timeout(60000),
  })
  if (res.status === 429 || res.status === 529) {
    if (attempt >= 4) throw new Error(`${res.status} after retries`)
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000))
    return ask(text, questions, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`)
  return res.json()
}

function report(name, audit, rows) {
  const scored = rows.filter((r) => r.answer && r.answer !== 'not_stated')
  const abstained = rows.filter((r) => r.answer === 'not_stated')
  const confident = scored.filter((r) => (r.confidence ?? 0) >= MIN_CONFIDENCE)
  const agree = confident.filter((r) => r.answer === r.expected)
  const disagree = confident.filter((r) => r.answer !== r.expected)

  const pairs = new Map()
  for (const d of disagree) {
    const k = `${d.expected} -> ${d.answer}`
    if (!pairs.has(k)) pairs.set(k, [])
    pairs.get(k).push(d)
  }
  const known = new Set(audit.known?.map(([a, b]) => `${a} -> ${b}`) ?? [])
  const ranked = [...pairs.entries()].sort((a, b) => b[1].length - a[1].length)

  const L = []
  L.push(`# Label check: ${audit.table}.${audit.label}`)
  L.push('')
  L.push(`Generated by \`scripts/jev-check-loop.mjs --audit ${name}\` on ${new Date().toISOString().slice(0, 10)}.`)
  L.push('Nothing was written to the database. A disagreement is a suspect row, not a correction.')
  L.push('')
  L.push(`- rows checked: **${rows.length}**`)
  L.push(`- abstained: ${abstained.length} (${pc(abstained.length, rows.length)}) — no opinion, not a flag`)
  L.push(`- confident (>= ${MIN_CONFIDENCE}): ${confident.length}`)
  L.push(`- agreed with the stored label: ${agree.length} (${pc(agree.length, confident.length)})`)
  L.push(`- **disagreed: ${disagree.length} (${pc(disagree.length, confident.length)})**`)
  L.push('')
  L.push(`At this confidence the classifier was 95% correct when measured against this same column,`)
  L.push(`so expect roughly 1 in 20 flags to be the classifier rather than the label. **A pattern of`)
  L.push(`two or three is noise. A pattern of thirty is a defect.**`)
  L.push('')
  const coverage = scored.length ? confident.length / scored.length : 0
  if (coverage < 0.4) {
    L.push('## UNDERPOWERED — do not read the patterns below as findings')
    L.push('')
    L.push(`Only **${pc(confident.length, scored.length)}** of scored answers reached ${MIN_CONFIDENCE} confidence.`)
    L.push('For comparison, `grantconnect_awards.category` reached 86% on the same threshold.')
    L.push('')
    L.push('Low confident coverage is a statement about the TEXT, not the label: the columns being')
    L.push('read do not carry enough to answer the question. Nothing here supports a conclusion')
    L.push('either way, and the patterns below are too small to separate from the ~5% error rate.')
    L.push('')
    L.push('To make this audit conclusive, give it better text or a question the text can answer.')
    L.push('')
  }
  L.push('## Disagreement patterns')
  L.push('')
  if (!ranked.length) {
    L.push('None. Every confident answer matched the stored label.')
  } else {
    L.push('| stored label | classifier said | n | |')
    L.push('|---|---|---|---|')
    for (const [pair, items] of ranked) {
      const [a, b] = pair.split(' -> ')
      const note = known.has(pair)
        ? `known: ${audit.known.find(([x, y]) => `${x} -> ${y}` === pair)[2]}`
        : items.length >= 10 ? '**look at this**' : ''
      L.push(`| \`${a}\` | \`${b}\` | ${items.length} | ${note} |`)
    }
  }
  L.push('')
  L.push('## Examples, worst pattern first')
  L.push('')
  for (const [pair, items] of ranked.slice(0, 5)) {
    if (known.has(pair)) continue
    L.push(`### ${pair} (${items.length})`)
    L.push('')
    for (const it of items.slice(0, 4)) {
      L.push(`- \`${it.id}\` conf ${Number(it.confidence).toFixed(2)} — ${String(it.text).slice(0, 180).replace(/\s+/g, ' ')}`)
    }
    L.push('')
  }

  const out = `thoughts/shared/data-map/label-check-${name}.md`
  writeFileSync(out, L.join('\n'))

  console.log(`\nrows checked:  ${rows.length}`)
  console.log(`abstained:     ${abstained.length} (${pc(abstained.length, rows.length)})`)
  console.log(`confident:     ${confident.length}`)
  console.log(`agreed:        ${agree.length} (${pc(agree.length, confident.length)})`)
  console.log(`DISAGREED:     ${disagree.length} (${pc(disagree.length, confident.length)})`)
  const cov = scored.length ? confident.length / scored.length : 0
  if (cov < 0.4) {
    console.log(`\n!! UNDERPOWERED: only ${pc(confident.length, scored.length)} of scored answers were confident.`)
    console.log('   The text cannot answer the question. Do not read the patterns as findings.')
  }
  console.log('\npatterns:')
  for (const [pair, items] of ranked.slice(0, 8)) {
    console.log(`  ${String(items.length).padStart(4)}  ${pair}${known.has(pair) ? '   (known)' : ''}`)
  }
  console.log(`\nwrote ${out}`)
}

const pc = (a, b) => (b ? `${((100 * a) / b).toFixed(0)}%` : 'n/a')

/** An audit reads one column or several joined together. */
const textCols = (audit) => audit.textCols ?? [audit.text]

async function run() {
  if (argv.includes('--list')) {
    for (const [k, a] of Object.entries(AUDITS)) console.log(`${k}  ->  ${a.table}.${a.label} judged from ${textCols(a).join(' + ')}`)
    return
  }
  if (!AUDIT || !AUDITS[AUDIT]) throw new Error(`--audit required; one of: ${Object.keys(AUDITS).join(', ')}`)
  if (!process.env.JEV_API_KEY) throw new Error('JEV_API_KEY missing from env')

  const audit = AUDITS[AUDIT]
  const questions = buildQuestion(audit)
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const OUT = `data/jev-check/${AUDIT}.jsonl`
  mkdirSync('data/jev-check', { recursive: true })
  const done = existsSync(OUT)
    ? new Set(readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id))
    : new Set()

  const labels = Object.keys(audit.buckets)
  const perLabel = Math.max(1, Math.ceil(LIMIT / labels.length))
  const queue = []
  for (const label of labels) {
    const { data, error } = await sb
      .from(audit.table)
      .select([audit.id, ...textCols(audit), audit.label].join(', '))
      .eq(audit.label, label)
      .not(textCols(audit)[0], 'is', null)
      .limit(perLabel * 20)
    if (error) throw new Error(`fetch ${label}: ${error.message}`)
    // Dedup by text: the same wording repeats across awards of one programme,
    // and counting it many times would manufacture a pattern out of one example.
    const seen = new Set()
    for (const r of data || []) {
      const t = textCols(audit).map((c) => r[c] || '').join(' | ').trim()
      if (t.length < (audit.minChars ?? 60)) continue
      const k = t.slice(0, 200)
      if (seen.has(k)) continue
      seen.add(k)
      if (done.has(r[audit.id])) continue
      queue.push({ id: r[audit.id], text: t, expected: audit.buckets[label][0] })
      if (seen.size >= perLabel) break
    }
  }
  console.log(`${AUDIT}: ${done.size} already checked; ${queue.length} to do`)

  let cursor = 0
  let failed = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < queue.length) {
        const row = queue[cursor++]
        try {
          const out = await ask(row.text, questions)
          const a = out?.answers?.verdict ?? {}
          appendFileSync(
            OUT,
            JSON.stringify({
              id: row.id,
              expected: row.expected,
              answer: a.choice ?? null,
              confidence: a.confidence ?? null,
              text: row.text.slice(0, 300),
            }) + '\n',
          )
        } catch (e) {
          failed++
          console.error(`  ${row.id}: ${e.message}`)
        }
      }
    }),
  )
  if (failed) console.log(`${failed} calls failed`)

  const rows = readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  report(AUDIT, audit, rows)
}

run().catch((e) => {
  console.error(e.message)
  process.exit(1)
})

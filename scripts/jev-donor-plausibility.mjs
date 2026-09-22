#!/usr/bin/env node

/**
 * Is each donor→ABN match in donor_entity_matches plausibly the same organisation?
 *
 *   node --env-file=.env scripts/jev-donor-plausibility.mjs            # ask + report
 *   node --env-file=.env scripts/jev-donor-plausibility.mjs --report   # report only, from the jsonl
 *   node --env-file=.env scripts/jev-donor-plausibility.mjs --limit=50 # a sample first
 *
 * Why (2026-09-22): donor_entity_matches decides who every ABN-less political donation is
 * attributed to in the graph, and nothing has ever checked it. Rows like the National Party
 * matched to Panasonic Australia and the Australian National Audit Office matched to the
 * Department of Health move tens of millions of dollars onto the wrong entity. 0 of 10,269
 * rows are verified.
 *
 * WRITES NOTHING TO THE DATABASE. Output is data/jev-check/donor-plausibility.jsonl
 * (append-only, resumable) and thoughts/shared/findings/jev-donor-plausibility-<date>.md.
 * A flag is a row for a human to review; fixing a match is a reviewed migration.
 *
 * One question per distinct (donor name, ABN) pair. The state carries the donor name as
 * disclosed, the name the ABN register holds for that ABN, and the name on our graph node
 * (which imports have been known to overwrite). CHOICE, not Noul, because "related but not
 * the same" and "the name is not enough to tell" are real answers.
 *
 * Dollar exposure is total_donated as stored on the row, summed in code. Jev never sees it.
 */

import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const MODEL = 'jev-latest'
const CONCURRENCY = 4
// Calibrated on topic labels (thoughts/shared/findings/jev-calibration-2026-09-21.md), not identity.
const MIN_CONFIDENCE = 0.9
const OUT_DIR = 'data/jev-check'
const OUT = `${OUT_DIR}/donor-plausibility.jsonl`
const REPORT_ONLY = process.argv.includes('--report')
const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity

const PAIRS_SQL = `
SELECT coalesce(json_agg(p ORDER BY p.total_donated DESC NULLS LAST), '[]'::json) FROM (
  SELECT m.donor_name, m.matched_abn AS abn,
         min(m.matched_entity_name) AS matched_name,
         min(m.match_method) AS match_method,
         sum(m.total_donated) AS total_donated,
         sum(m.donation_count) AS donation_count,
         min(a.entity_name) AS register_name,
         min(a.entity_type) AS register_type,
         min(g.canonical_name) AS node_name,
         min(g.entity_type) AS node_type
    FROM donor_entity_matches m
    LEFT JOIN abr_registry a ON a.abn = m.matched_abn
    LEFT JOIN gs_entities g ON g.gs_id = 'AU-ABN-' || m.matched_abn
   WHERE m.matched_abn IS NOT NULL AND m.matched_abn !~ '^0+$' AND trim(m.donor_name) <> ''
   GROUP BY m.donor_name, m.matched_abn
) p`

function psqlJson(sql) {
  const pw = process.env.DATABASE_PASSWORD
  if (!pw) throw new Error('DATABASE_PASSWORD is required')
  const out = execFileSync(
    'psql',
    ['-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432',
     '-U', 'postgres.tednluwflfhxyucgwigh', '-d', 'postgres', '-X', '-q', '-A', '-t', '-c', sql],
    { env: { ...process.env, PGPASSWORD: pw }, encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024 },
  )
  // json_agg separates elements with newlines, so parse the whole output, not the last line.
  return JSON.parse(out.trim())
}

function describe(p) {
  return [
    `A political donation disclosure names the donor as: "${p.donor_name}".`,
    `It has been matched to ABN ${p.abn}.`,
    `The Australian Business Register name for that ABN: ${p.register_name ? `"${p.register_name}"${p.register_type ? ` (${p.register_type})` : ''}` : 'not found in the register'}.`,
    `Our database's name for that ABN: ${p.node_name ? `"${p.node_name}"${p.node_type ? ` (${p.node_type})` : ''}` : 'no record'}.`,
  ].join('\n')
}

const QUESTIONS = {
  verdict: {
    type: 'choice',
    instructions:
      'Is the donor named in the disclosure the same organisation as the business registered under the ' +
      'matched ABN? Judge by the Australian Business Register name first. Trading names, abbreviations, ' +
      '"Pty Ltd" versus "Limited", and a trustee acting for a trust of the same name count as the same.',
    criteria: {
      same: 'The donor is the registered business, allowing for abbreviation, legal suffix or trustee wording.',
      related: 'A related but different body: a parent, subsidiary, state branch, foundation or trust of the donor.',
      different: 'A different organisation. The names describe unrelated bodies, for example a political party and a company, or two different government agencies.',
      not_stated: 'The names alone are not enough to tell.',
    },
  },
}

async function ask(text, questions, attempt = 0) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.JEV_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, state: { text }, questions }),
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

const key = (r) => `${r.donor_name}|${r.abn}`

function loadDone() {
  if (!existsSync(OUT)) return []
  return readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

function report(rows) {
  const date = new Date().toISOString().slice(0, 10)
  const m = (xs) => xs.reduce((s, r) => s + Number(r.total_donated || 0), 0)
  const $ = (n) => `$${(n / 1e6).toFixed(1)}M`
  const conf = rows.filter((r) => (r.confidence ?? 0) >= MIN_CONFIDENCE)
  const by = (a) => conf.filter((r) => r.answer === a)
  const L = [`# Donor match plausibility (Jev), ${date}`, '',
    'Generated by `scripts/jev-donor-plausibility.mjs`. **Flags only. Nothing was written to the database.**',
    `Confident means >= ${MIN_CONFIDENCE}. That band was calibrated on topic labels, not identity. Dollars are \`total_donated\` as stored, summed in code.`, '',
    '| verdict | pairs | $ attributed |', '|---|---|---|']
  for (const a of ['same', 'related', 'different', 'not_stated']) L.push(`| confident ${a} | ${by(a).length} | ${$(m(by(a)))} |`)
  const low = rows.filter((r) => r.answer && (r.confidence ?? 0) < MIN_CONFIDENCE)
  const err = rows.filter((r) => !r.answer)
  L.push(`| below ${MIN_CONFIDENCE} | ${low.length} | ${$(m(low))} |`, `| failed | ${err.length} | |`, `| **total** | **${rows.length}** | **${$(m(rows))}** |`, '')
  const table = (title, xs, n) => {
    L.push(`## ${title}`, '', '| donor (disclosed) | ABN | register name | our node name | $ | conf |', '|---|---|---|---|---|---|')
    for (const r of [...xs].sort((a, b) => b.total_donated - a.total_donated).slice(0, n)) {
      L.push(`| ${r.donor_name} | ${r.abn} | ${r.register_name ?? '—'} | ${r.node_name ?? '—'} | ${$(Number(r.total_donated || 0))} | ${Number(r.confidence).toFixed(2)} |`)
    }
    L.push('')
  }
  table('Confident different: likely wrong matches, largest first', by('different'), 100)
  table('Confident related: attributed to a relative, not the donor', by('related'), 40)
  table('Below threshold and not "same": for a human', low.filter((r) => r.answer !== 'same'), 40)
  mkdirSync('thoughts/shared/findings', { recursive: true })
  const path = `thoughts/shared/findings/jev-donor-plausibility-${date}.md`
  writeFileSync(path, L.join('\n'))
  console.log(`report: ${path}`)
  console.log(L.slice(4, 14).join('\n'))
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  if (!REPORT_ONLY) {
    if (!process.env.JEV_API_KEY) throw new Error('JEV_API_KEY is required')
    const pairs = psqlJson(PAIRS_SQL)
    const done = new Set(loadDone().map(key))
    const queue = pairs.filter((p) => !done.has(key(p))).slice(0, LIMIT)
    console.log(`${pairs.length} donor→ABN pairs; ${done.size} already asked; ${queue.length} to do`)
    let cursor = 0
    let failed = 0
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < queue.length) {
        const p = queue[cursor++]
        try {
          const a = (await ask(describe(p), QUESTIONS))?.answers?.verdict ?? {}
          appendFileSync(OUT, JSON.stringify({ ...p, answer: a.choice ?? null, confidence: a.confidence ?? null, probabilities: a.probabilities ?? null }) + '\n')
        } catch (e) {
          failed++
          if (failed <= 3) console.error(`failed: ${p.donor_name}: ${e.message}`)
        }
        if (cursor % 500 === 0) console.log(`  ${cursor}/${queue.length}`)
      }
    }))
    if (failed) console.log(`${failed} failed; re-run to retry them`)
  }
  report(loadDone())
}

main().catch((e) => { console.error(e); process.exit(1) })

#!/usr/bin/env node

/**
 * Suggest which entity an unlinked name refers to, for the names the
 * deterministic linker refused.
 *
 *   node --env-file=.env scripts/jev-entity-match.mjs            # candidates + ask + report
 *   node --env-file=.env scripts/jev-entity-match.mjs --report   # report only, from the jsonl
 *
 * The residue after supabase/migrations/20260922090000: 157 of 438 buyers in
 * se_buyer_prospects and 179 of 846 funder names in alma_funding_opportunities
 * had no graph edge and no unique exact-name entity. What is left is judgement:
 * "is QLD Department of Child Safety, Youth and Women the same body as this
 * candidate, a predecessor of it, or something else?" Exact matching cannot
 * answer that and fuzzy matching answers it confidently wrong, because renamed
 * departments share most of their words.
 *
 * WRITES NOTHING TO THE DATABASE. Output is data/jev-check/entity-match.jsonl
 * (append-only, resumable) and thoughts/shared/findings/jev-entity-match-<date>.md.
 * A suggestion is a row for a human to confirm, then insert into
 * funder_entity_links with link_method 'reviewed'. It is never a link by itself.
 *
 * ── Why "renamed" and "none" are real answers ───────────────────────────────
 *
 * Forcing a pick among five candidates would invent merges. Many of these names
 * are predecessor departments, and the honest output is "an older name of a body
 * that none of these candidates exactly is". The classifier also cannot order
 * dates, so it can flag a lineage but never say which name came first.
 *
 * ── Candidates ──────────────────────────────────────────────────────────────
 *
 * Top 5 non-person entities by trigram similarity (>= 0.35), government bodies
 * first on ties. Candidate order is shown to the model as-is, so the report
 * states how often it picked candidate 1: a heavy skew there would mean it is
 * reading the order, not the names.
 */

import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const MODEL = 'jev-latest'
const CONCURRENCY = 4
// Measured in thoughts/shared/findings/jev-calibration-2026-09-21.md: 95% correct at >= 0.90.
// That calibration was on topic labels, not identity. Treat it as a prior, not a guarantee, here.
const MIN_CONFIDENCE = 0.9
const OUT_DIR = 'data/jev-check'
const OUT = `${OUT_DIR}/entity-match.jsonl`
const CANDIDATES = `${OUT_DIR}/entity-match-candidates.json`

const CANDIDATE_SQL = `
SET search_path = public, extensions;
SET pg_trgm.similarity_threshold = 0.35;
WITH names AS (
  SELECT 'buyer' AS kind, buyer_name AS name, contract_count AS weight
    FROM se_buyer_prospects WHERE gs_entity_id IS NULL
  UNION ALL
  SELECT 'funder', min(funder_name), count(*)
    FROM alma_funding_opportunities
   WHERE funder_entity_id IS NULL AND funder_name IS NOT NULL AND trim(funder_name) <> ''
   GROUP BY lower(trim(funder_name))
)
SELECT coalesce(json_agg(json_build_object(
         'kind', n.kind, 'name', n.name, 'weight', n.weight,
         'candidates', coalesce(c.list, '[]'::json))), '[]'::json)
  FROM names n
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
             'id', x.id, 'name', x.canonical_name, 'type', x.entity_type,
             'state', x.state, 'abn', x.abn, 'sim', round(x.sim::numeric, 2))
             ORDER BY x.sim DESC, x.gov DESC) AS list
      FROM (SELECT g.id, g.canonical_name, g.entity_type, g.state, g.abn,
                   similarity(g.canonical_name, n.name) AS sim,
                   (g.entity_type = 'government_body' OR g.gs_id LIKE 'AU-GOV-%') AS gov
              FROM gs_entities g
             WHERE g.canonical_name % n.name
               AND g.entity_type NOT IN ('person', 'political_party')
             ORDER BY similarity(g.canonical_name, n.name) DESC
             LIMIT 5) x
  ) c ON true`

function psqlJson(sql) {
  const pw = process.env.DATABASE_PASSWORD
  if (!pw) throw new Error('DATABASE_PASSWORD is required (candidate search runs through psql)')
  const out = execFileSync(
    'psql',
    ['-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432',
     '-U', 'postgres.tednluwflfhxyucgwigh', '-d', 'postgres', '-X', '-q', '-A', '-t', '-c', sql],
    { env: { ...process.env, PGPASSWORD: pw }, encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024 },
  )
  // SET statements print nothing under -q; the last non-empty line is the JSON.
  return JSON.parse(out.trim().split('\n').filter(Boolean).pop())
}

function describe(item) {
  const where = item.kind === 'buyer'
    ? `a government buyer named in Australian government contract data (${item.weight} contracts)`
    : `the funder of ${item.weight} Australian grant opportunit${item.weight === 1 ? 'y' : 'ies'}`
  const lines = [`Name as written: "${item.name}"`, `This is ${where}.`, '', 'Candidates from the entity register:']
  item.candidates.forEach((c, i) => {
    lines.push(`${i + 1}. "${c.name}" (${c.type ?? 'unknown type'}${c.state ? `, ${c.state}` : ''}${c.abn ? `, ABN ${c.abn}` : ', no ABN'})`)
  })
  return lines.join('\n')
}

function questionFor(item) {
  const criteria = {}
  item.candidates.forEach((c, i) => {
    criteria[`candidate_${i + 1}`] = `It is the same organisation as candidate ${i + 1}, "${c.name}".`
  })
  criteria.renamed = 'It is an earlier or later name of a government body, and none of the candidates is that exact body (a department renamed, split or merged in a restructure).'
  criteria.none = 'It is a different organisation from every candidate.'
  criteria.not_stated = 'The name is not enough to tell.'
  return {
    verdict: {
      type: 'choice',
      instructions:
        'Decide which candidate, if any, is the same organisation as the name. Same organisation means ' +
        'the same legal body, not a similar or related one: a state department is not the same as a ' +
        'federal one, and a foundation is not the same as the company that set it up.',
      criteria,
    },
  }
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

const key = (r) => `${r.kind}|${r.name}`

function loadDone() {
  if (!existsSync(OUT)) return []
  return readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

function report(rows) {
  const date = new Date().toISOString().slice(0, 10)
  const pc = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—')
  const L = [`# JEV entity-match suggestions, ${date}`, '',
    'Generated by `scripts/jev-entity-match.mjs`. **Suggestions only. Nothing was written to the database.**',
    `Confident means >= ${MIN_CONFIDENCE}, the band that was 95% correct on topic labels. Identity was not calibrated.`, '']

  for (const kind of ['buyer', 'funder']) {
    const mine = rows.filter((r) => r.kind === kind)
    const conf = mine.filter((r) => (r.confidence ?? 0) >= MIN_CONFIDENCE)
    const by = (a) => conf.filter((r) => (a === 'match' ? r.answer?.startsWith('candidate_') : r.answer === a))
    const noCand = mine.filter((r) => r.candidates === 0)
    L.push(`## ${kind === 'buyer' ? 'Buyers (se_buyer_prospects)' : 'Funders (alma_funding_opportunities)'}`, '')
    L.push('| | names | weight |', '|---|---|---|')
    const w = (xs) => xs.reduce((s, r) => s + Number(r.weight || 0), 0)
    L.push(`| asked | ${mine.length} | ${w(mine)} |`)
    L.push(`| no candidate within similarity 0.35 (not asked) | ${noCand.length} | ${w(noCand)} |`)
    L.push(`| confident match | ${by('match').length} | ${w(by('match'))} |`)
    L.push(`| confident renamed/predecessor | ${by('renamed').length} | ${w(by('renamed'))} |`)
    L.push(`| confident none | ${by('none').length} | ${w(by('none'))} |`)
    L.push(`| below ${MIN_CONFIDENCE} or not stated | ${mine.length - noCand.length - conf.length} | |`)
    const first = by('match').filter((r) => r.answer === 'candidate_1').length
    L.push('', `Position check: ${first} of ${by('match').length} confident matches chose candidate 1 (${pc(first, by('match').length)}). Candidate 1 is also the most similar name, so a high share is expected; 100% with no exceptions would be suspicious.`, '')
    if (by('match').length) {
      L.push('### Confident matches (confirm before linking)', '', '| name | weight | suggested entity | type | ABN | sim | conf |', '|---|---|---|---|---|---|---|')
      for (const r of by('match').sort((a, b) => b.weight - a.weight)) {
        const c = r.chosen
        L.push(`| ${r.name} | ${r.weight} | ${c?.name ?? '?'} | ${c?.type ?? ''} | ${c?.abn ?? ''} | ${c?.sim ?? ''} | ${Number(r.confidence).toFixed(2)} |`)
      }
      L.push('')
    }
    if (by('renamed').length) {
      L.push('### Flagged as renamed or predecessor bodies', '', ...by('renamed').sort((a, b) => b.weight - a.weight).slice(0, 40).map((r) => `- ${r.name} (${r.weight})`), '')
    }
  }
  mkdirSync('thoughts/shared/findings', { recursive: true })
  const path = `thoughts/shared/findings/jev-entity-match-${date}.md`
  writeFileSync(path, L.join('\n') + '\n')
  console.log(`report: ${path}`)
}

async function run() {
  mkdirSync(OUT_DIR, { recursive: true })
  if (process.argv.includes('--report')) return report(loadDone())
  if (!process.env.JEV_API_KEY) throw new Error('JEV_API_KEY is required')

  const items = psqlJson(CANDIDATE_SQL)
  writeFileSync(CANDIDATES, JSON.stringify(items, null, 1))
  const done = new Set(loadDone().map(key))
  const queue = items.filter((i) => !done.has(key(i)))
  console.log(`${items.length} unlinked names; ${done.size} already asked; ${queue.length} to do`)

  // Names with no candidate are recorded, not asked: there is nothing to choose between.
  for (const i of queue.filter((i) => i.candidates.length === 0)) {
    appendFileSync(OUT, JSON.stringify({ kind: i.kind, name: i.name, weight: i.weight, candidates: 0, answer: null, confidence: null }) + '\n')
  }
  const ask_ = queue.filter((i) => i.candidates.length > 0)
  let cursor = 0
  let failed = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < ask_.length) {
      const item = ask_[cursor++]
      try {
        const out = await ask(describe(item), questionFor(item))
        const a = out?.answers?.verdict ?? {}
        const n = /^candidate_(\d)$/.exec(a.choice ?? '')
        appendFileSync(OUT, JSON.stringify({
          kind: item.kind, name: item.name, weight: item.weight, candidates: item.candidates.length,
          answer: a.choice ?? null, confidence: a.confidence ?? null,
          chosen: n ? item.candidates[Number(n[1]) - 1] : null,
        }) + '\n')
      } catch (e) {
        failed++
        console.error(`✗ ${item.name}: ${e.message}`)
      }
    }
  }))
  console.log(`asked ${ask_.length - failed}, failed ${failed}`)
  report(loadDone())
  // Failures are resumable, but they are not a clean run.
  if (failed) process.exitCode = 1
}

run().catch((e) => { console.error(e.message); process.exit(2) })

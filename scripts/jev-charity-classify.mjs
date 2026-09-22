#!/usr/bin/env node
/**
 * What kind of charity is this? Three Jev judgements per charity, for the power-and-philanthropy
 * story (thoughts/shared/drafts/2026-09-22-who-holds-the-giving.md).
 *
 *   node --env-file=.env scripts/jev-charity-classify.mjs              # ask (resumable)
 *   node --env-file=.env scripts/jev-charity-classify.mjs --limit=200  # a sample first
 *
 * Replaces three things the draft leaned on that nobody had checked:
 *   sector   one MAIN sector per charity, so sector totals stop overlapping (ACNC purpose ticks overlap)
 *   control  Aboriginal community-controlled or not, asked only of charities that tick Aboriginal and
 *            Torres Strait Islander beneficiaries or are ORIC corporations (the 4.5% figure rests on it)
 *   school   school / school's own fund / university / other, asked only of education-purpose charities
 *
 * Jev judges ORGANISATIONS from their name and their own description. It never sees a dollar figure;
 * every total is summed in SQL afterwards. It never judges a person.
 *
 * WRITES NOTHING TO THE DATABASE. Output: data/jev-check/charity-classify.jsonl (append-only, resumable).
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const MODEL = 'jev-latest'
const CONCURRENCY = 12
const OUT_DIR = 'data/jev-check'
const OUT = `${OUT_DIR}/charity-classify.jsonl`
const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity

// Latest filing 2022-2024 per charity, same population as the draft (53,879).
const SQL = `
SELECT coalesce(json_agg(x), '[]'::json) FROM (
  SELECT DISTINCT ON (l.abn) l.abn, c.name, c.other_names, c.purposes, c.beneficiaries, c.state, c.charity_size,
         c.is_oric_corporation AS oric, c.ben_aboriginal_tsi AS atsi, c.purpose_education AS edu,
         left(l.how_purposes_pursued, 700) AS how
    FROM acnc_ais l JOIN acnc_charities c ON c.abn = l.abn
   WHERE l.ais_year >= 2022 AND coalesce(l.total_revenue, 0) < 3e10
   ORDER BY l.abn, l.ais_year DESC
) x`

function psqlJson(sql) {
  const out = execFileSync('psql',
    ['-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432', '-U', 'postgres.tednluwflfhxyucgwigh',
     '-d', 'postgres', '-X', '-q', '-A', '-t', '-c', sql],
    { env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD }, encoding: 'utf8', timeout: 600000, maxBuffer: 512 * 1024 * 1024 })
  return JSON.parse(out.trim())
}

const SECTOR = {
  type: 'choice',
  instructions: 'What is this charity MAINLY for? Pick the one sector where most of its work sits, judged by what it does, not every group it mentions.',
  criteria: {
    health: 'Hospitals, health services, medical care, mental health, community health clinics.',
    medical_research: 'Medical or scientific research institutes.',
    disability: 'Disability services and support.',
    aged_care: 'Aged care and retirement living.',
    school: 'A school, or a body running schools, or a school\'s own fund.',
    higher_education: 'A university or higher education provider.',
    other_education: 'Early childhood, training, tutoring, colleges that are not schools or universities.',
    justice: 'Legal services, courts support, prisoners, people leaving prison, victims of crime, youth justice.',
    housing: 'Housing and homelessness.',
    children_families_youth: 'Child protection, family support, youth services.',
    social_welfare: 'Other community and welfare services, emergency relief.',
    religion: 'Churches, parishes, religious orders, religious practice.',
    arts_culture: 'Arts, culture, heritage, museums, language and cultural maintenance.',
    environment_animals: 'Environment, conservation, land care, animal welfare.',
    sport_recreation: 'Sport and recreation clubs.',
    international: 'Overseas aid and development.',
    grantmaking: 'Foundations and funds whose main work is giving money to other charities.',
    land_economic: 'Land councils, native title bodies, economic development, industry bodies.',
    other: 'None of the above.',
  },
}

// Closing the Gap National Agreement, clause 44. Jev cannot see board composition; it judges from the
// organisation's own name and description, so "can't tell" is a real answer.
const CONTROL = {
  type: 'choice',
  instructions:
    'Is this an Aboriginal or Torres Strait Islander community-controlled organisation? Under the Closing the Gap ' +
    'definition that means a not-for-profit set up by and controlled by Aboriginal or Torres Strait Islander people, ' +
    'connected to its community, with a majority Aboriginal or Torres Strait Islander board. Judge from the name and ' +
    'the description. Peak bodies of community-controlled organisations count as community controlled.',
  criteria: {
    community_controlled: 'Clearly set up and run by Aboriginal or Torres Strait Islander people or communities.',
    mainstream: 'A general organisation that serves Aboriginal or Torres Strait Islander people among others, or runs programs for them.',
    government: 'A government body, statutory authority or government-owned entity.',
    cannot_tell: 'The name and description are not enough to tell.',
  },
}

const SCHOOL = {
  type: 'choice',
  instructions: 'What kind of education organisation is this?',
  criteria: {
    nongov_school: 'A non-government school (independent, Catholic, Anglican, other faith or community school) or the body that runs it.',
    school_fund: 'A school\'s own building fund, scholarship fund, library fund, foundation or endowment.',
    government_school_body: 'A parents and citizens group, school council or support body of a government or public school.',
    university: 'A university, university college or residential college.',
    other_education: 'Early childhood, training, adult or other education that is not a school or university.',
    not_education: 'Not mainly an education organisation.',
  },
}

function describe(c) {
  return [
    `Charity: ${c.name}${c.other_names ? ` (also known as: ${String(c.other_names).slice(0, 200)})` : ''}`,
    `State: ${c.state ?? 'unknown'}. Size: ${c.charity_size ?? 'unknown'}.${c.oric ? ' Registered with the Office of the Registrar of Indigenous Corporations.' : ''}`,
    `Stated purposes: ${c.purposes ?? 'none listed'}`,
    `Who it says it serves: ${c.beneficiaries ?? 'none listed'}`,
    `How it pursues its purposes (its own words): ${c.how ?? 'not given'}`,
  ].join('\n')
}

async function ask(text, questions, attempt = 0) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.JEV_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, state: { text }, questions }),
    signal: AbortSignal.timeout(60000),
  })
  if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 5) {
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000))
    return ask(text, questions, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`)
  return res.json()
}

async function main() {
  if (!process.env.JEV_API_KEY) throw new Error('JEV_API_KEY is required')
  mkdirSync(OUT_DIR, { recursive: true })
  const all = psqlJson(SQL)
  const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).abn) : [])
  const queue = all.filter((c) => !done.has(c.abn)).slice(0, LIMIT)
  console.log(`${all.length} charities; ${done.size} done; ${queue.length} to do`)
  let cursor = 0
  let failed = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < queue.length) {
      const c = queue[cursor++]
      const questions = { sector: SECTOR }
      if (c.atsi || c.oric) questions.control = CONTROL
      if (c.edu) questions.school = SCHOOL
      try {
        const ans = (await ask(describe(c), questions))?.answers ?? {}
        const row = { abn: c.abn, name: c.name }
        for (const k of Object.keys(questions)) {
          row[k] = ans[k]?.choice ?? null
          row[`${k}_conf`] = ans[k]?.confidence ?? null
        }
        appendFileSync(OUT, JSON.stringify(row) + '\n')
      } catch (e) {
        failed++
        if (failed <= 3) console.error(`failed: ${c.name}: ${e.message}`)
      }
      if (cursor % 2000 === 0) console.log(`  ${cursor}/${queue.length}`)
    }
  }))
  console.log(`done; ${failed} failed (re-run to retry)`)
}

main().catch((e) => { console.error(e); process.exit(1) })

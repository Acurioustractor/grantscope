#!/usr/bin/env node

/**
 * Guard against columns in the same table that contradict each other.
 *
 * Not a schema check (scripts/watch-schema-health.mjs does shape) and not a
 * money check (/money-audit does lanes). This is for the case where two fields
 * on one row make incompatible claims and something downstream reads the wrong
 * one.
 *
 *   node --env-file=.env scripts/check-data-contradictions.mjs
 *   node --env-file=.env scripts/check-data-contradictions.mjs --update-baselines
 *
 * Exits non-zero when a count rises ABOVE its recorded baseline. It does not
 * fail on the baseline itself: these are known, documented states, and a check
 * that is red on the day it ships gets muted within a week. What matters is
 * that the number stops growing.
 *
 * ── Why baselines rather than zero ──────────────────────────────────────────
 *
 * The first guard here counts 248 rows. Fixing them is a separate decision that
 * needs someone to rule on which column is authoritative. Until then the useful
 * signal is not "there are 248" but "a tagger ran again and now there are 300".
 *
 * Raise a baseline only with the reason written next to it.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'

const BASELINES = 'data/contradiction-baselines.json'

const CHECKS = [
  {
    id: 'alma_youth_justice_tag_vs_flag',
    title: 'alma_interventions: topics says youth-justice, serves_youth_justice says otherwise',
    /**
     * Found 2026-09-21 by scripts/jev-check-loop.mjs --audit
     * alma_intervention_validity. 195 of the 248 have "youth" in the name and
     * 177 have "youth" without "justice" — "Youth Worship Service (Sunday 3rd
     * Service)" from Melbourne Full Gospel Church, "Pursue Youth Camp" from New
     * Beginnings Baptist Church. A keyword tagger matched "youth" and wrote
     * youth-justice.
     *
     * It matters because the published report path reads the TAG, not the flag:
     * report-service.ts filters on topics @> ARRAY['<topic>'], and only five
     * files under apps/web/src mention serves_youth_justice at all against 145
     * references to the table.
     *
     * Full reasoning: thoughts/shared/findings/alma-interventions-off-domain-2026-09-21.md
     */
    /**
     * `= false`, NOT `IS NOT TRUE`.
     *
     * The first version of this check used IS NOT TRUE and counted 248. That
     * folds NULL in with false, and 154 of those rows have a NULL flag: nobody
     * ever assessed them. Unassessed is an abstention, not a contradiction, and
     * treating the two as one overstated the defect by a factor of two and a
     * half. That is precisely the mistake this file exists to catch, made
     * inside it.
     *
     * The unassessed rows are counted separately below, as a backlog.
     */
    sql: `SELECT count(*)::int AS n FROM alma_interventions
           WHERE serves_youth_justice = false
             AND topics @> ARRAY['youth-justice']::text[]`,
    why: 'a keyword tagger matched "youth" and wrote the youth-justice topic onto rows the table itself marks as not youth justice',
    owner: 'unknown — no writer in this repo assigns these tags; provenance is template_generated and web_scraped, Jan 2026',
  },
  {
    id: 'alma_youth_justice_tagged_but_unassessed',
    title: 'alma_interventions: tagged youth-justice, but serves_youth_justice was never assessed',
    /**
     * A backlog, not a contradiction. These rows carry the tag and a NULL flag,
     * so nothing has ever ruled on them either way. They are tracked because a
     * RISE means new rows are arriving pre-tagged and unassessed, which is how
     * the 64 stripped on 2026-09-21 got in.
     *
     * Do not "fix" these by setting the flag false. Nobody has looked.
     */
    sql: `SELECT count(*)::int AS n FROM alma_interventions
           WHERE serves_youth_justice IS NULL
             AND topics @> ARRAY['youth-justice']::text[]`,
    why: 'rows carry a youth-justice tag that nobody has ever assessed; a rise means new rows arrive pre-tagged',
    owner: 'same unidentified tagger',
  },
]

const argv = process.argv.slice(2)
const UPDATE = argv.includes('--update-baselines')

function loadBaselines() {
  try {
    return JSON.parse(readFileSync(BASELINES, 'utf8'))
  } catch {
    return {}
  }
}

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    // Say so rather than passing silently. A guard that reports success when it
    // could not run is worse than no guard.
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required; nothing was checked')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const baselines = loadBaselines()
  const results = []
  let worse = 0

  for (const check of CHECKS) {
    const { data, error } = await sb.rpc('exec_sql', { query: check.sql.trim() })
    if (error) {
      console.error(`✗ ${check.id}: query failed — ${error.message}`)
      process.exitCode = 2
      continue
    }
    const n = Number(data?.[0]?.n ?? 0)
    const base = baselines[check.id]?.count
    results.push({ id: check.id, n, base })

    if (base === undefined) {
      console.log(`? ${check.id}: ${n} (no baseline recorded)`)
    } else if (n > base) {
      console.error(`✗ ${check.id}: ${n}, was ${base} (+${n - base})`)
      console.error(`   ${check.title}`)
      console.error(`   ${check.why}`)
      worse++
    } else if (n < base) {
      console.log(`✓ ${check.id}: ${n}, down from ${base}`)
    } else {
      console.log(`· ${check.id}: ${n}, unchanged`)
    }
  }

  if (UPDATE) {
    const next = { ...baselines }
    for (const r of results) {
      next[r.id] = { count: r.n, recorded_at: new Date().toISOString().slice(0, 10) }
    }
    writeFileSync(BASELINES, JSON.stringify(next, null, 2) + '\n')
    console.log(`\nwrote ${BASELINES}`)
    return
  }

  if (worse) {
    console.error(`\n${worse} contradiction(s) grew. Something wrote to these columns again.`)
    console.error('If the growth is legitimate, raise the baseline WITH the reason:')
    console.error('  node --env-file=.env scripts/check-data-contradictions.mjs --update-baselines')
    process.exit(1)
  }
  console.log('\n✓ no contradiction grew')
}

run().catch((e) => {
  console.error(e.message)
  process.exit(2)
})

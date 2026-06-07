#!/usr/bin/env node
/**
 * backfill-se-abns-fuzzy.mjs — Phase 3-4 ABN backfill for social_enterprises
 *
 * Picks up where backfill-se-abns.mjs (exact/variant probes) left off:
 * ~1,911 records still missing the ABN that joins them to the evidence layer.
 *
 * Phases (cumulative exclusion; all guards conservative — a wrong ABN attaches
 * wrong evidence to a public profile, so prefer missed matches over bad ones):
 *  3a. Normalized-exact vs gs_entities — strip punctuation + legal suffixes on
 *      BOTH sides (phases 1-2 only appended suffixes, never stripped).
 *  3b. Stripped-name probes (+ suffix & "SURNAME, GIVEN" person variants) vs
 *      abr_registry Active legal names (btree on UPPER(entity_name)).
 *  3c. Trigram fuzzy (pg_trgm, similarity >= 0.85) vs gs_entities.
 *  4.  ABN Lookup MatchingNames API — catches business/trading names that map
 *      to a different legal entity (e.g. "Beacon Laundry" -> LIGHTHOUSE
 *      LAUNDRY SERVICES LTD). Score-gated, postcode cross-checked, Active only.
 *
 * Shared guards:
 *  - Unambiguous: exactly one distinct candidate ABN per SE record, else skip.
 *  - State agreement when both sides carry one. supply-nation state='ACT' is a
 *    scraper default (601 of 956 rows) — treated as NULL, never trusted.
 *
 * Dry-run by default; --live applies. Every run writes a proposals CSV to
 * data/backups/ for audit. API responses cached in data/abn-lookup-cache-se.jsonl
 * so re-runs don't re-call.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';

const LIVE = process.argv.includes('--live');
const GUID = process.env.ABN_LOOKUP_GUID;
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
const CACHE_FILE = 'data/abn-lookup-cache-se.jsonl';
const PROPOSALS_FILE = `data/backups/${new Date().toISOString().slice(0, 10)}-se-abn-fuzzy-proposals.csv`;
const API_DELAY_MS = 120;

if (!process.env.DATABASE_PASSWORD) {
  console.error('DATABASE_PASSWORD not set — run with --env-file=.env');
  process.exit(1);
}

// ---------- SQL runner (unlike lib/psql.mjs, surfaces errors instead of returning []) ----------

function runSql(query, { pre = '', timeout = 300000, label = 'se-fuzzy' } = {}) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const sqlFile = `/tmp/${label}-${stamp}.sql`;
  const outFile = `/tmp/${label}-${stamp}.out`;
  // \o redirects only query results to outFile; SET command tags stay on stdout.
  // json_agg avoids CSV parsing entirely.
  writeFileSync(sqlFile, `SET statement_timeout = '280s';\n${pre}\n\\t on\n\\a\n\\o ${outFile}\nSELECT COALESCE(json_agg(t), '[]'::json) FROM (\n${query}\n) t;\n\\o\n`);
  try {
    execSync(`psql "${CONN}" -v ON_ERROR_STOP=1 -q -f ${sqlFile}`, { encoding: 'utf-8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
    const raw = readFileSync(outFile, 'utf-8').trim();
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    throw new Error(`psql failed: ${err.stderr || err.message}`);
  } finally {
    try { unlinkSync(sqlFile); } catch {}
    try { unlinkSync(outFile); } catch {}
  }
}

function runDml(statement, { timeout = 300000, label = 'se-fuzzy-dml' } = {}) {
  const sqlFile = `/tmp/${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.sql`;
  writeFileSync(sqlFile, `SET statement_timeout = '280s';\n${statement}`);
  try {
    const out = execSync(`psql "${CONN}" -v ON_ERROR_STOP=1 -f ${sqlFile}`, { encoding: 'utf-8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
    const m = out.match(/UPDATE (\d+)/g) || [];
    return m.reduce((sum, tag) => sum + Number(tag.slice(7)), 0);
  } catch (err) {
    throw new Error(`psql DML failed: ${err.stderr || err.message}`);
  } finally {
    try { unlinkSync(sqlFile); } catch {}
  }
}

// ---------- shared SQL fragments ----------

const esc = (v) => String(v).replace(/'/g, "''");

// uppercase, & -> AND, punctuation -> space, collapse whitespace, strip trailing
// legal suffixes twice (handles "X PTY LTD" et al; POSIX alternation prefers longest match)
const SUFFIX_RE = ` (PTY LTD|PTY LIMITED|PTY|LTD|LIMITED|INC|INCORPORATED)$`;
const norm = (expr) => `TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(${expr}), '&', ' AND ', 'g'), '[^A-Z0-9 ]+', ' ', 'g'), '\\s+', ' ', 'g'), '${SUFFIX_RE}', ''), '${SUFFIX_RE}', ''))`;

// supply-nation state='ACT' is a scraper default — never trust it
const trustedStateSql = `CASE WHEN source_primary = 'supply-nation' AND state = 'ACT' THEN NULL ELSE NULLIF(TRIM(state), '') END`;

function baseSql(excludeIds) {
  const exclude = excludeIds.length ? `AND id NOT IN (${excludeIds.map((id) => `'${id}'::uuid`).join(',')})` : '';
  return `
    SELECT id, name, ${trustedStateSql} AS state, ${norm('name')} AS nname
    FROM social_enterprises
    WHERE abn IS NULL AND LENGTH(TRIM(name)) >= 4 ${exclude}`;
}

// ---------- phases ----------

function phase3aGraphNormExact(excludeIds) {
  return runSql(`
    WITH base AS (${baseSql(excludeIds)}),
    nb AS (SELECT * FROM base WHERE LENGTH(nname) >= 5),
    cand AS (
      SELECT nb.id, nb.name, e.abn
      FROM nb
      JOIN gs_entities e ON ${norm('e.canonical_name')} = nb.nname AND e.abn IS NOT NULL
      WHERE (nb.state IS NULL OR e.state IS NULL OR UPPER(e.state) = UPPER(nb.state))
      GROUP BY 1, 2, 3
    )
    SELECT id, name, MIN(abn) AS abn, 'norm-exact-graph' AS evidence
    FROM cand GROUP BY 1, 2 HAVING COUNT(*) = 1
  `, { label: 'se-fuzzy-3a' });
}

function phase3bAbrProbes(excludeIds) {
  return runSql(`
    WITH base AS (${baseSql(excludeIds)}),
    nb AS (SELECT * FROM base WHERE LENGTH(nname) >= 5),
    amp AS (
      SELECT id, name, state, nname AS v FROM nb
      UNION
      SELECT id, name, state, REPLACE(nname, ' AND ', ' & ') FROM nb WHERE nname LIKE '% AND %'
    ),
    probes AS (
      SELECT id, name, state, v AS probe FROM amp
      UNION
      SELECT id, name, state, v || s.suffix
      FROM amp CROSS JOIN (VALUES (' PTY LTD'), (' PTY. LTD.'), (' PTY LIMITED'), (' LTD'), (' LTD.'), (' LIMITED'), (' INC'), (' INC.'), (' INCORPORATED')) AS s(suffix)
      UNION
      -- sole traders: ABR stores individuals as "SURNAME, GIVEN NAMES"
      SELECT id, name, state,
             SUBSTRING(v FROM '([A-Z]+)$') || ', ' || TRIM(SUBSTRING(v FROM '^(.*) [A-Z]+$'))
      FROM amp WHERE v ~ '^[A-Z]+( [A-Z]+){1,3}$'
    ),
    cand AS (
      SELECT p.id, p.name, ar.abn
      FROM probes p
      JOIN abr_registry ar ON UPPER(ar.entity_name) = p.probe AND ar.status = 'Active'
      WHERE (p.state IS NULL OR ar.state IS NULL OR UPPER(ar.state) = UPPER(p.state))
      GROUP BY 1, 2, 3
    )
    SELECT id, name, MIN(abn) AS abn, 'norm-probe-abr' AS evidence
    FROM cand GROUP BY 1, 2 HAVING COUNT(*) = 1
  `, { label: 'se-fuzzy-3b' });
}

function phase3cTrigram(excludeIds) {
  return runSql(`
    WITH base AS (${baseSql(excludeIds)}),
    cand AS (
      SELECT b.id, b.name, e.abn,
             MAX(extensions.similarity(e.canonical_name, b.name)) AS sim
      FROM base b
      JOIN gs_entities e ON e.canonical_name OPERATOR(extensions.%) b.name AND e.abn IS NOT NULL
      WHERE (b.state IS NULL OR e.state IS NULL OR UPPER(e.state) = UPPER(b.state))
      GROUP BY 1, 2, 3
    )
    SELECT id, name, MIN(abn) AS abn, 'trgm-' || ROUND(MAX(sim)::numeric, 3) AS evidence
    FROM cand GROUP BY 1, 2 HAVING COUNT(*) = 1
  `, { pre: 'SET pg_trgm.similarity_threshold = 0.85;', label: 'se-fuzzy-3c' });
}

// ---------- phase 4: ABN Lookup API ----------

function loadCache() {
  const cache = new Map();
  if (existsSync(CACHE_FILE)) {
    for (const line of readFileSync(CACHE_FILE, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const { q, names } = JSON.parse(line);
        cache.set(q, names);
      } catch {}
    }
  }
  return cache;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function matchingNames(query, cache) {
  if (cache.has(query)) return cache.get(query);
  const url = `https://abr.business.gov.au/json/MatchingNames.aspx?name=${encodeURIComponent(query)}&maxResults=8&guid=${GUID}`;
  let names = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      const json = JSON.parse(text.replace(/^callback\(/, '').replace(/\)\s*$/, ''));
      if (json.Message && !json.Names) throw new Error(json.Message);
      names = json.Names || [];
      break;
    } catch (err) {
      if (attempt === 3) {
        console.error(`  API failed for "${query}": ${err.message}`);
        return null; // do not cache failures
      }
      await sleep(1000 * attempt);
    }
  }
  cache.set(query, names);
  appendFileSync(CACHE_FILE, JSON.stringify({ q: query, names }) + '\n');
  await sleep(API_DELAY_MS);
  return names;
}

const ACTIVE = '0000000001';

/**
 * Accept rules (per SE record, candidates grouped to best-score per distinct ABN):
 *  A. postcode path: exactly one Active candidate shares the SE's postcode,
 *     score >= 90, and within 5 points of the overall top score.
 *  B. score path: top candidate is Active, score >= 96, and every other distinct
 *     ABN trails by >= 3 points. State conflict (both present, trusted) rejects.
 */
function decide(se, candidates) {
  if (!candidates?.length) return null;
  const byAbn = new Map();
  for (const c of candidates) {
    const prev = byAbn.get(c.Abn);
    if (!prev || c.Score > prev.Score) byAbn.set(c.Abn, c);
  }
  const ranked = [...byAbn.values()].sort((a, b) => b.Score - a.Score);
  const top = ranked[0];
  const sePc = /^[0-9]{4}$/.test(se.postcode || '') ? se.postcode : null;

  if (sePc) {
    const pcCands = ranked.filter((c) => c.Postcode === sePc && c.AbnStatus === ACTIVE && c.Score >= 90);
    if (pcCands.length === 1 && pcCands[0].Score >= top.Score - 5) {
      const c = pcCands[0];
      return { abn: c.Abn, evidence: `api-${c.Score}-pc:${c.Name}` };
    }
  }

  if (top.AbnStatus !== ACTIVE || top.Score < 96) return null;
  if (se.state && top.State && top.State !== se.state) return null;
  const runnerUp = ranked[1];
  if (runnerUp && top.Score - runnerUp.Score < 3) return null;
  return { abn: top.Abn, evidence: `api-${top.Score}:${top.Name}` };
}

async function phase4Api(rows) {
  const cache = loadCache();
  const matches = [];
  let done = 0;
  for (const se of rows) {
    const probes = [se.name];
    const paren = se.name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (paren) probes.push(paren[1].trim(), paren[2].trim());
    for (const probe of probes) {
      if (probe.length < 4) continue;
      const names = await matchingNames(probe, cache);
      const verdict = names && decide(se, names);
      if (verdict) {
        matches.push({ id: se.id, name: se.name, ...verdict });
        break;
      }
    }
    if (++done % 100 === 0) console.log(`  [api] ${done}/${rows.length} queried, ${matches.length} matched`);
  }
  return matches;
}

// ---------- apply + report ----------

function applyMatches(matches, label) {
  let applied = 0;
  for (let i = 0; i < matches.length; i += 50) {
    const batch = matches.slice(i, i + 50);
    const values = batch.map((m) => `('${m.id}'::uuid, '${esc(m.abn)}')`).join(',\n        ');
    applied += runDml(`
      UPDATE social_enterprises se
      SET abn = v.abn, updated_at = now()
      FROM (VALUES
        ${values}
      ) AS v(id, abn)
      WHERE se.id = v.id AND se.abn IS NULL;
    `);
  }
  console.log(`  [${label}] applied ${applied} updates`);
  return applied;
}

function report(matches, label) {
  console.log(`  ${matches.length} unambiguous matches via ${label}`);
  if (!LIVE) matches.slice(0, 5).forEach((m) => console.log(`    ${m.name} -> ABN ${m.abn} (${m.evidence})`));
}

async function main() {
  if (!GUID) {
    console.error('ABN_LOOKUP_GUID not set — phases 3a-3c will run, phase 4 (API) will be skipped.');
  }
  console.log(`Mode: ${LIVE ? 'LIVE' : 'DRY RUN'}\n`);

  const all = [];
  const excludeIds = () => all.map((m) => m.id);

  console.log('Phase 3a: normalized-exact vs gs_entities...');
  const p3a = phase3aGraphNormExact([]);
  report(p3a, 'norm-exact gs_entities');
  all.push(...p3a.map((m) => ({ ...m, phase: '3a' })));

  console.log('\nPhase 3b: stripped+suffix/person probes vs abr_registry (Active)...');
  const p3b = phase3bAbrProbes(excludeIds());
  report(p3b, 'norm-probe abr_registry');
  all.push(...p3b.map((m) => ({ ...m, phase: '3b' })));

  console.log('\nPhase 3c: trigram fuzzy (sim >= 0.85) vs gs_entities...');
  const p3c = phase3cTrigram(excludeIds());
  report(p3c, 'trigram gs_entities');
  all.push(...p3c.map((m) => ({ ...m, phase: '3c' })));

  if (GUID) {
    console.log('\nPhase 4: ABN Lookup MatchingNames API for the remainder...');
    const remainder = runSql(`
      WITH base AS (${baseSql(excludeIds())})
      SELECT b.id, b.name, b.state, se.postcode
      FROM base b JOIN social_enterprises se ON se.id = b.id
    `, { label: 'se-fuzzy-rem' });
    console.log(`  ${remainder.length} records to query`);
    const p4 = await phase4Api(remainder);
    report(p4, 'abn-lookup api');
    all.push(...p4.map((m) => ({ ...m, phase: '4' })));
  }

  // audit trail — written on every run, dry or live
  mkdirSync('data/backups', { recursive: true });
  const csv = ['phase,id,name,abn,evidence']
    .concat(all.map((m) => `${m.phase},${m.id},"${m.name.replace(/"/g, '""')}",${m.abn},"${String(m.evidence).replace(/"/g, '""')}"`))
    .join('\n');
  writeFileSync(PROPOSALS_FILE, csv + '\n');
  console.log(`\nProposals written to ${PROPOSALS_FILE}`);

  if (LIVE) {
    console.log('\nApplying...');
    applyMatches(all, 'all-phases');
  }

  const after = runSql(`
    SELECT COUNT(*) FILTER (WHERE abn IS NULL) AS still_missing,
           COUNT(*) FILTER (WHERE abn IS NOT NULL) AS with_abn,
           COUNT(*) AS total
    FROM social_enterprises
  `, { label: 'se-fuzzy-after' });
  const a = after[0];
  const byPhase = all.reduce((acc, m) => ((acc[m.phase] = (acc[m.phase] || 0) + 1), acc), {});
  console.log(`\n${LIVE ? 'After' : 'Current (no changes applied)'}: ${a.with_abn}/${a.total} with ABN; ${a.still_missing} still missing`);
  console.log(`Matched this run: ${all.length} ${JSON.stringify(byPhase)}${LIVE ? '' : ' (dry run — re-run with --live to apply)'}`);
}

main().catch((err) => {
  console.error('backfill-se-abns-fuzzy failed:', err.message);
  process.exit(1);
});

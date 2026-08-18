#!/usr/bin/env node
/**
 * The shared half of a grantee ingest: resolve a funder's grantee names to graph entities.
 *
 * WHY THIS EXISTS
 *
 * Four funder ingests have been done (McKinnon, Telethon, HMST, Lotterywest) and each one
 * re-implemented the same expensive, error-prone half by hand: exact match, trigram tiers, the
 * judge band, false-friend rules, the held-out list. `scripts/` has grown 29 foundation/grantee
 * scripts as a result. The extraction genuinely differs per funder — a CSV, a PDF table, an API,
 * 27 prose posts. The resolution does not.
 *
 * So: extraction stays per-funder and writes ONE agreed shape. Everything after it lives here.
 *
 * INPUT   <source>.tsv   name <TAB> amount <TAB> year        (raw, unresolved; amount in dollars)
 * OUTPUT  <source>-linked.tsv   name, amount, year, gs_id, confidence   — ready for the migration
 *         <source>-judge.tsv    the 0.60-0.80 band, one row per name, for human/agent adjudication
 *         <source>-heldout.tsv  names with no candidate, so the miss is NAMED, never silent
 *
 * TIERS (the method proven 4x — do not loosen without a reason written down)
 *   exact name match            -> confidence 'reported'
 *   trigram >= 0.80             -> confidence 'inferred', auto-accepted
 *   trigram 0.60 - 0.80         -> NOT accepted. Written to -judge.tsv with state/type context
 *   no candidate >= 0.60        -> held out, named in -heldout.tsv
 *
 * Matching runs as ONE bulk SQL pass using the `%` operator with pg_trgm.similarity_threshold —
 * bare similarity() cannot use the GIN index and times out on 1,589 names x 609K entities.
 *
 * Usage:
 *   node scripts/grantee-resolve.mjs --in data/ingest/ian-potter-raw.tsv
 *   node scripts/grantee-resolve.mjs --in <file> --accept data/ingest/ian-potter-judge-accepted.tsv
 *
 *   --accept  a judge-adjudicated file (name <TAB> gs_id) folded in as 'inferred'. Re-run after
 *             adjudication to produce the final -linked.tsv.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';

const exec = promisify(execFile);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const IN = arg('in');
const ACCEPT = arg('accept');
const LOW = Number(arg('low', '0.60'));
const HIGH = Number(arg('high', '0.80'));

if (!IN) {
  console.error('grantee-resolve: --in <raw.tsv> is required (name<TAB>amount<TAB>year)');
  process.exit(2);
}
if (!existsSync(IN)) {
  console.error(`grantee-resolve: no such file ${IN}`);
  process.exit(2);
}

const base = IN.replace(/(-raw)?\.tsv$/, '');
const outLinked = `${base}-linked.tsv`;
const outJudge = `${base}-judge.tsv`;
const outHeldout = `${base}-heldout.tsv`;

const PG = {
  host: 'aws-0-ap-southeast-2.pooler.supabase.com',
  port: '5432',
  user: 'postgres.tednluwflfhxyucgwigh',
  db: 'postgres',
};

async function psql(sql, { tuples = true } = {}) {
  const args = ['-h', PG.host, '-p', PG.port, '-U', PG.user, '-d', PG.db, '-v', 'ON_ERROR_STOP=1'];
  if (tuples) args.push('-t', '-A', '-F', '\t');
  args.push('-c', sql);
  const { stdout } = await exec('psql', args, {
    env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD },
    maxBuffer: 200 * 1024 * 1024,
  });
  return stdout;
}

/** Rows in, deduped names out. Blank and obviously-non-org names are dropped loudly, not quietly. */
function readRaw(path) {
  const rows = [];
  const skipped = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const [name, amount, year] = line.split('\t');
    const clean = (name ?? '').trim();
    if (!clean || /^(total|totals|grand total|subtotal|various|n\/a|na|unknown|tbc|other|\(blank\))$/i.test(clean)) {
      skipped.push(line);
      continue;
    }
    rows.push({ name: clean, amount: amount?.trim() ?? '', year: year?.trim() ?? '' });
  }
  return { rows, skipped };
}

const { rows, skipped } = readRaw(IN);
const names = [...new Set(rows.map((r) => r.name))];
console.log(`${rows.length} rows · ${names.length} distinct names${skipped.length ? ` · ${skipped.length} aggregate-shaped rows dropped` : ''}`);

// One bulk pass. The names go in as a VALUES list rather than a temp table so this stays a single
// statement (psql -c) and needs no session state.
const literal = (v) => `'${String(v).replace(/'/g, "''")}'`;
const valuesList = names.map((n) => `(${literal(n)})`).join(',');

const sql = `
SET pg_trgm.similarity_threshold = ${LOW};
WITH n(raw) AS (VALUES ${valuesList}),
-- ALL exact matches, not one: a name matching two entities is ambiguous, and which one is right
-- is a judgement. 'La Trobe University' resolves to both a company and a foundation with different
-- ABNs — the org-vs-its-own-fundraising-foundation false friend, exactly the case the method says
-- to rule on rather than guess. Picking one silently is how a grant gets attributed to the wrong
-- legal entity.
exact AS (
  SELECT n.raw, e.gs_id, 1.0::numeric AS score, e.canonical_name, e.state, e.entity_type
  FROM n
  JOIN gs_entities e ON lower(btrim(e.canonical_name)) = lower(btrim(n.raw))
),
fuzzy AS (
  SELECT DISTINCT ON (n.raw)
         n.raw, e.gs_id, similarity(e.canonical_name, n.raw)::numeric AS score,
         e.canonical_name, e.state, e.entity_type
  FROM n
  JOIN gs_entities e ON e.canonical_name % n.raw
  WHERE NOT EXISTS (SELECT 1 FROM exact x WHERE x.raw = n.raw)
  ORDER BY n.raw, similarity(e.canonical_name, n.raw) DESC, e.gs_id
)
SELECT raw, gs_id, round(score, 3), canonical_name, coalesce(state, ''), coalesce(entity_type, '')
FROM (SELECT * FROM exact UNION ALL SELECT * FROM fuzzy) z
ORDER BY raw;
`;

console.log('resolving against gs_entities (one bulk trigram pass)…');
const started = Date.now();
let out;
try {
  out = await psql(sql);
} catch (err) {
  console.error('resolve query failed:', (err.stderr || err.message || '').split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}
console.log(`matched in ${Math.round((Date.now() - started) / 1000)}s`);

// A name may come back with several candidates. One exact match is a resolution; two or more is a
// question, and the harness must not answer it by picking a row order.
const candidates = new Map();
for (const line of out.split('\n')) {
  if (!line.trim()) continue;
  const [raw, gs_id, score, canonical, state, type] = line.split('\t');
  if (!candidates.has(raw)) candidates.set(raw, []);
  candidates.get(raw).push({ gs_id, score: Number(score), canonical, state, type });
}

const matched = new Map();
const ambiguous = new Map();
for (const [raw, list] of candidates) {
  const exacts = list.filter((c) => c.score >= 1);
  if (exacts.length === 1) {
    matched.set(raw, exacts[0]);
  } else if (exacts.length > 1) {
    ambiguous.set(raw, exacts);
  } else {
    // Fuzzy: best score wins, gs_id breaks ties so a re-run gives the same answer.
    list.sort((a, b) => b.score - a.score || a.gs_id.localeCompare(b.gs_id));
    matched.set(raw, list[0]);
  }
}
if (ambiguous.size) {
  console.log(`${ambiguous.size} name(s) matched MORE THAN ONE entity exactly — sent to the judge band, not guessed`);
}

// A judge-adjudicated file folds in as accepted 'inferred' matches.
const accepted = new Map();
if (ACCEPT && existsSync(ACCEPT)) {
  for (const line of readFileSync(ACCEPT, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const [name, gs_id] = line.split('\t');
    if (name && gs_id) accepted.set(name.trim(), gs_id.trim());
  }
  console.log(`${accepted.size} judge-accepted names folded in from ${ACCEPT}`);
}

const linked = [];
const judge = [];
const heldout = [];
const seenJudge = new Set();
const seenHeld = new Set();

for (const r of rows) {
  const acceptedId = accepted.get(r.name);
  if (acceptedId) {
    linked.push([r.name, r.amount, r.year, acceptedId, 'inferred']);
    continue;
  }
  const amb = ambiguous.get(r.name);
  if (amb) {
    if (!seenJudge.has(r.name)) {
      for (const c of amb) {
        judge.push([r.name, c.gs_id, 'EXACT-AMBIGUOUS', c.canonical, c.state, c.type]);
      }
      seenJudge.add(r.name);
    }
    continue;
  }
  const m = matched.get(r.name);
  if (!m) {
    if (!seenHeld.has(r.name)) { heldout.push([r.name, 'no candidate']); seenHeld.add(r.name); }
    continue;
  }
  if (m.score >= 1) {
    linked.push([r.name, r.amount, r.year, m.gs_id, 'reported']);
  } else if (m.score >= HIGH) {
    linked.push([r.name, r.amount, r.year, m.gs_id, 'inferred']);
  } else if (!seenJudge.has(r.name)) {
    // The band a human or judge agent must rule on. State and type ride along because the
    // false-friend rules need them: different town, different state of a federated charity,
    // org vs its own fundraising foundation.
    judge.push([r.name, m.gs_id, m.score, m.canonical, m.state, m.type]);
    seenJudge.add(r.name);
  }
}

const write = (path, rowsOut) => writeFileSync(path, rowsOut.map((r) => r.join('\t')).join('\n') + (rowsOut.length ? '\n' : ''));
write(outLinked, linked);
write(outJudge, judge);
write(outHeldout, heldout);

const dollars = (rs) => rs.reduce((sum, r) => sum + (Number(r[1]) || 0), 0);
console.log('');
console.log(`linked   ${linked.length} rows · $${dollars(linked).toLocaleString('en-AU')} -> ${outLinked}`);
console.log(`judge    ${judge.length} names in the ${LOW}-${HIGH} band -> ${outJudge}`);
console.log(`heldout  ${heldout.length} names with no candidate -> ${outHeldout}`);
console.log('');
console.log('Next: adjudicate the judge band (false-friend rules), then re-run with');
console.log(`  --accept <accepted.tsv>   to fold the accepts into ${outLinked}`);
console.log('Then generate the migration with scripts/grantee-migration.mjs.');

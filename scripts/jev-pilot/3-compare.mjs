#!/usr/bin/env node
/**
 * 3-compare.mjs — compare JEV against the incumbent chat-model verdicts, and
 * emit a BLIND adjudication sheet for the rows where they disagree.
 *
 * Three things come out of this, in order of how much they matter:
 *
 * 1. THE CALIBRATION PLOT. Bucket JEV's probabilities and, once the sheet is
 *    adjudicated, show observed correctness per bucket. If 0.9 does not mean
 *    roughly 90% right ON OUR DATA, the calibration claim does not hold here and
 *    the whole confidence-routing design dies with it. This is the decision.
 *    Until the sheet comes back, this prints the DISTRIBUTION only — shape, not
 *    correctness. Do not read it as accuracy.
 *
 * 2. ABSTENTION. How often each system says "not stated". The incumbent's nulls
 *    and JEV's middle band mean the same thing to the app, so they are directly
 *    comparable. More abstention is not automatically worse: the failure this
 *    path actually has is confident wrong flags, not missing ones.
 *
 * 3. AGREEMENT, per field. Cheap to compute, weakest evidence — two systems can
 *    agree and both be wrong. Reported last on purpose.
 *
 * The adjudication sheet is deliberately BLIND: system A/B are shuffled per row
 * with a seeded coin, and the key is written to a separate file. Grade the sheet
 * without the key open.
 *
 * Usage:
 *   node scripts/jev-pilot/3-compare.mjs
 *   node scripts/jev-pilot/3-compare.mjs --seed=7
 *
 * Reads  data/grant-eligibility-cache.jsonl, data/jev-pilot/jev-verdicts.jsonl
 * Writes data/jev-pilot/adjudication-sheet.csv, data/jev-pilot/adjudication-key.csv
 */

import fs from 'node:fs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const SEED = parseInt(arg('seed', '1'), 10);
const PRIMITIVE = arg('primitive', 'choice'); // which stage-2 run to grade

const FIELDS = ['dgr_required', 'accepts_charity', 'accepts_pty_ltd', 'accepts_sole_trader', 'accepts_unincorporated'];
const CACHE_PATH = 'data/grant-eligibility-cache.jsonl';
const JEV_PATH = PRIMITIVE === 'choice'
  ? 'data/jev-pilot/jev-verdicts-choice.jsonl'
  : 'data/jev-pilot/jev-verdicts.jsonl';
const SHEET_PATH = `data/jev-pilot/adjudication-sheet-${PRIMITIVE}.csv`;
const KEY_PATH = `data/jev-pilot/adjudication-key-${PRIMITIVE}.csv`;

const readJsonl = (p) => fs.existsSync(p)
  ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : [];

// Deterministic PRNG so a rerun with the same seed produces the same sheet.
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const show = (v) => v === true ? 'yes' : v === false ? 'no' : 'not stated';
const csv = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;

function main() {
  const incumbent = new Map(readJsonl(CACHE_PATH).map(r => [r.id, r]));
  const jev = readJsonl(JEV_PATH).filter(r => !r.error);
  const failed = readJsonl(JEV_PATH).filter(r => r.error).length;

  if (!jev.length) { console.error('no JEV verdicts yet — run 2-ask-jev.mjs first'); process.exit(1); }

  const paired = jev.filter(j => incumbent.has(j.id));
  console.log(`\nCompared ${paired.length} grants (${failed} JEV calls failed, ${jev.length - paired.length} had no incumbent verdict)\n`);

  // ── 1. probability distribution (NOT accuracy) ────────────────────────────
  const BUCKETS = [[0, 0.15], [0.15, 0.45], [0.45, 0.55], [0.55, 0.85], [0.85, 1.01]];
  const dist = BUCKETS.map(() => 0);
  let n = 0;
  for (const j of paired) for (const f of FIELDS) {
    // noul -> the probability itself; choice -> the confidence, since the
    // per-option probabilities are an object and a bare "winner" is not a signal
    const p = PRIMITIVE === 'choice' ? j.confidence?.[f] : j.probabilities?.[f];
    if (p == null) continue;
    n++;
    dist[BUCKETS.findIndex(([lo, hi]) => p >= lo && p < hi)]++;
  }
  console.log(`JEV ${PRIMITIVE === 'choice' ? 'confidence' : 'probability'} distribution (shape only — correctness needs the adjudicated sheet)`);
  BUCKETS.forEach(([lo, hi], i) => {
    const pct = n ? (dist[i] / n * 100) : 0;
    console.log(`  ${lo.toFixed(2)}-${hi === 1.01 ? '1.00' : hi.toFixed(2)}  ${String(dist[i]).padStart(5)}  ${(pct).toFixed(1).padStart(5)}%  ${'#'.repeat(Math.round(pct / 2))}`);
  });
  const confident = dist[0] + dist[4];
  console.log(`  -> ${(confident / n * 100).toFixed(1)}% of answers land outside the abstention band\n`);

  // ── 2. abstention ─────────────────────────────────────────────────────────
  console.log('Abstention rate ("not stated"), per field');
  console.log('  field                      incumbent      JEV');
  for (const f of FIELDS) {
    let iNull = 0, jNull = 0;
    for (const j of paired) {
      if (incumbent.get(j.id)[f] == null) iNull++;
      if (j.flags?.[f] == null) jNull++;
    }
    console.log(`  ${f.padEnd(24)} ${(iNull / paired.length * 100).toFixed(1).padStart(7)}%  ${(jNull / paired.length * 100).toFixed(1).padStart(7)}%`);
  }

  // ── 3. agreement + the disagreement set ───────────────────────────────────
  console.log('\nAgreement, per field (weakest evidence — both can be wrong together)');
  const disagreements = [];
  for (const f of FIELDS) {
    let same = 0, bothStated = 0, sameWhenStated = 0;
    for (const j of paired) {
      const a = incumbent.get(j.id)[f] ?? null;
      const b = j.flags?.[f] ?? null;
      if (a === b) same++;
      else disagreements.push({ id: j.id, name: j.name, url: j.url, field: f, incumbent: a, jev: b, p: PRIMITIVE === 'choice' ? j.confidence?.[f] : j.probabilities?.[f] });
      if (a !== null && b !== null) { bothStated++; if (a === b) sameWhenStated++; }
    }
    const whenStated = bothStated ? `${(sameWhenStated / bothStated * 100).toFixed(1)}% of ${bothStated} both-stated` : 'no both-stated rows';
    console.log(`  ${f.padEnd(24)} ${(same / paired.length * 100).toFixed(1).padStart(6)}% overall   (${whenStated})`);
  }

  // ── the blind sheet ───────────────────────────────────────────────────────
  const rnd = mulberry32(SEED);
  const sheet = [['row', 'grant', 'url', 'question', 'option_A', 'option_B', 'your_verdict (A / B / neither)'].map(csv).join(',')];
  const key = [['row', 'id', 'field', 'A_is', 'B_is', PRIMITIVE === 'choice' ? 'jev_confidence' : 'jev_probability'].map(csv).join(',')];

  disagreements.forEach((d, i) => {
    const flip = rnd() < 0.5;
    const A = flip ? d.jev : d.incumbent;
    const B = flip ? d.incumbent : d.jev;
    const question = {
      dgr_required: 'Does the page require applicants to hold DGR endorsement?',
      accepts_charity: 'Does the page say charities / not-for-profits may apply?',
      accepts_pty_ltd: 'Does the page say for-profit companies may apply?',
      accepts_sole_trader: 'Does the page say sole traders / individuals may apply?',
      accepts_unincorporated: 'Does the page say unincorporated groups may apply?',
    }[d.field];
    sheet.push([i + 1, d.name, d.url, question, show(A), show(B), ''].map(csv).join(','));
    key.push([i + 1, d.id, d.field, flip ? 'jev' : 'incumbent', flip ? 'incumbent' : 'jev', d.p ?? ''].map(csv).join(','));
  });

  fs.writeFileSync(SHEET_PATH, sheet.join('\n') + '\n');
  fs.writeFileSync(KEY_PATH, key.join('\n') + '\n');

  console.log(`\n${disagreements.length} disagreements across ${paired.length} grants x ${FIELDS.length} fields (${(disagreements.length / (paired.length * FIELDS.length) * 100).toFixed(1)}%)`);
  console.log(`  sheet: ${SHEET_PATH}  (grade this, key closed)`);
  console.log(`  key:   ${KEY_PATH}`);

  // ── latency + cost, measured ──────────────────────────────────────────────
  const lat = jev.filter(j => j.latency_ms).map(j => j.latency_ms).sort((a, b) => a - b);
  const tokens = jev.reduce((s, j) => s + (j.usage?.input_tokens || 0), 0);
  if (lat.length) {
    console.log(`\nJEV latency  p50=${lat[Math.floor(lat.length * 0.5)]}ms  p95=${lat[Math.floor(lat.length * 0.95)]}ms  (n=${lat.length})`);
    console.log(`JEV cost     ${tokens.toLocaleString()} input tokens -> $${(tokens * 42 / 1e9).toFixed(4)}  ($0.042/M, output free)`);
    console.log(`  per 1,000 grants: ~$${(tokens / lat.length * 1000 * 42 / 1e9).toFixed(3)}`);
  }
  console.log('\nIncumbent latency is not comparable from the cache — it stores no timing.');
  console.log('To compare, re-run enrich-grant-eligibility.mjs over the same ids with a timer.\n');
}

main();

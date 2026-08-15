#!/usr/bin/env node
/**
 * run-clarity-answers.mjs — compute every registered clarity question and store its answer.
 *
 * SOURCE OF TRUTH: clarity_question in the database. This script holds NO question text, NO SQL
 * and NO thresholds per question. Same discipline as refresh-views-v2.mjs, and for the same
 * reason: the last script that kept its own list drifted 16 entries away from the job that was
 * supposed to run it.
 *
 *   - which questions, and their SQL   → clarity_question
 *   - what may never be said about one → clarity_question.forbidden_phrasing (guarded in CI)
 *   - which sentinels apply            → clarity_sentinel.applies_to ('{}' = global)
 *
 * Each question contributes one clarity_answer row per run, including failures. A question that
 * errors is recorded with ok = false and its error text rather than silently retaining
 * yesterday's number — a stale answer that still renders is the exact failure this surface exists
 * to make impossible.
 *
 * SENTINELS ARE NOT ADVISORY. A 'block' sentinel that trips marks the answer not-ok. The three
 * armed ones each trace to a confirmed defect: 89% of political_donations dollars are not
 * donations, 13 austender rows carry 29.4% of all recorded contract value, and two category nodes
 * carry 17.6% of the graph's edges.
 *
 * Usage:
 *   node --env-file=.env scripts/run-clarity-answers.mjs
 *   node --env-file=.env scripts/run-clarity-answers.mjs --question evidence-gap
 *   node --env-file=.env scripts/run-clarity-answers.mjs --dry-run
 */
import { spawn } from 'child_process';

const HOST = 'aws-0-ap-southeast-2.pooler.supabase.com';
const PORT = 5432;
const USER = 'postgres.tednluwflfhxyucgwigh';
const DB = 'postgres';

const args = process.argv.slice(2);
const ONLY = args.includes('--question') ? args[args.indexOf('--question') + 1] : null;
const DRY_RUN = args.includes('--dry-run');

/**
 * Above this, the answer page must not offer a live re-run — it reads from the stored answer.
 * Measured, not assumed: evidence-gap runs at ~4.5s against a claimed 300ms budget, so this
 * threshold is the difference between a responsive page and one that hangs on click.
 */
const LIVE_RERUN_MS = 1000;

const QUERY_TIMEOUT_S = 120;

function log(msg) { console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`); }

function runPsql(sql, { timeout = QUERY_TIMEOUT_S, tuplesOnly = false } = {}) {
  return new Promise((resolve, reject) => {
    const fullSql = `SET statement_timeout = '${timeout}s'; ${sql}`;
    const env = { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD };
    const proc = spawn('psql', [
      '-h', HOST, '-p', String(PORT), '-U', USER, '-d', DB,
      '-v', 'ON_ERROR_STOP=1',
      ...(tuplesOnly ? ['-At', '-F', '|'] : []),
      '-c', fullSql,
    ], { env, timeout: (timeout + 30) * 1000 });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      else {
        const err = new Error(extractPsqlError(stderr) || `psql exit ${code}`);
        err.stdout = stdout; err.stderr = stderr; err.code = code;
        reject(err);
      }
    });
    proc.on('error', (e) => reject(e));
  });
}

function extractPsqlError(stderr) {
  if (!stderr) return null;
  const errLine = stderr.split('\n').find((l) => l.startsWith('ERROR:') || l.startsWith('FATAL:'));
  if (errLine) return errLine.replace(/^(ERROR|FATAL):\s*/, '').slice(0, 400);
  return stderr.split('\n').filter((l) => l.trim()).slice(-1)[0]?.slice(0, 400) || null;
}

const q = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);

/**
 * Run a statement that returns exactly one row, as JSON. Wrapping in row_to_json keeps parsing to
 * one shape regardless of the question's column list, and avoids splitting on '|' inside a value
 * that legitimately contains one.
 */
async function selectOneJson(sql, timeout = QUERY_TIMEOUT_S) {
  const { stdout } = await runPsql(
    `SELECT row_to_json(t) FROM (${sql}) t`,
    { timeout, tuplesOnly: true },
  );
  const line = stdout.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{')).pop();
  if (!line) throw new Error('query returned no row');
  return JSON.parse(line);
}

async function loadQuestions() {
  const where = ONLY
    ? `slug = ${q(ONLY)}`
    : `state IN ('answered','contested') AND answer_sql IS NOT NULL`;
  const { stdout } = await runPsql(
    `SELECT json_agg(json_build_object(
       'slug', slug, 'stub', stub, 'answer_sql', answer_sql,
       'coverage_sql', coverage_sql, 'rows_sql', rows_sql,
       'ingredients', (SELECT coalesce(json_agg(i.object_key), '[]'::json)
                         FROM clarity_question_ingredient i WHERE i.question_slug = clarity_question.slug)))
     FROM clarity_question WHERE ${where}`,
    { tuplesOnly: true },
  );
  const line = stdout.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('[')).pop();
  return line ? JSON.parse(line) : [];
}

async function loadSentinels() {
  const { stdout } = await runPsql(
    `SELECT json_agg(json_build_object(
       'key', key, 'severity', severity, 'probe_sql', probe_sql,
       'applies_to', applies_to, 'guards_objects', guards_objects))
     FROM clarity_sentinel`,
    { tuplesOnly: true },
  );
  const line = stdout.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('[')).pop();
  return line ? JSON.parse(line) : [];
}

/**
 * Probes run once per invocation, not once per question — they are global measurements over
 * whole tables and re-running them per question would triple the cost for an identical answer.
 */
async function probeSentinels(sentinels) {
  const results = {};
  for (const s of sentinels) {
    try {
      const r = await selectOneJson(s.probe_sql);
      results[s.key] = {
        tripped: r.tripped === true, n: r.n ?? null, share: r.share ?? null,
        detail: r.detail ?? null, severity: s.severity,
        applies_to: s.applies_to ?? [], guards_objects: s.guards_objects ?? [],
      };
      log(`  sentinel ${s.key}: ${r.tripped === true ? 'TRIPPED' : 'clear'}`
        + (r.n != null ? ` (n=${r.n})` : ''));
    } catch (err) {
      // A sentinel that cannot run is itself a finding — record it tripped rather than absent.
      results[s.key] = {
        tripped: true, error: err.message, severity: s.severity,
        applies_to: s.applies_to ?? [], guards_objects: s.guards_objects ?? [],
      };
      log(`  sentinel ${s.key}: ERROR — ${err.message}`);
    }
  }
  return results;
}

/**
 * Which sentinels attach to this question, and which of them may block it.
 *
 * A sentinel BLOCKS only when the question actually reads what the sentinel guards — named
 * explicitly in applies_to, or reached through the question's own ingredient list. An unscoped
 * sentinel is still RECORDED on the answer so it stays visible, but it does not block: a guard
 * that refuses every question is a guard that gets switched off.
 */
function flagsFor(slug, ingredients, probes, exemptions = {}) {
  const out = {};
  const reads = new Set(ingredients ?? []);
  for (const [key, r] of Object.entries(probes)) {
    const named = r.applies_to?.includes(slug) ?? false;
    const guarded = (r.guards_objects ?? []).some((o) => reads.has(o));
    const scoped = Boolean(r.applies_to?.length) || Boolean(r.guards_objects?.length);
    // An exemption is a written, per-question decision that this defect cannot reach this answer.
    // It never hides the sentinel — the flag still records that it tripped, and carries the reason
    // so the card can state it. A guard silently detached is the failure mode this replaces.
    const exemptReason = exemptions[`${key}|${slug}`] ?? null;
    out[key] = {
      tripped: r.tripped,
      n: r.n ?? null,
      share: r.share ?? null,
      severity: r.severity,
      // blocking is a property of THIS question, not of the sentinel alone
      blocking: r.severity === 'block' && (named || guarded) && !exemptReason,
      scope: !scoped ? 'unscoped' : (named ? 'named' : (guarded ? 'ingredient' : 'not-applicable')),
      ...(exemptReason ? { exempt_reason: exemptReason } : {}),
      ...(r.error ? { error: r.error } : {}),
    };
  }
  return out;
}

/**
 * Per-question sentinel exemptions, keyed `sentinelKey|questionSlug`. The reason is NOT NULL in the
 * schema and is carried onto the answer, because an exemption nobody can read is indistinguishable
 * from a guard somebody quietly switched off.
 */
async function loadExemptions() {
  const { stdout } = await runPsql(
    `SELECT coalesce(json_agg(json_build_object(
       'k', sentinel_key || '|' || question_slug, 'reason', reason)), '[]'::json)
     FROM clarity_sentinel_exemption`,
    { tuplesOnly: true },
  );
  const line = stdout.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('[')).pop();
  return Object.fromEntries((line ? JSON.parse(line) : []).map((e) => [e.k, e.reason]));
}

async function runOne(question, probes, exemptions) {
  const { slug } = question;
  log(`${slug} …`);
  const started = Date.now();
  let answer = null; let coverage = null; let rowCount = null;
  let ok = true; let errorText = null;

  try {
    answer = await selectOneJson(question.answer_sql);
  } catch (err) {
    ok = false; errorText = err.message;
    log(`  FAILED — ${err.message}`);
  }
  const durationMs = Date.now() - started;

  if (ok && question.coverage_sql) {
    try {
      coverage = await selectOneJson(question.coverage_sql);
    } catch (err) {
      // Coverage is not optional context: without it the headline renders without its
      // denominator. Failing to measure it fails the answer.
      ok = false; errorText = `coverage: ${err.message}`;
      log(`  coverage FAILED — ${err.message}`);
    }
  }

  if (ok && question.rows_sql) {
    try {
      const r = await selectOneJson(`SELECT count(*) AS n FROM (${question.rows_sql}) z`);
      rowCount = r.n ?? null;
    } catch (err) {
      log(`  rows count unavailable — ${err.message}`);   // non-fatal: the headline still stands
    }
  }

  const flags = flagsFor(slug, question.ingredients, probes, exemptions);
  const blocked = Object.entries(flags)
    .filter(([, f]) => f.tripped && f.blocking)
    .map(([k]) => k);
  if (ok && blocked.length) {
    ok = false;
    errorText = `blocked by sentinel: ${blocked.join(', ')}`;
    log(`  BLOCKED — ${blocked.join(', ')}`);
  }

  if (ok) {
    log(`  ${answer.headline} · ${answer.headline_sub} · ${durationMs}ms`
      + (rowCount != null ? ` · ${rowCount} rows` : ''));
  }

  if (DRY_RUN) return { slug, ok, durationMs };

  const payloadJson = answer?.payload ? JSON.stringify(answer.payload) : null;
  await runPsql(`
    INSERT INTO clarity_answer (question_slug, ok, error_text, payload, headline, headline_sub,
      headline_num, coverage_num, coverage_den, coverage_label, sentinel_flags, row_count, duration_ms)
    VALUES (${q(slug)}, ${ok}, ${q(errorText)}, ${payloadJson ? `${q(payloadJson)}::jsonb` : 'NULL'},
      ${q(answer?.headline)}, ${q(answer?.headline_sub)},
      ${answer?.headline_num ?? 'NULL'},
      ${coverage?.numerator ?? 'NULL'}, ${coverage?.denominator ?? 'NULL'}, ${q(coverage?.label)},
      ${q(JSON.stringify(flags))}::jsonb, ${rowCount ?? 'NULL'}, ${durationMs});

    UPDATE clarity_question
       SET measured_ms = ${durationMs},
           live_rerun_ok = ${durationMs <= LIVE_RERUN_MS && ok},
           updated_at = now()
     WHERE slug = ${q(slug)};
  `);

  return { slug, ok, durationMs };
}

async function main() {
  if (!process.env.DATABASE_PASSWORD) {
    console.error('DATABASE_PASSWORD missing — run with `node --env-file=.env`');
    process.exit(1);
  }

  const questions = await loadQuestions();
  if (!questions.length) { log('No questions to run.'); return; }
  log(`${questions.length} question(s)${DRY_RUN ? ' — DRY RUN, nothing will be written' : ''}`);

  const sentinels = await loadSentinels();
  log(`probing ${sentinels.length} sentinel(s)`);
  const probes = await probeSentinels(sentinels);
  const exemptions = await loadExemptions();
  if (Object.keys(exemptions).length) log(`${Object.keys(exemptions).length} sentinel exemption(s) in force`);

  const results = [];
  for (const question of questions) results.push(await runOne(question, probes, exemptions));

  const failed = results.filter((r) => !r.ok);
  log(`done — ${results.length - failed.length}/${results.length} ok`
    + (failed.length ? `, failed: ${failed.map((f) => f.slug).join(', ')}` : ''));
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });

#!/usr/bin/env node
/**
 * One background watcher for a whole landing, so nobody babysits `gh pr checks --watch`.
 *
 * Phases: CI settles → merge (squash, delete branch) → optional live verification of URLs.
 * Prints ONE summary line and exits 0 on success, non-zero on anything that needs a human.
 *
 * Usage:
 *   node scripts/ship-watch.mjs --pr 123 [--merge] [--verify https://civicgraph.app/foo]
 *                               [--verify https://civicgraph.app/bar=200] [--timeout 600]
 *
 *   --merge   squash-merge when every check passes. Omit for VISIBLE changes: the watcher then
 *             reports green and stops, leaving the merge to Ben after he has seen the preview.
 *   --verify  URL to curl after the deploy. A trailing `=CODE` (three digits) asserts an exact status; otherwise any
 *             non-5xx counts as alive (an admin route legitimately answers 401/403/307, and civicgraph.app answers
 *             429 to every HTTP client because of Vercel's JS challenge, which is why 429 counts as alive here).
 *             Query strings are safe: only a trailing three-digit `=CODE` is treated as an expectation.
 *
 * Never waits on advisory checks — only on what the rollup reports as pending. This repo has
 * no branch protection, so there is no required-check list to consult; every reported check is
 * treated as blocking, which is the conservative reading.
 *
 * STALE-CHECK GUARD (added after PR #317, 2026-08-19). #317 merged in FIVE SECONDS with Type Check
 * and Unit Tests still pending. `gh pr update-branch` had just pushed a new head commit, and the
 * check rollup had not yet caught up, so the watcher read the PREVIOUS commit's green and merged.
 * The sibling PR that day escaped only because its poll happened to land after the new run
 * registered. Luck, not design.
 *
 * Three defences, because any one of them alone still has a window:
 *   1. Read head SHA and rollup in ONE `gh pr view` call, so they cannot disagree with each other.
 *   2. Require green on TWO consecutive polls with an unchanged head SHA, and never merge inside
 *      the first MIN_SETTLE_S. A rollup that is about to be replaced does not survive that.
 *   3. Pass `--match-head-commit` to the merge, so if the head moves between the decision and the
 *      merge, GitHub itself refuses rather than landing something nobody checked.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function flag(name) {
  return process.argv.includes(`--${name}`);
}
function args(name) {
  const out = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]);
  });
  return out;
}

const PR = arg('pr');
const DO_MERGE = flag('merge');
const VERIFY = args('verify');
// 600s, not 1800s. A healthy pipeline here is ~230s, so ten minutes is already generous; the old
// half-hour default meant a hung job cost thirty minutes of waiting to learn nothing. Fail fast and
// read the log. Raise it per-invocation with --timeout when a run legitimately needs longer.
const TIMEOUT_S = Number(arg('timeout', '600'));
const POLL_MS = 20_000;

if (!PR) {
  console.error('ship-watch: --pr <number> is required');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const started = Date.now();
const elapsed = () => Math.round((Date.now() - started) / 1000);

async function gh(argv) {
  const { stdout } = await exec('gh', argv, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

const PENDING_STATES = ['PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED', 'WAITING', 'REQUESTED'];
const FAILED_STATES = ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'];

/**
 * Head SHA and rollup together, from one call, so they always describe the same commit.
 * A CheckRun is pending until status COMPLETED, then judged on conclusion; a StatusContext
 * (Vercel and friends) carries its verdict directly in `state`.
 */
async function checkState() {
  let raw = '';
  try {
    raw = await gh(['pr', 'view', PR, '--json', 'headRefOid,statusCheckRollup']);
  } catch (err) {
    raw = err.stdout || '';
  }
  if (!raw) return { settled: false, failed: [], pending: ['(gh unavailable)'], total: 0, head: null };

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { settled: false, failed: [], pending: ['(unparseable)'], total: 0, head: null };
  }

  const head = data.headRefOid || null;
  const rows = (data.statusCheckRollup || []).map((r) => ({
    name: r.name || r.context || '(unnamed)',
    state: r.__typename === 'CheckRun'
      ? (r.status === 'COMPLETED' ? (r.conclusion || 'NEUTRAL') : r.status)
      : r.state,
  }));

  const pending = rows.filter((r) => PENDING_STATES.includes(r.state));
  const failed = rows.filter((r) => FAILED_STATES.includes(r.state));
  return { settled: rows.length > 0 && pending.length === 0, failed, pending, total: rows.length, head };
}

async function verifyUrl(spec) {
  // `URL=CODE`, but only when the tail is a bare 3-digit status. Splitting on the first `=` ate the query string of
  // every URL that had one: `--verify '.../index?q=mission'` became url `.../index?q` with expected code "mission",
  // and `Number("mission")` is NaN, so two landings on 2026-09-05 reported a live-check failure that had not happened.
  const m = spec.match(/^(.*)=(\d{3})$/);
  const url = m ? m[1] : spec;
  const expected = m ? m[2] : null;
  try {
    const { stdout } = await exec('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-L', '--max-time', '30', url]);
    const code = Number(stdout.trim());
    if (expected) return { url, code, ok: code === Number(expected) };
    return { url, code, ok: code > 0 && code < 500 };
  } catch {
    return { url, code: 0, ok: false };
  }
}

(async () => {
  // Phase 1 — CI. Green must hold across two consecutive polls on the same head SHA before it
  // counts, and never inside the first MIN_SETTLE_S. See the stale-check note at the top.
  const MIN_SETTLE_S = 45;
  let confirmedHead = null;
  let mergeHead = null;

  for (;;) {
    if (elapsed() > TIMEOUT_S) {
      console.log(`ship-watch: TIMEOUT after ${elapsed()}s waiting on CI for PR #${PR}`);
      process.exit(1);
    }
    const { settled, failed, pending, total, head } = await checkState();

    if (failed.length) {
      console.log(`ship-watch: FAILED — ${failed.map((f) => f.name).join(', ')} (PR #${PR}, ${elapsed()}s). Read the log; do not retry blindly.`);
      process.exit(1);
    }

    if (settled && total > 0) {
      if (confirmedHead === head && elapsed() >= MIN_SETTLE_S) {
        mergeHead = head;
        break;
      }
      // First green sighting, or the head moved under us, or we are still inside the settle
      // window. Remember what we saw and look again rather than acting on it.
      if (confirmedHead && confirmedHead !== head) {
        console.log(`ship-watch: head moved ${confirmedHead.slice(0, 7)} -> ${String(head).slice(0, 7)}, re-waiting on CI`);
      }
      confirmedHead = head;
    } else {
      confirmedHead = null;
    }
    await sleep(POLL_MS);
  }

  if (!DO_MERGE) {
    console.log(`ship-watch: GREEN — PR #${PR} passed all checks in ${elapsed()}s. Not merging (VISIBLE change or --merge omitted).`);
    process.exit(0);
  }

  // Phase 2 — merge
  try {
    // --match-head-commit: if the head moved since the green we confirmed, GitHub refuses the
    // merge rather than landing a commit no check ever saw.
    await gh(['pr', 'merge', PR, '--squash', '--delete-branch', '--match-head-commit', mergeHead]);
  } catch (err) {
    console.log(`ship-watch: MERGE REFUSED for PR #${PR} — ${(err.stderr || err.message || '').trim().split('\n')[0]}`);
    process.exit(1);
  }

  // Phase 3 — live verification. Vercel builds after merge; give it room before curling.
  if (VERIFY.length) {
    await sleep(90_000);
    const results = [];
    for (const spec of VERIFY) {
      let r = await verifyUrl(spec);
      if (!r.ok) {
        await sleep(60_000);
        r = await verifyUrl(spec);
      }
      results.push(r);
    }
    const bad = results.filter((r) => !r.ok);
    const summary = results.map((r) => `${r.url}→${r.code || 'ERR'}`).join(' · ');
    if (bad.length) {
      console.log(`ship-watch: MERGED PR #${PR} but live check failed — ${summary} (${elapsed()}s)`);
      process.exit(1);
    }
    console.log(`ship-watch: LANDED PR #${PR} · live ${summary} · ${elapsed()}s`);
    process.exit(0);
  }

  console.log(`ship-watch: LANDED PR #${PR} in ${elapsed()}s (no --verify URLs given)`);
})();

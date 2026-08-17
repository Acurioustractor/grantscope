#!/usr/bin/env node
/**
 * One background watcher for a whole landing, so nobody babysits `gh pr checks --watch`.
 *
 * Phases: CI settles → merge (squash, delete branch) → optional live verification of URLs.
 * Prints ONE summary line and exits 0 on success, non-zero on anything that needs a human.
 *
 * Usage:
 *   node scripts/ship-watch.mjs --pr 123 [--merge] [--verify https://civicgraph.app/foo]
 *                               [--verify https://civicgraph.app/bar=200] [--timeout 1800]
 *
 *   --merge   squash-merge when every check passes. Omit for VISIBLE changes: the watcher then
 *             reports green and stops, leaving the merge to Ben after he has seen the preview.
 *   --verify  URL to curl after the deploy. `=CODE` asserts an exact status; otherwise any
 *             non-5xx counts as alive (an admin route legitimately answers 401/403/307).
 *
 * Never waits on advisory checks — only on what `gh pr checks` reports as pending. This repo has
 * no branch protection, so there is no required-check list to consult; every reported check is
 * treated as blocking, which is the conservative reading.
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
const TIMEOUT_S = Number(arg('timeout', '1800'));
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

/** `gh pr checks` exits non-zero when checks fail OR are pending, so read rows, not exit codes. */
async function checkState() {
  let raw = '';
  try {
    raw = await gh(['pr', 'checks', PR, '--json', 'name,state,link']);
  } catch (err) {
    raw = err.stdout || '';
    if (!raw) return { settled: false, failed: [], pending: ['(gh unavailable)'] };
  }
  let rows = [];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { settled: false, failed: [], pending: ['(unparseable)'] };
  }
  const pending = rows.filter((r) => ['PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED'].includes(r.state));
  const failed = rows.filter((r) => ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(r.state));
  return { settled: pending.length === 0, failed, pending, total: rows.length };
}

async function verifyUrl(spec) {
  const [url, expected] = spec.split('=');
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
  // Phase 1 — CI
  for (;;) {
    if (elapsed() > TIMEOUT_S) {
      console.log(`ship-watch: TIMEOUT after ${elapsed()}s waiting on CI for PR #${PR}`);
      process.exit(1);
    }
    const { settled, failed, pending, total } = await checkState();
    if (settled && total > 0) {
      if (failed.length) {
        console.log(`ship-watch: FAILED — ${failed.map((f) => f.name).join(', ')} (PR #${PR}, ${elapsed()}s). Read the log; do not retry blindly.`);
        process.exit(1);
      }
      break;
    }
    await sleep(POLL_MS);
  }

  if (!DO_MERGE) {
    console.log(`ship-watch: GREEN — PR #${PR} passed all checks in ${elapsed()}s. Not merging (VISIBLE change or --merge omitted).`);
    process.exit(0);
  }

  // Phase 2 — merge
  try {
    await gh(['pr', 'merge', PR, '--squash', '--delete-branch']);
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

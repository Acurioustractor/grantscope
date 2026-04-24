#!/usr/bin/env node

import { execSync, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_ROOT = path.join(ROOT, 'apps/web');
const args = new Set(process.argv.slice(2));

const FULL = args.has('--full');
const BRANCH_ONLY = args.has('--branch-only');
const FAIL_DIRTY = args.has('--fail-dirty');

const GENERATED_PATH_PATTERNS = [
  /^apps\/web\/\.next\.stale\./,
  /^apps\/web\/test-results\//,
  /^\.claude\/worktrees\//,
  /^logs\//,
  /^tmp\//,
];

function runShell(command, cwd = ROOT) {
  return execSync(command, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

function classifyStatusLine(line) {
  const code = line.slice(0, 2);
  const pathText = line.slice(3).trim();
  const filePath = pathText.includes(' -> ') ? pathText.split(' -> ').at(-1) : pathText;
  const generated = GENERATED_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
  return {
    code,
    filePath,
    generated,
    untracked: code === '??',
  };
}

function getGitHygiene() {
  const currentBranch = runShell('git branch --show-current');
  const mainSha = runShell('git rev-parse main');
  const originMainSha = runShell('git rev-parse origin/main');
  const statusOutput = runShell('git status --porcelain=v1 || true');
  const statusLines = statusOutput ? statusOutput.split('\n').filter(Boolean).map(classifyStatusLine) : [];

  const realChanges = statusLines.filter((line) => !line.generated);
  const generatedChanges = statusLines.filter((line) => line.generated);
  const realTracked = realChanges.filter((line) => !line.untracked);
  const realUntracked = realChanges.filter((line) => line.untracked);

  return {
    currentBranch,
    mainMatchesOrigin: mainSha === originMainSha,
    mainSha,
    originMainSha,
    realTrackedCount: realTracked.length,
    realUntrackedCount: realUntracked.length,
    generatedCount: generatedChanges.length,
    sampleRealPaths: realChanges.slice(0, 12).map((line) => `${line.code} ${line.filePath}`),
  };
}

function runCheck(label, command, cwd = ROOT) {
  console.log(`\n[run] ${label}`);
  const result = spawnSync('zsh', ['-lc', command], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return {
    label,
    ok: result.status === 0,
    status: result.status ?? 1,
  };
}

function printManualSmokeChecklist() {
  printSection('Manual Smoke');
  console.log('Open these routes in the local app after `pnpm dev`:');
  console.log('- http://127.0.0.1:3003/ops/health');
  console.log('  - Grant Semantics and Grant Source Identity both show zero active debt.');
  console.log('- http://127.0.0.1:3003/reports/data-health');
  console.log('  - The same semantics and source-identity counts match the ops health view.');
  console.log('- http://127.0.0.1:3003/mission-control');
  console.log('  - Agent registry loads and the analytics checks show recent successful runs.');
  console.log('- http://127.0.0.1:3003/ops');
  console.log('  - Ops summary loads without API errors and links through to health/report pages.');
}

const blockers = [];
const warnings = [];

printSection('Branch Hygiene');
const git = getGitHygiene();
console.log(`Current branch: ${git.currentBranch}`);
console.log(`Local main:     ${git.mainSha}`);
console.log(`Origin main:    ${git.originMainSha}`);

if (git.currentBranch === 'main') {
  blockers.push('Current branch is `main`. Use a work branch before closing out.');
}

if (!git.mainMatchesOrigin) {
  blockers.push('Local `main` does not match `origin/main`.');
}

if (git.realTrackedCount > 0 || git.realUntrackedCount > 0) {
  const message = `Worktree still has ${git.realTrackedCount} tracked and ${git.realUntrackedCount} untracked non-generated changes.`;
  if (FAIL_DIRTY) {
    blockers.push(message);
  } else {
    warnings.push(message);
  }
}

if (git.generatedCount > 0) {
  warnings.push(`${git.generatedCount} generated local artifacts are present but ignored by closeout hygiene.`);
}

if (git.sampleRealPaths.length > 0) {
  console.log('Sample non-generated changes:');
  for (const sample of git.sampleRealPaths) {
    console.log(`- ${sample}`);
  }
}

if (!BRANCH_ONLY) {
  const checks = [
    ['Web typecheck', 'npx tsc --noEmit', WEB_ROOT],
    ['Grant engine contract tests', 'pnpm --filter @grantscope/engine test:contracts', ROOT],
    ['Grant semantics health', 'node --env-file=.env scripts/check-grant-semantics-health.mjs --max-status-null=0 --max-application-status-null=0 --max-open-past-deadline=0', ROOT],
    ['Grant source identity health', 'node --env-file=.env scripts/check-grant-source-identity-health.mjs --max-blank-source-id=0 --max-canonical-mismatch=0', ROOT],
    ['Analytics pipeline health gate', 'node --env-file=.env scripts/pipeline-runner.mjs --once --skip=frontier,frontier-poll,foundation-frontier-poll,discovery,source-identity,state,deadlines,semantics,enrich,profile,foundation-discovery,foundation-relationships,sync,embed', ROOT],
  ];

  if (FULL) {
    checks.push(
      ['Data health report', 'node --env-file=.env scripts/health-check.mjs --data', ROOT],
      ['Agent health report', 'node --env-file=.env scripts/health-check.mjs --agents', ROOT],
    );
  }

  printSection('Automated Checks');
  const results = checks.map(([label, command, cwd]) => runCheck(label, command, cwd));
  for (const result of results) {
    if (!result.ok) {
      blockers.push(`${result.label} failed with exit code ${result.status}.`);
    }
  }
}

printSection('Closeout Result');
if (warnings.length === 0) {
  console.log('Warnings: none');
} else {
  for (const warning of warnings) {
    console.log(`- warning: ${warning}`);
  }
}

if (blockers.length === 0) {
  console.log('Status: READY FOR DRAFTING / SYSTEM USE');
  printManualSmokeChecklist();
  process.exit(0);
}

for (const blocker of blockers) {
  console.log(`- blocker: ${blocker}`);
}
console.log('Status: NOT READY');
process.exit(1);

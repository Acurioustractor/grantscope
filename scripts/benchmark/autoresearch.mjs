#!/usr/bin/env node
/**
 * autoresearch.mjs — Autonomous Research Loop Runner
 *
 * Implements Karpathy's autoresearch pattern:
 * Fixed evaluation harness + mutable resolver + AI-driven improvement loop
 *
 * Each iteration:
 * 1. Read current resolver code + last evaluation results
 * 2. Ask Claude to propose an improvement
 * 3. Write the new resolver
 * 4. Run evaluation
 * 5. If F1 improved → git commit. If worse → revert.
 *
 * Usage:
 *   node scripts/benchmark/autoresearch.mjs --task entity-resolution --budget 60
 *   node scripts/benchmark/autoresearch.mjs --task entity-resolution --iterations 5
 *   node scripts/benchmark/autoresearch.mjs --task entity-resolution --dry-run
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const RESULTS_DIR = join(DATA_DIR, 'results');
const LOG_FILE = join(RESULTS_DIR, 'autoresearch-log.jsonl');

const args = process.argv.slice(2);
const task = args.find(a => a.startsWith('--task='))?.split('=')[1] || 'entity-resolution';
const budgetMinutes = parseInt(args.find(a => a.startsWith('--budget='))?.split('=')[1] || '30');
const maxIterations = parseInt(args.find(a => a.startsWith('--iterations='))?.split('=')[1] || '100');
const dryRun = args.includes('--dry-run');

const TASK_DIR = join(__dirname, 'tasks', task);
const RESOLVER_PATH = join(TASK_DIR, 'resolve.mjs');
const PROGRAM_PATH = join(TASK_DIR, 'program.md');

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logIteration(entry) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

/** Run the evaluation harness and return metrics */
async function runEvaluation() {
  try {
    // Fork a child process to run evaluate.mjs with --save
    const output = execSync(
      `node ${join(__dirname, 'evaluate.mjs')} --task=${task} --save`,
      { cwd: __dirname, encoding: 'utf-8', timeout: 120_000, env: process.env }
    );
    console.log(output);

    // Read the latest results
    const latestPath = join(RESULTS_DIR, 'latest.json');
    if (existsSync(latestPath)) {
      return JSON.parse(readFileSync(latestPath, 'utf-8'));
    }
    return null;
  } catch (err) {
    log(`  Evaluation failed: ${err.message}`);
    return null;
  }
}

/** Get the last N results from the log */
function getRecentResults(n = 5) {
  if (!existsSync(LOG_FILE)) return [];
  const lines = readFileSync(LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  return lines.slice(-n).map(line => JSON.parse(line));
}

/** Read failure examples from latest results */
function getFailureExamples() {
  const latestPath = join(RESULTS_DIR, 'latest.json');
  if (!existsSync(latestPath)) return { falsePositives: [], falseNegatives: [] };
  const results = JSON.parse(readFileSync(latestPath, 'utf-8'));
  return {
    falsePositives: (results.topFalsePositives || []).slice(0, 10),
    falseNegatives: (results.topFalseNegatives || []).slice(0, 10),
  };
}

/** Ask Claude for an improved resolver via Anthropic API (direct fetch) */
async function proposeImprovement(currentCode, metrics, failures, recentHistory) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const programDoc = existsSync(PROGRAM_PATH) ? readFileSync(PROGRAM_PATH, 'utf-8') : '';

  const historyStr = recentHistory.length > 0
    ? recentHistory.map(h => `  Iteration ${h.iteration}: F1=${(h.f1 * 100).toFixed(1)}% (${h.status}) — ${h.description || 'no description'}`).join('\n')
    : '  (No previous iterations)';

  const fpStr = failures.falsePositives.length > 0
    ? failures.falsePositives.map(f =>
        `  "${f.donor_name}" → matched "${f.got_name}" (${f.got_abn}) but expected "${f.expected_name || 'no match'}" [${f.difficulty}]`
      ).join('\n')
    : '  (None)';

  const fnStr = failures.falseNegatives.length > 0
    ? failures.falseNegatives.map(f =>
        `  "${f.donor_name}" → no match, expected "${f.expected_name}" (${f.expected_abn}) [${f.difficulty}]`
      ).join('\n')
    : '  (None)';

  const prompt = `You are improving an entity resolution algorithm for matching Australian political donor names to entities in a database.

## Task Description
${programDoc}

## Current Code (resolve.mjs)
\`\`\`javascript
${currentCode}
\`\`\`

## Current Performance
- Precision: ${(metrics.precision * 100).toFixed(1)}%
- Recall: ${(metrics.recall * 100).toFixed(1)}%
- F1 Score: ${(metrics.f1 * 100).toFixed(1)}%
- Match Rate: ${(metrics.matchRate * 100).toFixed(1)}%

## Recent Iteration History
${historyStr}

## Current Failure Examples

False Positives (wrong matches):
${fpStr}

False Negatives (missed matches):
${fnStr}

## Instructions

Your goal is to IMPROVE the F1 score. Analyze the failure examples and propose a specific code change.

Rules:
1. The function signature \`resolve(donorName, entityIndex)\` MUST NOT change
2. The return type \`{ matched_abn, matched_name, confidence, method }\` or \`null\` MUST NOT change
3. The \`normalizeName\` export MUST remain (the evaluator uses it)
4. NO external API calls (no LLM, no HTTP) — must run fast
5. The entityIndex has: byExact (Map), byNormalized (Map), byAlias (Map)
6. Focus on one specific improvement per iteration — don't try to change everything

Think step by step:
1. What pattern in the failures can you exploit?
2. What specific change would fix the most failures?
3. Will this change introduce new false positives?

Output the COMPLETE new resolve.mjs file. Start your response with a brief description of what you changed and why (one sentence), then the full code in a \`\`\`javascript block.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const response = await res.json();
  const text = response.content[0].text;

  // Extract description (first line before code block)
  const descMatch = text.match(/^(.+?)(?:\n|```)/s);
  const description = descMatch ? descMatch[1].trim() : 'Unknown change';

  // Extract code block
  const codeMatch = text.match(/```javascript\n([\s\S]*?)```/);
  if (!codeMatch) {
    throw new Error('No JavaScript code block found in response');
  }

  return { code: codeMatch[1], description };
}

/** Git commit the resolver improvement */
function gitCommit(oldF1, newF1, description) {
  if (dryRun) {
    log(`  [dry-run] Would commit: F1 ${(oldF1 * 100).toFixed(1)} → ${(newF1 * 100).toFixed(1)}`);
    return;
  }
  try {
    execSync(`git add "${RESOLVER_PATH}"`, { cwd: dirname(RESOLVER_PATH) });
    const msg = `autoresearch: F1 ${(oldF1 * 100).toFixed(1)}% → ${(newF1 * 100).toFixed(1)}% — ${description}`;
    execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { cwd: dirname(RESOLVER_PATH) });
    log(`  Committed: ${msg}`);
  } catch (err) {
    log(`  Git commit failed: ${err.message}`);
  }
}

/** Revert resolver to previous version */
function revertResolver(backupCode) {
  writeFileSync(RESOLVER_PATH, backupCode);
  log(`  Reverted resolve.mjs`);
}

// ─── Main Loop ───

async function main() {
  log(`╔══════════════════════════════════════════════════╗`);
  log(`║  GrantScope Autoresearch Loop                   ║`);
  log(`║  Task: ${task.padEnd(41)}║`);
  log(`║  Budget: ${String(budgetMinutes).padEnd(3)} minutes / ${String(maxIterations).padEnd(3)} iterations       ║`);
  log(`╚══════════════════════════════════════════════════╝`);

  if (dryRun) log(`[DRY RUN MODE — no git commits]\n`);

  // Verify ground truth exists
  const gtFile = join(DATA_DIR, `${task}-ground-truth.jsonl`);
  if (!existsSync(gtFile)) {
    log(`Ground truth not found. Run: node scripts/benchmark/create-ground-truth.mjs`);
    process.exit(1);
  }

  // Run baseline evaluation
  log(`\n─── Baseline Evaluation ───`);
  const baseline = await runEvaluation();
  if (!baseline) {
    log('Baseline evaluation failed. Fix errors before running autoresearch.');
    process.exit(1);
  }

  let bestF1 = baseline.metrics.f1;
  log(`\nBaseline F1: ${(bestF1 * 100).toFixed(1)}%`);

  const startTime = Date.now();
  const budgetMs = budgetMinutes * 60 * 1000;
  let iteration = 0;
  let improvements = 0;
  let reverts = 0;

  while (iteration < maxIterations) {
    // Check budget
    const elapsed = Date.now() - startTime;
    if (elapsed > budgetMs) {
      log(`\nBudget exhausted (${budgetMinutes} minutes). Stopping.`);
      break;
    }

    iteration++;
    const remaining = Math.round((budgetMs - elapsed) / 60000);
    log(`\n─── Iteration ${iteration} (${remaining}min remaining) ───`);

    // Read current resolver
    const currentCode = readFileSync(RESOLVER_PATH, 'utf-8');
    const failures = getFailureExamples();
    const recentHistory = getRecentResults(5);

    // Propose improvement
    log(`  Asking Claude for improvement...`);
    let proposal;
    try {
      proposal = await proposeImprovement(currentCode, baseline.metrics, failures, recentHistory);
    } catch (err) {
      log(`  Proposal failed: ${err.message}`);
      logIteration({
        iteration, timestamp: new Date().toISOString(),
        status: 'error', description: `Proposal failed: ${err.message}`,
        f1: bestF1, precision: baseline.metrics.precision, recall: baseline.metrics.recall,
      });
      continue;
    }

    log(`  Proposal: ${proposal.description}`);

    // Write new resolver
    const backupCode = currentCode;
    writeFileSync(RESOLVER_PATH, proposal.code);

    // Evaluate
    log(`  Evaluating...`);
    const newResults = await runEvaluation();

    if (!newResults) {
      log(`  Evaluation failed (likely syntax error). Reverting.`);
      revertResolver(backupCode);
      reverts++;
      logIteration({
        iteration, timestamp: new Date().toISOString(),
        status: 'error', description: proposal.description,
        f1: bestF1, precision: baseline.metrics.precision, recall: baseline.metrics.recall,
      });
      continue;
    }

    const newF1 = newResults.metrics.f1;
    const delta = newF1 - bestF1;

    if (delta > 0) {
      // Improvement!
      log(`  ✓ F1 improved: ${(bestF1 * 100).toFixed(1)}% → ${(newF1 * 100).toFixed(1)}% (+${(delta * 100).toFixed(1)}%)`);
      gitCommit(bestF1, newF1, proposal.description);
      bestF1 = newF1;
      improvements++;

      logIteration({
        iteration, timestamp: new Date().toISOString(),
        status: 'improved', description: proposal.description,
        f1: newF1, precision: newResults.metrics.precision, recall: newResults.metrics.recall,
        delta: delta,
      });

      // Update metrics for next iteration
      baseline.metrics = newResults.metrics;
    } else {
      // No improvement — revert
      log(`  ✗ F1 ${delta === 0 ? 'unchanged' : 'decreased'}: ${(bestF1 * 100).toFixed(1)}% → ${(newF1 * 100).toFixed(1)}% (${(delta * 100).toFixed(1)}%)`);
      revertResolver(backupCode);
      reverts++;

      logIteration({
        iteration, timestamp: new Date().toISOString(),
        status: 'reverted', description: proposal.description,
        f1: bestF1, attempted_f1: newF1,
        precision: newResults.metrics.precision, recall: newResults.metrics.recall,
        delta: delta,
      });
    }
  }

  // ─── Summary ───
  const totalTime = Math.round((Date.now() - startTime) / 60000);
  log(`\n╔══════════════════════════════════════════════════╗`);
  log(`║  Autoresearch Complete                           ║`);
  log(`╠══════════════════════════════════════════════════╣`);
  log(`║  Iterations:    ${String(iteration).padStart(4)}                          ║`);
  log(`║  Improvements:  ${String(improvements).padStart(4)}                          ║`);
  log(`║  Reverts:       ${String(reverts).padStart(4)}                          ║`);
  log(`║  Final F1:      ${(bestF1 * 100).toFixed(1).padStart(5)}%                        ║`);
  log(`║  Time:          ${String(totalTime).padStart(4)} minutes                    ║`);
  log(`╚══════════════════════════════════════════════════╝`);
}

main().catch(err => {
  console.error('[autoresearch] Fatal:', err);
  process.exit(1);
});

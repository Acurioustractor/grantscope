#!/usr/bin/env node

import 'dotenv/config';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const RESULTS_DIR = join(DATA_DIR, 'results');
const STRATEGY_PATH = join(__dirname, 'strategy.mjs');
const PROGRAM_PATH = join(__dirname, 'program.md');
const LOG_PATH = join(RESULTS_DIR, 'autoresearch-log.jsonl');

const args = process.argv.slice(2);
const budgetMinutes = parseInt(args.find((arg) => arg.startsWith('--budget='))?.split('=')[1] || '30', 10);
const maxIterations = parseInt(args.find((arg) => arg.startsWith('--iterations='))?.split('=')[1] || '8', 10);
const dryRun = args.includes('--dry-run');

function log(message) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${message}`);
}

function runEvaluation() {
  execSync(`node ${join(__dirname, 'evaluate.mjs')} --save`, {
    cwd: __dirname,
    env: process.env,
    stdio: 'inherit',
    timeout: 180_000,
  });
  return JSON.parse(readFileSync(join(RESULTS_DIR, 'latest.json'), 'utf-8'));
}

function recentHistory(limit = 5) {
  if (!existsSync(LOG_PATH)) return [];
  return readFileSync(LOG_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .slice(-limit)
    .map((line) => JSON.parse(line));
}

function recordIteration(entry) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
}

async function proposeImprovement(currentCode, latest, history) {
  const program = readFileSync(PROGRAM_PATH, 'utf-8');
  const worstScenarios = latest.worstScenarios
    .map((scenario) => {
      const misses = scenario.misses.map((miss) => miss.name).join(' | ') || '(no misses logged)';
      const top = scenario.topResults.map((row) => row.name).join(' | ');
      return `- ${scenario.id} (${(scenario.metrics.overallScore * 100).toFixed(1)}%)
  title: ${scenario.title}
  top results: ${top}
  misses: ${misses}`;
    })
    .join('\n');

  const historyText = history.length
    ? history.map((row) => `- Iteration ${row.iteration}: ${(row.overallScore * 100).toFixed(1)}% (${row.status}) — ${row.description}`).join('\n')
    : '- No previous iterations';

  const prompt = `You are improving a funding-network ranking strategy for CivicGraph.

## Program
${program}

## Current Strategy
\`\`\`javascript
${currentCode}
\`\`\`

## Current Overall Score
${(latest.metrics.overallScore * 100).toFixed(1)}%

## Current Family Metrics
${Object.entries(latest.familyMetrics)
  .map(([family, metrics]) => `- ${family}: ${(metrics.overallScore * 100).toFixed(1)}%`)
  .join('\n')}

## Worst Scenarios
${worstScenarios}

## Recent History
${historyText}

## Rules
1. Only edit strategy.mjs behavior.
2. Do not change function names or exports.
3. Do not use external API calls or network calls.
4. Optimise for the evaluator's fixed metrics: precision@10, recall@10, justice exposure, actability, relationship utility.
5. Prefer one coherent improvement per iteration.

Return:
1. One sentence describing the improvement.
2. A full \`\`\`javascript block containing the entire new strategy.mjs file.`;

  let text = null;

  if (process.env.ANTHROPIC_API_KEY) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (response.ok) {
      const json = await response.json();
      text = json.content?.[0]?.text || null;
    } else {
      const errorText = await response.text();
      log(`Anthropic unavailable, falling back${process.env.OPENAI_API_KEY ? ' to OpenAI' : ''}: ${response.status}`);
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
      }
    }
  }

  if (!text) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('No usable LLM provider found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You improve ranking heuristics for a funding intelligence benchmark. Return one sentence plus a full ```javascript block with the complete strategy.mjs file.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
    }

    const json = await response.json();
    text = json.choices?.[0]?.message?.content || null;
  }

  if (!text) {
    throw new Error('LLM returned no content');
  }

  const description = text.split('\n')[0].trim();
  const match = text.match(/```javascript\n([\s\S]*?)```/);
  if (!match) throw new Error('No JavaScript block returned');

  return { description, code: match[1] };
}

function gitCommit(oldScore, newScore, description) {
  if (dryRun) {
    log(`[dry-run] Would commit ${(oldScore * 100).toFixed(1)}% → ${(newScore * 100).toFixed(1)}%`);
    return;
  }
  execSync(`git add "${STRATEGY_PATH}"`, { cwd: dirname(STRATEGY_PATH) });
  execSync(
    `git commit -m "funding-autoresearch: ${(oldScore * 100).toFixed(1)}% → ${(newScore * 100).toFixed(1)}% — ${description.replace(/"/g, '\\"')}"`,
    { cwd: dirname(STRATEGY_PATH), stdio: 'inherit' },
  );
}

async function main() {
  log('╔══════════════════════════════════════════════════╗');
  log('║  CivicGraph Funding Autoresearch                ║');
  log(`║  Budget: ${String(budgetMinutes).padEnd(3)} minutes / ${String(maxIterations).padEnd(3)} iterations        ║`);
  log('╚══════════════════════════════════════════════════╝');

  if (!existsSync(join(DATA_DIR, 'funding-benchmark.json'))) {
    log('Benchmark set missing. Run: node scripts/funding-autoresearch/build-benchmark-set.mjs');
    process.exit(1);
  }

  const baseline = runEvaluation();
  let bestScore = baseline.metrics.overallScore;
  const started = Date.now();

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    if (Date.now() - started > budgetMinutes * 60_000) {
      log('Budget exhausted. Stopping.');
      break;
    }

    log(`\n── Iteration ${iteration} ──`);
    const before = readFileSync(STRATEGY_PATH, 'utf-8');
    const history = recentHistory();
    const { description, code } = await proposeImprovement(before, JSON.parse(readFileSync(join(RESULTS_DIR, 'latest.json'), 'utf-8')), history);
    writeFileSync(STRATEGY_PATH, code);

    let next;
    try {
      next = runEvaluation();
    } catch (error) {
      writeFileSync(STRATEGY_PATH, before);
      recordIteration({
        iteration,
        status: 'reverted',
        description,
        reason: error.message,
        overallScore: bestScore,
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    if (next.metrics.overallScore > bestScore) {
      gitCommit(bestScore, next.metrics.overallScore, description);
      recordIteration({
        iteration,
        status: 'improved',
        description,
        overallScore: next.metrics.overallScore,
        timestamp: new Date().toISOString(),
      });
      bestScore = next.metrics.overallScore;
      log(`Improved: ${(bestScore * 100).toFixed(1)}%`);
    } else {
      writeFileSync(STRATEGY_PATH, before);
      recordIteration({
        iteration,
        status: 'reverted',
        description,
        overallScore: next.metrics.overallScore,
        timestamp: new Date().toISOString(),
      });
      log(`Reverted: ${(next.metrics.overallScore * 100).toFixed(1)}% did not beat ${(bestScore * 100).toFixed(1)}%`);
    }
  }
}

main().catch((error) => {
  console.error('[funding-autoresearch] Fatal:', error);
  process.exit(1);
});

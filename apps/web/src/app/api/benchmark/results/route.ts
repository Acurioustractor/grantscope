import { NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Benchmark Results API
 *
 * GET /api/benchmark/results?task=entity-resolution           → latest scores + history
 * GET /api/benchmark/results?task=entity-resolution&history=1 → include run history
 */

const BENCHMARK_DATA = join(process.cwd(), '..', '..', 'scripts', 'benchmark', 'data');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const task = searchParams.get('task') || 'entity-resolution';
  const includeHistory = searchParams.get('history') === '1';

  const resultsDir = join(BENCHMARK_DATA, 'results');

  // Latest results
  const latestPath = join(resultsDir, 'latest.json');
  if (!existsSync(latestPath)) {
    return NextResponse.json(
      { error: 'No benchmark results found. Run: node scripts/benchmark/evaluate.mjs --save' },
      { status: 404 }
    );
  }

  const latest = JSON.parse(readFileSync(latestPath, 'utf-8'));

  // Run history (all saved runs)
  let history: unknown[] = [];
  if (includeHistory && existsSync(resultsDir)) {
    const files = readdirSync(resultsDir)
      .filter(f => f.startsWith('run-') && f.endsWith('.json'))
      .sort();

    history = files.map(f => {
      const data = JSON.parse(readFileSync(join(resultsDir, f), 'utf-8'));
      return {
        file: f,
        timestamp: data.timestamp,
        metrics: data.metrics,
        counts: data.counts,
      };
    });
  }

  // Autoresearch log
  let autoresearchLog: unknown[] = [];
  const logPath = join(resultsDir, 'autoresearch-log.jsonl');
  if (existsSync(logPath)) {
    autoresearchLog = readFileSync(logPath, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  }

  return NextResponse.json({
    task,
    latest: {
      timestamp: latest.timestamp,
      metrics: latest.metrics,
      counts: latest.counts,
      calibration: latest.calibration,
    },
    failures: {
      falsePositives: (latest.topFalsePositives || []).slice(0, 20),
      falseNegatives: (latest.topFalseNegatives || []).slice(0, 20),
    },
    history: includeHistory ? history : undefined,
    autoresearch: autoresearchLog.length > 0 ? autoresearchLog : undefined,
  });
}

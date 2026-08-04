#!/usr/bin/env node

/**
 * ACT Bittensor research readiness report.
 *
 * Despite the legacy command name, this script never buys, stakes or transfers
 * tokens. It reports whether ACT has enough benchmark evidence to consider a
 * bounded testnet/community experiment.
 */

import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const RESULTS_DIR = join(process.cwd(), 'scripts/funding-autoresearch/data/results');

async function latestBenchmark() {
  const files = (await readdir(RESULTS_DIR))
    .filter((name) => /^run-\d+\.json$/.test(name))
    .sort((a, b) => Number(b.match(/\d+/)?.[0]) - Number(a.match(/\d+/)?.[0]));
  if (!files[0]) return null;
  return JSON.parse(await readFile(join(RESULTS_DIR, files[0]), 'utf8'));
}

async function researchState() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { initiative: null, reviewedSignals: 0 };
  const db = createClient(url, key);
  const [initiativeResult, reviewedResult] = await Promise.all([
    db.from('act_research_initiatives')
      .select('status, current_phase, budget_cap_aud, spend_to_date_aud, success_metrics')
      .eq('slug', 'community-opportunity-intelligence')
      .maybeSingle(),
    db.from('act_opportunity_benchmark_cases')
      .select('id', { count: 'exact', head: true })
      .eq('benchmark_version', 'act-opportunity-v1')
      .eq('review_status', 'confirmed'),
  ]);
  if (initiativeResult.error) throw new Error(`Research initiative query failed: ${initiativeResult.error.message}`);
  if (reviewedResult.error) throw new Error(`Observatory count failed: ${reviewedResult.error.message}`);
  const initiative = initiativeResult.data;
  const count = reviewedResult.count;
  return { initiative, reviewedSignals: count ?? 0 };
}

const benchmark = await latestBenchmark();
const state = await researchState();
const metrics = benchmark?.metrics ?? {};
const thresholds = state.initiative?.success_metrics ?? {};

const gates = [
  {
    gate: 'fixed_benchmark',
    passes: Boolean(benchmark?.benchmarkVersion && benchmark?.scenarioCount >= 50),
    actual: benchmark ? `${benchmark.benchmarkVersion} · ${benchmark.scenarioCount} cases` : 'missing',
    required: 'versioned benchmark with at least 50 cases',
  },
  {
    gate: 'precision',
    passes: Number(metrics.precisionAt10 ?? 0) >= Number(thresholds.precision_at_10_min ?? 0.8),
    actual: Number(metrics.precisionAt10 ?? 0),
    required: Number(thresholds.precision_at_10_min ?? 0.8),
  },
  {
    gate: 'reviewed_observatory_cases',
    passes: state.reviewedSignals >= 100,
    actual: state.reviewedSignals,
    required: 100,
  },
  {
    gate: 'community_benefit_evaluation',
    passes: false,
    actual: 'not yet independently reviewed',
    required: 'documented review with participating community representatives',
  },
  {
    gate: 'research_phase',
    passes: Number(state.initiative?.current_phase ?? 0) >= 4,
    actual: Number(state.initiative?.current_phase ?? 0),
    required: 4,
  },
  {
    gate: 'explicit_external_spend_approval',
    passes: false,
    actual: 'not approved',
    required: 'recorded human approval for a capped testnet/community experiment',
  },
];

const ready = gates.every((gate) => gate.passes);
console.log(JSON.stringify({
  purpose: 'Bittensor research readiness only; no token purchase, staking or transfer',
  ready,
  recommendation: ready
    ? 'A bounded testnet/community experiment may be proposed for human approval.'
    : 'Continue local benchmarking and community governance work. Do not spend on Bittensor yet.',
  gates,
}, null, 2));

if (!ready) process.exitCode = 2;

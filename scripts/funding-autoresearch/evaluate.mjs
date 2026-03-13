#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  deliveryTrust,
  foundationRelationshipUtility,
  grantActability,
  hasCommunitySignal,
  hasIndigenousSignal,
  hasRegionalSignal,
  overlapCount,
  stateMatches,
} from './lib/signals.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const RESULTS_DIR = join(DATA_DIR, 'results');
const BENCHMARK_PATH = join(DATA_DIR, 'funding-benchmark.json');

const args = process.argv.slice(2);
const save = args.includes('--save');
const verbose = args.includes('--verbose');

function log(message) {
  console.log(message);
}

function judgeGrantScenario(scenario, candidate) {
  let score = 0;
  score += overlapCount(scenario.target.themes, candidate.themes) * 5;
  score += overlapCount(scenario.target.beneficiaries, candidate.beneficiaries) * 2;
  score += stateMatches(scenario.target.states, candidate.states) * 3;
  score += grantActability(candidate) * 1.5;
  if (candidate.grantType === 'open_opportunity') score += 2;
  if (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) score += 3;
  if (scenario.target.preferCommunityControlled && hasCommunitySignal(candidate)) score += 2;
  return {
    score,
    actability: grantActability(candidate) / 4,
    relationshipUtility: candidate.foundationId ? 0.75 : 0.4,
    justiceSignal:
      (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) ||
      (scenario.target.preferCommunityControlled && hasCommunitySignal(candidate)) ||
      (scenario.target.preferRegional && hasRegionalSignal(candidate)),
  };
}

function judgeFoundationScenario(scenario, candidate) {
  let score = 0;
  score += overlapCount(scenario.target.themes, candidate.themes) * 5;
  score += overlapCount(scenario.target.beneficiaries, candidate.beneficiaries) * 3;
  score += stateMatches(scenario.target.states, candidate.states) * 3;
  score += foundationRelationshipUtility(candidate) * 2;
  if (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) score += 3;
  return {
    score,
    actability: (candidate.website ? 1 : 0) * 0.5 + (candidate.hasOpenPrograms ? 0.5 : 0),
    relationshipUtility: foundationRelationshipUtility(candidate) / 5,
    justiceSignal:
      (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) ||
      (scenario.target.preferCommunityControlled && hasCommunitySignal(candidate)),
  };
}

function judgeCharityScenario(scenario, candidate) {
  let score = 0;
  score += overlapCount(scenario.target.themes, candidate.purposes) * 5;
  score += overlapCount(scenario.target.beneficiaries, candidate.beneficiaries) * 3;
  score += stateMatches(scenario.target.states, candidate.states) * 2;
  score += deliveryTrust(candidate) * 1.5;
  if (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) score += 3;
  if (scenario.target.preferRegional && hasRegionalSignal(candidate)) score += 2;
  return {
    score,
    actability: deliveryTrust(candidate) / 5,
    relationshipUtility: candidate.website ? 0.75 : 0.25,
    justiceSignal:
      (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) ||
      (scenario.target.preferCommunityControlled && hasCommunitySignal(candidate)) ||
      (scenario.target.preferRegional && hasRegionalSignal(candidate)),
  };
}

function judgeSocialEnterpriseScenario(scenario, candidate) {
  let score = 0;
  score += overlapCount(scenario.target.themes, candidate.sectors) * 5;
  score += overlapCount(scenario.target.beneficiaries, candidate.beneficiaries) * 3;
  score += stateMatches(scenario.target.states, candidate.states) * 2;
  score += deliveryTrust(candidate) * 1.25;
  if (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) score += 4;
  return {
    score,
    actability: deliveryTrust(candidate) / 5,
    relationshipUtility: candidate.website ? 0.75 : 0.25,
    justiceSignal:
      (scenario.target.preferIndigenous && hasIndigenousSignal(candidate)) ||
      (scenario.target.preferCommunityControlled && hasCommunitySignal(candidate)),
  };
}

function judgePlaceScenario(scenario, candidate) {
  let score = 0;
  score += stateMatches(scenario.target.states, candidate.states) * 3;
  if (scenario.target.needFirst) score += 4;
  if (candidate.totalFunding === 0) score += 4;
  if (candidate.seifaDecile && candidate.seifaDecile <= 3) score += 4;
  if (hasRegionalSignal(candidate)) score += 3;
  if (candidate.entityCount && candidate.entityCount > 0) score += 2;
  return {
    score,
    actability: candidate.entityCount && candidate.entityCount > 0 ? 1 : 0.3,
    relationshipUtility: candidate.totalFunding === 0 ? 1 : 0.5,
    justiceSignal: hasRegionalSignal(candidate),
  };
}

function judgeScenarioCandidate(scenario, candidate) {
  if (scenario.family === 'grant_discovery') return judgeGrantScenario(scenario, candidate);
  if (scenario.family === 'foundation_discovery') return judgeFoundationScenario(scenario, candidate);
  if (scenario.family === 'charity_delivery_match') return judgeCharityScenario(scenario, candidate);
  if (scenario.family === 'social_enterprise_delivery_match') return judgeSocialEnterpriseScenario(scenario, candidate);
  return judgePlaceScenario(scenario, candidate);
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function dcg(scores) {
  return scores.reduce((sum, score, index) => sum + score / Math.log2(index + 2), 0);
}

async function main() {
  if (!existsSync(BENCHMARK_PATH)) {
    console.error(`[funding-eval] Benchmark set not found: ${BENCHMARK_PATH}`);
    console.error('[funding-eval] Run: node scripts/funding-autoresearch/build-benchmark-set.mjs');
    process.exit(1);
  }

  const benchmark = JSON.parse(readFileSync(BENCHMARK_PATH, 'utf-8'));
  const { rankScenario } = await import('./strategy.mjs');

  log(`\n╔══════════════════════════════════════════════════╗`);
  log(`║  CivicGraph Funding Benchmark                   ║`);
  log(`║  Scenarios: ${String(benchmark.scenarioCount).padEnd(35)}║`);
  log(`╚══════════════════════════════════════════════════╝\n`);

  const scenarioResults = [];
  for (const scenario of benchmark.scenarios) {
    const judgedPool = scenario.candidatePool.map((candidate) => ({
      ...candidate,
      judge: judgeScenarioCandidate(scenario, candidate),
    }));
    const ranked = rankScenario({ ...scenario, candidatePool: judgedPool });
    const top10 = ranked.slice(0, 10);
    const ideal = judgedPool
      .slice()
      .sort((a, b) => b.judge.score - a.judge.score || String(a.name || a.postcode).localeCompare(String(b.name || b.postcode)));
    const maxJudgeScore = Math.max(...judgedPool.map((candidate) => candidate.judge.score), 0);
    const relevanceThreshold = maxJudgeScore > 0 ? maxJudgeScore * 0.65 : 0;
    const positives = judgedPool.filter((candidate) => candidate.judge.score >= relevanceThreshold && candidate.judge.score > 0);
    const positiveIds = new Set(positives.map((candidate) => candidate.id));
    const eliteCount = Math.min(
      10,
      Math.max(5, Math.round(judgedPool.filter((candidate) => candidate.judge.score > 0).length * 0.2)),
    );
    const eliteThreshold = ideal
      .filter((candidate) => candidate.judge.score > 0)
      .slice(0, eliteCount)
      .at(-1)?.judge.score ?? 0;
    const eliteIds = new Set(
      ideal
        .filter((candidate) => candidate.judge.score >= eliteThreshold && candidate.judge.score > 0)
        .map((candidate) => candidate.id),
    );

    const precisionAt10 = top10.length
      ? top10.filter((candidate) => eliteIds.has(candidate.id)).length / top10.length
      : 0;
    const recallAt10 = eliteIds.size
      ? top10.filter((candidate) => eliteIds.has(candidate.id)).length / eliteIds.size
      : 0;
    const meanRelevance = top10.length && maxJudgeScore > 0
      ? average(top10.map((candidate) => clamp01(candidate.judge.score / maxJudgeScore)))
      : 0;
    const ndcgAt10 = (() => {
      if (!top10.length || maxJudgeScore <= 0) return 0;
      const actual = top10.map((candidate) => clamp01(candidate.judge.score / maxJudgeScore));
      const idealScores = ideal.slice(0, 10).map((candidate) => clamp01(candidate.judge.score / maxJudgeScore));
      const idealDcg = dcg(idealScores);
      return idealDcg > 0 ? dcg(actual) / idealDcg : 0;
    })();
    const justiceExposure = scenario.target.preferIndigenous || scenario.target.preferCommunityControlled || scenario.target.preferRegional
      ? average(top10.map((candidate) => (candidate.judge.justiceSignal ? 1 : 0)))
      : 1;
    const actability = top10.length ? average(top10.map((candidate) => candidate.judge.actability)) : 0;
    const relationshipUtility = top10.length ? average(top10.map((candidate) => candidate.judge.relationshipUtility)) : 0;
    const overallScore =
      precisionAt10 * 0.25 +
      recallAt10 * 0.15 +
      meanRelevance * 0.2 +
      ndcgAt10 * 0.15 +
      justiceExposure * 0.1 +
      actability * 0.075 +
      relationshipUtility * 0.075;

    scenarioResults.push({
      id: scenario.id,
      title: scenario.title,
      family: scenario.family,
      metrics: {
        precisionAt10,
        recallAt10,
        meanRelevance,
        ndcgAt10,
        justiceExposure,
        actability,
        relationshipUtility,
        overallScore,
      },
      topResults: top10.slice(0, 5).map((candidate) => ({
        id: candidate.id,
        kind: candidate.kind,
        name: candidate.name || candidate.postcode,
        judgeScore: candidate.judge.score,
        strategyScore: candidate.strategyScore,
      })),
      misses: positives
        .filter((candidate) => !top10.some((rankedCandidate) => rankedCandidate.id === candidate.id))
        .slice(0, 5)
        .map((candidate) => ({
          id: candidate.id,
          kind: candidate.kind,
          name: candidate.name || candidate.postcode,
          judgeScore: candidate.judge.score,
        })),
    });
  }

  const familyMetrics = {};
  for (const family of benchmark.families) {
    const rows = scenarioResults.filter((result) => result.family === family);
    familyMetrics[family] = {
      precisionAt10: average(rows.map((row) => row.metrics.precisionAt10)),
      recallAt10: average(rows.map((row) => row.metrics.recallAt10)),
      meanRelevance: average(rows.map((row) => row.metrics.meanRelevance)),
      ndcgAt10: average(rows.map((row) => row.metrics.ndcgAt10)),
      justiceExposure: average(rows.map((row) => row.metrics.justiceExposure)),
      actability: average(rows.map((row) => row.metrics.actability)),
      relationshipUtility: average(rows.map((row) => row.metrics.relationshipUtility)),
      overallScore: average(rows.map((row) => row.metrics.overallScore)),
    };
  }

  const latest = {
    timestamp: new Date().toISOString(),
    benchmarkVersion: benchmark.benchmarkVersion,
    scenarioCount: benchmark.scenarioCount,
    metrics: {
      precisionAt10: average(scenarioResults.map((row) => row.metrics.precisionAt10)),
      recallAt10: average(scenarioResults.map((row) => row.metrics.recallAt10)),
      meanRelevance: average(scenarioResults.map((row) => row.metrics.meanRelevance)),
      ndcgAt10: average(scenarioResults.map((row) => row.metrics.ndcgAt10)),
      justiceExposure: average(scenarioResults.map((row) => row.metrics.justiceExposure)),
      actability: average(scenarioResults.map((row) => row.metrics.actability)),
      relationshipUtility: average(scenarioResults.map((row) => row.metrics.relationshipUtility)),
      overallScore: average(scenarioResults.map((row) => row.metrics.overallScore)),
    },
    familyMetrics,
    worstScenarios: scenarioResults
      .slice()
      .sort((a, b) => a.metrics.overallScore - b.metrics.overallScore)
      .slice(0, 10),
    scenarioResults,
  };

  log(`┌──────────────────────────────────────┐`);
  log(`│    FUNDING NETWORK EVALUATION        │`);
  log(`├──────────────────────────────────────┤`);
  log(`│ Precision@10: ${(latest.metrics.precisionAt10 * 100).toFixed(1).padStart(6)}%           │`);
  log(`│ Recall@10:    ${(latest.metrics.recallAt10 * 100).toFixed(1).padStart(6)}%           │`);
  log(`│ Relevance:    ${(latest.metrics.meanRelevance * 100).toFixed(1).padStart(6)}%           │`);
  log(`│ NDCG@10:      ${(latest.metrics.ndcgAt10 * 100).toFixed(1).padStart(6)}%           │`);
  log(`│ Justice:      ${(latest.metrics.justiceExposure * 100).toFixed(1).padStart(6)}%           │`);
  log(`│ Actability:   ${(latest.metrics.actability * 100).toFixed(1).padStart(6)}%           │`);
  log(`│ Rel Utility:  ${(latest.metrics.relationshipUtility * 100).toFixed(1).padStart(6)}%           │`);
  log(`│ Overall:      ${(latest.metrics.overallScore * 100).toFixed(1).padStart(6)}%           │`);
  log(`└──────────────────────────────────────┘`);

  if (verbose) {
    for (const scenario of latest.worstScenarios) {
      log(`\n[worst] ${scenario.id} — ${(scenario.metrics.overallScore * 100).toFixed(1)}%`);
      log(`        ${scenario.title}`);
      if (scenario.misses.length > 0) {
        log(`        misses: ${scenario.misses.map((miss) => miss.name).join(' | ')}`);
      }
    }
  }

  if (save) {
    mkdirSync(RESULTS_DIR, { recursive: true });
    const runName = `run-${Date.now()}.json`;
    writeFileSync(join(RESULTS_DIR, runName), JSON.stringify(latest, null, 2));
    writeFileSync(join(RESULTS_DIR, 'latest.json'), JSON.stringify(latest, null, 2));
    log(`\nSaved results to ${join(RESULTS_DIR, runName)}`);
  }
}

main().catch((error) => {
  console.error('[funding-eval] Fatal:', error);
  process.exit(1);
});

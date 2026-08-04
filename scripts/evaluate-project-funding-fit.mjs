#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessProjectFundingFit, rankProjectFundingCandidates } from './lib/project-funding-fit.mjs';

const arg = (name, fallback) => process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;
const PROFILE_PATH = resolve(arg('--profile', 'scripts/funding-profiles/goods-on-country.json'));
const BENCHMARK_PATH = resolve(arg('--benchmark', 'scripts/fixtures/goods-funding-fit-benchmark.json'));
const VERBOSE = process.argv.includes('--verbose');

const profile = JSON.parse(await readFile(PROFILE_PATH, 'utf8'));
const benchmark = JSON.parse(await readFile(BENCHMARK_PATH, 'utf8'));

if (benchmark.profileVersion !== profile.profileVersion) {
  throw new Error(`Benchmark expects ${benchmark.profileVersion}, received ${profile.profileVersion}`);
}

const assessed = benchmark.cases.map((testCase) => {
  const fit = assessProjectFundingFit(profile, testCase.candidate, { asOf: profile.asOf });
  const predictedRelevant = fit.hardBlocks.length === 0 && fit.score >= 60;
  const predictedBlocked = fit.hardBlocks.length > 0;
  return { ...testCase, fit, predictedRelevant, predictedBlocked };
});

const ranked = rankProjectFundingCandidates(
  profile,
  benchmark.cases.map((testCase) => ({ id: testCase.id, ...testCase.candidate })),
  { asOf: profile.asOf },
);
const labelById = new Map(benchmark.cases.map((testCase) => [testCase.id, testCase]));
const topFive = ranked.filter((candidate) => candidate.fundingFit.hardBlocks.length === 0).slice(0, 5);

const truePositive = assessed.filter((row) => row.expectedRelevant && row.predictedRelevant).length;
const falsePositive = assessed.filter((row) => !row.expectedRelevant && row.predictedRelevant).length;
const falseNegative = assessed.filter((row) => row.expectedRelevant && !row.predictedRelevant).length;
const trueNegative = assessed.filter((row) => !row.expectedRelevant && !row.predictedRelevant).length;
const expectedNegative = assessed.filter((row) => !row.expectedRelevant).length;
const expectedBlocked = assessed.filter((row) => row.expectedBlocked).length;
const correctBlocked = assessed.filter((row) => row.expectedBlocked === row.predictedBlocked).length;
const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 0;
const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 0;
const precisionAt5 = topFive.length
  ? topFive.filter((candidate) => labelById.get(candidate.id)?.expectedRelevant).length / topFive.length
  : 0;
const falsePositiveRate = expectedNegative ? falsePositive / expectedNegative : 0;
const blockAccuracy = assessed.length ? correctBlocked / assessed.length : 0;
const operatingCoverageAt5 = topFive.some((candidate) => candidate.fundingFit.blockMatches.some((block) => block.id === 'running_cover'));

const blockReasonFailures = assessed.filter((row) => {
  if (!row.expectedBlockIncludes) return false;
  return !row.fit.hardBlocks.some((reason) => reason.includes(row.expectedBlockIncludes));
});

const result = {
  benchmarkVersion: benchmark.benchmarkVersion,
  profileVersion: profile.profileVersion,
  cases: assessed.length,
  confusion: { truePositive, falsePositive, falseNegative, trueNegative },
  metrics: {
    precisionAt5: Number(precisionAt5.toFixed(4)),
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    falsePositiveRate: Number(falsePositiveRate.toFixed(4)),
    blockAccuracy: Number(blockAccuracy.toFixed(4)),
    operatingCoverageAt5,
  },
  topFive: topFive.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    score: candidate.fundingFit.score,
    label: candidate.fundingFit.label,
    blocks: candidate.fundingFit.blockMatches.map((block) => block.id),
  })),
  failures: assessed
    .filter((row) => row.expectedRelevant !== row.predictedRelevant || row.expectedBlocked !== row.predictedBlocked)
    .map((row) => ({
      id: row.id,
      expectedRelevant: row.expectedRelevant,
      predictedRelevant: row.predictedRelevant,
      expectedBlocked: row.expectedBlocked,
      predictedBlocked: row.predictedBlocked,
      score: row.fit.score,
      hardBlocks: row.fit.hardBlocks,
    })),
  blockReasonFailures: blockReasonFailures.map((row) => ({
    id: row.id,
    expected: row.expectedBlockIncludes,
    actual: row.fit.hardBlocks,
  })),
};

console.log(JSON.stringify(result, null, 2));

if (VERBOSE) {
  for (const row of assessed) {
    console.log(`${row.predictedRelevant ? 'MATCH' : row.predictedBlocked ? 'BLOCK' : 'HOLD '} ${String(row.fit.score).padStart(3)} ${row.id} — ${row.fit.reason}`);
  }
}

const passes = precisionAt5 >= 0.8
  && falsePositiveRate <= 0.1
  && blockAccuracy >= 0.95
  && operatingCoverageAt5
  && result.failures.length === 0
  && blockReasonFailures.length === 0
  && expectedBlocked > 0;

if (!passes) process.exitCode = 1;


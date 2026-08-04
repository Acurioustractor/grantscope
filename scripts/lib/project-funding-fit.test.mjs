import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { assessProjectFundingFit, rankProjectFundingCandidates, selectCoveragePortfolio } from './project-funding-fit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const profile = JSON.parse(await readFile(join(here, '../funding-profiles/goods-on-country.json'), 'utf8'));
const benchmark = JSON.parse(await readFile(join(here, '../fixtures/goods-funding-fit-benchmark.json'), 'utf8'));

test('GOODS benchmark cases honour relevance and hard-block labels', () => {
  for (const testCase of benchmark.cases) {
    const fit = assessProjectFundingFit(profile, testCase.candidate, { asOf: profile.asOf });
    const relevant = fit.hardBlocks.length === 0 && fit.score >= 60;
    assert.equal(relevant, testCase.expectedRelevant, `${testCase.id}: ${fit.reason}`);
    assert.equal(fit.hardBlocks.length > 0, testCase.expectedBlocked, `${testCase.id}: ${fit.reason}`);
    if (testCase.expectedBlockIncludes) {
      assert.ok(
        fit.hardBlocks.some((reason) => reason.includes(testCase.expectedBlockIncludes)),
        `${testCase.id}: expected block containing ${testCase.expectedBlockIncludes}; got ${fit.hardBlocks.join(', ')}`,
      );
    }
  }
});

test('an explicit 51% Indigenous ownership gate blocks an otherwise strong match', () => {
  const testCase = benchmark.cases.find((row) => row.id === 'ownership-gate');
  const fit = assessProjectFundingFit(profile, testCase.candidate, { asOf: profile.asOf });
  assert.equal(fit.label, 'blocked');
  assert.equal(fit.score, 0);
  assert.ok(fit.hardBlocks.includes('Indigenous ownership/control is required'));
  assert.equal(fit.qbe.eligible, 'no');
});

test('the $5K–8K servicing block is the only sub-$25K exception', () => {
  const servicing = benchmark.cases.find((row) => row.id === 'servicing-small-grant-exception');
  const smallPilot = benchmark.cases.find((row) => row.id === 'small-non-servicing-grant');
  const servicingFit = assessProjectFundingFit(profile, servicing.candidate, { asOf: profile.asOf });
  const pilotFit = assessProjectFundingFit(profile, smallPilot.candidate, { asOf: profile.asOf });
  assert.equal(servicingFit.hardBlocks.length, 0);
  assert.ok(servicingFit.blockMatches.some((block) => block.id === 'servicing_and_scoping'));
  assert.ok(pilotFit.hardBlocks.some((reason) => reason.includes('maximum amount is below')));
});

test('QBE eligibility is yes only when all documented commitment fields are evidenced', () => {
  const operating = benchmark.cases.find((row) => row.id === 'operating-cost-foundation');
  const fit = assessProjectFundingFit(profile, operating.candidate, { asOf: profile.asOf });
  assert.equal(fit.qbe.eligible, 'yes');

  const incomplete = structuredClone(operating.candidate);
  incomplete.commitmentLetterFields = ['amount', 'instrument'];
  const incompleteFit = assessProjectFundingFit(profile, incomplete, { asOf: profile.asOf });
  assert.equal(incompleteFit.qbe.eligible, 'unclear');
});

test('coverage portfolio includes the scarce operating-cover block', () => {
  const ranked = rankProjectFundingCandidates(
    profile,
    benchmark.cases.map((row) => ({ id: row.id, ...row.candidate })),
    { asOf: profile.asOf },
  );
  const portfolio = selectCoveragePortfolio(profile, ranked, 5);
  assert.ok(portfolio.selected.some((candidate) => candidate.fundingFit.blockMatches.some((block) => block.id === 'running_cover')));
  assert.equal(portfolio.selected.some((candidate) => candidate.fundingFit.hardBlocks.length > 0), false);
});

test('live coverage mode excludes non-official and low-evidence discovery leads', () => {
  const base = benchmark.cases.find((row) => row.id === 'operating-cost-foundation').candidate;
  const ranked = rankProjectFundingCandidates(profile, [
    { id: 'official', ...base, officialSourceConfirmed: true, evidenceCompleteness: 80 },
    { id: 'aggregator', ...base, funderName: 'Different Funder', officialSourceConfirmed: false, evidenceCompleteness: 100 },
    { id: 'thin', ...base, funderName: 'Third Funder', officialSourceConfirmed: true, evidenceCompleteness: 20 },
  ], { asOf: profile.asOf });
  const portfolio = selectCoveragePortfolio(profile, ranked, 5, { requireOfficial: true, minEvidence: 40 });
  assert.deepEqual(portfolio.selected.map((candidate) => candidate.id), ['official']);
});

test('funder names do not masquerade as supported operating costs', () => {
  const fit = assessProjectFundingFit(profile, {
    name: 'Community Grant Program 2026',
    funderName: '.au Domain Administration Limited',
    description: 'Digital inclusion projects for rural, remote and First Nations communities.',
    opportunityKind: 'grant',
    instruments: ['grant'],
    eligibleOrgTypes: ['charity'],
    supportedCostTypes: [],
    amountMin: 50000,
    deadline: '2026-08-31',
    officialSourceConfirmed: true,
    evidenceCompleteness: 70,
  }, { asOf: profile.asOf });
  assert.equal(fit.blockMatches.some((block) => block.id === 'running_cover'), false);
  assert.ok(fit.score < 60);
});

test('verified specialised eligibility with no compatible type blocks both GOODS entities', () => {
  const fit = assessProjectFundingFit(profile, {
    name: 'Special Statutory Applicant Fund',
    funderName: 'Example Department',
    description: 'Funding for a specialised statutory body only.',
    opportunityKind: 'grant',
    instruments: ['grant'],
    eligibleOrgTypes: [],
    eligibilityKnown: true,
    amountMax: 100000,
    deadline: '2026-09-01',
    officialSourceConfirmed: true,
    evidenceCompleteness: 80,
  }, { asOf: profile.asOf });
  assert.ok(fit.hardBlocks.includes('no eligible GOODS entity or instrument path'));
});

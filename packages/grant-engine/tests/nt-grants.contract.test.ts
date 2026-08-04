import assert from 'node:assert/strict';
import test from 'node:test';
import { mapGrantsNTResult } from '../src/sources/nt-grants';

test('maps an open GrantsNT API result with authoritative evidence', () => {
  const grant = mapGrantsNTResult({
    publicContentId: 1138,
    title: ' Gender Equity and Diversity Grants ',
    applicationsOpen: '2026-07-31T14:30:00Z',
    applicationsClose: '2026-08-31T14:29:00Z',
    slug: '2026-27-round-one',
    grantRoundSlug: '2026-27-round-one',
    agency: 'Department of People, Sport and Culture',
    isIndividualEligible: true,
    isOrganisationEligible: true,
    showGlobalMaxFunding: true,
    globalFundingMax: 10000,
    overviewHtml: '<p>Support for <strong>regional and remote</strong> NT communities.</p>',
    categories: ['Community', 'Health and Wellbeing'],
  }, new Date('2026-08-03T00:00:00Z'));

  assert.equal(grant.title, 'Gender Equity and Diversity Grants');
  assert.equal(grant.provider, 'Department of People, Sport and Culture');
  assert.equal(grant.sourceUrl, 'https://grantsnt.nt.gov.au/grants/2026-27-round-one');
  assert.deepEqual(grant.amount, { max: 10000 });
  assert.equal(grant.deadline, '2026-08-31T14:29:00Z');
  assert.equal(grant.applicationStatus, 'open');
  assert.equal(grant.description, 'Support for regional and remote NT communities.');
  assert.ok(grant.categories?.includes('community'));
  assert.deepEqual(grant.geography, ['AU-NT']);
});

test('derives upcoming and closed state from GrantsNT round dates', () => {
  const base = {
    publicContentId: 1,
    title: 'Test round',
    applicationsOpen: '2026-09-01T00:00:00Z',
    applicationsClose: '2026-09-30T00:00:00Z',
    slug: 'test-round',
    grantRoundSlug: 'test-round',
    agency: 'Northern Territory Government',
    isIndividualEligible: false,
    isOrganisationEligible: true,
    showGlobalMaxFunding: false,
    globalFundingMax: null,
    overviewHtml: null,
    categories: [],
  };

  assert.equal(mapGrantsNTResult(base, new Date('2026-08-03T00:00:00Z')).applicationStatus, 'upcoming');
  assert.equal(mapGrantsNTResult(base, new Date('2026-10-01T00:00:00Z')).applicationStatus, 'closed');
});

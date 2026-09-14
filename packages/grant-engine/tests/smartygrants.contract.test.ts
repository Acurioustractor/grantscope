import assert from 'node:assert/strict';
import test from 'node:test';
import { mapSmartyGrantsRound, parseCloseDate, parseRoundSlugs } from '../src/sources/smartygrants';

const round = (title: string, body: string) => `<html><head><title>
  2026-27 ${title} - City of Perth</title><script>var close = 1;</script></head><body>
  <p>Not logged in. Log in</p><h2>Current Rounds</h2><h3>${title}</h3>
  <a href="/x/start">Start a submission</a> Preview the form Download preview form
  <p>${body}</p></body></html>`;

test('maps an open round with its close date, funder and amount', () => {
  const g = mapSmartyGrantsRound('perth', 'HCG2627', round(
    'Heritage Conservation Grant 2026/27',
    'Submissions are now being accepted. Submissions close at 4:00pm 16 November 2026 (AWST). IMPORTANT: Please read the information below. Grants of up to $20,000 for heritage places.',
  ), new Date('2026-09-14T00:00:00Z'));

  assert.ok(g);
  assert.equal(g.title, 'Heritage Conservation Grant 2026/27');
  assert.equal(g.provider, 'City of Perth');
  assert.equal(g.sourceUrl, 'https://perth.smartygrants.com.au/HCG2627');
  assert.equal(g.deadline, '2026-11-16');
  assert.equal(g.applicationStatus, 'open');
  assert.deepEqual(g.amount, { max: 20000 });
  assert.ok(g.categories?.includes('arts'));
  assert.equal(g.sourceId, 'smartygrants');
});

test('a past close date is closed even if the page still says accepting', () => {
  const g = mapSmartyGrantsRound('perth', 'OLD', round('Old Grant', 'Submissions are now being accepted. Submissions close at midnight (end of day) 30 June 2026 (AEST).'), new Date('2026-09-14T00:00:00Z'));
  assert.equal(g?.applicationStatus, 'closed');
});

test('rolling rounds with no close date stay open with no deadline', () => {
  const g = mapSmartyGrantsRound('geelong', 'SIAG', round('2026 SIAG Access Enabler Payments', 'Submissions are now being accepted. IMPORTANT: Please read.'), new Date('2026-09-14T00:00:00Z'));
  assert.equal(g?.deadline, undefined);
  assert.equal(g?.applicationStatus, 'open');
});

test('admin rounds (acquittals, registers) are not grants', () => {
  assert.equal(mapSmartyGrantsRound('hume', 'ACQ', round('Community Grants Acquittal 2025-26', 'Submissions are now being accepted.')), null);
  assert.equal(mapSmartyGrantsRound('artstasmania', 'expert_register', round('Cultural and Creative Industries Expert Register', 'Submissions are now being accepted.')), null);
});

test('parses close dates in both SmartyGrants phrasings', () => {
  assert.equal(parseCloseDate('Submissions close at 5:00pm 30 November 2026 (AEDT).'), '2026-11-30');
  assert.equal(parseCloseDate('Submissions close at midnight (end of day) 3 April 2027 (AEST).'), '2027-04-03');
});

test('lists round slugs from a tenant home page, skipping system links', () => {
  const home = '<a href="/CPG2627">x</a><a href="/SG2627">y</a><a href="/applicant">a</a><a href="#main-content">m</a><a href="/CPG2627">dup</a>';
  assert.deepEqual(parseRoundSlugs(home), ['CPG2627', 'SG2627']);
});

test('a round that has not opened yet is upcoming, and the notice stays out of the title', () => {
  const html = '<title>Connected Campbelltown Community Grants 2026-2027 - Campbelltown City Council</title><body>Current Rounds Connected Campbelltown Community Grants 2026-2027 This round will open at 8:00am 18 September 2026 (AEST) for submissions. IMPORTANT: Please read.</body>';
  const g = mapSmartyGrantsRound('campbelltownnsw', 'ConnectedCampbelltown', html, new Date('2026-09-14T00:00:00Z'));
  assert.equal(g?.title, 'Connected Campbelltown Community Grants 2026-2027');
  assert.equal(g?.applicationStatus, 'upcoming');
});

/**
 * Tests for the per-project fit scorers.
 * Run: node --test scripts/lib/project-relevance.test.mjs
 *
 * Locks the reason this file exists: opportunity-intelligence.ts's PROJECT_LENSES
 * bare-substring keywords ('data', 'land', 'tour', 'story') tag unrelated grants.
 * These scorers require a specific TIER_1 phrase before a lone thematic word can tag.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreGrantForProject, scoreGrantForAllProjects, applyProjectTags, PROJECT_CODES, PROJECT_TAG_THRESHOLD } from './project-relevance.mjs';

test('a real youth justice diversion grant scores at/above threshold for justicehub', () => {
  const { score, signals } = scoreGrantForProject('justicehub', {
    name: 'Youth Justice Diversion Program Grants',
    provider: 'NSW Department of Communities and Justice',
    description: 'Funding for restorative justice and youth mentoring programs to reduce recidivism.',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD, `expected >= ${PROJECT_TAG_THRESHOLD}, got ${score}`);
  assert.ok(signals.tier1_hits.length > 0);
});

test('a generic "justice" mention without shape does not tag justicehub', () => {
  const { score } = scoreGrantForProject('justicehub', {
    name: 'Access to Justice Legal Aid Fund',
    provider: 'Attorney-General\'s Department',
    description: 'General legal aid funding for community legal centres.',
  });
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a bushfire land-recovery grant does not tag farm despite the word "land"', () => {
  const { score, signals } = scoreGrantForProject('farm', {
    name: 'Bushfire-Affected Land Recovery Fund',
    provider: 'NSW Government',
    description: 'Grants to landholders to recover fencing and farm infrastructure after bushfires.',
  });
  assert.equal(signals.tier1_hits.length, 0);
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a regenerative agriculture / landcare grant tags farm', () => {
  const { score } = scoreGrantForProject('farm', {
    name: 'Landcare Regenerative Agriculture Grants',
    provider: 'Queensland Government',
    description: 'Supporting regenerative farming and soil health projects on Queensland farms.',
    geography: 'AU-QLD',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD, `expected >= ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('"wind farm" infrastructure grant is disqualified from farm', () => {
  const { score, signals } = scoreGrantForProject('farm', {
    name: 'Regional Wind Farm Community Benefit Fund',
    provider: 'Clean Energy Council',
    description: 'Community benefit payments from wind farm developments, land access agreements.',
  });
  assert.ok(signals.disqualifier_hits.includes('wind farm'));
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a study/sports tour grant does not tag contained despite the word "tour"', () => {
  const { score, signals } = scoreGrantForProject('contained', {
    name: 'Regional Sports Tour Travel Grants',
    provider: 'Sport Australia',
    description: 'Support for junior sports teams to tour regional competitions.',
  });
  assert.equal(signals.tier1_hits.length, 0);
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a touring shipping-container exhibition grant tags contained', () => {
  const { score } = scoreGrantForProject('contained', {
    name: 'Immersive Touring Exhibition Fund',
    provider: 'Australia Council for the Arts',
    description: 'Support for a shipping container exhibition touring regional galleries.',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD, `expected >= ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a data-analytics grant does not falsely tag empathy-ledger via "ledger"', () => {
  const { score, signals } = scoreGrantForProject('empathy-ledger', {
    name: 'Small Business Accounting Software Grant',
    provider: 'Department of Industry',
    description: 'Grants to upgrade general ledger and bookkeeping software.',
  });
  assert.ok(signals.disqualifier_hits.includes('general ledger'));
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('an indigenous data sovereignty storytelling grant tags empathy-ledger', () => {
  const { score } = scoreGrantForProject('empathy-ledger', {
    name: 'Indigenous Data Sovereignty and Digital Storytelling Grant',
    provider: 'Lowitja Institute',
    description: 'Supporting community-led digital storytelling and consent-based data platforms.',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD);
});

test('a wine/grape harvest festival grant does not tag harvest', () => {
  const { score, signals } = scoreGrantForProject('harvest', {
    name: 'Regional Wine Harvest Festival Grant',
    provider: 'Tourism Victoria',
    description: 'Funding for the annual grape harvest festival celebrations.',
  });
  assert.ok(signals.disqualifier_hits.length > 0);
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a community food security garden grant tags harvest', () => {
  const { score } = scoreGrantForProject('harvest', {
    name: 'Community Food Security and Garden Grants',
    provider: 'Queensland Government',
    description: 'Grants for community gardens and food rescue programs to improve food security.',
    geography: 'AU-QLD',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD);
});

test('closed grants score lower than the same grant open', () => {
  const grant = {
    name: 'Youth Justice Diversion Program Grants',
    description: 'Restorative justice and youth mentoring.',
  };
  const open = scoreGrantForProject('justicehub', grant);
  const closed = scoreGrantForProject('justicehub', { ...grant, closes_at: '2020-01-01' });
  assert.ok(closed.score < open.score);
});

test('scoreGrantForAllProjects returns only projects at/above threshold, highest first', () => {
  const results = scoreGrantForAllProjects({
    name: 'Youth Justice Restorative Diversion Fund',
    description: 'Restorative justice diversion program for young people.',
  });
  assert.ok(results.length >= 1);
  assert.equal(results[0].project, 'justicehub');
  for (let i = 1; i < results.length; i++) assert.ok(results[i - 1].score >= results[i].score);
});

test('ACT Government shared round description does not falsely tag an unrelated sibling grant', () => {
  // Real row, verified 2026-09-14: one boilerplate description lists every category the round
  // covers ("...Child protection and youth justice...Support for veterans and their families...").
  const { score, signals } = scoreGrantForProject('justicehub', {
    name: 'Support for veterans and their families',
    provider: 'ACT Government',
    source: 'ACT Government',
    description: 'Aboriginal and Torres Strait Islander peoples Child protection and youth justice Community service providers Domestic, family and sexual violence Families Gambling harm Honours and awards LGBTIQA+ communities Multicultural communities Older Canberrans People with disability Support for veterans and their families Women Youth',
  });
  assert.equal(signals.tier1_hits.length, 0);
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a genuine ACT Government justice grant still tags via its name', () => {
  const { score } = scoreGrantForProject('justicehub', {
    name: 'Youth Justice Restorative Program Grants',
    provider: 'ACT Government',
    source: 'ACT Government',
    description: 'Aboriginal and Torres Strait Islander peoples Child protection and youth justice Gambling harm Older Canberrans Women Youth',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD);
});

test('unknown project throws', () => {
  assert.throws(() => scoreGrantForProject('not-a-project', {}));
});

test('applyProjectTags tags a fresh high-scoring justicehub grant and logs the add', () => {
  const row = { aligned_projects: [], project_relevance: {} };
  const results = { justicehub: { score: 60, signals: { tier1_hits: ['youth justice'] } } };
  const { tagged, changes, relevance } = applyProjectTags(row, results, '2026-09-14T00:00:00Z');
  assert.ok(tagged.includes(PROJECT_CODES.justicehub));
  assert.equal(changes.justicehub.change, 'added');
  assert.equal(relevance.justicehub.score, 60);
});

test('applyProjectTags untags a project whose score dropped below threshold on rescore', () => {
  const row = { aligned_projects: [PROJECT_CODES.farm], project_relevance: { farm: { score: 55 } } };
  const results = { farm: { score: 10, signals: {} } };
  const { tagged, changes } = applyProjectTags(row, results, '2026-09-14T00:00:00Z');
  assert.ok(!tagged.includes(PROJECT_CODES.farm));
  assert.equal(changes.farm.change, 'removed');
  assert.equal(changes.farm.previous_score, 55);
});

test('applyProjectTags leaves unrelated tags (e.g. ACT-GD) alone', () => {
  const row = { aligned_projects: ['ACT-GD'], project_relevance: {} };
  const results = { harvest: { score: 5, signals: {} } };
  const { tagged } = applyProjectTags(row, results);
  assert.deepEqual(tagged, ['ACT-GD']);
});

test('applyProjectTags is a no-op (no changes) when nothing crosses the threshold either way', () => {
  const row = { aligned_projects: [], project_relevance: {} };
  const results = { farm: { score: 10, signals: {} }, harvest: { score: 5, signals: {} } };
  const { tagged, changes } = applyProjectTags(row, results);
  assert.deepEqual(tagged, []);
  assert.deepEqual(changes, {});
});

// ── Regression cases from the 2026-09-21 JEV sweep of the rejected pool ──────
// Each of these was a REAL open grant the keyword scorer threw away. The stored
// scores at the time are in the comments; all five now clear the threshold.
// Do not delete a keyword these depend on without replacing the coverage.

test('youth-crime rounds reach the JusticeHub threshold (was 2/30)', () => {
  // NSW Premier's Department, $5M each, close 2026-11-30. The description is
  // procurement boilerplate with no justice vocabulary, so the NAME is the only signal.
  for (const town of ['Kempsey', 'Tamworth']) {
    const { score, signals } = scoreGrantForProject('justicehub', {
      name: `Strengthening Efforts to Reduce Youth Crime - ${town}`,
      source: "NSW Government — Premier's Department",
      description: 'Funding will be allocated through a structured assessment process. Local stakeholders will identify, develop and prioritise projects that respond to community need, build on existing services and improve outcomes for young people.',
    });
    assert.ok(score >= PROJECT_TAG_THRESHOLD, `${town} scored ${score}`);
    assert.ok(signals.tier1_hits.includes('youth crime'));
  }
});

test('"Bail and Remand Support" reaches the JusticeHub threshold (was 8/30)', () => {
  // 'bail support' was already tier1 but never matched: these are substring tests,
  // and "Bail and Remand Support" does not contain "bail support".
  const { score, signals } = scoreGrantForProject('justicehub', {
    name: 'Aboriginal Justice Agreement Bail and Remand Support Program - Grants RFA 003/25-26',
    source: 'Victorian Government',
    description: 'The Aboriginal Justice Agreement (AJA) Bail and Remand Support Grants Program will support Aboriginal community organisations.',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD, `scored ${score}`);
  assert.ok(signals.tier1_hits.includes('bail and remand'));
});

test('touring-exhibition funds reach the Contained threshold (were 0 and 2 of 30)', () => {
  const touring = scoreGrantForProject('contained', {
    name: '2026 Regional Arts Touring Round 2',
    source: 'NSW Government — Create NSW',
    description: 'This grant round is open to individual artists, arts and cultural workers, groups and organisations who are touring arts and cultural work across regional NSW.',
  });
  assert.ok(touring.score >= PROJECT_TAG_THRESHOLD, `Regional Arts Touring scored ${touring.score}`);

  const visions = scoreGrantForProject('contained', {
    name: 'Visions of Australia - Round 23',
    source: 'grantconnect',
    description: 'The Visions of Australia Program provides funding to support the development and touring of quality exhibitions around Australia.',
  });
  assert.ok(visions.score >= PROJECT_TAG_THRESHOLD, `Visions scored ${visions.score}`);
});

test('adding "touring" to Contained tier2 does not let tour false-friends through', () => {
  // The whole reason 'touring' is tier2 and not tier1: the disqualifiers must still bite.
  for (const name of ['Concert Tour Support Fund', 'Regional Sports Tour Grant', 'Study Tour Scholarship']) {
    const { score } = scoreGrantForProject('contained', { name, description: 'Support for touring.' });
    assert.ok(score < PROJECT_TAG_THRESHOLD, `${name} scored ${score}`);
  }
});

test('a council grant in the home LGA is still NOT a thematic match', () => {
  // SCC Major Grants (Sunshine Coast Council, Harvest and Farm's only LGA) scores 0.
  // That is CORRECT for a theme scorer — it is a geography signal, and forcing it
  // through tier1 would defeat the `shaped` gate. Recorded so nobody "fixes" it here.
  const { score } = scoreGrantForProject('harvest', {
    name: 'SCC Major Grants',
    description: "The Sunshine Coast Council's Major Grants program supports not-for-profit organisations in Australia to deliver one-off projects, events, and activities that provide broad community benefit.",
  });
  assert.ok(score < PROJECT_TAG_THRESHOLD, `scored ${score}`);
});
